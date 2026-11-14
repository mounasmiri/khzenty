import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { Button } from '@/components/ui/button';
import { useWardrobe } from '@/features/clothing/use-wardrobe';
import { useOutfits } from '@/features/outfits/use-outfits';
import { tripsApi } from '@/features/trips/api';
import { CategoryProgress } from '@/features/trips/category-progress';
import { TripChecklist } from '@/features/trips/trip-checklist';
import {
  countLaundryGarments,
  daysLabel,
  formatDateRange,
  percent,
} from '@/features/trips/trip-format';
import { TripItemPicker, TripOutfitPicker } from '@/features/trips/trip-pickers';
import { TripWeatherStrip } from '@/features/trips/trip-weather';
import type { TripDetail, TripEntry } from '@/features/trips/types';
import { messageFrom, useTrip, useTripWeather } from '@/features/trips/use-trips';

type Panel = 'items' | 'outfits' | null;
type AddTarget = { clothingItemId: string } | { outfitId: string };

interface PanelProps {
  trip: TripDetail;
  busy: boolean;
  onAdd: (target: AddTarget) => void;
  onRemove: (entry: TripEntry) => void;
}

/** Mounted only while open, so the wardrobe is fetched when it is wanted. */
function ItemsPanel({ trip, busy, onAdd, onRemove }: PanelProps) {
  const { items, error } = useWardrobe();

  if (error) {
    return (
      <p role="alert" className="text-destructive text-sm">
        {error}
      </p>
    );
  }

  if (!items) {
    return <p className="text-muted-foreground text-sm">Loading your wardrobe…</p>;
  }

  const entryByItem = new Map(
    trip.entries.flatMap((entry) => (entry.item ? [[entry.item.id, entry] as const] : [])),
  );

  return (
    <TripItemPicker
      items={items}
      addedIds={[...entryByItem.keys()]}
      onToggle={(id) => {
        if (busy) return;
        const existing = entryByItem.get(id);

        if (existing) onRemove(existing);
        else onAdd({ clothingItemId: id });
      }}
    />
  );
}

function OutfitsPanel({ trip, busy, onAdd, onRemove }: PanelProps) {
  const { outfits, error } = useOutfits();

  if (error) {
    return (
      <p role="alert" className="text-destructive text-sm">
        {error}
      </p>
    );
  }

  if (!outfits) {
    return <p className="text-muted-foreground text-sm">Loading your outfits…</p>;
  }

  const entryByOutfit = new Map(
    trip.entries.flatMap((entry) => (entry.outfit ? [[entry.outfit.id, entry] as const] : [])),
  );

  return (
    <TripOutfitPicker
      outfits={outfits}
      addedIds={[...entryByOutfit.keys()]}
      busy={busy}
      onToggle={(id) => {
        const existing = entryByOutfit.get(id);

        if (existing) onRemove(existing);
        else onAdd({ outfitId: id });
      }}
    />
  );
}

