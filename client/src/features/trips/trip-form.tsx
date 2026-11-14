import { useState } from 'react';
import type { FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DestinationField } from './destination-field';
import { daysLabel, parseCalendarDate } from './trip-format';
import type { Destination, TripInput, TripSummary } from './types';
import { MAX_TRIP_DAYS } from './types';
import { messageFrom } from './use-trips';

interface TripFormProps {
  /** Present when editing; absent when creating. */
  trip?: TripSummary;
  submitLabel: string;
  onSubmit: (input: TripInput) => Promise<TripSummary>;
  onDone: (trip: TripSummary) => void;
  onCancel: () => void;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Returns a message when the dates cannot be saved, else null. */
function dateProblem(start: string, end: string): string | null {
  if (!start || !end) return 'Choose a start and an end date.';

  const length =
    Math.round((parseCalendarDate(end).getTime() - parseCalendarDate(start).getTime()) / MS_PER_DAY) + 1;

  if (length < 1) return 'The end date must be on or after the start date.';
  if (length > MAX_TRIP_DAYS) return `A trip can be at most ${daysLabel(MAX_TRIP_DAYS)} long.`;

  return null;
}

export function TripForm({ trip, submitLabel, onSubmit, onDone, onCancel }: TripFormProps) {
  const [name, setName] = useState(trip?.name ?? '');
  const [destination, setDestination] = useState(trip?.destinationName ?? '');
  const [picked, setPicked] = useState<Destination | null>(null);
  const [startDate, setStartDate] = useState(trip?.startDate ?? '');
  const [endDate, setEndDate] = useState(trip?.endDate ?? '');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const problem = startDate && endDate ? dateProblem(startDate, endDate) : null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!name.trim() || !destination.trim()) {
      setError('Give the trip a name and a destination.');
      return;
    }

    const invalid = dateProblem(startDate, endDate);

    if (invalid) {
      setError(invalid);
      return;
    }

    setSaving(true);

    try {
      const saved = await onSubmit({
        name: name.trim(),
        destination: destination.trim(),
        // Only a picked suggestion carries coordinates; otherwise the server
        // geocodes the text itself.
        ...(picked ? { latitude: picked.latitude, longitude: picked.longitude } : {}),
        startDate,
        endDate,
      });

      onDone(saved);
    } catch (caught) {
      setError(messageFrom(caught));
      setSaving(false);
    }
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="flex max-w-md flex-col gap-4">
      <div className="space-y-1.5">
        <Label htmlFor="trip-name">Trip name</Label>
        <Input
          id="trip-name"
          value={name}
          maxLength={120}
          placeholder="e.g. Lisbon long weekend"
          onChange={(event) => setName(event.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="trip-destination">Destination (city)</Label>
        <DestinationField
          id="trip-destination"
          value={destination}
          onChange={(value, chosen) => {
            setDestination(value);
            setPicked(chosen);
          }}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="trip-start">Start date</Label>
          <Input
            id="trip-start"
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="trip-end">End date</Label>
          <Input
            id="trip-end"
            type="date"
            value={endDate}
            min={startDate || undefined}
            onChange={(event) => setEndDate(event.target.value)}
          />
        </div>
      </div>

      {problem ? (
        <p role="alert" className="text-destructive text-sm">
          {problem}
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving…' : submitLabel}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
