/*
TrackerGate.tsx — Router-level gate for the /tracker route.
Decides whether to show the real ProductTracker or the DemoTracker based on:
1. Authentication status
2. Whether the user owns any animals
*/

import { lazy, Suspense, useMemo } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Loader2 } from "lucide-react";
import Navbar from "@/components/Navbar";

const ProductTracker = lazy(() => import("./ProductTracker"));
const DemoTracker = lazy(() => import("./DemoTracker"));

function TrackerLoading() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <div className="flex items-center justify-center pt-40">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Загружаем трекер…</p>
        </div>
      </div>
    </div>
  );
}

export default function TrackerGate() {
  const { isAuthenticated, loading: authLoading } = useAuth();

  // Only query owned animals if authenticated
  const myAnimalsQuery = trpc.productTracker.myAnimals.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const hasAnimals = useMemo(() => {
    if (!isAuthenticated) return false;
    if (!myAnimalsQuery.data) return false;
    return myAnimalsQuery.data.length > 0;
  }, [isAuthenticated, myAnimalsQuery.data]);

  // Still loading auth or ownership data
  if (authLoading || (isAuthenticated && myAnimalsQuery.isLoading)) {
    return <TrackerLoading />;
  }

  // Show demo if: not authenticated OR authenticated but has no animals
  const showDemo = !isAuthenticated || !hasAnimals;

  return (
    <Suspense fallback={<TrackerLoading />}>
      {showDemo ? <DemoTracker /> : <ProductTracker />}
    </Suspense>
  );
}
