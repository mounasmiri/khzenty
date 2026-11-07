import { Link, NavLink, Outlet } from 'react-router';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/use-auth';

const NAV = [
  { to: '/', label: 'Wardrobe', end: true },
  { to: '/outfits', label: 'Outfits', end: false },
  { to: '/laundry', label: 'Laundry', end: false },
] as const;

/** Layout for every signed-in page: shared header plus the routed content. */
export function AppShell() {
  const { user, logout } = useAuth();

  return (
    <div className="bg-background text-foreground min-h-screen">
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 p-4">
          <Link to="/" className="flex flex-col">
            <span className="text-xl font-semibold tracking-tight">Khzenty</span>
            <span className="text-muted-foreground text-xs">
              Organize less. Decide faster. Dress better.
            </span>
          </Link>

          <div className="flex items-center gap-3">
            {NAV.map((entry) => (
              <NavLink key={entry.to} to={entry.to} end={entry.end}>
                {({ isActive }) => (
                  <Button
                    asChild
                    variant={isActive ? 'secondary' : 'ghost'}
                    size="sm"
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <span>{entry.label}</span>
                  </Button>
                )}
              </NavLink>
            ))}
            <span className="text-muted-foreground hidden text-sm sm:inline">
              {user?.name ?? user?.email}
            </span>
            <Button variant="outline" size="sm" onClick={() => void logout()}>
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl p-4">
        <Outlet />
      </div>
    </div>
  );
}
