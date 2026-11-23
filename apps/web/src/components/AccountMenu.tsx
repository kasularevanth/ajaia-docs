import * as Menu from '@radix-ui/react-dropdown-menu';
import { ChevronDown, LogOut, Users } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useCurrentUser, useAuth } from '../features/auth/AuthProvider';
import { Avatar } from './ui';

export function AccountMenu() {
  const user = useCurrentUser();
  const { logout } = useAuth();
  const navigate = useNavigate();

  const signOut = () => {
    logout();
    navigate('/login');
  };

  return (
    <Menu.Root>
      <Menu.Trigger
        className="flex items-center gap-2 rounded-full py-1 pr-2 pl-1 text-sm hover:bg-desk-deep/70"
        aria-label={`Account: ${user.name}`}
      >
        <Avatar name={user.name} size={30} />
        <span className="hidden font-medium sm:inline">{user.name}</span>
        <ChevronDown className="size-4 text-muted" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content
          align="end"
          sideOffset={8}
          className="z-50 min-w-60 rounded-xl border border-line bg-paper p-1.5 shadow-pop"
        >
          <div className="px-3 py-2">
            <p className="text-sm font-semibold">{user.name}</p>
            <p className="text-xs text-muted">{user.email}</p>
          </div>
          <Menu.Separator className="my-1 h-px bg-line" />
          <Menu.Item
            onSelect={signOut}
            className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none data-[highlighted]:bg-desk"
          >
            <Users className="size-4 text-muted" /> Switch account
          </Menu.Item>
          <Menu.Item
            onSelect={signOut}
            className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none data-[highlighted]:bg-desk"
          >
            <LogOut className="size-4 text-muted" /> Sign out
          </Menu.Item>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}
