import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  ChevronRight,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useApprovals, useIncidents } from '@/hooks/useAdminData';

interface AvaQuickPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AvaQuickPanel({ isOpen, onClose }: AvaQuickPanelProps) {
  // Real Supabase data
  const { data: allApprovals } = useApprovals({ status: 'Pending' });
  const { data: allIncidents } = useIncidents({ status: 'Open' });
  const pendingApprovals = allApprovals.length;
  const openIncidents = allIncidents.length;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const quickActions = [
    {
      icon: CheckCircle,
      label: 'Review approvals',
      count: pendingApprovals,
      linkTo: '/approvals',
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      icon: AlertTriangle,
      label: 'Check incidents',
      count: openIncidents,
      linkTo: '/incidents',
      color: 'text-warning',
      bgColor: 'bg-warning/10',
    },
    {
      icon: TrendingUp,
      label: 'See revenue',
      linkTo: '/business/revenue-addons',
      color: 'text-success',
      bgColor: 'bg-success/10',
    },
  ];

  const contextInsights = [
    pendingApprovals > 0 && `${pendingApprovals} approval${pendingApprovals > 1 ? 's' : ''} waiting`,
    openIncidents > 0 && `${openIncidents} open incident${openIncidents > 1 ? 's' : ''}`,
    'Systems running normally',
  ].filter(Boolean);

  return (
    <div
      className={cn(
        'fixed bottom-24 right-6 z-50',
        'w-80 rounded-2xl',
        'bg-card border border-border',
        'shadow-2xl shadow-black/40',
        'transition-all duration-300 ease-out',
        'origin-bottom-right',
        isOpen
          ? 'opacity-100 scale-100 translate-y-0'
          : 'opacity-0 scale-95 translate-y-4 pointer-events-none'
      )}
    >
      {/* Header with Ava branding */}
      <div className="p-5 border-b border-border bg-gradient-to-r from-primary/10 to-transparent rounded-t-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{getGreeting()}!</h3>
            <p className="text-sm text-muted-foreground">I'm Ava, your assistant</p>
          </div>
        </div>
      </div>

      {/* Context summary */}
      <div className="p-4 border-b border-border">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
          Quick summary
        </p>
        <ul className="space-y-1.5">
          {contextInsights.map((insight, index) => (
            <li key={index} className="flex items-center gap-2 text-sm text-foreground">
              <div className="w-1.5 h-1.5 rounded-full bg-primary" />
              {insight}
            </li>
          ))}
        </ul>
      </div>

      {/* Quick actions */}
      <div className="p-4 space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
          Quick actions
        </p>
        {quickActions.map((action, index) => {
          const Icon = action.icon;
          return (
            <Link
              key={index}
              to={action.linkTo}
              onClick={onClose}
              className={cn(
                'flex items-center gap-3 p-3 rounded-lg',
                'bg-surface-1 hover:bg-surface-2',
                'transition-colors duration-150',
                'group'
              )}
            >
              <div className={cn('p-2 rounded-lg', action.bgColor)}>
                <Icon className={cn('h-4 w-4', action.color)} />
              </div>
              <span className="flex-1 text-sm font-medium">{action.label}</span>
              {action.count !== undefined && action.count > 0 && (
                <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  {action.count}
                </span>
              )}
              <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>
          );
        })}
      </div>

      {/* Open full session link */}
      <div className="p-4 border-t border-border">
        <Button
          asChild
          variant="outline"
          className="w-full justify-center gap-2"
          onClick={onClose}
        >
          <Link to="/llm-ops-desk">
            <Sparkles className="h-4 w-4" />
            Open full session
            <ExternalLink className="h-3 w-3 ml-1" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
