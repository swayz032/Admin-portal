/**
 * SuggestionChips — horizontal scrolling quick action pills.
 * AI Elements style: single row, overflow scroll, no wrapping.
 */

import { Activity, AlertTriangle, Brain, Server, Zap, Shield } from 'lucide-react';

interface SuggestionChipsProps {
  onSelect: (text: string) => void;
}

const suggestions = [
  { label: 'Check system health', icon: Activity, text: 'Check the overall system health and provider status' },
  { label: 'Show incidents', icon: AlertTriangle, text: 'Show me all open incidents sorted by severity' },
  { label: 'Run Meeting of Minds', icon: Brain, text: 'Run a Meeting of the Minds council on the top priority incident' },
  { label: 'Analyze providers', icon: Server, text: 'Analyze provider connectivity and performance' },
  { label: 'Run robot tests', icon: Zap, text: 'Run synthetic robot verification tests' },
  { label: 'Security review', icon: Shield, text: 'Run a security posture review on recent receipts' },
];

export function SuggestionChips({ onSelect }: SuggestionChipsProps) {
  return (
    <div className="pb-3">
      <div className="flex gap-2 overflow-x-auto scrollbar-thin pb-1">
        {suggestions.map((s) => (
          <button
            key={s.label}
            onClick={() => onSelect(s.text)}
            className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium text-text-secondary bg-surface-1 border border-border/50 hover:border-primary/30 hover:text-primary hover:bg-primary/5 transition-all cursor-pointer"
          >
            <s.icon className="w-3.5 h-3.5" />
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
