import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import AnimalProfile from "./pages/AnimalProfile";
import ProductTracker from "./pages/ProductTracker";
import ClubFeed from "./pages/ClubFeed";
import AdminClub from "./pages/AdminClub";
import AnimalsCatalog from "./pages/AnimalsCatalog";
import AdminAnimals from "./pages/AdminAnimals";
import AdminHub from "./pages/AdminHub";
function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/animal/:slug" component={AnimalProfile} />
      <Route path="/animals" component={AnimalsCatalog} />
      <Route path="/animals/:slug" component={AnimalProfile} />
      <Route path="/tracker" component={ProductTracker} />
      <Route path="/club" component={ClubFeed} />
      <Route path="/admin" component={AdminHub} />
      <Route path="/admin/club" component={AdminClub} />
      <Route path="/admin/animals" component={AdminAnimals} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
