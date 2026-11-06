import { useCallback, useEffect, useState } from 'react';

import { ApiError } from '@/lib/api';
import { outfitsApi } from './api';
import type { Outfit } from './types';

function messageFrom(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Something went wrong.';
}

/** The outfit list, with a `reload` for use after a mutation. */
export function useOutfits() {
  const [outfits, setOutfits] = useState<Outfit[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setError(null);

    try {
      setOutfits(await outfitsApi.list());
    } catch (caught) {
      setError(messageFrom(caught));
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  /** Drops one outfit locally, so a delete does not cost a full refetch. */
  const removeLocally = useCallback((id: string) => {
    setOutfits((current) => current?.filter((outfit) => outfit.id !== id) ?? current);
  }, []);

  return { outfits, error, reload, removeLocally };
}

/** A single outfit, by id. */
export function useOutfit(id: string | undefined) {
  const [outfit, setOutfit] = useState<Outfit | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    let cancelled = false;
    setLoading(true);

    outfitsApi
      .get(id)
      .then((found) => {
        if (!cancelled) setOutfit(found);
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(messageFrom(caught));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  return { outfit, error, loading };
}
