import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { GarmentImage } from '@/features/clothing/garment-image';
import { labelFor } from '@/features/clothing/labels';
import { LAUNDRY_LABEL } from '@/features/clothing/types';
import type { OutfitGarment } from '@/features/outfits/types';
import { groupEntries, isInLaundry, OUTFITS_GROUP } from './trip-format';
import type { TripEntry } from './types';

/** Same order the wardrobe grid and the garment picker use. */
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

interface TripChecklistProps {
  entries: TripEntry[];
  /** Entry ids with a request in flight, so their controls are disabled. */
  busyIds: ReadonlySet<string>;
  onTogglePacked: (entry: TripEntry, packed: boolean) => void;
  onRemove: (entry: TripEntry) => void;
}

/** The warning, in the same badge the wardrobe uses for the laundry. */
function LaundryBadge({ label = LAUNDRY_LABEL.IN_LAUNDRY }: { label?: string }) {
  return (
    <Badge variant="secondary" className="shrink-0">
      <span aria-hidden>⚠</span> {label}
    </Badge>
  );
}

function groupTitle(key: string): string {
  return key === OUTFITS_GROUP ? 'Outfits' : labelFor(key);
}

export function TripChecklist({ entries, busyIds, onTogglePacked, onRemove }: TripChecklistProps) {
  const groups = groupEntries(entries, CATEGORY_ORDER);

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <section key={group.key} aria-label={groupTitle(group.key)}>
          <h3 className="mb-2 text-sm font-medium">{groupTitle(group.key)}</h3>

          <ul className="divide-y rounded-lg border">
            {group.entries.map((entry) => {
              const busy = busyIds.has(entry.id);
              const title = entry.item
                ? (entry.item.name ?? labelFor(entry.item.type))
                : (entry.outfit?.name ?? '');
              const washing = entry.item
                ? isInLaundry(entry.item)
                  ? 1
                  : 0
                : (entry.outfit?.items.filter(isInLaundry).length ?? 0);
              const thumbs: OutfitGarment[] = entry.item ? [entry.item] : (entry.outfit?.items ?? []);

              return (
                <li key={entry.id} className="flex items-center gap-3 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={entry.packed}
                    disabled={busy}
                    onChange={(event) => onTogglePacked(entry, event.target.checked)}
                    aria-label={`Packed: ${title}`}
                    // Brown tick (the foreground token), not blue.
                    className="accent-foreground size-5 shrink-0 cursor-pointer"
                  />

                  {/* Garments are always shown on a white tile. */}
                  <div className="flex shrink-0 -space-x-2">
                    {thumbs.slice(0, 4).map((garment) => (
                      <GarmentImage
                        key={garment.id}
                        src={garment.imageUrl}
                        alt={garment.name ?? labelFor(garment.type)}
                        placeholder={labelFor(garment.type)}
                        className="size-11 rounded-md border"
                        lazy
                      />
                    ))}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p
                      className={`truncate text-sm font-medium ${
                        entry.packed ? 'text-muted-foreground line-through' : ''
                      }`}
                    >
                      {title}
                    </p>
                    <p className="text-muted-foreground truncate text-xs">
                      {entry.outfit
                        ? entry.outfit.items.length === 1
                          ? '1 garment'
                          : `${String(entry.outfit.items.length)} garments`
                        : (entry.item?.color ?? labelFor(entry.item?.category ?? ''))}
                    </p>
                  </div>

                  {washing > 0 ? (
                    <LaundryBadge
                      label={
                        entry.outfit
                          ? `${String(washing)} in laundry`
                          : LAUNDRY_LABEL.IN_LAUNDRY
                      }
                    />
                  ) : null}

                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground shrink-0"
                    disabled={busy}
                    onClick={() => onRemove(entry)}
                    aria-label={`Remove ${title}`}
                  >
                    Remove
                  </Button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
