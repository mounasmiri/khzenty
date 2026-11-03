/** Mirrors the server's `ITEM_SELECT` projection. */
export interface ClothingItem {
  id: string;
  name: string | null;
  category: string;
  type: string;
  color: string;
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
  color: string;
  name?: string | null;
  seasons?: string[];
  favorite?: boolean;
}

export const SEASONS = ['SPRING', 'SUMMER', 'AUTUMN', 'WINTER'] as const;
