import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GarmentImage } from '@/features/clothing/garment-image';
import { labelFor } from '@/features/clothing/labels';
import type { ClothingItem } from '@/features/clothing/types';
import { GarmentPicker } from '@/features/outfits/garment-picker';
import type { Outfit } from '@/features/outfits/types';
import { isInLaundry } from './trip-format';

/** A trip can list many more garments than one outfit holds. */
const ITEM_PICKER_LIMIT = 200;

interface ItemPickerProps {
  items: readonly ClothingItem[];
  /** Garment ids already listed directly on the trip. */
  addedIds: readonly string[];
  onToggle: (id: string) => void;
}

/**
 * The outfit builder's garment picker, reused. Garments in the laundry stay
 * selectable here — the picker still badges them, and the trip flags them —
 * because a trip is planned days ahead, when they will be clean again.
 */
export function TripItemPicker({ items, addedIds, onToggle }: ItemPickerProps) {
  return (
    <GarmentPicker
      items={items}
      selectedIds={addedIds}
      onToggle={onToggle}
      allowLaundry
      limit={ITEM_PICKER_LIMIT}
    />
  );
}

interface OutfitPickerProps {
  outfits: readonly Outfit[];
  /** Outfit ids already listed on the trip. */
  addedIds: readonly string[];
  busy: boolean;
  onToggle: (id: string) => void;
}

export function TripOutfitPicker({ outfits, addedIds, busy, onToggle }: OutfitPickerProps) {
  if (outfits.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        You have no saved outfits yet. Build one first and it will show up here.
      </p>
    );
  }

  const added = new Set(addedIds);

  return (
    <ul className="divide-y rounded-lg border">
      {outfits.map((outfit) => {
        const isAdded = added.has(outfit.id);
        const washing = outfit.items.filter(isInLaundry).length;

        return (
          <li key={outfit.id} className="flex items-center gap-3 px-3 py-2">
            <div className="flex shrink-0 -space-x-2">
              {outfit.items.slice(0, 4).map((garment) => (
                <GarmentImage
                  key={garment.id}
                  src={garment.imageUrl}
                  alt={garment.name ?? labelFor(garment.type)}
                  placeholder={labelFor(garment.type)}
                  className="size-10 rounded-md border"
                  lazy
                />
              ))}
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{outfit.name}</p>
              <p className="text-muted-foreground text-xs">
                {outfit.items.length === 1 ? '1 garment' : `${String(outfit.items.length)} garments`}
              </p>
            </div>

            {washing > 0 ? (
              <Badge variant="secondary" className="shrink-0">
                <span aria-hidden>⚠</span> {washing} in laundry
              </Badge>
            ) : null}

            <Button
              size="sm"
              variant={isAdded ? 'secondary' : 'outline'}
              aria-pressed={isAdded}
              disabled={busy}
              onClick={() => onToggle(outfit.id)}
            >
              {isAdded ? 'Added ✓' : 'Add'}
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
