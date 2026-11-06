import { Link, useParams } from 'react-router';

import { Button } from '@/components/ui/button';
import { useWardrobe } from '@/features/clothing/use-wardrobe';
import { OutfitEditor } from '@/features/outfits/outfit-editor';
import { useBoardZones } from '@/features/outfits/use-board-zones';
import { useOutfit } from '@/features/outfits/use-outfits';

export function OutfitEditPage() {
  const { id } = useParams<{ id: string }>();
  const { outfit, error, loading } = useOutfit(id);
  const { items, error: wardrobeError } = useWardrobe();
  const zones = useBoardZones();

  const failure = error ?? wardrobeError;

  if (failure) {
    return (
      <div className="space-y-4">
        <p className="text-destructive text-sm">{failure}</p>
        <Button asChild variant="outline" size="sm">
          <Link to="/outfits">Back to outfits</Link>
        </Button>
      </div>
    );
  }

  if (loading || !outfit || !items || !zones) {
    return <p className="text-muted-foreground text-sm">Loading…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{outfit.name}</h1>
          <p className="text-muted-foreground text-sm">
            Change the garments, the name or the occasions.
          </p>
        </div>

        <Button asChild variant="ghost" size="sm">
          <Link to="/outfits">Outfits</Link>
        </Button>
      </div>

      {/* Keyed on the outfit id so navigating between two outfits rebuilds the
          editor's initial state instead of keeping the previous one's. */}
      <OutfitEditor key={outfit.id} items={items} zones={zones} outfit={outfit} />
    </div>
  );
}
