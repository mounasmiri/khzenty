import { z } from 'zod';

import { Occasion } from '../generated/prisma/enums.js';

/**
 * Upper bound on garments in one outfit.
 *
 * The board has one top, one bottom (or a one-piece), outerwear, shoes, a bag
 * and a cluster of small accessories. Twelve leaves room without letting a
 * client post a thousand ids and turn one request into a thousand-row insert.
 */
export const MAX_OUTFIT_ITEMS = 12;

/**
 * Bumped whenever the placement shape changes incompatibly, so a stored layout
 * from an older board can be recognised and discarded rather than mis-rendered.
 * A `literal`, so an unknown version is rejected at the edge instead of
 * reaching the renderer.
 */
export const LAYOUT_VERSION = 1;

/**
 * Positions are a fraction of the board, not pixels: the board is rendered at
 * whatever width the device gives it and exported at a fixed size, so storing
 * pixels would pin a layout to the screen that created it.
 *
 * `x`/`y` allow a little past the edges and `width`/`height` cap at the full
 * board, which is loose on purpose — this guards against nonsense (NaN,
 * 1e9, negative sizes) rather than enforcing a particular composition, since
 * the composition is the client's to decide.
 */
const placementSchema = z.object({
  itemId: z.string().trim().min(1).max(40),
  x: z.number().finite().min(-1).max(2),
  y: z.number().finite().min(-1).max(2),
  width: z.number().finite().gt(0).max(1),
  height: z.number().finite().gt(0).max(1),
});

/**
 * Validated rather than accepted as free-form JSON. The column is
 * unstructured, but the input is not: without this a client could store an
 * arbitrarily large blob, or ids pointing at garments it does not own.
 *
 * `strict`, so an unexpected key is a 400 instead of silently persisted dead
 * weight that later versions have to keep tolerating.
 */
export const layoutSchema = z
  .object({
    version: z.literal(LAYOUT_VERSION),
    placements: z.array(placementSchema).max(MAX_OUTFIT_ITEMS),
  })
  .strict();

const nameField = z.string().trim().min(1).max(120);

/**
 * Optional, defaulted to empty rather than required: an outfit is worth saving
 * before the user has decided what it is for. Occasion lives here and not on
 * the garment because the same blazer is work-wear in one outfit and formal in
 * another.
 */
const occasionsField = z.array(z.enum(Occasion)).max(Object.keys(Occasion).length);

/**
 * `itemIds` is the full membership set, not a delta. The board saves what it
 * currently shows, so replace-the-set matches how it is actually used and
 * avoids an add/remove protocol with no caller.
 *
 * Ownership of those ids is **not** checked here. Zod sees only the request
 * body; the caller's identity lives on `req.user`. The service enforces it.
 */
export const createOutfitSchema = z.object({
  name: nameField,
  occasions: occasionsField.optional(),
  itemIds: z.array(z.string().trim().min(1).max(40)).max(MAX_OUTFIT_ITEMS).optional(),
  // Nullable as well as optional: null clears a layout back to auto.
  layout: layoutSchema.nullable().optional(),
});

/**
 * Every field optional, at least one required — an empty PATCH is a client bug
 * worth a 400 rather than a silent no-op. Matches the clothing-item schema.
 */
export const updateOutfitSchema = z
  .object({
    name: nameField.optional(),
    occasions: occasionsField.optional(),
    itemIds: z.array(z.string().trim().min(1).max(40)).max(MAX_OUTFIT_ITEMS).optional(),
    layout: layoutSchema.nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one field to update',
  });

export type OutfitLayout = z.infer<typeof layoutSchema>;
export type CreateOutfitInput = z.infer<typeof createOutfitSchema>;
export type UpdateOutfitInput = z.infer<typeof updateOutfitSchema>;
