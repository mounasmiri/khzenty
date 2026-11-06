import type { LaundryStatus } from '@/features/clothing/types';
import type { BoardLayout, BoardZone } from './board-layout';

/** Mirrors the server's `Occasion` enum. */
export const OCCASIONS = [
  'CASUAL',
  'WORK',
  'FORMAL',
  'SPORT',
  'PARTY',
  'TRAVEL',
  'HOME',
] as const;

export type Occasion = (typeof OCCASIONS)[number];

/**
 * The garment fields an outfit carries — the server's `OUTFIT_ITEM_SELECT`.
 * Narrower than `ClothingItem`: an outfit has no need for seasons, favourites
 * or the outfit count, so it is not sent one.
 */
export interface OutfitGarment {
  id: string;
  name: string | null;
  category: string;
  type: string;
  color: string | null;
  imageUrl: string | null;
  laundryStatus: LaundryStatus;
}

export interface Outfit {
  id: string;
  name: string;
  occasions: Occasion[];
  /** Null means "no saved positions" — the board uses its auto-layout. */
  layout: BoardLayout | null;
  createdAt: string;
  updatedAt: string;
  items: OutfitGarment[];
}

export interface OutfitInput {
  name: string;
  occasions?: Occasion[];
  /** The full membership set, not a delta — the server replaces it wholesale. */
  itemIds?: string[];
  layout?: BoardLayout | null;
}

/** Garment type to board zone, as served by `/api/taxonomy`. */
export type BoardZoneMap = Record<string, BoardZone>;

/** Upper bound the server enforces; mirrored so the picker can stop earlier. */
export const MAX_OUTFIT_ITEMS = 12;
