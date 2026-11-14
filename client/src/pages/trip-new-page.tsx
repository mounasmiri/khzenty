import { Link, useNavigate } from 'react-router';

import { Button } from '@/components/ui/button';
import { tripsApi } from '@/features/trips/api';
import { TripForm } from '@/features/trips/trip-form';

export function TripNewPage() {
  const navigate = useNavigate();

  return (
    <section className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">New trip</h1>

        <Button asChild variant="ghost" size="sm">
          <Link to="/trips">Trips</Link>
        </Button>
      </div>

      <TripForm
        submitLabel="Save trip"
        onCancel={() => void navigate('/trips')}
        onSubmit={tripsApi.create}
        onDone={(trip) => void navigate(`/trips/${trip.id}`, { replace: true })}
      />
    </section>
  );
}
