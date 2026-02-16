import { useRef, useEffect } from 'react';
import { useOpsDesk, OpsDeskNote } from '@/contexts/OpsDeskContext';
import { Panel } from '@/components/shared/Panel';
import { formatDate } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { Bot, Code, User } from 'lucide-react';

type AuthorKey = 'Ava' | 'Claude' | 'You';

const authorConfig: Record<AuthorKey, { icon: React.ComponentType<{ className?: string }>; color: string }> = {
  Ava: { icon: Bot, color: 'text-primary' },
  Claude: { icon: Code, color: 'text-success' },
  You: { icon: User, color: 'text-text-primary' },
};

const typeColors: Record<string, string> = {
  Analysis: 'bg-primary/10 text-primary',
  'Fix Plan': 'bg-blue-500/10 text-blue-400',
  'Patch Draft': 'bg-success/10 text-success',
  Decision: 'bg-warning/10 text-warning',
};

export function OpsDeskNotes() {
  const { notes } = useOpsDesk();
  const scrollRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [notes]);
  
  return (
    <Panel title="Ops Desk Notes" collapsible defaultExpanded>
      <div ref={scrollRef} className="h-64 overflow-y-auto space-y-3 pr-1">
        {notes.length === 0 ? (
          <p className="text-sm text-text-tertiary text-center py-8">
            No notes yet. Run Analyze to generate the first entry.
          </p>
        ) : (
          notes.map(note => {
            const authorKey = (note.author as AuthorKey) || 'You';
            const config = authorConfig[authorKey] || authorConfig.You;
            const Icon = config.icon;
            const noteType = note.type || 'Decision';
            const typeColor = typeColors[noteType] || typeColors.Decision;
            const body = note.body || note.content || '';
            
            return (
              <div key={note.id} className="p-3 rounded-lg bg-surface-1 border border-border">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Icon className={cn('h-4 w-4', config.color)} />
                    <span className={cn('text-xs font-medium', config.color)}>{note.author}</span>
                    <span className={cn('text-xs px-2 py-0.5 rounded-full', typeColor)}>
                      {noteType}
                    </span>
                  </div>
                  <span className="text-xs text-text-tertiary">{formatDate(note.timestamp)}</span>
                </div>
                <div className="text-sm text-text-secondary whitespace-pre-wrap leading-relaxed">
                  {body.split('\n').map((line, i) => {
                    if (line.startsWith('**') && line.includes('**:')) {
                      const [label, ...rest] = line.split('**:');
                      return (
                        <p key={i} className="mb-1">
                          <strong className="text-text-primary">{label.replace(/\*\*/g, '')}:</strong>
                          {rest.join('**:')}
                        </p>
                      );
                    }
                    return <p key={i}>{line}</p>;
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </Panel>
  );
}
