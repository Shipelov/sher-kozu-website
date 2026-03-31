/**
 * Client-side analytics tracking hook.
 *
 * Responsibilities:
 * - Generate/persist a visitorId (fingerprint) and sessionId in cookies
 * - Track page views on route changes
 * - Track time on page (updated on navigation / unload)
 * - Detect device type, browser, OS, screen width
 * - Parse UTM parameters from the URL
 * - Expose trackEvent() for custom event tracking
 */

import { useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

/* ─── Cookie helpers ─── */

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name: string, value: string, days: number) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

/* ─── ID generators ─── */

function generateId(): string {
  return (
    Math.random().toString(36).slice(2, 10) +
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 6)
  );
}

function getOrCreateVisitorId(): string {
  let id = getCookie("sk_vid");
  if (!id) {
    id = "v_" + generateId();
    setCookie("sk_vid", id, 365);
  }
  return id;
}

function getOrCreateSessionId(): string {
  let id = getCookie("sk_sid");
  if (!id) {
    id = "s_" + generateId();
    setCookie("sk_sid", id, 0.02); // ~30 minutes
  } else {
    // Refresh session expiry on activity
    setCookie("sk_sid", id, 0.02);
  }
  return id;
}

/* ─── Device detection ─── */

function detectDeviceType(): string {
  const ua = navigator.userAgent;
  if (/Mobi|Android.*Mobile|iPhone|iPod/i.test(ua)) return "mobile";
  if (/Tablet|iPad|Android(?!.*Mobile)/i.test(ua)) return "tablet";
  return "desktop";
}

function detectBrowser(): string {
  const ua = navigator.userAgent;
  if (ua.includes("Firefox")) return "Firefox";
  if (ua.includes("Edg/")) return "Edge";
  if (ua.includes("OPR/") || ua.includes("Opera")) return "Opera";
  if (ua.includes("YaBrowser")) return "Yandex";
  if (ua.includes("Chrome") && !ua.includes("Edg")) return "Chrome";
  if (ua.includes("Safari") && !ua.includes("Chrome")) return "Safari";
  return "Other";
}

function detectOS(): string {
  const ua = navigator.userAgent;
  if (ua.includes("Windows")) return "Windows";
  if (ua.includes("Mac OS")) return "macOS";
  if (ua.includes("iPhone") || ua.includes("iPad")) return "iOS";
  if (ua.includes("Android")) return "Android";
  if (ua.includes("Linux")) return "Linux";
  return "Other";
}

/* ─── UTM parsing ─── */

function getUtmParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    utmSource: params.get("utm_source") || null,
    utmMedium: params.get("utm_medium") || null,
    utmCampaign: params.get("utm_campaign") || null,
  };
}

/* ─── Main hook ─── */

export function useAnalytics() {
  const [location] = useLocation();
  const { user } = useAuth();
  const trackVisit = trpc.analytics.trackVisit.useMutation({
    onError: () => { /* Analytics is best-effort, suppress errors silently */ },
  });
  const trackEventMut = trpc.analytics.trackEvent.useMutation({
    onError: () => { /* Analytics is best-effort, suppress errors silently */ },
  });
  const updateTime = trpc.analytics.updateTime.useMutation({
    onError: () => { /* Analytics is best-effort, suppress errors silently */ },
  });

  const pageEntryTime = useRef<number>(Date.now());
  const lastPagePath = useRef<string>("");
  const sessionIdRef = useRef<string>("");
  const visitorIdRef = useRef<string>("");
  const isFirstPage = useRef<boolean>(true);

  // Initialize IDs once
  useEffect(() => {
    visitorIdRef.current = getOrCreateVisitorId();
    sessionIdRef.current = getOrCreateSessionId();
  }, []);

  // Track page view on route change
  useEffect(() => {
    const pagePath = location || "/";

    // Skip duplicate tracking for same path
    if (pagePath === lastPagePath.current) return;

    // Update time on previous page before tracking new one
    if (lastPagePath.current && sessionIdRef.current) {
      const timeOnPage = Math.round((Date.now() - pageEntryTime.current) / 1000);
      if (timeOnPage > 0 && timeOnPage < 86400) {
        updateTime.mutate({
          sessionId: sessionIdRef.current,
          pagePath: lastPagePath.current,
          timeOnPage,
        });
      }
    }

    // Ensure IDs are ready
    if (!visitorIdRef.current) visitorIdRef.current = getOrCreateVisitorId();
    if (!sessionIdRef.current) sessionIdRef.current = getOrCreateSessionId();

    const utms = getUtmParams();
    const referrer = document.referrer && !document.referrer.includes(window.location.host)
      ? document.referrer
      : null;

    trackVisit.mutate({
      visitorId: visitorIdRef.current,
      sessionId: sessionIdRef.current,
      userOpenId: user?.openId ?? null,
      pagePath,
      referrer,
      ...utms,
      deviceType: detectDeviceType(),
      browser: detectBrowser(),
      os: detectOS(),
      screenWidth: window.screen.width,
      isEntry: isFirstPage.current,
      isExit: false,
    });

    lastPagePath.current = pagePath;
    pageEntryTime.current = Date.now();
    isFirstPage.current = false;
  }, [location]); // eslint-disable-line react-hooks/exhaustive-deps

  // Track time on page when user leaves
  useEffect(() => {
    const handleUnload = () => {
      if (!lastPagePath.current || !sessionIdRef.current) return;
      const timeOnPage = Math.round((Date.now() - pageEntryTime.current) / 1000);
      if (timeOnPage > 0 && timeOnPage < 86400) {
        // Use sendBeacon for reliability on page unload
        const payload = JSON.stringify({
          sessionId: sessionIdRef.current,
          pagePath: lastPagePath.current,
          timeOnPage,
        });
        navigator.sendBeacon("/api/analytics/time", payload);
      }
    };

    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, []);

  // Custom event tracking function
  const trackEvent = useCallback(
    (category: string, action: string, label?: string, value?: number, metadata?: Record<string, unknown>) => {
      if (!visitorIdRef.current) visitorIdRef.current = getOrCreateVisitorId();
      if (!sessionIdRef.current) sessionIdRef.current = getOrCreateSessionId();

      trackEventMut.mutate({
        visitorId: visitorIdRef.current,
        sessionId: sessionIdRef.current,
        userOpenId: user?.openId ?? null,
        category,
        action,
        label: label ?? null,
        value: value ?? null,
        pagePath: lastPagePath.current || location || "/",
        metadata: metadata ? JSON.stringify(metadata) : null,
      });
    },
    [user?.openId, location], // eslint-disable-line react-hooks/exhaustive-deps
  );

  return { trackEvent };
}
