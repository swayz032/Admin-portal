import { useState, useEffect, ReactNode } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { useSystem } from '@/contexts/SystemContext';
import { AlertTriangle } from 'lucide-react';
import { AvaFloatingButton } from '@/components/ava/AvaFloatingButton';
import { ProviderAlertBanner } from '@/components/admin-ava/ProviderAlertBanner';
import { SystemStatusBanner } from '@/components/shared/SystemStatusBanner';
import { useRealtimeApprovals } from '@/hooks/useRealtimeApprovals';
import { useRealtimeIncidents } from '@/hooks/useRealtimeIncidents';
import { useRedAlertBroadcast } from '@/hooks/useRedAlertBroadcast';

interface AppLayoutProps {
  children: ReactNode;
}

const SIDEBAR_COLLAPSED_KEY = 'aspire_sidebar_collapsed';

export function AppLayout({ children }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
      return stored ? JSON.parse(stored) === true : false;
    } catch {
      return false;
    }
  });
  const { systemState } = useSystem();

  // Sync collapse state with localStorage
  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, JSON.stringify(sidebarCollapsed));
  }, [sidebarCollapsed]);

  // Real Supabase data for Ava notification counts
  const { data: allApprovals } = useRealtimeApprovals({ status: 'Pending' });
  const { data: allIncidents } = useRealtimeIncidents({ status: 'Open' });
  const { alerts: redAlerts } = useRedAlertBroadcast();
  const avaNotifications = allApprovals.length + allIncidents.length + redAlerts.length;

  return (
    <div className="min-h-screen flex w-full bg-background">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(true)} />

        {/* System-wide status banner */}
        <SystemStatusBanner />

        {/* Provider degradation/disconnection alert */}
        <ProviderAlertBanner />

        {systemState.safetyMode && (
          <div className="safety-banner">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <span>
              <strong>Safety Mode is active.</strong> Write operations are restricted and risky automations are paused.
            </span>
          </div>
        )}

        <main className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>

      {/* Floating Ava Assistant - always available */}
      <AvaFloatingButton
        hasNotifications={avaNotifications > 0}
        notificationCount={avaNotifications}
      />
    </div>
  );
}
