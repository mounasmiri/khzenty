/** Mirrors the server's `ITEM_SELECT` projection. */
/** Shown wherever a garment has no colour set yet. */
export const UNSORTED_COLOR_LABEL = 'Unsorted';

export interface ClothingItem {
  id: string;
  name: string | null;
  category: string;
  type: string;
  /** Null means "not set yet", not "colourless". */
  color: string | null;
  seasons: string[];
  favorite: boolean;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
  /** How many outfits use this garment — drives the delete warning. */
  _count: { outfitItems: number };
}

/** One category and the types belonging to it, as served by `/api/taxonomy`. */
export interface TaxonomyGroup {
  category: string;
  types: string[];
}

/** `category` is absent by design: the server derives it from `type`. */
export interface ClothingItemInput {
  type: string;
  /** Omit or send null to leave it unset; an empty string is rejected. */
  color?: string | null;
  name?: string | null;
  seasons?: string[];
  favorite?: boolean;
}

export const SEASONS = ['SPRING', 'SUMMER', 'AUTUMN', 'WINTER'] as const;
