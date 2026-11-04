import { z } from 'zod';

import { LaundryStatus } from '../generated/prisma/enums.js';

export const setLaundryStatusSchema = z.object({
  status: z.enum(LaundryStatus),
});

/**
 * Bulk "mark as washed".
 *
 * Capped because the ids go into a single `IN (...)` clause; a wardrobe large
 * enough to exceed this wants pagination rather than a bigger limit.
 */
export const markWashedSchema = z.object({
  ids: z
    .array(z.string().trim().min(1))
    .min(1, 'Provide at least one item id')
    .max(500, 'Too many items in one request'),
});

export type SetLaundryStatusInput = z.infer<typeof setLaundryStatusSchema>;
export type MarkWashedInput = z.infer<typeof markWashedSchema>;
