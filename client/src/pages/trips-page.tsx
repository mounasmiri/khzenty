import { Link } from 'react-router';

import { Button } from '@/components/ui/button';
import { daysLabel, formatDateRange, percent } from '@/features/trips/trip-format';
import { useTrips } from '@/features/trips/use-trips';

export function TripsPage() {
  const { trips, error } = useTrips();

  if (error) {
    return (
      <p role="alert" className="text-destructive text-sm">
        {error}
      </p>
    );
  }

  if (!trips) {
    return <p className="text-muted-foreground text-sm">Loading your trips…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Trips</h1>
          <p className="text-muted-foreground text-sm">
            {trips.length === 0
              ? 'Nothing planned yet.'
              : `${String(trips.length)} planned, soonest first.`}
          </p>
        </div>

        {/* The empty state carries its own primary button, so the page never
            shows two. */}
        {trips.length > 0 ? (
          <Button asChild size="sm" className="h-11 sm:h-7">
            <Link to="/trips/new">New trip</Link>
          </Button>
        ) : null}
      </div>

      {trips.length === 0 ? (
        <div className="bg-card rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm font-medium">No trips yet</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Plan a trip, add what you want to take, and tick it off as you pack.
          </p>
          <Button asChild className="mt-4" size="sm">
            <Link to="/trips/new">New trip</Link>
          </Button>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {trips.map((trip) => (
            <li key={trip.id}>
              <Link
                to={`/trips/${trip.id}`}
                className="bg-card hover:bg-accent focus-visible:ring-ring block space-y-3 rounded-lg border p-4 transition-colors focus-visible:ring-2 focus-visible:outline-none"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{trip.name}</p>
                  <p className="text-muted-foreground truncate text-sm">{trip.destinationName}</p>
                </div>

                <p className="text-sm">
                  {formatDateRange(trip.startDate, trip.endDate)}
                  <span className="text-muted-foreground"> · {daysLabel(trip.days)}</span>
                </p>

                <div className="space-y-1">
                  <div
                    className="bg-muted h-1.5 overflow-hidden rounded-full"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={trip.entryCount}
                    aria-valuenow={trip.packedCount}
                    aria-label="Packing progress"
                  >
                    <div
                      className="bg-foreground h-full rounded-full"
                      style={{ width: `${String(percent(trip.packedCount, trip.entryCount))}%` }}
                    />
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {trip.entryCount === 0
                      ? 'Nothing added yet'
                      : `${String(trip.packedCount)} of ${String(trip.entryCount)} packed`}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
