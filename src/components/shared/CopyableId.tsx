import { Link } from 'react-router-dom';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Copy, Check, ExternalLink } from 'lucide-react';

interface CopyableIdProps {
  /** Full UUID (shown in tooltip, copied to clipboard) */
  fullId: string;
  /** Human-readable display label (e.g. RCP-A1B2C3D4) */
  displayId: string;
  /** Whether this ID was just copied (for check icon feedback) */
  isCopied: boolean;
  /** Copy handler */
  onCopy: (text: string) => void;
  /** Optional link (e.g. trace link) — renders as Link instead of button */
  linkTo?: string;
}

export function CopyableId({ fullId, displayId, isCopied, onCopy, linkTo }: CopyableIdProps) {
  if (linkTo) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            to={linkTo}
            onClick={(e) => e.stopPropagation()}
            className="font-mono text-xs font-bold text-primary hover:underline flex items-center gap-1"
          >
            {displayId}
            <ExternalLink className="h-3 w-3" />
          </Link>
        </TooltipTrigger>
        <TooltipContent side="right">
          <span className="font-mono text-xs">{fullId}</span>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={(e) => { e.stopPropagation(); onCopy(fullId); }}
          className="font-mono text-sm font-bold text-primary hover:underline cursor-pointer"
        >
          {displayId}
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" className="flex items-center gap-2">
        <span className="font-mono text-xs">{fullId}</span>
        {isCopied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
      </TooltipContent>
    </Tooltip>
  );
}
