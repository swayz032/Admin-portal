import { NavLink, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Bot,
  CheckCircle2,
  ClipboardList,
  DatabaseZap,
  HeartPulse,
  Home,
  PanelLeft,
  PanelLeftClose,
  ServerCog,
  ShieldAlert,
  Users,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

interface NavItem {
  to: string;
  icon: LucideIcon;
  label: string;
}

const SIDEBAR_COLLAPSED_KEY = 'aspire_sidebar_collapsed';

const storyItems: NavItem[] = [
  { to: '/home', icon: Home, label: 'Home' },
  { to: '/admin-health', icon: ServerCog, label: 'Admin Health' },
  { to: '/aspire-health', icon: HeartPulse, label: 'Aspire Health' },
  { to: '/users', icon: Users, label: 'Users' },
];

const proofItems: NavItem[] = [
  { to: '/admin-logs', icon: ClipboardList, label: 'Admin Logs' },
  { to: '/approvals', icon: CheckCircle2, label: 'Approvals' },
  { to: '/incidents', icon: ShieldAlert, label: 'Incidents' },
  { to: '/provider-call-log', icon: DatabaseZap, label: 'Provider Calls' },
  { to: '/llm-ops-desk', icon: Bot, label: 'Ava' },
];

export function Sidebar({ isOpen, onClose, isCollapsed, onToggleCollapse }: SidebarProps) {
  const location = useLocation();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, JSON.stringify(isCollapsed));
  }, [isCollapsed]);

  const renderNavItem = (item: NavItem) => {
    const isActive = location.pathname === item.to || (item.to === '/home' && location.pathname === '/');
    const linkContent = (
      <NavLink
        key={item.to}
        to={item.to}
        onClick={onClose}
        className={cn(
          'group relative flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium transition-colors duration-150',
          'focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/40',
          isActive
            ? 'bg-accent text-foreground'
            : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
          isCollapsed && 'justify-center px-2',
        )}
      >
        {isActive && (
          <div className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-primary" />
        )}
        <item.icon
          className={cn(
            'h-4 w-4 flex-shrink-0 transition-colors',
            isActive ? 'text-primary' : 'text-muted-foreground/70 group-hover:text-foreground',
          )}
        />
        {!isCollapsed && <span className="flex-1">{item.label}</span>}
      </NavLink>
    );

    if (!isCollapsed) return linkContent;

    return (
      <Tooltip key={item.to} delayDuration={0}>
        <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          {item.label}
        </TooltipContent>
      </Tooltip>
    );
  };

  const renderSection = (title: string, items: NavItem[]) => (
    <div className="space-y-px">
      {!isCollapsed && (
        <div className="px-3 pb-1 pt-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">{title}</p>
        </div>
      )}
      {isCollapsed && <div className="pt-2" />}
      {items.map(renderNavItem)}
    </div>
  );

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col border-r border-border bg-sidebar transition-all duration-300 ease-out lg:static lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          isCollapsed ? 'w-14' : 'w-56',
        )}
      >
        <div
          className={cn(
            'flex h-14 shrink-0 items-center border-b border-border px-3',
            isCollapsed ? 'justify-center' : 'justify-between',
          )}
        >
          {!isCollapsed && (
            <img src="/aspire-logo-full.png" alt="Aspire" height={22} className="h-[22px] w-auto object-contain" />
          )}

          {isCollapsed && (
            <img src="/aspire-logo-full.png" alt="Aspire" width={24} height={24} className="h-6 w-6 object-contain" />
          )}

          <Button variant="ghost" size="icon" className="h-7 w-7 lg:hidden" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </Button>

          {!isCollapsed && (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="hidden h-6 w-6 text-muted-foreground hover:text-foreground lg:flex"
                  onClick={onToggleCollapse}
                >
                  <PanelLeftClose className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Collapse</TooltipContent>
            </Tooltip>
          )}
        </div>

        {isCollapsed && (
          <div className="hidden justify-center border-b border-border py-2 lg:flex">
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

        <nav className="flex-1 overflow-y-auto px-2 py-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border">
          {renderSection('Stories', storyItems)}
          {renderSection('Proof', proofItems)}
        </nav>

        <div className={cn('shrink-0 border-t border-border px-3 py-2', isCollapsed && 'px-2 text-center')}>
          <span className="font-mono text-[10px] text-muted-foreground/40">
            {isCollapsed ? 'v1' : `v${APP_VERSION}`}
          </span>
        </div>
      </aside>
    </>
  );
}

const APP_VERSION = __APP_VERSION__ ?? '0.0.0';
