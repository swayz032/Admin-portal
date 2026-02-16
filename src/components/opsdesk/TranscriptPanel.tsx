import { useRef, useEffect } from 'react';
import { useOpsDesk } from '@/contexts/OpsDeskContext';
import { Panel } from '@/components/shared/Panel';
import { formatDate } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { User, Bot, Cpu } from 'lucide-react';

const speakerConfig = {
  You: { icon: User, bgColor: 'bg-surface-2', textColor: 'text-text-primary' },
  Ava: { icon: Bot, bgColor: 'bg-primary/10', textColor: 'text-primary' },
  Claude: { icon: Cpu, bgColor: 'bg-success/10', textColor: 'text-success' },
};

export function TranscriptPanel() {
  const { transcript } = useOpsDesk();
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript]);
  
  return (
    <Panel title="Transcript" collapsible defaultExpanded>
      <div 
        ref={scrollRef}
        className="h-64 overflow-y-auto space-y-3 pr-1"
      >
        {transcript.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-text-tertiary">
              No transcript yet. Use Start Session to begin.
            </p>
          </div>
        ) : (
          transcript.map(entry => {
            const config = speakerConfig[entry.speaker];
            const Icon = config.icon;
            
            return (
              <div key={entry.id} className={cn('p-3 rounded-lg border border-border', config.bgColor)}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <Icon className={cn('h-4 w-4', config.textColor)} />
                    <span className={cn('text-xs font-medium', config.textColor)}>
                      {entry.speaker}
                    </span>
                  </div>
                  <span className="text-xs text-text-tertiary">
                    {formatDate(entry.timestamp)}
                  </span>
                </div>
                <p className="text-sm text-text-secondary leading-relaxed">
                  {entry.message}
                </p>
              </div>
            );
          })
        )}
      </div>
    </Panel>
  );
}
