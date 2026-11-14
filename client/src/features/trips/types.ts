import type { OutfitGarment, Occasion } from '@/features/outfits/types';

/** Mirrors the server's trip summary (list rows, and the head of the detail). */
export interface TripSummary {
  id: string;
  name: string;
  destinationName: string;
  latitude: number;
  longitude: number;
  /** `YYYY-MM-DD` — a calendar date, not an instant. */
  startDate: string;
  endDate: string;
  days: number;
  entryCount: number;
  packedCount: number;
}

/** One line of the packing list: a garment or an outfit, never both. */
export interface TripEntry {
  id: string;
  packed: boolean;
  item: OutfitGarment | null;
  outfit: { id: string; name: string; occasions: Occasion[]; items: OutfitGarment[] } | null;
}

export interface CategoryGuidance {
  category: string;
  /** Null: no target for this category, only a count of what is planned. */
  recommended: number | null;
  /** From the wardrobe: garments added directly, plus those inside outfits. */
  planned: number;
  /** Packed outside the app (no photo); set with the row's stepper. */
  manual: number;
}

export interface TripDetail extends TripSummary {
  entries: TripEntry[];
  packing: {
    total: number;
    packed: number;
    categories: CategoryGuidance[];
  };
}

export interface WeatherDay {
  date: string;
  minC: number;
  maxC: number;
  precipitationProbability: number | null;
  rainLikely: boolean;
  summary: string;
}

export type TripWeather =
  | { forecastAvailable: true; days: WeatherDay[]; partial: boolean }
  | {
      forecastAvailable: false;
      reason: 'TOO_FAR_AHEAD' | 'IN_THE_PAST' | 'SERVICE_UNAVAILABLE';
      message: string;
    };

export interface Destination {
  label: string;
  latitude: number;
  longitude: number;
}

/** What the form sends. Coordinates only when a search result was picked. */
export interface TripInput {
  name: string;
  destination: string;
  latitude?: number;
  longitude?: number;
  startDate: string;
  endDate: string;
}

/** The server's cap, mirrored so the form can say so before the request does. */
export const MAX_TRIP_DAYS = 60;

/** The server's cap on a manual count, mirrored so the stepper stops there. */
export const MAX_MANUAL_COUNT = 50;