export function TripDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { trip, setTrip, error, loading, reload } = useTrip(id);
  const weather = useTripWeather(
    id,
    trip
      ? `${String(trip.latitude)}|${String(trip.longitude)}|${trip.startDate}|${trip.endDate}`
      : '',
  );

  const [panel, setPanel] = useState<Panel>(null);
  const [busyIds, setBusyIds] = useState<ReadonlySet<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (loading) {
    return <p className="text-muted-foreground text-sm">Loading your trip…</p>;
  }

  if (error || !trip) {
    return (
      <div className="space-y-3">
        <p role="alert" className="text-destructive text-sm">
          {error ?? 'Trip not found.'}
        </p>
        <Button asChild variant="outline" size="sm">
          <Link to="/trips">← Back to trips</Link>
        </Button>
      </div>
    );
  }

  const markBusy = (entryId: string, on: boolean) =>
    setBusyIds((current) => {
      const next = new Set(current);
      if (on) next.add(entryId);
      else next.delete(entryId);
      return next;
    });

  const setEntryPackedLocally = (entryId: string, packed: boolean) =>
    setTrip((current) => {
      if (!current) return current;

      const entries = current.entries.map((entry) =>
        entry.id === entryId ? { ...entry, packed } : entry,
      );
      const packedCount = entries.filter((entry) => entry.packed).length;

      return {
        ...current,
        entries,
        packedCount,
        packing: { ...current.packing, packed: packedCount },
      };
    });

  async function togglePacked(entry: TripEntry, packed: boolean) {
    if (!trip) return;

    setActionError(null);
    markBusy(entry.id, true);
    // Optimistic: a tick should feel instant. Reverted if the request fails.
    setEntryPackedLocally(entry.id, packed);

    try {
      await tripsApi.setPacked(trip.id, entry.id, packed);
    } catch (caught) {
      setEntryPackedLocally(entry.id, !packed);
      setActionError(messageFrom(caught));
    } finally {
      markBusy(entry.id, false);
    }
  }

  const setManualLocally = (category: string, manual: number) =>
    setTrip((current) =>
      current
        ? {
            ...current,
            packing: {
              ...current.packing,
              categories: current.packing.categories.map((row) =>
                row.category === category ? { ...row, manual } : row,
              ),
            },
          }
        : current,
    );

  async function changeManual(category: string, count: number) {
    if (!trip) return;

    const previous = trip.packing.categories.find((row) => row.category === category)?.manual ?? 0;

    setActionError(null);
    // Optimistic, like the packed tick; put back if the save fails.
    setManualLocally(category, count);

    try {
      await tripsApi.setCategoryCount(trip.id, category, count);
    } catch (caught) {
      setManualLocally(category, previous);
      setActionError(messageFrom(caught));
    }
  }

  async function removeEntry(entry: TripEntry) {
    if (!trip) return;

    setActionError(null);
    markBusy(entry.id, true);

    try {
      await tripsApi.removeEntry(trip.id, entry.id);
      // Refetched rather than patched: the suggested-versus-planned numbers are
      // derived on the server and change with the list.
      await reload();
    } catch (caught) {
      setActionError(messageFrom(caught));
    } finally {
      markBusy(entry.id, false);
    }
  }

  async function addEntry(target: AddTarget) {
    if (!trip) return;

    setActionError(null);
    setAdding(true);

    try {
      setTrip(await tripsApi.addEntry(trip.id, target));
    } catch (caught) {
      setActionError(messageFrom(caught));
    } finally {
      setAdding(false);
    }
  }

  async function deleteTrip() {
    if (!trip) return;

    setDeleting(true);
    setActionError(null);

    try {
      await tripsApi.remove(trip.id);
      void navigate('/trips', { replace: true });
    } catch (caught) {
      setActionError(messageFrom(caught));
      setDeleting(false);
    }
  }

  const washing = countLaundryGarments(trip.entries);
  const togglePanel = (next: Exclude<Panel, null>) =>
    setPanel((current) => (current === next ? null : next));

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to="/trips">← Trips</Link>
        </Button>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight">{trip.name}</h1>
            <p className="text-muted-foreground text-sm">{trip.destinationName}</p>
            <p className="mt-1 text-sm">
              {formatDateRange(trip.startDate, trip.endDate)}
              <span className="text-muted-foreground"> · {daysLabel(trip.days)}</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to={`/trips/${trip.id}/edit`}>Edit</Link>
            </Button>

            {confirmingDelete ? (
              <span className="flex items-center gap-1">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => void deleteTrip()}
                  disabled={deleting}
                >
                  {deleting ? '…' : 'Delete trip'}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmingDelete(false)}>
                  Cancel
                </Button>
              </span>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={() => setConfirmingDelete(true)}
              >
                Delete
              </Button>
            )}
          </div>
        </div>
      </div>

      {actionError ? (
        <p role="alert" className="text-destructive text-sm">
          {actionError}
        </p>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Weather</h2>
        <TripWeatherStrip weather={weather} />
      </section>

      <CategoryProgress
        rows={trip.packing.categories}
        days={trip.days}
        onChangeManual={(category, count) => void changeManual(category, count)}
      />

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Packing list</h2>
            <p className="text-muted-foreground text-sm">
              {trip.entryCount === 0
                ? 'Nothing added yet.'
                : `${String(trip.packedCount)} of ${String(trip.entryCount)} packed`}
            </p>
          </div>

          <div className="flex gap-2">
            <Button size="sm" aria-expanded={panel === 'items'} onClick={() => togglePanel('items')}>
              Add items
            </Button>
            <Button
              size="sm"
              variant="outline"
              aria-expanded={panel === 'outfits'}
              onClick={() => togglePanel('outfits')}
            >
              Add outfits
            </Button>
          </div>
        </div>

        {trip.entryCount > 0 ? (
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
        ) : null}

        {washing > 0 ? (
          <p role="status" className="text-sm">
            ⚠ {washing === 1 ? '1 garment is' : `${String(washing)} garments are`} in the laundry.
            You can still pack {washing === 1 ? 'it' : 'them'} — just wash before you go.
          </p>
        ) : null}

        {panel ? (
          <div className="bg-card space-y-3 rounded-lg border p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-medium">
                {panel === 'items' ? 'Add garments' : 'Add outfits'}
              </h3>
              <Button size="sm" variant="outline" onClick={() => setPanel(null)}>
                Done
              </Button>
            </div>

            {panel === 'items' ? (
              <ItemsPanel
                trip={trip}
                busy={adding}
                onAdd={(target) => void addEntry(target)}
                onRemove={(entry) => void removeEntry(entry)}
              />
            ) : (
              <OutfitsPanel
                trip={trip}
                busy={adding}
                onAdd={(target) => void addEntry(target)}
                onRemove={(entry) => void removeEntry(entry)}
              />
            )}
          </div>
        ) : null}

        {trip.entries.length === 0 ? (
          <div className="bg-card rounded-lg border border-dashed p-6 text-center">
            <p className="text-sm font-medium">Your packing list is empty</p>
            <p className="text-muted-foreground mt-1 text-sm">
              Use "Add items" or "Add outfits" to choose what to take.
            </p>
          </div>
        ) : (
          <TripChecklist
            entries={trip.entries}
            busyIds={busyIds}
            onTogglePacked={(entry, packed) => void togglePacked(entry, packed)}
            onRemove={(entry) => void removeEntry(entry)}
          />
        )}
      </section>
    </div>
  );
}
