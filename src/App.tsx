import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { SystemProvider } from "@/contexts/SystemContext";
import { AuthProvider } from "@/contexts/AuthContext";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Approvals from "./pages/Approvals";
import Activity from "./pages/Activity";
import Safety from "./pages/Safety";
import Incidents from "./pages/Incidents";
import Customers from "./pages/Customers";
import Subscriptions from "./pages/Subscriptions";
import ConnectedApps from "./pages/ConnectedApps";
import Advanced from "./pages/Advanced";
import LLMOpsDesk from "./pages/LLMOpsDesk";
import Auth from "./pages/Auth";
import AuthMfa from "./pages/AuthMfa";
import AccessDenied from "./pages/AccessDenied";
import NotFound from "./pages/NotFound";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { PublicRoute } from "./components/auth/PublicRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import AutomationPage from "./pages/Automation";
import { supabaseConfigStatus } from "@/integrations/supabase/client";

// New Trust Spine pages
import Receipts from "./pages/Receipts";
import Outbox from "./pages/Outbox";
import ProviderCallLog from "./pages/ProviderCallLog";

// Business Control pages
import RunwayBurn from "./pages/business/RunwayBurn";
import CostsUsage from "./pages/business/CostsUsage";
import RevenueAddons from "./pages/business/RevenueAddons";
import AcquisitionAnalytics from "./pages/business/AcquisitionAnalytics";

// Skill Packs pages
import SkillPackRegistry from "./pages/skillpacks/Registry";
import SkillPackAnalytics from "./pages/skillpacks/Analytics";

// Control Plane pages
import AgentStudio from "./pages/AgentStudio";
import CreateAgent from "./pages/control-plane/Builder";

const queryClient = new QueryClient();

function ConfigErrorScreen({ missingVars }: { missingVars: string[] }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="max-w-xl rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-foreground">
        <h1 className="text-xl font-semibold tracking-tight">Admin Portal Configuration Error</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Required public environment variables are missing. The app cannot initialize authentication.
        </p>
        <div className="mt-4 rounded-md bg-background/80 p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Missing Variables</p>
          <ul className="list-disc pl-4 space-y-1 text-sm">
            {missingVars.map((name) => (
              <li key={name}>
                <code>{name}</code>
              </li>
            ))}
          </ul>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          Set these in your deployment service and redeploy. If this is Railway, add them to the frontend service environment.
        </p>
      </div>
    </div>
  );
}

const App = () => (
  <ErrorBoundary>
    {!supabaseConfigStatus.isValid ? (
      <ConfigErrorScreen missingVars={supabaseConfigStatus.missingPublicEnv} />
    ) : (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <BrowserRouter>
            <AuthProvider>
              <SystemProvider>
                <Toaster />
                <Sonner />
              <Routes>
              <Route path="/auth" element={<PublicRoute><Auth /></PublicRoute>} />
              <Route path="/auth/mfa" element={<AuthMfa />} />
              <Route path="/access-denied" element={<AccessDenied />} />
              <Route path="/" element={<Navigate to="/home" replace />} />
              <Route
                path="/home"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <Home />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <Dashboard />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/approvals"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <Approvals />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/activity"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <Activity />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/safety"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <Safety />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/incidents"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <Incidents />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/customers"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <Customers />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/subscriptions"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <Subscriptions />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/connected-apps"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <ConnectedApps />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/advanced"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <Advanced />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/llm-ops-desk"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <LLMOpsDesk />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/automation"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <AutomationPage />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              
              {/* Trust Spine Pages */}
              <Route
                path="/receipts"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <Receipts />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/outbox"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <Outbox />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/provider-call-log"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <ProviderCallLog />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              
              {/* Business Control Routes */}
              <Route
                path="/business/runway-burn"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <RunwayBurn />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/business/costs-usage"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <CostsUsage />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/business/revenue-addons"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <RevenueAddons />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/business/acquisition-analytics"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <AcquisitionAnalytics />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              
              {/* Skill Packs Routes */}
              <Route
                path="/skill-packs/registry"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <SkillPackRegistry />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/skill-packs/analytics"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <SkillPackAnalytics />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              
              {/* Agent Studio (unified Control Plane) */}
              <Route
                path="/agent-studio"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <AgentStudio />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              {/* Create Agent */}
              <Route
                path="/agent-studio/create"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <CreateAgent />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              {/* Legacy Control Plane Routes (redirect to Agent Studio) */}
              <Route path="/staff-config" element={<Navigate to="/agent-studio" replace />} />
              <Route path="/control-plane/registry" element={<Navigate to="/agent-studio" replace />} />
              <Route path="/control-plane/builder" element={<Navigate to="/agent-studio/create" replace />} />
              <Route path="/control-plane/rollouts" element={<Navigate to="/agent-studio?tab=deploy" replace />} />
              
              <Route path="*" element={<NotFound />} />
              </Routes>
              </SystemProvider>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    )}
  </ErrorBoundary>
);

export default App;
