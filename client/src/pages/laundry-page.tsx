import { useState } from 'react';
import { Link } from 'react-router';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { clothingApi } from '@/features/clothing/api';
import { GarmentImage } from '@/features/clothing/garment-image';
import { labelFor } from '@/features/clothing/labels';
import { useWardrobe } from '@/features/clothing/use-wardrobe';
import { ApiError } from '@/lib/api';

/** "3 days ago", from the timestamp the status was last set. */
function sinceLabel(iso: string | null): string | null {
  if (!iso) return null;

  const then = new Date(iso).getTime();

  if (Number.isNaN(then)) return null;

  const days = Math.floor((Date.now() - then) / 86_400_000);

  if (days <= 0) return 'since today';
  if (days === 1) return 'since yesterday';

  return `for ${String(days)} days`;
}

export function LaundryPage() {
  const { items, error, reload } = useWardrobe();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Filtered client-side: the wardrobe is already fetched whole, and a
  // dedicated query belongs with the Phase 5 filter work.
  const dirty = (items ?? []).filter((item) => item.laundryStatus === 'IN_LAUNDRY');

  async function wash(ids: string[]) {
    if (ids.length === 0) return;

    setBusy(true);
    setActionError(null);

    try {
      await clothingApi.markWashed(ids);
      // Reload rather than patching locally: washing removes garments from
      // this list, so the whole list changes shape.
      await reload();
    } catch (caught) {
      setActionError(
        caught instanceof ApiError ? caught.message : 'Could not mark those as washed.',
      );
    } finally {
      setBusy(false);
    }
  }

  if (items === null && !error) {
    return <p className="text-muted-foreground text-sm">Loading…</p>;
  }

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Laundry basket</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {dirty.length === 0
              ? 'Nothing waiting to be washed.'
              : `${String(dirty.length)} garment${dirty.length === 1 ? '' : 's'} in the wash.`}
          </p>
        </div>

        {dirty.length > 0 ? (
          <Button disabled={busy} onClick={() => void wash(dirty.map((item) => item.id))}>
            {busy ? 'Washing…' : 'Mark all as washed'}
          </Button>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}

      {actionError ? (
        <p role="alert" className="text-destructive text-sm">
          {actionError}
        </p>
      ) : null}

      {dirty.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="font-medium">The basket is empty</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Mark a garment as in laundry from your wardrobe and it will show up here.
          </p>
          <Button asChild variant="outline" className="mt-4">
            <Link to="/">Back to wardrobe</Link>
          </Button>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {dirty.map((item) => {
            const since = sinceLabel(item.laundryAt);

            return (
              <li
                key={item.id}
                className="flex items-center gap-3 rounded-lg border p-3"
              >
                <Link
                  to={`/items/${item.id}`}
                  className="flex min-w-0 flex-1 items-center gap-3"
                >
                  <GarmentImage
                    src={item.imageUrl}
                    alt=""
                    placeholder={labelFor(item.type)}
                    className="size-14 shrink-0 rounded-md"
                    lazy
                  />

                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {item.name ?? labelFor(item.type)}
                    </p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1">
                      <Badge variant="outline" className="text-[10px]">
                        {labelFor(item.category)}
                      </Badge>
                      {since ? (
                        <span className="text-muted-foreground text-xs">{since}</span>
                      ) : null}
                    </div>
                  </div>
                </Link>

                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void wash([item.id])}
                >
                  Mark as washed
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
