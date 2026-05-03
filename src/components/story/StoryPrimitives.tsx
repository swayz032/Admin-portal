import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ArrowRight, CheckCircle2, Clock3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type StoryTone = 'neutral' | 'healthy' | 'watch' | 'critical';

const toneClasses: Record<StoryTone, string> = {
  neutral: 'border-border text-foreground',
  healthy: 'border-success/30 text-foreground',
  watch: 'border-warning/35 text-foreground',
  critical: 'border-destructive/35 text-foreground',
};

const dotClasses: Record<StoryTone, string> = {
  neutral: 'bg-primary',
  healthy: 'bg-success',
  watch: 'bg-warning',
  critical: 'bg-destructive',
};

interface StoryBriefProps {
  eyebrow: string;
  title: string;
  summary: string;
  tone?: StoryTone;
  meta?: string[];
  primaryAction?: { label: string; to: string };
  secondaryAction?: { label: string; to: string };
}

export function StoryBrief({
  eyebrow,
  title,
  summary,
  tone = 'neutral',
  meta = [],
  primaryAction,
  secondaryAction,
}: StoryBriefProps) {
  return (
    <section className={cn('xtract-hero-panel relative overflow-hidden px-5 py-5 sm:px-7 sm:py-7', toneClasses[tone])}>
      <div className="absolute left-0 top-0 h-full w-1 bg-primary" />
      <div className="relative z-10 max-w-4xl space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn('h-2 w-2 rounded-full', dotClasses[tone])} />
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{eyebrow}</p>
        </div>
        <div className="space-y-3">
          <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-foreground sm:text-5xl">
            {title}
          </h1>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
            {summary}
          </p>
        </div>
        {(meta.length > 0 || primaryAction || secondaryAction) && (
          <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              {meta.map((item) => (
                <span key={item} className="rounded-full border border-border bg-surface-2 px-3 py-1 text-xs text-muted-foreground">
                  {item}
                </span>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {secondaryAction && (
                <Button variant="outline" size="sm" asChild>
                  <Link to={secondaryAction.to}>{secondaryAction.label}</Link>
                </Button>
              )}
              {primaryAction && (
                <Button size="sm" asChild>
                  <Link to={primaryAction.to} className="gap-2">
                    {primaryAction.label}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

interface StoryMetricCardProps {
  label: string;
  value: string | number;
  story: string;
  source?: string;
  freshness?: string;
  tone?: StoryTone;
  icon?: LucideIcon;
  action?: { label: string; to: string };
}

export function StoryMetricCard({
  label,
  value,
  story,
  source,
  freshness,
  tone = 'neutral',
  icon: Icon,
  action,
}: StoryMetricCardProps) {
  return (
    <article className={cn('xtract-lane-card flex min-h-[240px] flex-col justify-between p-5 transition-colors hover:border-primary/50', toneClasses[tone])}>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {Icon && (
              <span className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-surface-2">
                <Icon className="h-4 w-4 text-primary" />
              </span>
            )}
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
          </div>
          <span className={cn('h-2 w-2 rounded-full', dotClasses[tone])} />
        </div>
        <div className="space-y-2">
          <p className="text-4xl font-semibold tracking-tight text-foreground">{value}</p>
          <p className="text-sm leading-6 text-muted-foreground">{story}</p>
        </div>
      </div>
      <div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-4 text-xs text-muted-foreground">
        <span>{source || 'Live admin data'}</span>
        {freshness && (
          <span className="inline-flex items-center gap-1">
            <Clock3 className="h-3.5 w-3.5" />
            {freshness}
          </span>
        )}
        {action && (
          <Link to={action.to} className="inline-flex items-center gap-1 font-medium text-primary hover:text-primary/80">
            {action.label}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
    </article>
  );
}

export interface StoryActionItem {
  id: string;
  title: string;
  description: string;
  cause?: string;
  fix?: string;
  meta?: string;
  tone?: StoryTone;
  to: string;
  actionLabel?: string;
}

interface StoryActionQueueProps {
  title: string;
  subtitle: string;
  items: StoryActionItem[];
  emptyTitle: string;
  emptyText: string;
  maxItems?: number;
}

export function StoryActionQueue({
  title,
  subtitle,
  items,
  emptyTitle,
  emptyText,
  maxItems = 6,
}: StoryActionQueueProps) {
  const visibleItems = items.slice(0, maxItems);

  return (
    <section className="story-surface overflow-hidden">
      <div className="flex flex-col gap-1 border-b border-border bg-surface-2 px-5 py-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      {visibleItems.length === 0 ? (
        <div className="flex items-start gap-3 px-5 py-7">
          <span className="flex h-9 w-9 items-center justify-center rounded-md border border-success/30 bg-success/10">
            <CheckCircle2 className="h-4 w-4 text-success" />
          </span>
          <div className="space-y-1">
            <p className="font-medium text-foreground">{emptyTitle}</p>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{emptyText}</p>
          </div>
        </div>
      ) : (
        <div className="story-list-scroll divide-y divide-border">
          {visibleItems.map((item, index) => (
            <Link
              key={`${item.id || 'story-action'}-${index}`}
              to={item.to}
              className="group grid gap-3 px-5 py-4 transition-colors hover:bg-surface-2 sm:grid-cols-[44px_1fr_auto]"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-surface-2 text-sm font-semibold text-muted-foreground">
                {index + 1}
              </div>
              <div className={cn('border-l-2 pl-3', item.tone === 'critical' ? 'border-l-destructive' : item.tone === 'watch' ? 'border-l-warning' : 'border-l-primary')}>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-foreground">{item.title}</p>
                  {item.meta && <span className="text-xs text-muted-foreground">{item.meta}</span>}
                </div>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.description}</p>
                {(item.cause || item.fix) && (
                  <div className="mt-3 grid gap-2 xl:grid-cols-2">
                    {item.cause && (
                      <div className="rounded-md border border-border bg-background/70 px-3 py-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Cause</p>
                        <p className="mt-1 text-xs leading-5 text-foreground">{item.cause}</p>
                      </div>
                    )}
                    {item.fix && (
                      <div className="rounded-md border border-primary/25 bg-primary/5 px-3 py-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">Fix</p>
                        <p className="mt-1 text-xs leading-5 text-foreground">{item.fix}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <span className="inline-flex items-center gap-1 text-sm font-medium text-primary group-hover:text-primary/80">
                {item.actionLabel || 'Open'}
                <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

interface StoryEvidencePanelProps {
  title: string;
  description?: string;
  children: ReactNode;
  action?: { label: string; to: string };
}

export function StoryEvidencePanel({ title, description, children, action }: StoryEvidencePanelProps) {
  return (
    <section className="story-surface overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-border bg-surface-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {action && (
          <Button variant="outline" size="sm" asChild>
            <Link to={action.to} className="gap-2">
              {action.label}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        )}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

interface TelemetryDrawerProps {
  title: string;
  summary: string;
  items: Array<{ id: string; title: string; meta?: string; to?: string }>;
  emptyText: string;
}

export function TelemetryDrawer({ title, summary, items, emptyText }: TelemetryDrawerProps) {
  return (
    <details className="story-surface overflow-hidden">
      <summary className="cursor-pointer list-none border-b border-border bg-surface-2 px-5 py-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-foreground">{title}</h2>
            <p className="text-sm text-muted-foreground">{summary}</p>
          </div>
          <span className="text-sm font-medium text-primary">Open telemetry</span>
        </div>
      </summary>
      {items.length === 0 ? (
        <p className="px-5 py-5 text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <div className="divide-y divide-border">
          {items.slice(0, 20).map((item, index) => {
            const content = (
              <div className="flex flex-col gap-1 px-5 py-3 hover:bg-surface-2">
                <p className="text-sm font-medium text-foreground">{item.title}</p>
                {item.meta && <p className="text-xs text-muted-foreground">{item.meta}</p>}
              </div>
            );

            return item.to ? (
              <Link key={`${item.id || 'telemetry'}-${index}`} to={item.to}>
                {content}
              </Link>
            ) : (
              <div key={`${item.id || 'telemetry'}-${index}`}>{content}</div>
            );
          })}
        </div>
      )}
    </details>
  );
}
