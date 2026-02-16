import { useState, useRef, useEffect } from 'react';
import { Search, X, User, AlertTriangle, FileText, Zap, CheckCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useSystem } from '@/contexts/SystemContext';
import { cn } from '@/lib/utils';

interface SearchResult {
  id: string;
  type: 'customer' | 'incident' | 'approval' | 'trace' | 'job';
  title: string;
  subtitle: string;
  link: string;
}

// Mock search results - will be wired to real search later
const mockResults: SearchResult[] = [
  { id: '1', type: 'customer', title: 'Acme Corp', subtitle: 'Enterprise • At Risk', link: '/customers?id=CUST-001' },
  { id: '2', type: 'incident', title: 'INC-001', subtitle: 'Stripe payment failing', link: '/incidents?id=INC-001' },
  { id: '3', type: 'approval', title: 'APR-001', subtitle: 'Rotate Stripe API key', link: '/approvals?id=APR-001' },
  { id: '4', type: 'trace', title: 'TRACE-003', subtitle: 'Payment retry blocked', link: '/llm-ops-desk?traceId=TRACE-003' },
  { id: '5', type: 'job', title: 'JOB-003', subtitle: 'Retry failed payment', link: '/automation?job=JOB-003' },
];

const typeIcons = {
  customer: User,
  incident: AlertTriangle,
  approval: CheckCircle,
  trace: FileText,
  job: Zap,
};

const typeLabels = {
  customer: 'Customer',
  incident: 'Incident',
  approval: 'Approval',
  trace: 'Trace',
  job: 'Job',
};

export function GlobalSearch() {
  const { viewMode } = useSystem();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Simulate search
  useEffect(() => {
    if (query.length >= 2) {
      const filtered = mockResults.filter(
        r => r.title.toLowerCase().includes(query.toLowerCase()) ||
             r.subtitle.toLowerCase().includes(query.toLowerCase())
      );
      setResults(filtered);
    } else {
      setResults([]);
    }
  }, [query]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
        setTimeout(() => inputRef.current?.focus(), 0);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const groupedResults = results.reduce((acc, result) => {
    if (!acc[result.type]) acc[result.type] = [];
    acc[result.type].push(result);
    return acc;
  }, {} as Record<string, SearchResult[]>);

  return (
    <div ref={containerRef} className="relative">
      {/* Search Trigger */}
      <Button
        variant="ghost"
        size="sm"
        className="h-8 gap-2 px-2 text-text-secondary hover:text-text-primary"
        onClick={() => {
          setIsOpen(true);
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
      >
        <Search className="h-4 w-4" />
        <span className="hidden sm:inline text-sm">Search</span>
        <kbd className="hidden md:inline-flex h-5 items-center gap-1 rounded border border-border bg-surface-1 px-1.5 font-mono text-[10px] text-text-tertiary">
          ⌘K
        </kbd>
      </Button>

      {/* Search Modal */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-80 sm:w-96 bg-card border border-border rounded-lg shadow-lg z-50">
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
              <Input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={viewMode === 'operator' 
                  ? 'Search customers, issues, approvals...' 
                  : 'Search by ID, trace, correlation...'}
                className="pl-9 pr-9 bg-surface-1 border-none"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {results.length > 0 ? (
              <div className="p-2">
                {Object.entries(groupedResults).map(([type, items]) => (
                  <div key={type} className="mb-3 last:mb-0">
                    <div className="px-2 py-1 text-xs font-medium text-text-tertiary uppercase">
                      {typeLabels[type as keyof typeof typeLabels]}
                    </div>
                    {items.map((result) => {
                      const Icon = typeIcons[result.type];
                      return (
                        <a
                          key={result.id}
                          href={result.link}
                          className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-surface-1 transition-colors"
                          onClick={() => setIsOpen(false)}
                        >
                          <Icon className="h-4 w-4 text-text-tertiary" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{result.title}</p>
                            <p className="text-xs text-text-secondary truncate">{result.subtitle}</p>
                          </div>
                        </a>
                      );
                    })}
                  </div>
                ))}
              </div>
            ) : query.length >= 2 ? (
              <div className="p-8 text-center text-text-tertiary">
                <p className="text-sm">No results found</p>
              </div>
            ) : (
              <div className="p-4 text-center text-text-tertiary">
                <p className="text-sm">
                  {viewMode === 'operator' 
                    ? 'Search for customers, issues, or approvals' 
                    : 'Search by ID, trace ID, correlation ID, or job ID'}
                </p>
                <div className="mt-3 flex flex-wrap gap-1 justify-center">
                  {['APR-', 'INC-', 'TRACE-', 'JOB-', 'CUST-'].map((prefix) => (
                    <button
                      key={prefix}
                      onClick={() => setQuery(prefix)}
                      className="px-2 py-1 text-xs font-mono bg-surface-1 rounded hover:bg-surface-2"
                    >
                      {prefix}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
