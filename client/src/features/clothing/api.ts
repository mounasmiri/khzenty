import { api } from '@/lib/api';
import type { ClothingItem, ClothingItemInput, LaundryStatus, TaxonomyGroup } from './types';

export const clothingApi = {
  list: () => api.get<{ items: ClothingItem[] }>('/items').then((r) => r.items),

  get: (id: string) =>
    api.get<{ item: ClothingItem }>(`/items/${encodeURIComponent(id)}`).then((r) => r.item),

  create: (input: ClothingItemInput) =>
    api.post<{ item: ClothingItem }>('/items', input).then((r) => r.item),

  update: (id: string, input: Partial<ClothingItemInput>) =>
    api
      .patch<{ item: ClothingItem }>(`/items/${encodeURIComponent(id)}`, input)
      .then((r) => r.item),

  remove: (id: string) => api.delete<void>(`/items/${encodeURIComponent(id)}`),

  removeImage: (id: string) =>
    api
      .delete<{ item: { id: string; imageUrl: string | null } }>(
        `/items/${encodeURIComponent(id)}/image`,
      )
      .then((r) => r.item),

  taxonomy: () => api.get<{ taxonomy: TaxonomyGroup[] }>('/taxonomy').then((r) => r.taxonomy),

  setLaundryStatus: (id: string, status: LaundryStatus) =>
    api
      .patch<{ item: ClothingItem }>(`/items/${encodeURIComponent(id)}/laundry`, { status })
      .then((r) => r.item),

  /** Resolves with how many garments actually moved; foreign ids are skipped. */
  markWashed: (ids: string[]) =>
    api.post<{ updated: number }>('/items/laundry/washed', { ids }).then((r) => r.updated),
};
