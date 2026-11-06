import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { labelFor } from '@/features/clothing/labels';
import type { ClothingItem } from '@/features/clothing/types';
import { outfitsApi } from './api';
import { GarmentPicker } from './garment-picker';
import { layoutForGarments } from './garment-layout';
import { OutfitBoard } from './outfit-board';
import {
  type BoardZoneMap,
  MAX_OUTFIT_ITEMS,
  OCCASIONS,
  type Occasion,
  type Outfit,
  type OutfitGarment,
} from './types';
import { ApiError } from '@/lib/api';

/**
 * The wardrobe's richer item shape narrowed to what a board needs. The board
 * takes the server's outfit projection, so a locally picked garment has to be
 * presented the same way rather than the board learning a second shape.
 */
function toGarment(item: ClothingItem): OutfitGarment {
  return {
    id: item.id,
    name: item.name,
    category: item.category,
    type: item.type,
    color: item.color,
    imageUrl: item.imageUrl,
    laundryStatus: item.laundryStatus,
  };
}

interface OutfitEditorProps {
  /** Every garment in the wardrobe, clean or not. */
  items: readonly ClothingItem[];
  zones: BoardZoneMap;
  /** The outfit being edited, or undefined when building a new one. */
  outfit?: Outfit;
}

/**
 * Builds or edits an outfit.
 *
 * One component for both, rather than a new page and an edit page that drift:
 * the only difference is where the initial state comes from and whether a
 * delete button is shown. Everything else — the picker, the board, the name,
 * the occasions, the save — is identical, and duplicating it would mean fixing
 * every board bug twice.
 */
export function OutfitEditor({ items, zones, outfit }: OutfitEditorProps) {
  const navigate = useNavigate();

  const [name, setName] = useState(outfit?.name ?? '');
  const [occasions, setOccasions] = useState<Occasion[]>(outfit?.occasions ?? []);
  const [selectedIds, setSelectedIds] = useState<string[]>(
    () => outfit?.items.map((item) => item.id) ?? [],
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const toggleGarment = useCallback((id: string) => {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((existing) => existing !== id)
        : // Guarded here as well as in the picker: the cap is the server's
          // rule, and the state should not be able to break it even if a
          // future caller forgets to disable the control.
          current.length >= MAX_OUTFIT_ITEMS
          ? current
          : [...current, id],
    );
  }, []);

  const toggleOccasion = useCallback((occasion: Occasion) => {
    setOccasions((current) =>
      current.includes(occasion)
        ? current.filter((existing) => existing !== occasion)
        : [...current, occasion],
    );
  }, []);

  /**
   * Only clean garments can be picked. An outfit being edited may already hold
   * one that has since gone in the wash, though, and silently dropping it on
   * open would rewrite the user's outfit behind their back — so anything
   * already in the outfit stays selectable.
   */
  const selectable = useMemo(() => {
    const alreadyIn = new Set(outfit?.items.map((item) => item.id) ?? []);

    return items.filter((item) => item.laundryStatus === 'CLEAN' || alreadyIn.has(item.id));
  }, [items, outfit]);

  const garments = useMemo(() => {
    const byId = new Map(selectable.map((item) => [item.id, item]));

    return selectedIds.flatMap((id) => {
      const item = byId.get(id);

      return item ? [toGarment(item)] : [];
    });
  }, [selectable, selectedIds]);

  // Computed here and handed to the board, so what is stored is exactly what
  // was on screen. The board would otherwise derive its own and the two could
  // differ after a zone change.
  const layout = useMemo(() => layoutForGarments(garments, zones), [garments, zones]);

  const trimmedName = name.trim();
  const canSave = trimmedName.length > 0 && !saving;

  const save = async () => {
    if (!canSave) return;

    setSaving(true);
    setError(null);

    const input = {
      name: trimmedName,
      occasions,
      itemIds: garments.map((garment) => garment.id),
      // Saved rather than recomputed on open, so a later taxonomy change
      // cannot quietly rearrange an outfit the user already composed.
      layout: layout.placements.length > 0 ? layout : null,
    };

    try {
      if (outfit) {
        await outfitsApi.update(outfit.id, input);
      } else {
        await outfitsApi.create(input);
      }

      void navigate('/outfits');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'The outfit could not be saved.');
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!outfit) return;

    setSaving(true);
    setError(null);

    try {
      await outfitsApi.remove(outfit.id);
      void navigate('/outfits');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'The outfit could not be deleted.');
      setSaving(false);
      setConfirmingDelete(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Mobile-first: the board sits above the picker in one column, and the
          two sit side by side only once there is room. The board is sticky on
          the wide layout so it stays visible while the picker scrolls. */}
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <div className="space-y-4 lg:sticky lg:top-4">
          <OutfitBoard garments={garments} zones={zones} />

          <p className="text-muted-foreground text-xs">
            {garments.length === 0
              ? 'Nothing picked yet.'
              : `${String(garments.length)} of ${String(MAX_OUTFIT_ITEMS)} garments.`}
            {garments.length >= MAX_OUTFIT_ITEMS && ' That is the most one outfit can hold.'}
          </p>

          <div className="space-y-2">
            <Label htmlFor="outfit-name">Name</Label>
            <Input
              id="outfit-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Friday dinner"
              maxLength={120}
            />
          </div>

          <div className="space-y-2">
            <Label>Occasions</Label>
            <p className="text-muted-foreground text-xs">
              Optional — the same blazer is work-wear in one outfit and formal in another.
            </p>

            <div className="flex flex-wrap gap-2">
              {OCCASIONS.map((occasion) => {
                const active = occasions.includes(occasion);

                return (
                  <Button
                    key={occasion}
                    type="button"
                    size="sm"
                    variant={active ? 'default' : 'outline'}
                    aria-pressed={active}
                    onClick={() => toggleOccasion(occasion)}
                  >
                    {labelFor(occasion)}
                  </Button>
                );
              })}
            </div>
          </div>

          {error && <p className="text-destructive text-sm">{error}</p>}

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => void save()} disabled={!canSave}>
              {saving ? 'Saving…' : outfit ? 'Save changes' : 'Save outfit'}
            </Button>

            {selectedIds.length > 0 && (
              <Button variant="outline" onClick={() => setSelectedIds([])} disabled={saving}>
                Clear board
              </Button>
            )}

            {outfit &&
              (confirmingDelete ? (
                <span className="flex items-center gap-2">
                  <span className="text-muted-foreground text-sm">Delete this outfit?</span>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => void remove()}
                    disabled={saving}
                  >
                    Delete
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmingDelete(false)}
                    disabled={saving}
                  >
                    Cancel
                  </Button>
                </span>
              ) : (
                <Button
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => setConfirmingDelete(true)}
                  disabled={saving}
                >
                  Delete
                </Button>
              ))}
          </div>

          {trimmedName.length === 0 && (
            <p className="text-muted-foreground text-xs">An outfit needs a name to be saved.</p>
          )}
        </div>

        <GarmentPicker items={selectable} selectedIds={selectedIds} onToggle={toggleGarment} />
      </div>
    </div>
  );
}
