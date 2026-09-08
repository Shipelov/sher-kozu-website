import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot, type Root } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { getLoginUrl, navigateToLogin } from "./const";
import { TelegramProvider } from "./contexts/TelegramContext";
import "./index.css";

/**
 * Telegram Mini App token store.
 * Set by TelegramContext after successful auth, read by tRPC link.
 */
let _tgMiniAppToken: string | null = null;
export function setTgMiniAppToken(token: string | null) {
  _tgMiniAppToken = token;
}
export function getTgMiniAppToken() {
  return _tgMiniAppToken;
}

/** Detect if we're inside Telegram WebView */
const isTelegramMiniApp = !!(window as any).Telegram?.WebApp?.initData;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Большинство данных (каталог, профили, CMS) меняется редко: 30 с без
      // повторных запросов при перемонтировании и без refetch на фокус окна.
      // Запросам, которым нужна свежесть (чат, уведомления, live-статусы АРМ),
      // staleTime/refetchInterval задаются точечно в месте useQuery.
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 1,
      gcTime: 5 * 60_000,
    },
  },
});
let hasScheduledUnauthorizedRedirect = false;

const redirectToLoginIfUnauthorized = (error: unknown) => {
  // Don't redirect inside Telegram Mini App
  if (isTelegramMiniApp) return;

  // Don't redirect farm worker pages — they use separate auth (farm_session cookie)
  if (typeof window !== "undefined" && window.location.pathname.startsWith("/farm")) return;

  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.data?.code === "UNAUTHORIZED"
    || error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized || hasScheduledUnauthorizedRedirect) return;

  hasScheduledUnauthorizedRedirect = true;
  navigateToLogin();
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    // Skip analytics mutations — they are best-effort and should not pollute the console
    const mutationKey = (event.mutation.options.mutationKey as string[] | undefined);
    const isAnalytics = mutationKey?.some(k => typeof k === 'string' && k.startsWith('analytics.'));
    if (isAnalytics) return;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Mutation Error]", error);
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      fetch(input, init) {
        const headers = new Headers((init as any)?.headers);

        // Inject Telegram Mini App token if available
        const tgToken = getTgMiniAppToken();
        if (tgToken) {
          headers.set("Authorization", `Bearer ${tgToken}`);
        }

        return globalThis.fetch(input, {
          ...(init ?? {}),
          headers,
          credentials: "include",
        });
      },
    }),
  ],
});

const appTree = (
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <TelegramProvider>
        <App />
      </TelegramProvider>
    </QueryClientProvider>
  </trpc.Provider>
);

/**
 * HMR-safe root management.
 * Cache the React root on the container element so that Vite HMR
 * re-executes this module without calling createRoot() twice on the
 * same DOM node — which triggers the "container already passed to
 * createRoot" warning and cascading removeChild errors.
 */
const container = document.getElementById("root")!;
const existingRoot = (container as any).__reactRoot as Root | undefined;

if (existingRoot) {
  // HMR reload — reuse the existing root
  existingRoot.render(appTree);
} else {
  // First mount
  const root = createRoot(container);
  (container as any).__reactRoot = root;
  root.render(appTree);
}
