import { Menu, Bell, User, Bot, LogOut } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSystem } from '@/contexts/SystemContext';
import { useAuth } from '@/contexts/AuthContext';
import { OperatorEngineerToggle } from '@/components/shared/OperatorEngineerToggle';
import { GlobalSearch } from '@/components/header/GlobalSearch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const { systemState } = useSystem();
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
  };

  const displayName = user?.displayName || 'User';

  return (
    <header className="h-14 border-b border-border bg-background/95 backdrop-blur-sm flex items-center justify-between px-4 sticky top-0 z-40">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={onMenuClick}
        >
          <Menu className="h-5 w-5" />
        </Button>
        
        {/* Global Search */}
        <GlobalSearch />
      </div>

      <div className="flex items-center gap-2">
        {/* Operator/Engineer Toggle */}
        <div className="hidden md:block">
          <OperatorEngineerToggle />
        </div>
        
        {systemState.safetyMode && (
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-warning/10 border border-warning/20">
            <div className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse" />
            <span className="text-xs font-medium text-warning">Safety Mode</span>
          </div>
        )}
        
        {/* LLM Ops Desk Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9" asChild>
              <Link to="/llm-ops-desk">
                <Bot className="h-4 w-4 text-primary" />
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>LLM Ops Desk</p>
          </TooltipContent>
        </Tooltip>
        
        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          <Bell className="h-4 w-4 text-muted-foreground" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-destructive" />
        </Button>
        
        <div className="w-px h-6 bg-border mx-1" />
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 h-9 px-2 hover:bg-accent">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center ring-1 ring-primary/20">
                <User className="h-3.5 w-3.5 text-primary" />
              </div>
              <span className="hidden sm:block text-sm font-medium text-foreground">{displayName}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium text-foreground">{displayName}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive cursor-pointer">
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
