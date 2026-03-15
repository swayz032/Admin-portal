import { NavLink, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import {
  Home,
  CheckCircle,
  Activity,
  Shield,
  AlertTriangle,
  Users,
  CreditCard,
  Plug,
  Settings,
  X,
  PanelLeftClose,
  PanelLeft,
  Wallet,
  Receipt,
  TrendingUp,
  BarChart3,
  Package,
  Cpu,
  ChevronDown,
  Zap,
  Inbox,
  Server,
  Bot,
  Plus,
  DollarSign,
  Video,
  Mail,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSystem } from '@/contexts/SystemContext';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useErrorStream } from '@/hooks/useErrorStream';
import { useProviderHealthStream } from '@/hooks/useProviderHealthStream';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

const SIDEBAR_COLLAPSED_KEY = 'aspire_sidebar_collapsed';

const coreItems = [
  { to: '/home', icon: Home, label: 'Home' },
  { to: '/approvals', icon: CheckCircle, label: 'Approvals', engineerLabel: 'Authority Queue' },
  { to: '/activity', icon: Activity, label: 'Activity' },
];

const operationsItems = [
  { to: '/receipts', icon: Receipt, label: 'Proof Log', engineerLabel: 'Receipts' },
  { to: '/outbox', icon: Inbox, label: 'Tasks', engineerLabel: 'Outbox' },
  { to: '/automation', icon: Zap, label: 'Automation' },
  { to: '/safety', icon: Shield, label: 'Safety' },
  { to: '/incidents', icon: AlertTriangle, label: 'Incidents' },
];

const platformItems = [
  { to: '/connected-apps', icon: Plug, label: 'Services', engineerLabel: 'Providers' },
  { to: '/provider-call-log', icon: Server, label: 'Call Log', engineerLabel: 'Provider Logs' },
  { to: '/customers', icon: Users, label: 'Customers' },
  { to: '/subscriptions', icon: CreditCard, label: 'Billing', engineerLabel: 'Subscriptions' },
  { to: '/advanced', icon: Settings, label: 'Settings', engineerLabel: 'Advanced' },
];

const businessControlItems = [
  { to: '/business/runway-burn', icon: Wallet, label: 'Runway & Burn' },
  { to: '/business/costs-usage', icon: Receipt, label: 'Costs & Usage' },
  { to: '/business/revenue-addons', icon: TrendingUp, label: 'Revenue' },
  { to: '/business/acquisition-analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/business/audience', icon: Users, label: 'Audience' },
];

const visibilityItems = [
  { to: '/visibility/finance', icon: DollarSign, label: 'Finance', engineerLabel: 'Finance Receipts' },
  { to: '/visibility/conference', icon: Video, label: 'Conferences', engineerLabel: 'Conference Monitor' },
  { to: '/visibility/mail', icon: Mail, label: 'Mail', engineerLabel: 'Mail Visibility' },
];

const skillPackItems = [
  { to: '/skill-packs/registry', icon: Package, label: 'Registry' },
  { to: '/skill-packs/analytics', icon: Cpu, label: 'Analytics' },
];

