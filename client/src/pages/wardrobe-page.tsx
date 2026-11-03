import { Link } from 'react-router';

import { Button } from '@/components/ui/button';
import { ItemCard } from '@/features/clothing/item-card';
import { labelFor } from '@/features/clothing/labels';
import { useWardrobe } from '@/features/clothing/use-wardrobe';

export function WardrobePage() {
  const { items, error } = useWardrobe();

  return (
    <section className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          Your wardrobe
          {items ? <span className="text-muted-foreground ml-2 text-base">{items.length}</span> : null}
        </h1>

        <Button asChild>
          <Link to="/items/new">Add item</Link>
        </Button>
      </div>

      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}

      {items === null && !error ? (
        <p className="text-muted-foreground text-sm">Loading your wardrobe…</p>
      ) : null}

      {items?.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="font-medium">Nothing here yet</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Add your first garment and it will show up here.
          </p>
        </div>
      ) : null}

      {items && items.length > 0 ? (
        <>
          {/* Favourites sort first server-side, so no client ordering here. */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((item) => (
              <ItemCard key={item.id} item={item} />
            ))}
          </div>

          <p className="text-muted-foreground text-xs">
            {[...new Set(items.map((i) => i.category))]
              .map((category) => labelFor(category))
              .join(' · ')}
          </p>
        </>
      ) : null}
    </section>
  );
}
