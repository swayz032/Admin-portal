import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type ViewMode = 'operator' | 'engineer';
type AutonomyLevel = 'Limited' | 'Standard' | 'Emergency Stop';

const VIEW_MODE_STORAGE_KEY = 'aspire-view-mode';

interface SystemState {
  safetyMode: boolean;
  autonomyLevel: AutonomyLevel;
}

interface SystemContextType {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  systemState: SystemState;
  toggleSafetyMode: () => void;
  setAutonomyLevel: (level: AutonomyLevel) => void;
}

const SystemContext = createContext<SystemContextType | undefined>(undefined);

export function SystemProvider({ children }: { children: ReactNode }) {
  // Persist viewMode in localStorage
  const [viewMode, setViewModeState] = useState<ViewMode>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
      if (stored === 'engineer' || stored === 'operator') {
        return stored;
      }
    }
    return 'operator';
  });

  const [systemState, setSystemState] = useState<SystemState>({
    safetyMode: false,
    autonomyLevel: 'Standard',
  });

  // Persist viewMode changes to localStorage
  const setViewMode = (mode: ViewMode) => {
    setViewModeState(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
    }
  };

  const toggleSafetyMode = () => {
    setSystemState(prev => ({ ...prev, safetyMode: !prev.safetyMode }));
  };

  const setAutonomyLevel = (level: AutonomyLevel) => {
    setSystemState(prev => ({ ...prev, autonomyLevel: level }));
  };

  return (
    <SystemContext.Provider value={{ viewMode, setViewMode, systemState, toggleSafetyMode, setAutonomyLevel }}>
      {children}
    </SystemContext.Provider>
  );
}

export function useSystem() {
  const context = useContext(SystemContext);
  if (context === undefined) {
    throw new Error('useSystem must be used within a SystemProvider');
  }
  return context;
}
