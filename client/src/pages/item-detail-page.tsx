import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { clothingApi } from '@/features/clothing/api';
import { labelFor } from '@/features/clothing/labels';
import { useClothingItem } from '@/features/clothing/use-wardrobe';
import { ApiError } from '@/lib/api';

export function ItemDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { item, error, loading } = useClothingItem(id);
  const [confirming, setConfirming] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  if (loading) {
    return <p className="text-muted-foreground text-sm">Loading…</p>;
  }

  if (error || !item) {
    return (
      <div className="flex flex-col gap-4">
        <p role="alert" className="text-destructive text-sm">
          {error ?? 'Item not found.'}
        </p>
        <Button asChild variant="outline" className="self-start">
          <Link to="/">Back to wardrobe</Link>
        </Button>
      </div>
    );
  }

  const outfitCount = item._count.outfitItems;

  async function handleDelete() {
    setDeleteError(null);

    try {
      await clothingApi.remove(item!.id);
      void navigate('/', { replace: true });
    } catch (caught) {
      setDeleteError(caught instanceof ApiError ? caught.message : 'Could not delete the item.');
    }
  }

  return (
    <section className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {item.name ?? labelFor(item.type)}
          </h1>
          <p className="text-muted-foreground text-sm">{item.color}</p>
        </div>

        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to={`/items/${item.id}/edit`}>Edit</Link>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setConfirming(true)}>
            Delete
          </Button>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-4 rounded-lg border p-4 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-muted-foreground text-xs">Category</dt>
          <dd className="mt-1">{labelFor(item.category)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs">Type</dt>
          <dd className="mt-1">{labelFor(item.type)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs">Favourite</dt>
          <dd className="mt-1">{item.favorite ? 'Yes' : 'No'}</dd>
        </div>
        <div className="col-span-2 sm:col-span-3">
          <dt className="text-muted-foreground text-xs">Seasons</dt>
          <dd className="mt-1 flex flex-wrap gap-1">
            {item.seasons.length > 0 ? (
              item.seasons.map((season) => (
                <Badge key={season} variant="outline">
                  {labelFor(season)}
                </Badge>
              ))
            ) : (
              <span className="text-muted-foreground">Not set</span>
            )}
          </dd>
        </div>
        <div className="col-span-2 sm:col-span-3">
          <dt className="text-muted-foreground text-xs">Used in</dt>
          <dd className="mt-1">
            {outfitCount === 1 ? '1 outfit' : `${String(outfitCount)} outfits`}
          </dd>
        </div>
      </dl>

      {confirming ? (
        <div className="border-destructive/40 flex flex-col gap-3 rounded-lg border p-4">
          <p className="text-sm font-medium">Delete this item?</p>
          {/* The count is why OutfitItem.clothingItemId is indexed: deleting a
              garment cascades it out of every outfit using it. */}
          <p className="text-muted-foreground text-sm">
            {outfitCount > 0
              ? `It will also be removed from ${outfitCount === 1 ? '1 outfit' : `${String(outfitCount)} outfits`}. This cannot be undone.`
              : 'This cannot be undone.'}
          </p>

          {deleteError ? (
            <p role="alert" className="text-destructive text-sm">
              {deleteError}
            </p>
          ) : null}

          <div className="flex gap-2">
            <Button variant="destructive" size="sm" onClick={() => void handleDelete()}>
              Yes, delete
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
              Keep it
            </Button>
          </div>
        </div>
      ) : null}

      <Button asChild variant="ghost" className="self-start">
        <Link to="/">← Back to wardrobe</Link>
      </Button>
    </section>
  );
}
