import { Link } from 'react-router';

import { Badge } from '@/components/ui/badge';
import { labelFor } from './labels';
import type { ClothingItem } from './types';
import { UNSORTED_COLOR_LABEL } from './types';

/**
 * One garment in the wardrobe grid. `name` is optional on the server, so the
 * type is the fallback label.
 */
export function ItemCard({ item }: { item: ClothingItem }) {
  return (
    <Link
      to={`/items/${item.id}`}
      className="group focus-visible:ring-ring flex flex-col gap-2 rounded-lg border p-3 transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:outline-none"
    >
      {/* `object-contain`, not `object-cover`: garment photos arrive at every
          aspect ratio, and cropping to fill the tile cut the toes off shoes and
          the hems off trousers. Letterboxing on a light neutral ground shows
          the whole garment, and the fixed 4:5 tile — matching the detail view —
          keeps rows aligned despite the varying image shapes. */}
      <div className="flex aspect-[4/5] items-center justify-center overflow-hidden rounded-md bg-neutral-50 dark:bg-neutral-900">
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.name ?? labelFor(item.type)}
            className="max-h-full max-w-full object-contain"
            loading="lazy"
          />
        ) : (
          // The grid has to read well without photos: many garments have none.
          <span className="text-muted-foreground px-2 text-center text-xs">
            {labelFor(item.type)}
          </span>
        )}
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
  );
}
