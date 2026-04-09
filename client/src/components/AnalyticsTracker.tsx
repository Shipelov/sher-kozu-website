/**
 * AnalyticsTracker — a component that initializes page-view tracking
 * and exposes a trackEvent function via React context.
 *
 * Place this inside the Router tree so it can read the current location.
 */

import { createContext, useContext } from "react";
import { useAnalytics } from "@/hooks/useAnalytics";
import { usePerformanceTracking } from "@/hooks/usePerformanceTracking";

type TrackEventFn = (
  category: string,
  action: string,
  label?: string,
  value?: number,
  metadata?: Record<string, unknown>,
) => void;

const AnalyticsContext = createContext<{ trackEvent: TrackEventFn }>({
  trackEvent: () => {},
});

export function useTrackEvent() {
  return useContext(AnalyticsContext).trackEvent;
}

export default function AnalyticsTracker({ children }: { children: React.ReactNode }) {
  const { trackEvent } = useAnalytics();
  usePerformanceTracking(); // Collect Web Vitals + Navigation Timing on page load

  return (
    <AnalyticsContext.Provider value={{ trackEvent }}>
      {children}
    </AnalyticsContext.Provider>
  );
}
