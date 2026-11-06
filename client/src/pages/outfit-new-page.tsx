import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router';

import { Button } from '@/components/ui/button';
import type { ClothingItem } from '@/features/clothing/types';
import { useWardrobe } from '@/features/clothing/use-wardrobe';
import { GarmentPicker } from '@/features/outfits/garment-picker';
import { OutfitBoard } from '@/features/outfits/outfit-board';
import { MAX_OUTFIT_ITEMS, type OutfitGarment } from '@/features/outfits/types';
import { useBoardZones } from '@/features/outfits/use-board-zones';

/**
 * The wardrobe's richer item shape narrowed to what a board needs. The board
 * takes the server's outfit projection, so a locally picked garment has to be
 * presented the same way rather than the board learning a second shape.
 */
function toGarment(item: ClothingItem): OutfitGarment {
  return {
    id: item.id,
    name: item.name,
    category: item.category,
    type: item.type,
    color: item.color,
    imageUrl: item.imageUrl,
    laundryStatus: item.laundryStatus,
  };
}

export function OutfitNewPage() {
  const { items, error } = useWardrobe();
  const zones = useBoardZones();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const toggle = useCallback((id: string) => {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((existing) => existing !== id)
        : // Guarded here as well as in the picker: the cap is the server's
          // rule, and the state should not be able to break it even if a
          // future caller forgets to disable the control.
          current.length >= MAX_OUTFIT_ITEMS
          ? current
          : [...current, id],
    );
  }, []);

  // Only clean garments can be picked, so a stale selection — a garment thrown
  // in the wash in another tab — drops out of the board rather than being
  // saved into an outfit the user cannot actually wear.
  const selectable = useMemo(
    () => (items ?? []).filter((item) => item.laundryStatus === 'CLEAN'),
    [items],
  );

  const garments = useMemo(() => {
    const byId = new Map(selectable.map((item) => [item.id, item]));

    return selectedIds.flatMap((id) => {
      const item = byId.get(id);

      return item ? [toGarment(item)] : [];
    });
  }, [selectable, selectedIds]);

  if (error) {
    return <p className="text-destructive text-sm">{error}</p>;
  }

  if (!items || !zones) {
    return <p className="text-muted-foreground text-sm">Loading your wardrobe…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Build an outfit</h1>
          <p className="text-muted-foreground text-sm">
            Pick garments by category. Anything in the laundry cannot be picked.
          </p>
        </div>

        <Button asChild variant="ghost" size="sm">
          <Link to="/">Wardrobe</Link>
        </Button>
      </div>

      {/* Mobile-first: the board sits above the picker in one column, and the
          two sit side by side only once there is room. The board is sticky on
          the wide layout so it stays visible while the picker scrolls. */}
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <div className="lg:sticky lg:top-4">
          <OutfitBoard garments={garments} zones={zones} />

          <p className="text-muted-foreground mt-2 text-xs">
            {garments.length === 0
              ? 'Nothing picked yet.'
              : `${String(garments.length)} of ${String(MAX_OUTFIT_ITEMS)} garments.`}
            {garments.length >= MAX_OUTFIT_ITEMS && ' That is the most one outfit can hold.'}
          </p>

          {selectedIds.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => setSelectedIds([])}
            >
              Clear board
            </Button>
          )}
        </div>

        <GarmentPicker items={selectable} selectedIds={selectedIds} onToggle={toggle} />
      </div>
    </div>
  );
}
