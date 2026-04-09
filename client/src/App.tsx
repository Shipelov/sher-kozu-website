import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch, useLocation, Redirect } from "wouter";
import { useEffect, useState, useCallback, lazy, Suspense } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { useAuth } from "@/_core/hooks/useAuth";
import WelcomeOnboarding from "@/components/WelcomeOnboarding";
import { Loader2 } from "lucide-react";
import AIFloatingHub from "@/components/AIFloatingHub";
import AnalyticsTracker from "@/components/AnalyticsTracker";

/* ─── Lazy-loaded page components (code-split per route) ─── */
const Home = lazy(() => import("./pages/Home"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const AnimalProfile = lazy(() => import("./pages/AnimalProfile"));
const TrackerGate = lazy(() => import("./pages/TrackerGate"));
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
const AdminSiteAnalytics = lazy(() => import("./pages/AdminSiteAnalytics"));
const AdminFaqAnalytics = lazy(() => import("./pages/AdminFaqAnalytics"));
const AdminCmsEditor = lazy(() => import("./pages/AdminCmsEditor"));
const AdminPhotoModeration = lazy(() => import("./pages/AdminPhotoModeration"));
const Marketplace = lazy(() => import("./pages/Marketplace"));
const Leaderboard = lazy(() => import("./pages/Leaderboard"));
const Profile = lazy(() => import("./pages/Profile"));
const Partners = lazy(() => import("./pages/Partners"));
const AboutFarm = lazy(() => import("./pages/AboutFarm"));
const AnimalCompare = lazy(() => import("./pages/AnimalCompare"));
const FAQ = lazy(() => import("./pages/FAQ"));
const Nutritionist = lazy(() => import("./pages/Nutritionist"));
const NotificationSettings = lazy(() => import("./pages/NotificationSettings"));
const AdminAnalyticsAlerts = lazy(() => import("./pages/AdminAnalyticsAlerts"));
const AdminABExperiments = lazy(() => import("./pages/AdminABExperiments"));
const Pricing = lazy(() => import("./pages/Pricing"));
const PricingCalculator = lazy(() => import("./pages/PricingCalculator"));
const PricingCompare = lazy(() => import("./pages/PricingCompare"));
const PricingTierDetail = lazy(() => import("./pages/PricingTierDetail"));
const AdminPricing = lazy(() => import("./pages/AdminPricing"));
const AdminClubComments = lazy(() => import("./pages/AdminClubComments"));
const AdminNutriKnowledge = lazy(() => import("./pages/AdminNutriKnowledge"));
const AdminClubRegistrations = lazy(() => import("./pages/AdminClubRegistrations"));
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
    <AnalyticsTracker>
      <RouteNormalizer />
      <Suspense fallback={<PageLoader />}>
        <Switch>
        <Route path="/" component={Home} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/profile" component={Profile} />
        <Route path="/settings/notifications" component={NotificationSettings} />
        <Route path="/animal/:slug" component={AnimalProfile} />
        <Route path="/animals" component={AnimalsCatalog} />
        <Route path="/animals/:slug" component={AnimalProfile} />
        <Route path="/tracker" component={TrackerGate} />
        <Route path="/club" component={ClubFeed} />
        <Route path="/admin" component={AdminHub} />
        <Route path="/admin/users" component={AdminUsers} />
        <Route path="/admin/club" component={AdminClub} />
        <Route path="/admin/club/comments" component={AdminClubComments} />
        <Route path="/admin/club/registrations" component={AdminClubRegistrations} />
        <Route path="/admin/animals" component={AdminAnimals} />
        <Route path="/admin/product-track" component={AdminProductTrack} />
        <Route path="/admin/product-track/:animalId" component={AdminProductTrack} />
        <Route path="/admin/marketplace" component={AdminMarketplace} />
        <Route path="/admin/tokens" component={AdminTokens} />
        <Route path="/admin/analytics" component={AdminAnalytics} />
        <Route path="/admin/site-analytics" component={AdminSiteAnalytics} />
        <Route path="/admin/faq-analytics" component={AdminFaqAnalytics} />
        <Route path="/admin/content" component={AdminCmsEditor} />
        <Route path="/admin/photo-moderation" component={AdminPhotoModeration} />
        <Route path="/admin/analytics-alerts" component={AdminAnalyticsAlerts} />
        <Route path="/admin/ab-experiments" component={AdminABExperiments} />
        <Route path="/marketplace" component={Marketplace} />
        <Route path="/leaderboard" component={Leaderboard} />
        <Route path="/compare" component={AnimalCompare} />
        <Route path="/about" component={AboutFarm} />
        <Route path="/partners" component={Partners} />
        <Route path="/pricing" component={Pricing} />
        <Route path="/pricing/calculator" component={PricingCalculator} />
        <Route path="/pricing/compare" component={PricingCompare} />
        <Route path="/pricing/:slug" component={PricingTierDetail} />
        <Route path="/admin/pricing" component={AdminPricing} />
        <Route path="/admin/nutri-knowledge" component={AdminNutriKnowledge} />
        <Route path="/faq" component={FAQ} />
        <Route path="/nutritionist" component={Nutritionist} />
        <Route path="/register">{() => <Redirect to="/?register=1" />}</Route>
        <Route path="/login">{() => <Redirect to="/?login=1" />}</Route>
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
        </Switch>
      </Suspense>
    </AnalyticsTracker>
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
          <AIFloatingHub />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
