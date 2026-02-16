import { cn } from '@/lib/utils';

// Staff avatar imports
import avaAvatar from '@/assets/staff/ava.png';
import sarahAvatar from '@/assets/staff/sarah.png';
import eliAvatar from '@/assets/staff/eli.png';
import quinnAvatar from '@/assets/staff/quinn.png';
import noraAvatar from '@/assets/staff/nora.png';
import claraAvatar from '@/assets/staff/clara.png';

type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';
type AvatarStatus = 'active' | 'draft' | 'paused' | 'deprecated' | 'proposed';

interface StaffAvatarProps {
  staffId: string;
  name: string;
  size?: AvatarSize;
  status?: AvatarStatus;
  showStatus?: boolean;
  className?: string;
}

const staffAvatars: Record<string, string> = {
  ava: avaAvatar,
  sarah: sarahAvatar,
  eli: eliAvatar,
  quinn: quinnAvatar,
  nora: noraAvatar,
  clara: claraAvatar,
};

// Gradient backgrounds for staff without photos
const staffGradients: Record<string, string> = {
  adam: 'bg-gradient-to-br from-violet-500 to-purple-600',
  tec: 'bg-gradient-to-br from-emerald-500 to-teal-600',
  finn: 'bg-gradient-to-br from-blue-500 to-indigo-600',
  milo: 'bg-gradient-to-br from-orange-500 to-amber-600',
  teressa: 'bg-gradient-to-br from-rose-500 to-pink-600',
  default: 'bg-gradient-to-br from-primary/80 to-primary',
};

const sizeClasses: Record<AvatarSize, { container: string; text: string; status: string }> = {
  sm: { container: 'h-10 w-10', text: 'text-sm font-semibold', status: 'h-2.5 w-2.5 -bottom-0.5 -right-0.5' },
  md: { container: 'h-14 w-14', text: 'text-base font-semibold', status: 'h-3 w-3 -bottom-0.5 -right-0.5' },
  lg: { container: 'h-20 w-20', text: 'text-xl font-bold', status: 'h-4 w-4 -bottom-1 -right-1' },
  xl: { container: 'h-24 w-24', text: 'text-2xl font-bold', status: 'h-5 w-5 -bottom-1 -right-1' },
};

const statusColors: Record<AvatarStatus, string> = {
  active: 'bg-success',
  draft: 'bg-muted-foreground',
  proposed: 'bg-warning',
  paused: 'bg-warning',
  deprecated: 'bg-destructive',
};

function getInitials(name: string): string {
  const parts = name.split(' ').filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function StaffAvatar({
  staffId,
  name,
  size = 'md',
  status,
  showStatus = false,
  className,
}: StaffAvatarProps) {
  const avatarUrl = staffAvatars[staffId];
  const sizeConfig = sizeClasses[size];
  const gradient = staffGradients[staffId] || staffGradients.default;
  const initials = getInitials(name);

  return (
    <div className={cn('relative', className)}>
      <div
        className={cn(
          sizeConfig.container,
          'relative rounded-full overflow-hidden',
          'bg-surface-2',
        )}
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div
            className={cn(
              'h-full w-full flex items-center justify-center',
              gradient
            )}
          >
            <span className={cn(sizeConfig.text, 'text-white')}>
              {initials}
            </span>
          </div>
        )}
      </div>

      {showStatus && status && (
        <div
          className={cn(
            'absolute rounded-full border-2 border-background',
            sizeConfig.status,
            statusColors[status],
          )}
        />
      )}
    </div>
  );
}
