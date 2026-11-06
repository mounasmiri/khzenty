import { useMemo } from 'react';

import { GarmentImage } from '@/features/clothing/garment-image';
import { labelFor } from '@/features/clothing/labels';
import type { BoardLayout } from './board-layout';
import { layoutForGarments, layoutMatchesGarments } from './garment-layout';
import type { BoardZoneMap, OutfitGarment } from './types';

/**
 * Inset of the garments from the board's edge, so nothing is flush against it.
 *
 * Applied as a percentage inset on an inner wrapper rather than as padding on
 * the board: an absolutely positioned child's percentages resolve against the
 * padding box, so padding would not actually move anything in.
 */
const BOARD_INSET = '4%';

/** Taller than wide, like a person. Also what a phone screen has room for. */
export const BOARD_ASPECT_RATIO = '4 / 5';

interface OutfitBoardProps {
  garments: readonly OutfitGarment[];
  zones: BoardZoneMap;
  /**
   * Saved positions. When absent or null the board computes its own, which is
   * also what happens when a saved layout no longer matches the garments.
   */
  layout?: BoardLayout | null;
  className?: string;
  /** Marks the one element a PNG export should rasterise. */
  exportRef?: React.Ref<HTMLDivElement>;
}

/**
 * Renders an outfit as a board.
 *
 * All composition comes from `computeBoardLayout`, which is pure and tested
 * separately; this component only turns its unit-space boxes into CSS
 * percentages. The split matters: the geometry is the part worth testing, and
 * it is untestable once it is tangled up with the DOM.
 *
 * `object-contain` inside each box is the other half of the layout. The pure
 * function decides how much room a garment gets; the browser fits the cutout
 * into it at its own aspect ratio. Neither needs to know the other's business,
 * which is why the layout function never has to measure an image.
 *
 * The neutral surface is painted once, by the board. Cutouts are stored
 * transparent with no colour baked in, so they sit on it directly — hence
 * `surface={false}` on each garment, which would otherwise draw a visible
 * rectangle around every box.
 */
export function OutfitBoard({
  garments,
  zones,
  layout,
  className = '',
  exportRef,
}: OutfitBoardProps) {
  const byId = useMemo(
    () => new Map(garments.map((garment) => [garment.id, garment])),
    [garments],
  );

  const placements = useMemo(() => {
    // A saved layout is used only while it still describes exactly these
    // garments; otherwise the auto-layout is the honest answer.
    if (layout && layoutMatchesGarments(layout, garments)) {
      return layout.placements;
    }

    return layoutForGarments(garments, zones).placements;
  }, [garments, layout, zones]);

  return (
    <div
      ref={exportRef}
      className={`bg-garment-surface relative w-full overflow-hidden rounded-lg border ${className}`}
      style={{ aspectRatio: BOARD_ASPECT_RATIO }}
    >
      <div
        className="absolute"
        style={{ top: BOARD_INSET, right: BOARD_INSET, bottom: BOARD_INSET, left: BOARD_INSET }}
      >
        {placements.map((placement) => {
          const garment = byId.get(placement.itemId);

          if (!garment) return null;

          return (
            <div
              key={placement.itemId}
              className="absolute"
              style={{
                left: `${String(placement.x * 100)}%`,
                top: `${String(placement.y * 100)}%`,
                width: `${String(placement.width * 100)}%`,
                height: `${String(placement.height * 100)}%`,
              }}
            >
              <GarmentImage
                src={garment.imageUrl}
                alt={garment.name ?? labelFor(garment.type)}
                placeholder={labelFor(garment.type)}
                surface={false}
                className="h-full w-full"
              />
            </div>
          );
        })}
      </div>

      {placements.length === 0 && (
        <p className="text-muted-foreground absolute inset-0 flex items-center justify-center p-6 text-center text-sm">
          Pick a few garments and they will appear here.
        </p>
      )}
    </div>
  );
}
