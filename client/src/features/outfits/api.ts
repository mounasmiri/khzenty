import { api } from '@/lib/api';
import type { BoardZoneMap, Outfit, OutfitInput } from './types';

export const outfitsApi = {
  list: () => api.get<{ outfits: Outfit[] }>('/outfits').then((r) => r.outfits),

  get: (id: string) =>
    api.get<{ outfit: Outfit }>(`/outfits/${encodeURIComponent(id)}`).then((r) => r.outfit),

  create: (input: OutfitInput) =>
    api.post<{ outfit: Outfit }>('/outfits', input).then((r) => r.outfit),

  update: (id: string, input: Partial<OutfitInput>) =>
    api.patch<{ outfit: Outfit }>(`/outfits/${encodeURIComponent(id)}`, input).then((r) => r.outfit),

  /** Marks the outfit worn; clean pieces go to the laundry. Resolves with the log id. */
  wear: (id: string) =>
    api
      .post<{ wearLog: { id: string } }>(`/outfits/${encodeURIComponent(id)}/wear`)
      .then((r) => r.wearLog.id),

  undoWear: (logId: string) => api.post<void>(`/wear-log/${encodeURIComponent(logId)}/undo`),

  remove: (id: string) => api.delete<void>(`/outfits/${encodeURIComponent(id)}`),

  /**
   * The type-to-zone mapping, from the same endpoint that serves the taxonomy.
   * Fetched rather than hardcoded for the same reason the type picker is: a
   * second copy on the client would be free to drift from the server's.
   */
  boardZones: () =>
    api.get<{ boardZones: BoardZoneMap }>('/taxonomy').then((r) => r.boardZones),
};
