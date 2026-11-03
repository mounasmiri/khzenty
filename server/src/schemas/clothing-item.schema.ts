import { z } from 'zod';

import { ClothingType, Season } from '../generated/prisma/enums.js';

const clothingTypeField = z.enum(ClothingType);
const seasonsField = z.array(z.enum(Season)).max(4);

/**
 * `category` is deliberately absent: the server derives it from `type` via the
 * taxonomy map, so an inconsistent pair cannot be submitted.
 */
export const createClothingItemSchema = z.object({
  type: clothingTypeField,
  // Human-readable colour name, not a hex value.
  color: z.string().trim().min(1, 'Colour is required').max(40),
  // Optional so capture stays fast; the UI falls back to the type.
  name: z.string().trim().min(1).max(120).optional(),
  seasons: seasonsField.optional(),
  favorite: z.boolean().optional(),
});

/**
 * Every field optional, but at least one required — an empty PATCH is a client
 * bug worth surfacing rather than a silent no-op.
 */
export const updateClothingItemSchema = z
  .object({
    type: clothingTypeField.optional(),
    color: z.string().trim().min(1).max(40).optional(),
    // Nullable as well as optional: null clears the name, absent leaves it.
    name: z.string().trim().min(1).max(120).nullable().optional(),
    seasons: seasonsField.optional(),
    favorite: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one field to update',
  });

export type CreateClothingItemInput = z.infer<typeof createClothingItemSchema>;
export type UpdateClothingItemInput = z.infer<typeof updateClothingItemSchema>;
