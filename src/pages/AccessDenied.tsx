import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { ShieldX } from 'lucide-react';

export default function AccessDenied() {
  const { signOut } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center max-w-sm px-6">
        <div className="w-11 h-11 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center justify-center mx-auto mb-5">
          <ShieldX className="h-5 w-5 text-destructive" />
        </div>
        <h1 className="text-xl font-semibold text-foreground tracking-tight">Access Denied</h1>
        <p className="text-sm text-muted-foreground mt-2 mb-6">
          Your account is not authorized to access the admin portal. Contact your administrator for access.
        </p>
        <Button variant="outline" onClick={() => signOut()} className="h-9">
          Sign Out
        </Button>
      </div>
    </div>
  );
}
