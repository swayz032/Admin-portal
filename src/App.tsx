import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { SystemProvider } from "@/contexts/SystemContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { ScopeProvider } from "@/contexts/ScopeContext";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { PublicRoute } from "./components/auth/PublicRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { supabaseConfigStatus } from "@/integrations/supabase/client";


// Eagerly loaded (initial routes — no lazy)
import Home from "./pages/Home";
import Auth from "./pages/Auth";

// Lazy loaded (code-split per route)
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Approvals = lazy(() => import("./pages/Approvals"));
const Activity = lazy(() => import("./pages/Activity"));
const Safety = lazy(() => import("./pages/Safety"));
const Incidents = lazy(() => import("./pages/Incidents"));
const Customers = lazy(() => import("./pages/Customers"));
const Subscriptions = lazy(() => import("./pages/Subscriptions"));
const ConnectedApps = lazy(() => import("./pages/ConnectedApps"));
const Advanced = lazy(() => import("./pages/Advanced"));
const AdminAvaChat = lazy(() => import("./pages/AdminAvaChat"));
const AutomationPage = lazy(() => import("./pages/Automation"));
const AuthMfa = lazy(() => import("./pages/AuthMfa"));
const AccessDenied = lazy(() => import("./pages/AccessDenied"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Command Center pages
const SystemHealth = lazy(() => import("./pages/SystemHealth"));
const Metrics = lazy(() => import("./pages/Metrics"));
const DatabasePerformance = lazy(() => import("./pages/DatabasePerformance"));
const N8nOperations = lazy(() => import("./pages/N8nOperations"));

// Trust Spine pages
const Receipts = lazy(() => import("./pages/Receipts"));
const Outbox = lazy(() => import("./pages/Outbox"));
const ProviderCallLog = lazy(() => import("./pages/ProviderCallLog"));
const TraceView = lazy(() => import("./pages/TraceView"));
const ClientEvents = lazy(() => import("./pages/ClientEvents"));
const FrontendHealth = lazy(() => import("./pages/FrontendHealth"));

// Business Control pages
const RunwayBurn = lazy(() => import("./pages/business/RunwayBurn"));
const CostsUsage = lazy(() => import("./pages/business/CostsUsage"));
const RevenueAddons = lazy(() => import("./pages/business/RevenueAddons"));
const AcquisitionAnalytics = lazy(() => import("./pages/business/AcquisitionAnalytics"));
const AudienceIntelligence = lazy(() => import("./pages/business/AudienceIntelligence"));

// Skill Packs pages
const SkillPackRegistry = lazy(() => import("./pages/skillpacks/Registry"));
const SkillPackAnalytics = lazy(() => import("./pages/skillpacks/Analytics"));

// Cross-System Visibility pages
const FinanceView = lazy(() => import("./pages/FinanceView"));
const ConferenceMonitor = lazy(() => import("./pages/ConferenceMonitor"));
const MailVisibility = lazy(() => import("./pages/MailVisibility"));

// Control Plane pages
const AgentStudio = lazy(() => import("./pages/AgentStudio"));
const CreateAgent = lazy(() => import("./pages/control-plane/Builder"));
const RobotRunPage = lazy(() => import("./pages/control-plane/RobotRunPage"));
const PatchJobPage = lazy(() => import("./pages/control-plane/PatchJobPage"));

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
      </div>
    </div>
  );
}

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
                <ScopeProvider>
                <Toaster />
                <Sonner />
                <Suspense fallback={<PageLoader />}>
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
                path="/n8n-operations"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <N8nOperations />
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
                      <AdminAvaChat />
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

              {/* Command Center Pages */}
              <Route
                path="/system-health"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <SystemHealth />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/metrics"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <Metrics />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/db-performance"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <DatabasePerformance />
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
              <Route
                path="/trace/:correlationId"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <TraceView />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/frontend-health"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <FrontendHealth />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/client-events"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <ClientEvents />
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
              <Route
                path="/business/audience"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <AudienceIntelligence />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />


              {/* Cross-System Visibility Routes */}
              <Route
                path="/visibility/finance"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <FinanceView />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/visibility/conference"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <ConferenceMonitor />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/visibility/mail"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <MailVisibility />
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
              {/* Control Plane Detail Routes */}
              <Route
                path="/control-plane/robots/:id"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <RobotRunPage />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/control-plane/patches/:id"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <PatchJobPage />
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
              </Suspense>
              </ScopeProvider>
              </SystemProvider>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    )}
  </ErrorBoundary>
);

export default App;
