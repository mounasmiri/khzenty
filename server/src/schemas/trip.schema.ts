import { z } from 'zod';

import { daysInclusive, isCalendarDate, parseCalendarDate } from '../lib/calendar-date.js';

/** A trip longer than this is almost certainly a typo, and drives a long checklist. */
export const MAX_TRIP_DAYS = 60;

/** Bounds one trip's list so a client cannot grow it without limit. */
export const MAX_TRIP_ENTRIES = 200;

const idField = z.string().trim().min(1).max(40);

const dateField = z
  .string()
  .trim()
  .refine(isCalendarDate, { message: 'must be a valid date in YYYY-MM-DD format' });

const nameField = z.string().trim().min(1).max(120);
const destinationField = z.string().trim().min(1).max(120);

/**
 * Both ends must be real dates, in order, and not more than `MAX_TRIP_DAYS`
 * apart. Shared by create (always both dates) and the service's update path
 * (which checks the merged result, since a PATCH may send only one date).
 */
export function checkDateRange(
  startDate: string,
  endDate: string,
  addIssue: (message: string) => void,
): void {
  const start = parseCalendarDate(startDate);
  const end = parseCalendarDate(endDate);

  if (end.getTime() < start.getTime()) {
    addIssue('endDate must be on or after startDate');
  } else if (daysInclusive(start, end) > MAX_TRIP_DAYS) {
    addIssue(`A trip can be at most ${String(MAX_TRIP_DAYS)} days long`);
  }
}

const coordinates = {
  /** From a destination search; the server geocodes `destination` when absent. */
  latitude: z.number().finite().min(-90).max(90).optional(),
  longitude: z.number().finite().min(-180).max(180).optional(),
};

function coordinatesComplete(value: { latitude?: number; longitude?: number }): boolean {
  return (value.latitude === undefined) === (value.longitude === undefined);
}

const COORDINATES_MESSAGE = 'latitude and longitude must be sent together';

export const createTripSchema = z
  .object({
    name: nameField,
    destination: destinationField,
    ...coordinates,
    startDate: dateField,
    endDate: dateField,
  })
  .refine(coordinatesComplete, { message: COORDINATES_MESSAGE, path: ['latitude'] })
  .superRefine((value, context) => {
    checkDateRange(value.startDate, value.endDate, (message) => {
      context.addIssue({ code: 'custom', message, path: ['endDate'] });
    });
  });

/** Every field optional, at least one required — as the other PATCH schemas. */
export const updateTripSchema = z
  .object({
    name: nameField.optional(),
    destination: destinationField.optional(),
    ...coordinates,
    startDate: dateField.optional(),
    endDate: dateField.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one field to update',
  })
  .refine(coordinatesComplete, { message: COORDINATES_MESSAGE, path: ['latitude'] })
  .superRefine((value, context) => {
    if (value.startDate !== undefined && value.endDate !== undefined) {
      checkDateRange(value.startDate, value.endDate, (message) => {
        context.addIssue({ code: 'custom', message, path: ['endDate'] });
      });
    }
  });

/** Exactly one target: a garment or an outfit. */
export const addTripEntrySchema = z
  .object({
    clothingItemId: idField.optional(),
    outfitId: idField.optional(),
  })
  .strict()
  .refine((value) => (value.clothingItemId === undefined) !== (value.outfitId === undefined), {
    message: 'Provide exactly one of clothingItemId or outfitId',
  });

export const updateTripEntrySchema = z.object({ packed: z.boolean() }).strict();

export const destinationSearchSchema = z.object({
  q: z.string().trim().min(2).max(120),
});

export type CreateTripInput = z.infer<typeof createTripSchema>;
export type UpdateTripInput = z.infer<typeof updateTripSchema>;
export type AddTripEntryInput = z.infer<typeof addTripEntrySchema>;
