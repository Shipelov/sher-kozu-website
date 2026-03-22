import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import { useEffect, useState, useCallback } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { useAuth } from "@/_core/hooks/useAuth";
import WelcomeOnboarding from "@/components/WelcomeOnboarding";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import AnimalProfile from "./pages/AnimalProfile";
import ProductTracker from "./pages/ProductTracker";
import ClubFeed from "./pages/ClubFeed";
import AdminClub from "./pages/AdminClub";
import AnimalsCatalog from "./pages/AnimalsCatalog";
import AdminAnimals from "./pages/AdminAnimals";
import AdminHub from "./pages/AdminHub";
import AdminUsers from "./pages/AdminUsers";
import AdminProductTrack from "./pages/AdminProductTrack";
import Profile from "./pages/Profile";
import Partners from "./pages/Partners";

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
      <Route path="/partners" component={Partners} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
      </Switch>
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
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
