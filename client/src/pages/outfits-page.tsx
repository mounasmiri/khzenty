import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { labelFor } from '@/features/clothing/labels';
import { OutfitBoard } from '@/features/outfits/outfit-board';
import { outfitsApi } from '@/features/outfits/api';
import { pickOutfitForToday } from '@/features/outfits/pick-outfit';
import { useBoardZones } from '@/features/outfits/use-board-zones';
import { useOutfits } from '@/features/outfits/use-outfits';
import { ApiError } from '@/lib/api';

export function OutfitsPage() {
  const { outfits, error, removeLocally } = useOutfits();
  const zones = useBoardZones();
  const navigate = useNavigate();

  const lastPickRef = useRef<string | null>(null);
  const [nothingReady, setNothingReady] = useState(false);

  const suggest = () => {
    const picked = pickOutfitForToday(outfits ?? [], Math.random, lastPickRef.current);

    if (!picked) {
      setNothingReady(true);
      return;
    }

    lastPickRef.current = picked.id;
    void navigate(`/outfits/${picked.id}/edit`);
  };

  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const remove = async (id: string) => {
    setDeletingId(id);
    setDeleteError(null);

    try {
      await outfitsApi.remove(id);
      removeLocally(id);
      setConfirmingId(null);
    } catch (caught) {
      setDeleteError(
        caught instanceof ApiError ? caught.message : 'The outfit could not be deleted.',
      );
    } finally {
      setDeletingId(null);
    }
  };

  if (error) {
    return <p className="text-destructive text-sm">{error}</p>;
  }

  if (!outfits || !zones) {
    return <p className="text-muted-foreground text-sm">Loading your outfits…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Outfits</h1>
          <p className="text-muted-foreground text-sm">
            {outfits.length === 0
              ? 'Nothing saved yet.'
              : `${String(outfits.length)} saved, newest first.`}
          </p>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" size="sm" onClick={suggest}>
            What should I wear today?
          </Button>
          <Button asChild size="sm">
            <Link to="/outfits/new">Build one</Link>
          </Button>
        </div>
      </div>

      {nothingReady && (
        <p role="status" className="text-muted-foreground text-sm">
          No outfit is ready. Everything is in the laundry or no outfits are saved yet.
        </p>
      )}

      {deleteError && <p className="text-destructive text-sm">{deleteError}</p>}

      {outfits.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm font-medium">No outfits yet</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Pick a few garments and save the board to come back to it.
          </p>
          <Button asChild className="mt-4" size="sm">
            <Link to="/outfits/new">Build your first outfit</Link>
          </Button>
        </div>
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {outfits.map((outfit) => (
            <li key={outfit.id} className="space-y-2">
              {/* The whole board is the link, so opening an outfit on a phone
                  does not depend on hitting a small label. */}
              <Link to={`/outfits/${outfit.id}/edit`} className="block">
                <OutfitBoard
                  garments={outfit.items}
                  zones={zones}
                  layout={outfit.layout}
                  className="transition-opacity hover:opacity-90"
                />
              </Link>

              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link
                    to={`/outfits/${outfit.id}/edit`}
                    className="block truncate text-sm font-medium hover:underline"
                  >
                    {outfit.name}
                  </Link>
                  <p className="text-muted-foreground text-xs">
                    {outfit.items.length === 1
                      ? '1 garment'
                      : `${String(outfit.items.length)} garments`}
                  </p>
                </div>

                {confirmingId === outfit.id ? (
                  <span className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => void remove(outfit.id)}
                      disabled={deletingId === outfit.id}
                    >
                      {deletingId === outfit.id ? '…' : 'Delete'}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setConfirmingId(null)}>
                      Cancel
                    </Button>
                  </span>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground shrink-0"
                    onClick={() => setConfirmingId(outfit.id)}
                  >
                    Delete
                  </Button>
                )}
              </div>

              {outfit.occasions.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {outfit.occasions.map((occasion) => (
                    <Badge key={occasion} variant="secondary" className="text-[11px]">
                      {labelFor(occasion)}
                    </Badge>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