export function Sidebar({ isOpen, onClose, isCollapsed, onToggleCollapse }: SidebarProps) {
  const location = useLocation();
  const { viewMode } = useSystem();
  const { counts: errorCounts } = useErrorStream();
  const { degradedCount, disconnectedCount } = useProviderHealthStream();
  const providerIssueCount = degradedCount + disconnectedCount;
  const [opsOpen, setOpsOpen] = useState(() =>
    operationsItems.some(i => location.pathname === i.to)
  );
  const [platformOpen, setPlatformOpen] = useState(() =>
    platformItems.some(i => location.pathname === i.to)
  );
  const [businessOpen, setBusinessOpen] = useState(location.pathname.startsWith('/business'));
  const [skillPacksOpen, setSkillPacksOpen] = useState(location.pathname.startsWith('/skill-packs'));
  const [visibilityOpen, setVisibilityOpen] = useState(location.pathname.startsWith('/visibility'));

  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, JSON.stringify(isCollapsed));
  }, [isCollapsed]);

  // Badge count for specific nav items
  const getBadgeCount = (to: string): number => {
    if (to === '/incidents') return errorCounts.total;
    if (to === '/connected-apps') return providerIssueCount;
    return 0;
  };

  const renderNavItem = (item: { to: string; icon: React.ComponentType<{ className?: string }>; label: string; engineerLabel?: string }) => {
    const isActive = location.pathname === item.to ||
      (item.to === '/home' && location.pathname === '/');

    const displayLabel = viewMode === 'engineer' && item.engineerLabel ? item.engineerLabel : item.label;
    const badgeCount = getBadgeCount(item.to);

    const linkContent = (
      <NavLink
        key={item.to}
        to={item.to}
        onClick={onClose}
        className={cn(
          'group relative flex items-center gap-2.5 px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors duration-150',
          'focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/40',
          isActive
            ? 'bg-accent text-foreground'
            : 'text-muted-foreground hover:bg-accent/40 hover:text-foreground',
          isCollapsed && 'justify-center px-2'
        )}
      >
        {isActive && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-3.5 bg-primary rounded-full" />
        )}
        <item.icon className={cn(
          'h-3.5 w-3.5 flex-shrink-0 transition-colors',
          isActive ? 'text-primary' : 'text-muted-foreground/70 group-hover:text-foreground'
        )} />
        {!isCollapsed && <span className="flex-1">{displayLabel}</span>}
        {!isCollapsed && badgeCount > 0 && (
          <span className={cn(
            'ml-auto inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full text-[9px] font-bold',
            item.to === '/incidents' && errorCounts.p0 > 0 ? 'bg-red-500 text-white animate-pulse' :
            item.to === '/connected-apps' && disconnectedCount > 0 ? 'bg-red-500 text-white' :
            'bg-amber-500 text-white',
          )}>
            {badgeCount > 99 ? '99+' : badgeCount}
          </span>
        )}
      </NavLink>
    );

    if (isCollapsed) {
      return (
        <Tooltip key={item.to} delayDuration={0}>
          <TooltipTrigger asChild>
            {linkContent}
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={8}>
            {displayLabel}
          </TooltipContent>
        </Tooltip>
      );
    }

    return linkContent;
  };

  const renderCollapsibleGroup = (
    title: string,
    items: typeof businessControlItems,
    isGroupOpen: boolean,
    setGroupOpen: (open: boolean) => void
  ) => {
    const isAnyActive = items.some(item => location.pathname === item.to);

    if (isCollapsed) {
      return (
        <div className="space-y-px">
          {items.map(item => renderNavItem(item))}
        </div>
      );
    }

    return (
      <Collapsible open={isGroupOpen} onOpenChange={setGroupOpen}>
        <CollapsibleTrigger asChild>
          <button
            className={cn(
              'flex items-center justify-between w-full px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors duration-150',
              'text-muted-foreground hover:bg-accent/40 hover:text-foreground',
              isAnyActive && 'text-foreground'
            )}
          >
            <span>{title}</span>
            <ChevronDown className={cn('h-3 w-3 transition-transform duration-200', isGroupOpen && 'rotate-180')} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pl-2.5 space-y-px mt-px">
          {items.map(item => renderNavItem(item))}
        </CollapsibleContent>
      </Collapsible>
    );
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed lg:static inset-y-0 left-0 z-50 flex flex-col border-r border-border transition-all duration-300 ease-out lg:transform-none',
          'bg-sidebar',
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          isCollapsed ? 'w-14' : 'w-52'
        )}
      >
        {/* Header */}
        <div className={cn(
          'flex items-center h-14 px-3 border-b border-border shrink-0',
          isCollapsed ? 'justify-center' : 'justify-between'
        )}>
          {!isCollapsed && (
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">
                <span className="text-primary font-semibold text-[10px]">A</span>
              </div>
              <span className="font-semibold text-sm text-foreground tracking-tight">Aspire</span>
            </div>
          )}

          {isCollapsed && (
            <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">
              <span className="text-primary font-semibold text-[10px]">A</span>
            </div>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden h-7 w-7"
            onClick={onClose}
          >
            <X className="h-3.5 w-3.5" />
          </Button>

          {!isCollapsed && (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="hidden lg:flex h-6 w-6 text-muted-foreground hover:text-foreground"
                  onClick={onToggleCollapse}
                >
                  <PanelLeftClose className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Collapse</TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* Expand button when collapsed */}
        {isCollapsed && (
          <div className="hidden lg:flex justify-center py-2 border-b border-border">
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-foreground"
                  onClick={onToggleCollapse}
                >
                  <PanelLeft className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Expand</TooltipContent>
            </Tooltip>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 px-2 py-2 space-y-px overflow-y-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
          {/* Core */}
          {coreItems.map(item => renderNavItem(item))}

          {/* Operations group */}
          {!isCollapsed && (
            <div className="pt-3 pb-1">
              <p className="px-3 text-[10px] font-medium text-muted-foreground/50 uppercase tracking-widest">
                Operations
              </p>
            </div>
          )}
          {isCollapsed && <div className="pt-2" />}
          {renderCollapsibleGroup('Ops', operationsItems, opsOpen, setOpsOpen)}

          {/* Platform group */}
          {!isCollapsed && (
            <div className="pt-3 pb-1">
              <p className="px-3 text-[10px] font-medium text-muted-foreground/50 uppercase tracking-widest">
                Platform
              </p>
            </div>
          )}
          {isCollapsed && <div className="pt-2" />}
          {renderCollapsibleGroup('Platform', platformItems, platformOpen, setPlatformOpen)}

          {/* Agent Studio */}
          {!isCollapsed && (
            <div className="pt-3 pb-1">
              <p className="px-3 text-[10px] font-medium text-muted-foreground/50 uppercase tracking-widest">
                Agents
              </p>
            </div>
          )}
          {isCollapsed && <div className="pt-2" />}
          {renderNavItem({ to: '/agent-studio', icon: Bot, label: 'Agent Studio' })}
          {renderNavItem({ to: '/agent-studio/create', icon: Plus, label: 'Create Agent' })}

          {/* Visibility section */}
          {!isCollapsed && (
            <div className="pt-3 pb-1">
              <p className="px-3 text-[10px] font-medium text-muted-foreground/50 uppercase tracking-widest">
                Visibility
              </p>
            </div>
          )}
          {isCollapsed && <div className="pt-2" />}
          {renderCollapsibleGroup('Visibility', visibilityItems, visibilityOpen, setVisibilityOpen)}

          {/* Business section */}
          {viewMode === 'operator' && (
            <>
              {!isCollapsed && (
                <div className="pt-3 pb-1">
                  <p className="px-3 text-[10px] font-medium text-muted-foreground/50 uppercase tracking-widest">
                    Business
                  </p>
                </div>
              )}
              {renderCollapsibleGroup('Finance', businessControlItems, businessOpen, setBusinessOpen)}
            </>
          )}

          {/* Skill Packs */}
          {viewMode === 'operator' && (
            <>
              {!isCollapsed && (
                <div className="pt-3 pb-1">
                  <p className="px-3 text-[10px] font-medium text-muted-foreground/50 uppercase tracking-widest">
                    Skill Packs
                  </p>
                </div>
              )}
              {renderCollapsibleGroup('Packs', skillPackItems, skillPacksOpen, setSkillPacksOpen)}
            </>
          )}
        </nav>

        {/* Version badge */}
        <div className={cn(
          'shrink-0 border-t border-border px-3 py-2',
          isCollapsed && 'px-2 text-center'
        )}>
          <span className="text-[10px] text-muted-foreground/40 font-mono">
            {isCollapsed ? 'v1' : `v${APP_VERSION}`}
          </span>
        </div>
      </aside>
    </>
  );
}

// Injected at build time by Vite — see vite.config.ts `define` block.
// Falls back to package.json version via import.meta.env.
const APP_VERSION = __APP_VERSION__ ?? '0.0.0';
