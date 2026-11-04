import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { clothingApi } from '@/features/clothing/api';
import { labelFor } from '@/features/clothing/labels';
import { LaundryToggle } from '@/features/clothing/laundry-toggle';
import type { LaundryStatus } from '@/features/clothing/types';
import { LAUNDRY_LABEL, UNSORTED_COLOR_LABEL } from '@/features/clothing/types';
import { useClothingItem } from '@/features/clothing/use-wardrobe';
import { ApiError } from '@/lib/api';

export function ItemDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { item, error, loading } = useClothingItem(id);
  const [confirming, setConfirming] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  /** Local so the placeholder returns immediately after a removal. */
  const [imageUrl, setImageUrl] = useState<string | null | undefined>(undefined);
  const [confirmingPhotoRemoval, setConfirmingPhotoRemoval] = useState(false);
  const [removingPhoto, setRemovingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [laundryStatus, setLaundryStatus] = useState<LaundryStatus | undefined>(undefined);
  const [laundryError, setLaundryError] = useState<string | null>(null);

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
  // `undefined` means "not changed here", so the fetched value is used.
  const shownStatus = laundryStatus ?? item.laundryStatus;
  // `undefined` means "not touched here", so the fetched value is used.
  const shownImageUrl = imageUrl === undefined ? item.imageUrl : imageUrl;

  async function handleRemovePhoto() {
    setPhotoError(null);
    setRemovingPhoto(true);

    try {
      await clothingApi.removeImage(item!.id);
      setImageUrl(null);
      setConfirmingPhotoRemoval(false);
    } catch (caught) {
      setPhotoError(caught instanceof ApiError ? caught.message : 'Could not remove the photo.');
    } finally {
      setRemovingPhoto(false);
    }
  }

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
          {item.color ? (
            <p className="text-muted-foreground text-sm">{item.color}</p>
          ) : (
            <Badge variant="outline" className="mt-1">
              {UNSORTED_COLOR_LABEL}
            </Badge>
          )}
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

      <div className="flex flex-col items-start gap-3">
        {/* object-contain on a light neutral ground: garments are shot at all
            sorts of aspect ratios, and cropping cuts off shoes and hems. The
            4:5 tile matches the grid so the two read as one system. */}
        <div className="flex aspect-[4/5] w-full max-w-xs items-center justify-center overflow-hidden rounded-lg border bg-neutral-50 dark:bg-neutral-900">
          {shownImageUrl ? (
            <img
              src={shownImageUrl}
              alt={item.name ?? labelFor(item.type)}
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            // Same fallback as the grid: the type label, so an item without a
            // photo is still identifiable.
            <div className="text-muted-foreground p-6 text-center">
              <p className="text-sm font-medium">{labelFor(item.type)}</p>
              <p className="mt-1 text-xs">No photo yet</p>
            </div>
          )}
        </div>

        {shownImageUrl ? (
          confirmingPhotoRemoval ? (
            <div className="flex flex-col gap-2 rounded-lg border p-3">
              <p className="text-sm font-medium">Remove this photo?</p>
              <p className="text-muted-foreground text-sm">
                The garment stays in your wardrobe; only the photo is deleted.
              </p>
              {photoError ? (
                <p role="alert" className="text-destructive text-sm">
                  {photoError}
                </p>
              ) : null}
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={removingPhoto}
                  onClick={() => void handleRemovePhoto()}
                >
                  {removingPhoto ? 'Removing…' : 'Yes, remove'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={removingPhoto}
                  onClick={() => setConfirmingPhotoRemoval(false)}
                >
                  Keep it
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setConfirmingPhotoRemoval(true)}>
              Remove photo
            </Button>
          )
        ) : null}
      </div>

      <div className="flex flex-col gap-2 rounded-lg border p-4">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium">Laundry</p>
          {shownStatus === 'IN_LAUNDRY' ? (
            <Badge variant="secondary">{LAUNDRY_LABEL.IN_LAUNDRY}</Badge>
          ) : null}
        </div>
        <LaundryToggle
          status={shownStatus}
          size="default"
          onChange={async (next) => {
            setLaundryError(null);

            try {
              const updated = await clothingApi.setLaundryStatus(item!.id, next);
              setLaundryStatus(updated.laundryStatus);
            } catch (caught) {
              setLaundryError(
                caught instanceof ApiError ? caught.message : 'Could not change the status.',
              );
            }
          }}
        />
        {laundryError ? (
          <p role="alert" className="text-destructive text-sm">
            {laundryError}
          </p>
        ) : null}
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
