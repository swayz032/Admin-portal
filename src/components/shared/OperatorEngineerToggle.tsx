import { useSystem } from '@/contexts/SystemContext';
import { Button } from '@/components/ui/button';

export function OperatorEngineerToggle() {
  const { viewMode, setViewMode } = useSystem();
  
  return (
    <div className="flex items-center gap-1 bg-surface-1 rounded-lg p-1">
      <Button
        size="sm"
        variant={viewMode === 'operator' ? 'default' : 'ghost'}
        onClick={() => setViewMode('operator')}
        className="text-xs h-7"
      >
        Operator
      </Button>
      <Button
        size="sm"
        variant={viewMode === 'engineer' ? 'default' : 'ghost'}
        onClick={() => setViewMode('engineer')}
        className="text-xs h-7"
      >
        Engineer
      </Button>
    </div>
  );
}
