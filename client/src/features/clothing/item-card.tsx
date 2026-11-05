import { Link } from 'react-router';

import { Badge } from '@/components/ui/badge';
import { GarmentImage } from './garment-image';
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
        {/* The fixed 4:5 tile matches the detail view, so rows stay aligned
            despite the varying shapes of the photos inside. */}
        <GarmentImage
          src={item.imageUrl}
          alt={item.name ?? labelFor(item.type)}
          placeholder={labelFor(item.type)}
          className="aspect-[4/5] rounded-md"
          // Dimmed while in the wash, so the grid reads at a glance.
          imageClassName={inLaundry ? 'opacity-50' : ''}
          lazy
        >
          {inLaundry ? (
            <Badge variant="secondary" className="absolute top-1 left-1 text-[10px]">
              {LAUNDRY_LABEL.IN_LAUNDRY}
            </Badge>
          ) : null}
        </GarmentImage>

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
