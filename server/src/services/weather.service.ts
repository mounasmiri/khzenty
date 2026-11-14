import { addDays, formatCalendarDate, todayUtc } from '../lib/calendar-date.js';
import type { WeatherForGuidance } from './packing-guidance.service.js';

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const TIMEOUT_MS = 4000;

/** Open-Meteo forecasts today plus 15 further days. */
const FORECAST_HORIZON_DAYS = 15;

/** Precipitation probability (%) at or above which a day counts as rainy. */
const RAIN_LIKELY_PERCENT = 50;

const CACHE_TTL_MS = 45 * 60 * 1000;
/** A failure is remembered only briefly, so an outage is retried soon. */
const FAILURE_TTL_MS = 60 * 1000;
const CACHE_MAX_ENTRIES = 200;

export interface WeatherDay {
  date: string;
  minC: number;
  maxC: number;
  /** Null when the API gave no value for the day. */
  precipitationProbability: number | null;
  rainLikely: boolean;
  /** e.g. "8–14°C, rain likely". */
  summary: string;
}

export type UnavailableReason = 'TOO_FAR_AHEAD' | 'IN_THE_PAST' | 'SERVICE_UNAVAILABLE';

export type TripWeather =
  | {
      forecastAvailable: true;
      days: WeatherDay[];
      /** Whole-trip figures, also what the packing guidance uses. */
      overall: WeatherForGuidance;
      /** True when only part of the trip is inside the forecast window. */
      partial: boolean;
    }
  | { forecastAvailable: false; reason: UnavailableReason; message: string };

export interface WeatherQuery {
  latitude: number;
  longitude: number;
  startDate: Date;
  endDate: Date;
}

interface ForecastResponse {
  daily?: {
    time?: string[];
    temperature_2m_max?: (number | null)[];
    temperature_2m_min?: (number | null)[];
    precipitation_probability_max?: (number | null)[];
  };
}

/** Caches the promise, so concurrent requests for one trip share one call. */
const cache = new Map<string, { expiresAt: number; result: Promise<TripWeather> }>();

export function clearWeatherCache(): void {
  cache.clear();
}

function summarise(minC: number, maxC: number, rainLikely: boolean): string {
  const range = `${String(Math.round(minC))}–${String(Math.round(maxC))}°C`;

  return rainLikely ? `${range}, rain likely` : range;
}

function unavailable(reason: UnavailableReason, message: string): TripWeather {
  return { forecastAvailable: false, reason, message };
}

async function fetchForecast(query: WeatherQuery, from: Date, to: Date): Promise<TripWeather> {
  const url = new URL(FORECAST_URL);
  url.searchParams.set('latitude', String(query.latitude));
  url.searchParams.set('longitude', String(query.longitude));
  url.searchParams.set(
    'daily',
    'temperature_2m_max,temperature_2m_min,precipitation_probability_max',
  );
  url.searchParams.set('timezone', 'auto');
  url.searchParams.set('start_date', formatCalendarDate(from));
  url.searchParams.set('end_date', formatCalendarDate(to));

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });

    if (!response.ok) {
      throw new Error(`Forecast responded ${String(response.status)}`);
    }

    const { daily } = (await response.json()) as ForecastResponse;
    const days: WeatherDay[] = [];

    (daily?.time ?? []).forEach((date, index) => {
      const minC = daily?.temperature_2m_min?.[index];
      const maxC = daily?.temperature_2m_max?.[index];

      // A day with no temperatures is skipped rather than shown as made up.
      if (typeof minC !== 'number' || typeof maxC !== 'number') return;

      const probability = daily?.precipitation_probability_max?.[index] ?? null;
      const rainLikely = probability !== null && probability >= RAIN_LIKELY_PERCENT;

      days.push({
        date,
        minC,
        maxC,
        precipitationProbability: probability,
        rainLikely,
        summary: summarise(minC, maxC, rainLikely),
      });
    });

    if (days.length === 0) {
      throw new Error('Forecast contained no usable days');
    }

    return {
      forecastAvailable: true,
      days,
      overall: {
        minC: Math.min(...days.map((day) => day.minC)),
        maxC: Math.max(...days.map((day) => day.maxC)),
        rainLikely: days.some((day) => day.rainLikely),
      },
      partial: from.getTime() > query.startDate.getTime() || to.getTime() < query.endDate.getTime(),
    };
  } catch {
    return unavailable('SERVICE_UNAVAILABLE', 'The weather service could not be reached right now.');
  }
}

/**
 * Forecast for a trip's destination and dates, via Open-Meteo.
 *
 * Never throws: weather is a nicety, so every failure becomes a
 * `forecastAvailable: false` result and the trip page keeps working. Dates
 * outside the forecast window are reported as such rather than invented.
 */
export function getWeather(query: WeatherQuery, now: Date = new Date()): Promise<TripWeather> {
  const today = todayUtc(now);
  const horizon = addDays(today, FORECAST_HORIZON_DAYS);

  if (query.endDate.getTime() < today.getTime()) {
    return Promise.resolve(unavailable('IN_THE_PAST', 'This trip is over, so there is no forecast.'));
  }

  if (query.startDate.getTime() > horizon.getTime()) {
    return Promise.resolve(
      unavailable(
        'TOO_FAR_AHEAD',
        'Forecasts only cover about 16 days ahead. Check back closer to your trip.',
      ),
    );
  }

  const from = query.startDate.getTime() < today.getTime() ? today : query.startDate;
  const to = query.endDate.getTime() > horizon.getTime() ? horizon : query.endDate;
  const key = [query.latitude, query.longitude, formatCalendarDate(from), formatCalendarDate(to)].join('|');

  const hit = cache.get(key);

  if (hit && hit.expiresAt > Date.now()) {
    return hit.result;
  }

  const result = fetchForecast(query, from, to);
  const entry = { expiresAt: Date.now() + CACHE_TTL_MS, result };

  if (cache.size >= CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }

  cache.set(key, entry);

  void result.then((value) => {
    if (!value.forecastAvailable) entry.expiresAt = Date.now() + FAILURE_TTL_MS;
  });

  return result;
}
