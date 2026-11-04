import { useCallback, useEffect, useState } from 'react';

import { ApiError } from '@/lib/api';
import { clothingApi } from './api';
import type { ClothingItem, TaxonomyGroup } from './types';

function messageFrom(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Something went wrong.';
}

/** The wardrobe list, with a `reload` for use after a mutation. */
export function useWardrobe() {
  const [items, setItems] = useState<ClothingItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setError(null);

    try {
      setItems(await clothingApi.list());
    } catch (caught) {
      setError(messageFrom(caught));
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  /**
   * Swaps one garment in place after a mutation, so a status change does not
   * cost a full refetch and does not reshuffle the grid under the user.
   */
  const replaceItem = useCallback((updated: ClothingItem) => {
    setItems((current) =>
      current ? current.map((item) => (item.id === updated.id ? updated : item)) : current,
    );
  }, []);

  return { items, error, reload, replaceItem };
}

/** A single garment, by id. */
export function useClothingItem(id: string | undefined) {
  const [item, setItem] = useState<ClothingItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    let cancelled = false;
    setLoading(true);

    clothingApi
      .get(id)
      .then((found) => {
        if (!cancelled) setItem(found);
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

  return { item, error, loading };
}

/**
 * Fetched rather than hardcoded, so the type picker can only offer values the
 * API accepts.
 */
export function useTaxonomy() {
  const [taxonomy, setTaxonomy] = useState<TaxonomyGroup[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    clothingApi
      .taxonomy()
      .then((groups) => {
        if (!cancelled) setTaxonomy(groups);
      })
      .catch((caught: unknown) => {
        console.error('[wardrobe] Could not load the taxonomy:', caught);
        if (!cancelled) setTaxonomy([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return taxonomy;
}
