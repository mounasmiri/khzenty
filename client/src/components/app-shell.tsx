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
        {/* Under 640px: brand and Sign out share the first row, the nav is one
            compact row beneath (scrolling sideways if it ever outgrows the
            screen). From 640px up the group is a plain flex row again, exactly
            as before. `contents` / `order` reflow the same elements rather than
            duplicating them. */}
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-1.5 sm:gap-y-2 sm:p-4">
          <Link to="/" className="flex flex-col">
            <span className="text-xl leading-6 font-semibold tracking-tight sm:leading-7">Khzenty</span>
            <span className="text-header-muted hidden text-xs sm:block">
              Organize less. Decide faster. Dress better.
            </span>
          </Link>

          <div className="contents sm:flex sm:flex-wrap sm:items-center sm:gap-3">
            <nav
              aria-label="Main"
              className="order-3 -my-1 flex w-full gap-0.5 overflow-x-auto py-1 [scrollbar-width:none] sm:contents [&::-webkit-scrollbar]:hidden"
            >
              {NAV.map((entry) => (
                <NavLink key={entry.to} to={entry.to} end={entry.end} className="shrink-0">
                  {({ isActive }) => (
                    <Button
                      asChild
                      variant="ghost"
                      size="sm"
                      className={`h-8 px-2 sm:h-7 sm:px-2.5 ${isActive ? NAV_ACTIVE : NAV_IDLE}`}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      <span>{entry.label}</span>
                    </Button>
                  )}
                </NavLink>
              ))}
            </nav>
            <span className="text-header-muted hidden text-sm sm:inline">
              {user?.name ?? user?.email}
            </span>
            <Button
              variant="outline"
              size="sm"
              className={`order-2 h-8 sm:order-none sm:h-7 ${HEADER_OUTLINE}`}
              onClick={() => void logout()}
            >
              Sign out
            </Button>
          </div>
        </div>
      </header>

      {user?.isDemo ? (
        <p role="note" className="bg-muted text-muted-foreground px-4 py-1.5 text-center text-xs text-balance">
          Demo: your changes are private and deleted after 24 hours.
        </p>
      ) : null}

      <div className="mx-auto max-w-5xl p-4">
        <Outlet />
      </div>
    </div>
  );
}
