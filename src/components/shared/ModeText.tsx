import { useSystem } from '@/contexts/SystemContext';

interface ModeTextProps {
  operator: string;
  engineer: string;
  operatorShort?: string;
  engineerShort?: string;
  useShort?: boolean;
  className?: string;
}

/**
 * Displays different text based on the global view mode.
 * Use operatorShort/engineerShort for compact displays like chips.
 */
export function ModeText({ 
  operator, 
  engineer, 
  operatorShort, 
  engineerShort,
  useShort = false,
  className 
}: ModeTextProps) {
  const { viewMode } = useSystem();
  
  if (viewMode === 'operator') {
    return <span className={className}>{useShort && operatorShort ? operatorShort : operator}</span>;
  }
  
  return <span className={className}>{useShort && engineerShort ? engineerShort : engineer}</span>;
}
