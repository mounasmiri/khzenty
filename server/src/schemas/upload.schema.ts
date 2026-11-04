import { z } from 'zod';

/**
 * Sent back by the client after it has uploaded straight to Cloudinary. Only
 * the identifier is accepted — the URL, format and byte count are read from
 * Cloudinary itself, so a client cannot claim a file is smaller or a different
 * type than it is.
 */
export const confirmItemImageSchema = z.object({
  publicId: z.string().trim().min(1, 'publicId is required').max(300),
});

export type ConfirmItemImageInput = z.infer<typeof confirmItemImageSchema>;
