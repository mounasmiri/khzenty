import { useEffect, useState } from 'react';

import { outfitsApi } from './api';
import type { BoardZoneMap } from './types';

/**
 * The garment-type to board-zone mapping.
 *
 * Null while loading. On failure it settles on an empty map rather than
 * staying null: the board then renders nothing instead of spinning forever,
 * and the page can say so.
 */
export function useBoardZones(): BoardZoneMap | null {
  const [zones, setZones] = useState<BoardZoneMap | null>(null);

  useEffect(() => {
    let cancelled = false;

    outfitsApi
      .boardZones()
      .then((loaded) => {
        if (!cancelled) setZones(loaded);
      })
      .catch((caught: unknown) => {
        console.error('[outfits] Could not load the board zones:', caught);
        if (!cancelled) setZones({});
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return zones;
}
