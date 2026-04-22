import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { TRPCClientError } from "@trpc/client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

/**
 * Maximum time (ms) to wait for auth.me before treating user as guest.
 * Prevents indefinite loading state after PM2 restart / DB timeout.
 */
const AUTH_LOADING_TIMEOUT_MS = 5000;

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath = getLoginUrl() } =
    options ?? {};
  const utils = trpc.useUtils();

  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: 2,                       // Retry up to 2 times (handles transient DB timeouts)
    retryDelay: 1000,               // Wait 1s between retries
    refetchOnWindowFocus: false,
    staleTime: 60_000,              // Consider data fresh for 60s (was 30s)
    gcTime: 5 * 60_000,             // Keep cache for 5 minutes
  });

  const logoutMutation = trpc.auth.logout.useMutation();

  const logout = useCallback(async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch (error: unknown) {
      if (
        error instanceof TRPCClientError &&
        error.data?.code === "UNAUTHORIZED"
      ) {
        return;
      }
      throw error;
    } finally {
      await utils.auth.me.invalidate();
    }
  }, [logoutMutation, utils]);

  // ── Loading timeout: after AUTH_LOADING_TIMEOUT_MS, force loading=false ──
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isActuallyLoading = meQuery.isLoading || logoutMutation.isPending;

  useEffect(() => {
    if (isActuallyLoading && !loadingTimedOut) {
      // Start timeout timer
      timeoutRef.current = setTimeout(() => {
        setLoadingTimedOut(true);
        console.warn("[useAuth] Loading timed out after", AUTH_LOADING_TIMEOUT_MS, "ms — treating as guest");
      }, AUTH_LOADING_TIMEOUT_MS);
    } else {
      // Clear timeout when loading finishes
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      // Reset timeout flag when data arrives
      if (!isActuallyLoading && loadingTimedOut) {
        setLoadingTimedOut(false);
      }
    }
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [isActuallyLoading, loadingTimedOut]);

  const state = useMemo(() => {
    // If loading timed out, treat as guest (not loading, not authenticated)
    const effectiveLoading = isActuallyLoading && !loadingTimedOut;

    return {
      user: meQuery.data?.user ?? null,
      loading: effectiveLoading,
      error: meQuery.error ?? logoutMutation.error ?? null,
      isAuthenticated: meQuery.data?.isAuthenticated ?? false,
      // Expose whether auth errored (for Navbar to handle)
      isError: meQuery.isError,
    };
  }, [
    meQuery.data,
    meQuery.error,
    meQuery.isError,
    meQuery.isLoading,
    logoutMutation.error,
    logoutMutation.isPending,
    isActuallyLoading,
    loadingTimedOut,
  ]);

  useEffect(() => {
    if (!redirectOnUnauthenticated) return;
    if (state.loading) return;
    if (state.user) return;
    if (typeof window === "undefined") return;
    if (window.location.pathname === redirectPath) return;

    window.location.href = redirectPath;
  }, [
    redirectOnUnauthenticated,
    redirectPath,
    state.loading,
    state.user,
  ]);

  return {
    ...state,
    refresh: () => meQuery.refetch(),
    logout,
  };
}
