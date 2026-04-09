/**
 * Client-side performance tracking hook.
 *
 * Collects:
 * - Navigation Timing API metrics (DNS, TCP, TLS, TTFB, download, DOM, page load)
 * - Web Vitals (FCP, LCP, FID/INP, CLS) via PerformanceObserver
 * - Resource count and transfer size
 * - Device type and connection type
 *
 * Sends data to analytics.trackPerformance (fire-and-forget on server).
 * Collects once per page load (not on SPA navigations — only initial load).
 */

import { useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

/* ─── Cookie helpers (reuse pattern from useAnalytics) ─── */

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/* ─── Device detection ─── */

function detectDeviceType(): string {
  const ua = navigator.userAgent;
  if (/Mobi|Android.*Mobile|iPhone|iPod/i.test(ua)) return "mobile";
  if (/Tablet|iPad|Android(?!.*Mobile)/i.test(ua)) return "tablet";
  return "desktop";
}

function getConnectionType(): string | null {
  const nav = navigator as any;
  if (nav.connection?.effectiveType) return nav.connection.effectiveType;
  return null;
}

/* ─── Metric collection ─── */

interface PerfMetrics {
  dnsMs: number | null;
  tcpMs: number | null;
  tlsMs: number | null;
  ttfbMs: number | null;
  downloadMs: number | null;
  domInteractiveMs: number | null;
  domContentLoadedMs: number | null;
  pageLoadMs: number | null;
  fcpMs: number | null;
  lcpMs: number | null;
  fidMs: number | null;
  clsX1000: number | null;
  transferSizeBytes: number | null;
  resourceCount: number | null;
}

function getNavigationTimingMetrics(): Partial<PerfMetrics> {
  const entries = performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];
  if (!entries.length) return {};
  const nav = entries[0];

  const round = (v: number) => (v > 0 ? Math.round(v) : null);

  return {
    dnsMs: round(nav.domainLookupEnd - nav.domainLookupStart),
    tcpMs: round(nav.connectEnd - nav.connectStart),
    tlsMs: nav.secureConnectionStart > 0 ? round(nav.connectEnd - nav.secureConnectionStart) : null,
    ttfbMs: round(nav.responseStart - nav.requestStart),
    downloadMs: round(nav.responseEnd - nav.responseStart),
    domInteractiveMs: round(nav.domInteractive - nav.fetchStart),
    domContentLoadedMs: round(nav.domContentLoadedEventEnd - nav.fetchStart),
    pageLoadMs: nav.loadEventEnd > 0 ? round(nav.loadEventEnd - nav.fetchStart) : null,
    transferSizeBytes: nav.transferSize > 0 ? Math.round(nav.transferSize) : null,
  };
}

function getResourceMetrics(): { resourceCount: number; totalTransferSize: number } {
  const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
  let totalTransferSize = 0;
  for (const r of resources) {
    totalTransferSize += r.transferSize || 0;
  }
  return { resourceCount: resources.length, totalTransferSize: Math.round(totalTransferSize) };
}

/* ─── Main hook ─── */

export function usePerformanceTracking() {
  const { user } = useAuth();
  const trackPerformance = trpc.analytics.trackPerformance.useMutation({
    onError: () => { /* Performance tracking is best-effort */ },
  });
  const sentRef = useRef(false);

  useEffect(() => {
    // Only send once per page load
    if (sentRef.current) return;

    const collectAndSend = () => {
      if (sentRef.current) return;
      sentRef.current = true;

      const visitorId = getCookie("sk_vid") || "unknown";
      const sessionId = getCookie("sk_sid") || "unknown";

      // Navigation Timing
      const navMetrics = getNavigationTimingMetrics();

      // Resource metrics
      const resMet = getResourceMetrics();

      // Web Vitals collected via PerformanceObserver
      let fcpMs: number | null = null;
      let lcpMs: number | null = null;
      let fidMs: number | null = null;
      let clsX1000: number | null = null;

      // FCP from paint entries
      const paintEntries = performance.getEntriesByType("paint");
      const fcpEntry = paintEntries.find(e => e.name === "first-contentful-paint");
      if (fcpEntry) fcpMs = Math.round(fcpEntry.startTime);

      // Collect LCP, FID, CLS via PerformanceObserver (already buffered)
      try {
        const lcpEntries = performance.getEntriesByType("largest-contentful-paint") as any[];
        if (lcpEntries.length) {
          lcpMs = Math.round(lcpEntries[lcpEntries.length - 1].startTime);
        }
      } catch { /* not supported */ }

      try {
        const fidEntries = performance.getEntriesByType("first-input") as any[];
        if (fidEntries.length) {
          fidMs = Math.round(fidEntries[0].processingStart - fidEntries[0].startTime);
        }
      } catch { /* not supported */ }

      // CLS from layout-shift entries
      try {
        const lsEntries = performance.getEntriesByType("layout-shift") as any[];
        let clsValue = 0;
        for (const entry of lsEntries) {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
          }
        }
        clsX1000 = Math.round(clsValue * 1000);
      } catch { /* not supported */ }

      trackPerformance.mutate({
        visitorId,
        sessionId,
        userOpenId: user?.openId ?? null,
        pagePath: window.location.pathname,
        ...navMetrics,
        fcpMs,
        lcpMs,
        fidMs,
        clsX1000,
        transferSizeBytes: (navMetrics.transferSizeBytes || 0) + resMet.totalTransferSize || null,
        resourceCount: resMet.resourceCount,
        deviceType: detectDeviceType(),
        connectionType: getConnectionType(),
      });
    };

    // Wait for the page to fully load before collecting metrics
    if (document.readyState === "complete") {
      // Small delay to let LCP/CLS settle
      setTimeout(collectAndSend, 2000);
    } else {
      const handler = () => {
        setTimeout(collectAndSend, 2000);
      };
      window.addEventListener("load", handler, { once: true });
      return () => window.removeEventListener("load", handler);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
