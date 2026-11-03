import { Link } from 'react-router';

import { Badge } from '@/components/ui/badge';
import { labelFor } from './labels';
import type { ClothingItem } from './types';

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
      <div className="bg-muted flex aspect-square items-center justify-center overflow-hidden rounded-md">
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.name ?? labelFor(item.type)}
            className="h-full w-full object-cover"
          />
        ) : (
          // Images arrive in a later phase; until then every tile is a
          // placeholder, so the grid must read well without them.
          <span className="text-muted-foreground px-2 text-center text-xs">
            {labelFor(item.type)}
          </span>
        )}
      </div>

      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{item.name ?? labelFor(item.type)}</p>
          <p className="text-muted-foreground truncate text-xs">{item.color}</p>
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
