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
  // Human-readable colour name, not a hex value. Optional and nullable so a
  // photo-only capture is not blocked on typing one; absent and null both mean
  // "not set yet". An empty string is still rejected — send null instead, so a
  // blank field cannot masquerade as a colour.
  color: z.string().trim().min(1).max(40).nullable().optional(),
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
    // Nullable as well as optional: null clears the colour, absent leaves it.
    color: z.string().trim().min(1).max(40).nullable().optional(),
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
