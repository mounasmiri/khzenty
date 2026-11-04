import { useState } from 'react';
import { Link } from 'react-router';

import { Button } from '@/components/ui/button';
import { clothingApi } from '@/features/clothing/api';
import { ItemCard } from '@/features/clothing/item-card';
import { labelFor } from '@/features/clothing/labels';
import type { LaundryStatus } from '@/features/clothing/types';
import { useWardrobe } from '@/features/clothing/use-wardrobe';
import { ApiError } from '@/lib/api';

export function WardrobePage() {
  const { items, error, replaceItem } = useWardrobe();
  const [laundryError, setLaundryError] = useState<string | null>(null);

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
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          Your wardrobe
          {items ? <span className="text-muted-foreground ml-2 text-base">{items.length}</span> : null}
        </h1>

        {/* Quick add leads, since photo-first capture is the fast path on a
            phone; the full form stays available for a considered entry. */}
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link to="/items/quick-add">Quick add</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/items/bulk-add">Bulk add</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link to="/items/new">Full form</Link>
          </Button>
        </div>
      </div>

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

      {items && items.length > 0 ? (
        <>
          {/* Favourites sort first server-side, so no client ordering here. */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((item) => (
              <ItemCard key={item.id} item={item} onLaundryChange={changeLaundry} />
            ))}
          </div>

          <p className="text-muted-foreground text-xs">
            {[...new Set(items.map((i) => i.category))]
              .map((category) => labelFor(category))
              .join(' · ')}
          </p>
        </>
      ) : null}
    </section>
  );
}
