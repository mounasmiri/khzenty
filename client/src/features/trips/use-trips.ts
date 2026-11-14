import { useCallback, useEffect, useState } from 'react';

import { ApiError } from '@/lib/api';
import { tripsApi } from './api';
import type { TripDetail, TripSummary, TripWeather } from './types';

export function messageFrom(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Something went wrong.';
}

/** The trip list, with `removeLocally` so a delete does not cost a refetch. */
export function useTrips() {
  const [trips, setTrips] = useState<TripSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setError(null);

    try {
      setTrips(await tripsApi.list());
    } catch (caught) {
      setError(messageFrom(caught));
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const removeLocally = useCallback((id: string) => {
    setTrips((current) => current?.filter((trip) => trip.id !== id) ?? current);
  }, []);

  return { trips, error, reload, removeLocally };
}

/**
 * One trip with its entries.
 *
 * `setTrip` is exposed so a mutation that already returns the fresh trip (add
 * entry) or only flips a flag (packed) can update in place; `reload` refetches
 * when the server's derived numbers may have changed (after a removal).
 */
export function useTrip(id: string | undefined) {
  const [trip, setTrip] = useState<TripDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!id) return;

    try {
      setTrip(await tripsApi.get(id));
      setError(null);
    } catch (caught) {
      setError(messageFrom(caught));
    }
  }, [id]);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    void reload().finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [reload]);

  return { trip, setTrip, error, loading, reload };
}

/**
 * The forecast, fetched separately from the trip so a slow or failing weather
 * service never holds the page back. A failed request is reported in the same
 * "unavailable" shape the server uses.
 */
export function useTripWeather(id: string | undefined, version: string) {
  const [weather, setWeather] = useState<TripWeather | null>(null);

  useEffect(() => {
    if (!id || !version) return;

    let cancelled = false;
    setWeather(null);

    tripsApi
      .weather(id)
      .then((found) => {
        if (!cancelled) setWeather(found);
      })
      .catch(() => {
        if (!cancelled) {
          setWeather({
            forecastAvailable: false,
            reason: 'SERVICE_UNAVAILABLE',
            message: 'The weather could not be loaded right now.',
          });
        }
      });

    return () => {
      cancelled = true;
    };
    // `version` (the trip's destination and dates) refetches after an edit.
  }, [id, version]);

  return weather;
}
