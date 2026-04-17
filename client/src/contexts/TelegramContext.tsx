/**
 * Telegram Mini App context — provides auth state and Telegram WebApp SDK access.
 * Only active when running inside Telegram WebView on /tg/* routes.
 * Dynamically loads the Telegram WebApp SDK to avoid DOM conflicts on regular pages.
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { setTgMiniAppToken } from "@/main";

// Telegram WebApp types (subset)
interface TelegramWebApp {
  initData: string;
  initDataUnsafe: {
    user?: {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
      photo_url?: string;
      language_code?: string;
    };
    start_param?: string;
  };
  version: string;
  platform: string;
  colorScheme: "light" | "dark";
  themeParams: Record<string, string>;
  isExpanded: boolean;
  viewportHeight: number;
  viewportStableHeight: number;
  ready: () => void;
  expand: () => void;
  close: () => void;
  BackButton: {
    isVisible: boolean;
    show: () => void;
    hide: () => void;
    onClick: (cb: () => void) => void;
    offClick: (cb: () => void) => void;
  };
  MainButton: {
    text: string;
    color: string;
    textColor: string;
    isVisible: boolean;
    isActive: boolean;
    isProgressVisible: boolean;
    setText: (text: string) => void;
    show: () => void;
    hide: () => void;
    enable: () => void;
    disable: () => void;
    showProgress: (leaveActive?: boolean) => void;
    hideProgress: () => void;
    onClick: (cb: () => void) => void;
    offClick: (cb: () => void) => void;
  };
  HapticFeedback: {
    impactOccurred: (style: "light" | "medium" | "heavy" | "rigid" | "soft") => void;
    notificationOccurred: (type: "error" | "success" | "warning") => void;
    selectionChanged: () => void;
  };
  setHeaderColor: (color: string) => void;
  setBackgroundColor: (color: string) => void;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp;
    };
  }
}

interface TgUser {
  id: number;
  name: string;
  role: string;
  avatarUrl: string | null;
}

interface TelegramContextValue {
  /** Whether we're running inside Telegram WebView */
  isTelegram: boolean;
  /** The Telegram WebApp SDK instance */
  webApp: TelegramWebApp | null;
  /** Auth token for tRPC calls */
  token: string | null;
  /** Authenticated user */
  user: TgUser | null;
  /** Loading state */
  loading: boolean;
  /** Error message if auth failed */
  error: string | null;
  /** Whether user is authenticated */
  isAuthenticated: boolean;
}

const TelegramContext = createContext<TelegramContextValue>({
  isTelegram: false,
  webApp: null,
  token: null,
  user: null,
  loading: true,
  error: null,
  isAuthenticated: false,
});

export function useTelegram() {
  return useContext(TelegramContext);
}

/**
 * Dynamically loads the Telegram WebApp SDK script.
 * Tries direct telegram.org first, falls back to Cloudflare Worker proxy
 * for users in regions where telegram.org is blocked.
 */
function loadTelegramScript(): Promise<void> {
  // Already loaded (e.g. Telegram WebView auto-injected it or from index.html script tag)
  if (window.Telegram?.WebApp) {
    return Promise.resolve();
  }

  // The SDK is loaded via <script> in index.html from the Cloudflare Worker proxy.
  // It may still be loading — poll for it with a timeout.
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const maxAttempts = 50; // 5 seconds total
    const interval = setInterval(() => {
      attempts++;
      if (window.Telegram?.WebApp) {
        clearInterval(interval);
        resolve();
        return;
      }
      if (attempts >= maxAttempts) {
        clearInterval(interval);
        console.error("[TG SDK] Telegram SDK did not load within timeout");
        reject(new Error("Telegram SDK load timeout"));
      }
    }, 100);
  });
}

export function TelegramProvider({ children }: { children: ReactNode }) {
  const [webApp, setWebApp] = useState<TelegramWebApp | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<TgUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isTelegram = !!webApp;

  const authenticate = useCallback(async (wa: TelegramWebApp) => {
    try {
      const res = await fetch("/api/tg-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData: wa.initData }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.error === "account_not_linked") {
          setError(data.message || "Аккаунт не привязан");
        } else {
          setError("Ошибка авторизации");
        }
        setLoading(false);
        return;
      }

      const data = await res.json();
      setToken(data.token);
      setTgMiniAppToken(data.token);
      setUser(data.user);
      setLoading(false);
    } catch (err) {
      console.error("[TG Mini App] Auth error:", err);
      setError("Не удалось подключиться к серверу");
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const isTgRoute = window.location.pathname.startsWith("/tg");

    if (!isTgRoute) {
      // Not on a Telegram Mini App route — skip SDK loading entirely
      setLoading(false);
      return;
    }

    // On /tg/* route — load SDK dynamically, then init
    loadTelegramScript()
      .then(() => {
        const wa = window.Telegram?.WebApp;
        if (!wa || !wa.initData) {
          // SDK loaded but not inside Telegram WebView (e.g. direct browser access to /tg)
          setLoading(false);
          return;
        }

        setWebApp(wa);
        wa.ready();
        wa.expand();

        // Set Telegram-native colors
        try {
          wa.setHeaderColor("#1a3a2a");
          wa.setBackgroundColor("#f5f0e8");
        } catch {
          // Older clients may not support this
        }

        authenticate(wa);
      })
      .catch(() => {
        // Failed to load SDK — not critical, just mark as not-telegram
        setLoading(false);
      });
  }, [authenticate]);

  return (
    <TelegramContext.Provider
      value={{
        isTelegram,
        webApp,
        token,
        user,
        loading,
        error,
        isAuthenticated: !!token && !!user,
      }}
    >
      {children}
    </TelegramContext.Provider>
  );
}
