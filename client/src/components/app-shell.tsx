import { Link, NavLink, Outlet } from 'react-router';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/use-auth';

const NAV = [
  { to: '/', label: 'Wardrobe', end: true },
  { to: '/outfits', label: 'Outfits', end: false },
  { to: '/trips', label: 'Trips', end: false },
  { to: '/laundry', label: 'Laundry', end: false },
] as const;

// Header colours come from the --header/--nav tokens; in dark mode those tokens
// reproduce the previous neutral look. The focus ring is overridden because the
// default (brown) vanishes against the brown bar.
const NAV_FOCUS =
  'focus-visible:border-header-ring focus-visible:ring-header-ring/50';
const NAV_BASE = `text-header-foreground hover:bg-nav-hover hover:text-nav-hover-foreground dark:hover:bg-nav-hover ${NAV_FOCUS}`;
// Active: baby-blue text with an inset baby-blue underline, so the current page
// reads by more than hue alone.
const NAV_ACTIVE = `bg-nav-active text-nav-active-foreground hover:bg-nav-active hover:text-nav-active-foreground dark:hover:bg-nav-active shadow-[inset_0_-2px_0_0_var(--nav-indicator)] ${NAV_FOCUS}`;
const NAV_IDLE = NAV_BASE;
const HEADER_OUTLINE = `border-header-foreground/50 bg-transparent text-header-foreground hover:bg-nav-hover hover:text-nav-hover-foreground ${NAV_FOCUS}`;

/** Layout for every signed-in page: shared header plus the routed content. */
export function AppShell() {
  const { user, logout } = useAuth();

  return (
    <div className="bg-background text-foreground min-h-screen">
      <header className="bg-header text-header-foreground border-b">
        {/* flex-wrap: with four nav entries the row no longer fits a phone, so
            the nav drops under the logo instead of overflowing the page. */}
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-2 p-4">
          <Link to="/" className="flex flex-col">
            <span className="text-xl font-semibold tracking-tight">Khzenty</span>
            <span className="text-header-muted text-xs">
              Organize less. Decide faster. Dress better.
            </span>
          </Link>

          <div className="flex flex-wrap items-center gap-3">
            {NAV.map((entry) => (
              <NavLink key={entry.to} to={entry.to} end={entry.end}>
                {({ isActive }) => (
                  <Button
                    asChild
                    variant="ghost"
                    size="sm"
                    className={isActive ? NAV_ACTIVE : NAV_IDLE}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <span>{entry.label}</span>
                  </Button>
                )}
              </NavLink>
            ))}
            <span className="text-header-muted hidden text-sm sm:inline">
              {user?.name ?? user?.email}
            </span>
            <Button variant="outline" size="sm" className={HEADER_OUTLINE} onClick={() => void logout()}>
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
