import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch, useLocation } from "wouter";
import { useEffect, useState, useCallback, lazy, Suspense } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { useAuth } from "@/_core/hooks/useAuth";
import WelcomeOnboarding from "@/components/WelcomeOnboarding";
import { Loader2 } from "lucide-react";
import MashaFloatingChat from "@/components/MashaFloatingChat";

/* ─── Lazy-loaded page components (code-split per route) ─── */
const Home = lazy(() => import("./pages/Home"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const AnimalProfile = lazy(() => import("./pages/AnimalProfile"));
const ProductTracker = lazy(() => import("./pages/ProductTracker"));
const ClubFeed = lazy(() => import("./pages/ClubFeed"));
const AdminClub = lazy(() => import("./pages/AdminClub"));
const AnimalsCatalog = lazy(() => import("./pages/AnimalsCatalog"));
const AdminAnimals = lazy(() => import("./pages/AdminAnimals"));
const AdminHub = lazy(() => import("./pages/AdminHub"));
const AdminUsers = lazy(() => import("./pages/AdminUsers"));
const AdminProductTrack = lazy(() => import("./pages/AdminProductTrack"));
const AdminMarketplace = lazy(() => import("./pages/AdminMarketplace"));
const AdminTokens = lazy(() => import("./pages/AdminTokens"));
const AdminAnalytics = lazy(() => import("./pages/AdminAnalytics"));
const Marketplace = lazy(() => import("./pages/Marketplace"));
const Leaderboard = lazy(() => import("./pages/Leaderboard"));
const Profile = lazy(() => import("./pages/Profile"));
const Partners = lazy(() => import("./pages/Partners"));
const AboutFarm = lazy(() => import("./pages/AboutFarm"));
const AnimalCompare = lazy(() => import("./pages/AnimalCompare"));
const FAQ = lazy(() => import("./pages/FAQ"));
const NotFound = lazy(() => import("./pages/NotFound"));

/* ─── Suspense fallback spinner ─── */
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

function normalizeRoutePath(path: string) {
  const [pathname, query = ""] = path.split("?");
  const normalizedSegments = pathname
    .split("/")
    .map((segment, index) => {
      if (index === 0) return segment;
      return segment.replace(/%20+$/g, "").replace(/\s+$/g, "");
    })
    .filter((segment, index) => index === 0 || segment.length > 0);

  const normalizedPathname = normalizedSegments.join("/") || "/";

  return query ? `${normalizedPathname}?${query}` : normalizedPathname;
}

function RouteNormalizer() {
  const [location, setLocation] = useLocation();

  useEffect(() => {
    const normalizedLocation = normalizeRoutePath(location);

    if (normalizedLocation !== location) {
      setLocation(normalizedLocation, { replace: true });
    }
  }, [location, setLocation]);

  return null;
}

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <>
      <RouteNormalizer />
      <Suspense fallback={<PageLoader />}>
        <Switch>
        <Route path="/" component={Home} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/profile" component={Profile} />
        <Route path="/animal/:slug" component={AnimalProfile} />
        <Route path="/animals" component={AnimalsCatalog} />
        <Route path="/animals/:slug" component={AnimalProfile} />
        <Route path="/tracker" component={ProductTracker} />
        <Route path="/club" component={ClubFeed} />
        <Route path="/admin" component={AdminHub} />
        <Route path="/admin/users" component={AdminUsers} />
        <Route path="/admin/club" component={AdminClub} />
        <Route path="/admin/animals" component={AdminAnimals} />
        <Route path="/admin/product-track" component={AdminProductTrack} />
        <Route path="/admin/product-track/:animalId" component={AdminProductTrack} />
        <Route path="/admin/marketplace" component={AdminMarketplace} />
        <Route path="/admin/tokens" component={AdminTokens} />
        <Route path="/admin/analytics" component={AdminAnalytics} />
        <Route path="/marketplace" component={Marketplace} />
        <Route path="/leaderboard" component={Leaderboard} />
        <Route path="/compare" component={AnimalCompare} />
        <Route path="/about" component={AboutFarm} />
        <Route path="/partners" component={Partners} />
        <Route path="/faq" component={FAQ} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
        </Switch>
      </Suspense>
    </>
  );
}

function OnboardingGate() {
  const { user, isAuthenticated, loading } = useAuth();
  const [dismissed, setDismissed] = useState(false);

  const handleComplete = useCallback(() => {
    setDismissed(true);
  }, []);

  if (loading || !isAuthenticated || !user) return null;
  if (dismissed) return null;
  if ((user as any).onboardingCompleted) return null;

  return <WelcomeOnboarding userName={user.name || ""} onComplete={handleComplete} />;
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <OnboardingGate />
          <Router />
          <MashaFloatingChat />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
