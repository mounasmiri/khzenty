import { Link, useNavigate, useParams } from 'react-router';

import { Button } from '@/components/ui/button';
import { tripsApi } from '@/features/trips/api';
import { TripForm } from '@/features/trips/trip-form';
import { useTrip } from '@/features/trips/use-trips';

export function TripEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { trip, error, loading } = useTrip(id);

  if (loading) {
    return <p className="text-muted-foreground text-sm">Loading…</p>;
  }

  if (error || !trip) {
    return (
      <p role="alert" className="text-destructive text-sm">
        {error ?? 'Trip not found.'}
      </p>
    );
  }

  return (
    <section className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Edit trip</h1>

        <Button asChild variant="ghost" size="sm">
          <Link to={`/trips/${trip.id}`}>Back to trip</Link>
        </Button>
      </div>

      <TripForm
        trip={trip}
        submitLabel="Save trip"
        onCancel={() => void navigate(`/trips/${trip.id}`)}
        onSubmit={(input) => tripsApi.update(trip.id, input)}
        onDone={() => void navigate(`/trips/${trip.id}`, { replace: true })}
      />
    </section>
  );
}
