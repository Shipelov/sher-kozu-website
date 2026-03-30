import { trpc } from "@/lib/trpc";
import { useEffect, useMemo, useRef } from "react";
import { useLocation } from "wouter";

/**
 * Hook to check active A/B experiments for the current page
 * and get the assigned variant for the current visitor.
 *
 * Usage:
 *   const { variant, config, experimentId, isLoading } = useABExperiment();
 *   // variant = "control" | "variant_a" | etc.
 *   // config = parsed JSON config for the variant (or null)
 */
export function useABExperiment() {
  const [location] = useLocation();

  // Get visitor/session IDs from localStorage (same as analytics tracker)
  const ids = useMemo(() => {
    let visitorId = localStorage.getItem("sk_vid") || "";
    let sessionId = sessionStorage.getItem("sk_sid") || "";
    if (!visitorId) {
      visitorId = crypto.randomUUID();
      localStorage.setItem("sk_vid", visitorId);
    }
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      sessionStorage.setItem("sk_sid", sessionId);
    }
    return { visitorId, sessionId };
  }, []);

  const { data, isLoading } = trpc.abExperiments.activeForPage.useQuery(
    { pagePath: location, visitorId: ids.visitorId, sessionId: ids.sessionId },
    { staleTime: 5 * 60 * 1000 } // Cache for 5 minutes
  );

  // Return first active experiment assignment (most common case)
  const assignment = data?.[0] ?? null;

  return {
    experimentId: assignment?.experimentId ?? null,
    experimentName: assignment?.experimentName ?? null,
    variant: assignment?.variantKey ?? null,
    variantLabel: assignment?.variantLabel ?? null,
    config: assignment?.config ?? null,
    goalEvent: assignment?.goalEvent ?? null,
    allExperiments: data ?? [],
    isLoading,
  };
}

/**
 * Hook to record a conversion for an A/B experiment.
 *
 * Usage:
 *   const recordConversion = useABConversion();
 *   recordConversion(experimentId);
 */
export function useABConversion() {
  const conversionMut = trpc.abExperiments.recordConversion.useMutation();
  const calledRef = useRef<Set<number>>(new Set());

  return (experimentId: number) => {
    if (calledRef.current.has(experimentId)) return; // Prevent duplicate conversions
    calledRef.current.add(experimentId);
    const visitorId = localStorage.getItem("sk_vid") || "";
    if (visitorId) {
      conversionMut.mutate({ experimentId, visitorId });
    }
  };
}
