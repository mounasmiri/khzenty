import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { Button } from '@/components/ui/button';
import { clothingApi } from '@/features/clothing/api';
import { ItemCard } from '@/features/clothing/item-card';
import { labelFor } from '@/features/clothing/labels';
import type { ClothingItem, LaundryStatus } from '@/features/clothing/types';
import { useWardrobe } from '@/features/clothing/use-wardrobe';
import { useAuth } from '@/features/auth/use-auth';
import { ApiError } from '@/lib/api';

/** Kept in the URL, so the filter survives back-navigation and is linkable. */
const FILTER_PARAM = 'laundry';

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'clean', label: 'Clean' },
  { value: 'in-laundry', label: 'In laundry' },
] as const;

type FilterValue = (typeof FILTERS)[number]['value'];

function parseFilter(raw: string | null): FilterValue {
  // An unrecognised value falls back to showing everything rather than an
  // empty grid, which would look like a broken wardrobe.
  return FILTERS.some((f) => f.value === raw) ? (raw as FilterValue) : 'all';
}

function matches(item: ClothingItem, filter: FilterValue): boolean {
  if (filter === 'clean') return item.laundryStatus === 'CLEAN';
  if (filter === 'in-laundry') return item.laundryStatus === 'IN_LAUNDRY';

  return true;
}

export function WardrobePage() {
  const { items, error, replaceItem } = useWardrobe();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [laundryError, setLaundryError] = useState<string | null>(null);

  const filter = parseFilter(searchParams.get(FILTER_PARAM));

  // Filtered client-side: the wardrobe is already fetched whole, so this needs
  // no extra round trip. A server-side query belongs with the Phase 5 filters.
  const visible = (items ?? []).filter((item) => matches(item, filter));

  const counts = {
    all: items?.length ?? 0,
    clean: (items ?? []).filter((i) => i.laundryStatus === 'CLEAN').length,
    'in-laundry': (items ?? []).filter((i) => i.laundryStatus === 'IN_LAUNDRY').length,
  } satisfies Record<FilterValue, number>;

  function selectFilter(value: FilterValue) {
    const next = new URLSearchParams(searchParams);

    if (value === 'all') {
      // Keep the default out of the URL rather than carrying ?laundry=all.
      next.delete(FILTER_PARAM);
    } else {
      next.set(FILTER_PARAM, value);
    }

    setSearchParams(next, { replace: true });
  }

  async function changeLaundry(id: string, status: LaundryStatus) {
    setLaundryError(null);

    try {
      // Swapped in place rather than refetched, so the grid does not reshuffle
      // under the user mid-tap.
      replaceItem(await clothingApi.setLaundryStatus(id, status));
    } catch (caught) {
      setLaundryError(
        caught instanceof ApiError ? caught.message : 'Could not change the status.',
      );
    }
  }

  return (
    <section className="flex flex-col gap-6">
      {/* Under 640px the title stacks above the actions; from there up it is the
          same single row as before. Buttons are 44px tall on touch screens. */}
      <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          Your wardrobe
          {items ? (
            <span className="text-muted-foreground ml-2 text-base">{items.length}</span>
          ) : null}
        </h1>

        {/* Quick add leads, since photo-first capture is the fast path on a
            phone; the full form stays available for a considered entry. */}
        <div className="flex flex-wrap gap-2">
          {/* Both exist to upload photos, which the demo sandbox does not allow. */}
          {user?.isDemo ? null : (
            <>
              <Button asChild className="h-11 sm:h-8">
                <Link to="/items/quick-add">Quick add</Link>
              </Button>
              <Button asChild variant="outline" className="h-11 sm:h-8">
                <Link to="/items/bulk-add">Bulk add</Link>
              </Button>
            </>
          )}
          <Button
            asChild
            variant="ghost"
            // Alone in the demo view, a bare text link under the title looks
            // unfinished on a phone, so it takes an outline look there. Desktop
            // keeps the ghost button it always had.
            className={`h-11 sm:h-8 ${user?.isDemo ? "max-sm:border-secondary-border max-sm:bg-background" : ""}`}
          >
            <Link to="/items/new">Full form</Link>
          </Button>
        </div>
      </div>

      {items && items.length > 0 ? (
        <div role="group" aria-label="Filter by laundry status" className="flex flex-wrap gap-1">
          {FILTERS.map((option) => (
            <Button
              key={option.value}
              type="button"
              size="sm"
              variant={option.value === filter ? 'default' : 'outline'}
              aria-pressed={option.value === filter}
              onClick={() => selectFilter(option.value)}
            >
              {option.label}
              {/* Counts come from the full list, so they stay stable as the
                  visible set narrows. */}
              <span className="ml-1.5 opacity-70">{counts[option.value]}</span>
            </Button>
          ))}
        </div>
      ) : null}

      {error ?? laundryError ? (
        <p role="alert" className="text-destructive text-sm">
          {error ?? laundryError}
        </p>
      ) : null}

      {items === null && !error ? (
        <p className="text-muted-foreground text-sm">Loading your wardrobe…</p>
      ) : null}

      {items?.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="font-medium">Nothing here yet</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Add your first garment and it will show up here.
          </p>
        </div>
      ) : null}

      {/* Distinct from an empty wardrobe: there are garments, just none in this
          filter, so the way out is to change the filter rather than add items. */}
      {items && items.length > 0 && visible.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="font-medium">
            {filter === 'clean' ? 'Everything is in the wash' : 'Nothing is in the wash'}
          </p>
          <p className="text-muted-foreground mt-1 text-sm">
            {filter === 'clean'
              ? 'Mark something as washed and it will reappear here.'
              : 'Mark a garment as in laundry and it will show up here.'}
          </p>
          <Button variant="outline" className="mt-4" onClick={() => selectFilter('all')}>
            Show all {counts.all}
          </Button>
        </div>
      ) : null}

      {visible.length > 0 ? (
        <>
          {/* Favourites sort first server-side, so no client ordering here. */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {visible.map((item) => (
              <ItemCard key={item.id} item={item} onLaundryChange={changeLaundry} />
            ))}
          </div>

          <p className="text-muted-foreground text-xs">
            {[...new Set(visible.map((i) => i.category))]
              .map((category) => labelFor(category))
              .join(' · ')}
          </p>
        </>
      ) : null}
    </section>
  );
}
