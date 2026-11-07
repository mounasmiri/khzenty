import { Link } from 'react-router';

import { Button } from '@/components/ui/button';
import { useWardrobe } from '@/features/clothing/use-wardrobe';
import { OutfitEditor } from '@/features/outfits/outfit-editor';
import { useBoardZones } from '@/features/outfits/use-board-zones';

export function OutfitNewPage() {
  const { items, error } = useWardrobe();
  const zones = useBoardZones();

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
          <Link to="/outfits">Outfits</Link>
        </Button>
      </div>

      <OutfitEditor items={items} zones={zones} />

      <Button asChild variant="ghost" className="self-start">
        <Link to="/">← Back to wardrobe</Link>
      </Button>
    </div>
  );
}
