import { api } from '@/lib/api';
import type { Destination, TripDetail, TripInput, TripSummary, TripWeather } from './types';

const enc = encodeURIComponent;

export const tripsApi = {
  list: () => api.get<{ trips: TripSummary[] }>('/trips').then((r) => r.trips),

  get: (id: string) => api.get<{ trip: TripDetail }>(`/trips/${enc(id)}`).then((r) => r.trip),

  create: (input: TripInput) => api.post<{ trip: TripSummary }>('/trips', input).then((r) => r.trip),

  update: (id: string, input: Partial<TripInput>) =>
    api.patch<{ trip: TripSummary }>(`/trips/${enc(id)}`, input).then((r) => r.trip),

  remove: (id: string) => api.delete<void>(`/trips/${enc(id)}`),

  weather: (id: string) =>
    api.get<{ weather: TripWeather }>(`/trips/${enc(id)}/weather`).then((r) => r.weather),

  /** Server-side geocoding, so the browser never calls a third party. */
  searchDestinations: (query: string) =>
    api
      .get<{ destinations: Destination[] }>(`/trips/destinations?q=${enc(query)}`)
      .then((r) => r.destinations),

  /** Resolves with the refreshed trip, since guidance changes with the entries. */
  addEntry: (tripId: string, target: { clothingItemId: string } | { outfitId: string }) =>
    api.post<{ trip: TripDetail }>(`/trips/${enc(tripId)}/entries`, target).then((r) => r.trip),

  removeEntry: (tripId: string, entryId: string) =>
    api.delete<void>(`/trips/${enc(tripId)}/entries/${enc(entryId)}`),

  setPacked: (tripId: string, entryId: string, packed: boolean) =>
    api.patch<{ entry: { id: string; packed: boolean } }>(
      `/trips/${enc(tripId)}/entries/${enc(entryId)}`,
      { packed },
    ),
};
