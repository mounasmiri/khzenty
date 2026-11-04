import { Link } from 'react-router';

import { Badge } from '@/components/ui/badge';
import { labelFor } from './labels';
import { LaundryToggle } from './laundry-toggle';
import type { ClothingItem, LaundryStatus } from './types';
import { LAUNDRY_LABEL, UNSORTED_COLOR_LABEL } from './types';

interface ItemCardProps {
  item: ClothingItem;
  /** Omit to render the card without a laundry control. */
  onLaundryChange?: (id: string, status: LaundryStatus) => Promise<void>;
}

/**
 * One garment in the wardrobe grid. `name` is optional on the server, so the
 * type is the fallback label.
 *
 * The link wraps only the navigating area: a button nested inside an anchor is
 * invalid markup, and its clicks would also trigger the navigation.
 */
export function ItemCard({ item, onLaundryChange }: ItemCardProps) {
  const inLaundry = item.laundryStatus === 'IN_LAUNDRY';

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      <Link
        to={`/items/${item.id}`}
        className="focus-visible:ring-ring hover:bg-accent -m-1 flex flex-col gap-2 rounded-md p-1 transition-colors focus-visible:ring-2 focus-visible:outline-none"
      >
        {/* `object-contain`, not `object-cover`: garment photos arrive at every
            aspect ratio, and cropping to fill the tile cut the toes off shoes and
            the hems off trousers. Letterboxing on a light neutral ground shows
            the whole garment, and the fixed 4:5 tile — matching the detail view —
            keeps rows aligned despite the varying image shapes. */}
        <div className="relative flex aspect-[4/5] items-center justify-center overflow-hidden rounded-md bg-neutral-50 dark:bg-neutral-900">
          {item.imageUrl ? (
            <img
              src={item.imageUrl}
              alt={item.name ?? labelFor(item.type)}
              // Dimmed while in the wash, so the grid reads at a glance.
              className={`max-h-full max-w-full object-contain ${inLaundry ? 'opacity-50' : ''}`}
              loading="lazy"
            />
          ) : (
            // The grid has to read well without photos: many garments have none.
            <span className="text-muted-foreground px-2 text-center text-xs">
              {labelFor(item.type)}
            </span>
          )}

          {inLaundry ? (
            <Badge variant="secondary" className="absolute top-1 left-1 text-[10px]">
              {LAUNDRY_LABEL.IN_LAUNDRY}
            </Badge>
          ) : null}
        </div>

        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{item.name ?? labelFor(item.type)}</p>
            {item.color ? (
              <p className="text-muted-foreground truncate text-xs">{item.color}</p>
            ) : (
              // A badge rather than blank space: an unset colour is a thing to
              // finish, not an absence to overlook.
              <Badge variant="outline" className="mt-0.5 text-[10px]">
                {UNSORTED_COLOR_LABEL}
              </Badge>
            )}
          </div>
          {item.favorite ? (
            <span className="text-xs" aria-label="Favourite" title="Favourite">
              ★
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-1">
          <Badge variant="secondary">{labelFor(item.category)}</Badge>
          {item.seasons.map((season) => (
            <Badge key={season} variant="outline">
              {labelFor(season)}
            </Badge>
          ))}
        </div>
      </Link>

      {onLaundryChange ? (
        <LaundryToggle
          status={item.laundryStatus}
          onChange={(next) => onLaundryChange(item.id, next)}
        />
      ) : null}
    </div>
  );
}
