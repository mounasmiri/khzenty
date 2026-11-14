import { HttpError } from '../lib/http-error.js';

const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const TIMEOUT_MS = 5000;

export interface Destination {
  /** Display text, e.g. "Paris, Île-de-France, France". */
  label: string;
  latitude: number;
  longitude: number;
}

interface GeocodingResponse {
  results?: {
    name: string;
    admin1?: string;
    country?: string;
    latitude: number;
    longitude: number;
  }[];
}

/**
 * Looks a city up via Open-Meteo's geocoding API (no key needed).
 *
 * Called from the server only, so the browser never talks to a third party.
 * A failure is a 502 with a safe message: the caller cannot do anything with
 * the upstream detail, and it must not be mistaken for the user's own error.
 */
export async function searchDestinations(query: string, count = 5): Promise<Destination[]> {
  const url = new URL(GEOCODING_URL);
  url.searchParams.set('name', query);
  url.searchParams.set('count', String(count));
  url.searchParams.set('language', 'en');
  url.searchParams.set('format', 'json');

  let body: GeocodingResponse;

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });

    if (!response.ok) {
      throw new Error(`Geocoding responded ${String(response.status)}`);
    }

    body = (await response.json()) as GeocodingResponse;
  } catch (cause) {
    throw new HttpError(502, 'Destination search is unavailable right now', {
      cause,
      expose: true,
    });
  }

  return (body.results ?? []).map((result) => ({
    label: [result.name, result.admin1, result.country]
      .filter((part): part is string => Boolean(part))
      .filter((part, index, all) => all.indexOf(part) === index)
      .join(', '),
    latitude: result.latitude,
    longitude: result.longitude,
  }));
}

/** The best match for a free-text destination, or a 400 when there is none. */
export async function resolveDestination(query: string): Promise<Destination> {
  const [best] = await searchDestinations(query, 1);

  if (!best) {
    throw new HttpError(400, `We could not find a destination called "${query}"`);
  }

  return best;
}
