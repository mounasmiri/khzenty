import { useMemo } from 'react';

import { Badge } from '@/components/ui/badge';
import { GarmentImage } from '@/features/clothing/garment-image';
import { labelFor } from '@/features/clothing/labels';
import type { ClothingItem } from '@/features/clothing/types';
import { MAX_OUTFIT_ITEMS } from './types';

/**
 * Category display order. Taken from the server's `CATEGORY_ORDER` — the same
 * order the wardrobe grid uses, so the two screens do not disagree about where
 * to look for shoes.
 */
const CATEGORY_ORDER = [
  'TOP',
  'BOTTOM',
  'DRESS',
  'OUTERWEAR',
  'FOOTWEAR',
  'ACCESSORY',
  'ACTIVEWEAR',
  'SLEEPWEAR',
  'SWIMWEAR',
  'UNDERWEAR',
  'OTHER',
] as const;

interface GarmentPickerProps {
  items: readonly ClothingItem[];
  selectedIds: readonly string[];
  onToggle: (id: string) => void;
  /**
   * Lets garments in the laundry be selected. Off by default, because an outfit
   * is something to wear now; a trip is planned ahead, so it turns this on and
   * relies on the badge to flag the garment instead.
   */
  allowLaundry?: boolean;
  /** Most garments that can be selected. Defaults to the outfit limit. */
  limit?: number;
}

/**
 * Picks garments for a board, grouped by category.
 *
 * Mobile-first: each category is one horizontally scrolling row of tiles, so
 * the whole wardrobe is reachable by thumb without a vertical scroll per
 * category. On a wider screen the rows simply get longer.
 *
 * Garments in the laundry are shown but **not selectable**. Hiding them would
 * be simpler, but then a missing favourite shirt looks like a bug; shown and
 * disabled, with its badge, it explains itself — and the laundry basket is one
 * tap away.
 */
export function GarmentPicker({
  items,
  selectedIds,
  onToggle,
  allowLaundry = false,
  limit = MAX_OUTFIT_ITEMS,
}: GarmentPickerProps) {
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);
  const atCapacity = selectedIds.length >= limit;

  const groups = useMemo(() => {
    const byCategory = new Map<string, ClothingItem[]>();

    for (const item of items) {
      const existing = byCategory.get(item.category);

      if (existing) {
        existing.push(item);
      } else {
        byCategory.set(item.category, [item]);
      }
    }

    // Known categories in the shared order, then anything the server has
    // learned about since this list was written — appended rather than
    // dropped, so a new category is merely out of order, not invisible.
    const known = CATEGORY_ORDER.filter((category) => byCategory.has(category));
    const unknown = [...byCategory.keys()].filter(
      (category) => !(CATEGORY_ORDER as readonly string[]).includes(category),
    );

    return [...known, ...unknown].map((category) => ({
      category,
      items: byCategory.get(category) ?? [],
    }));
  }, [items]);

  if (items.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Your wardrobe is empty. Add a garment or two and they will show up here.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <section key={group.category}>
          <h3 className="mb-2 text-sm font-medium">{labelFor(group.category)}</h3>

          {/* -mx-4 px-4 lets the row bleed to the screen edges on a phone so
              the last tile does not look cut off mid-gutter. */}
          <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2">
            {group.items.map((item) => {
              const isSelected = selected.has(item.id);
              const inLaundry = item.laundryStatus === 'IN_LAUNDRY';
              // Already-selected garments stay tappable at capacity, or there
              // would be no way to deselect one and swap it out.
              const disabled = (inLaundry && !allowLaundry) || (atCapacity && !isSelected);

              return (
                <li key={item.id} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => onToggle(item.id)}
                    disabled={disabled}
                    aria-pressed={isSelected}
                    title={inLaundry ? 'In the laundry' : undefined}
                    className={`relative block w-20 overflow-hidden rounded-md border-2 transition-colors ${
                      isSelected ? 'border-primary' : 'border-transparent'
                    } ${disabled ? 'cursor-not-allowed opacity-40' : 'hover:border-muted-foreground/40'}`}
                  >
                    <GarmentImage
                      src={item.imageUrl}
                      alt={item.name ?? labelFor(item.type)}
                      placeholder={labelFor(item.type)}
                      className="aspect-[4/5] w-full"
                      lazy
                    />

                    {inLaundry && (
                      <Badge
                        variant="secondary"
                        className="absolute bottom-1 left-1 px-1 py-0 text-[10px]"
                      >
                        Washing
                      </Badge>
                    )}
                  </button>

                  <p className="text-muted-foreground mt-1 w-20 truncate text-[11px]">
                    {item.name ?? labelFor(item.type)}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
