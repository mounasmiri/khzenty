import { prisma } from '../config/prisma.js';
import { categoryForType } from '../lib/clothing-taxonomy.js';
import { HttpError } from '../lib/http-error.js';
import type {
  CreateClothingItemInput,
  UpdateClothingItemInput,
} from '../schemas/clothing-item.schema.js';

/**
 * Includes how many outfits reference the garment, so the UI can warn before a
 * delete cascades it out of them. This is what the `OutfitItem.clothingItemId`
 * index exists for.
 */
const ITEM_SELECT = {
  id: true,
  name: true,
  category: true,
  type: true,
  color: true,
  seasons: true,
  favorite: true,
  imageUrl: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { outfitItems: true } },
} as const;

/**
 * Every function here takes `userId` and applies it to the query.
 *
 * `update` and `delete` go through `updateMany`/`deleteMany` filtered on
 * `{ id, userId }` rather than reading first and comparing: a count of zero is
 * reported as 404 whether the row is missing or belongs to someone else, so
 * probing ids reveals nothing about another user's wardrobe.
 */
export function listItems(userId: string) {
  return prisma.clothingItem.findMany({
    where: { userId },
    select: ITEM_SELECT,
    // Favourites first, then newest.
    orderBy: [{ favorite: 'desc' }, { createdAt: 'desc' }],
  });
}

export async function getItem(userId: string, id: string) {
  const item = await prisma.clothingItem.findFirst({
    where: { id, userId },
    select: ITEM_SELECT,
  });

  if (!item) {
    throw new HttpError(404, 'Clothing item not found');
  }

  return item;
}

export function createItem(userId: string, input: CreateClothingItemInput) {
  return prisma.clothingItem.create({
    data: {
      userId,
      // Derived, never taken from the client.
      category: categoryForType(input.type),
      type: input.type,
      color: input.color,
      name: input.name ?? null,
      seasons: input.seasons ?? [],
      favorite: input.favorite ?? false,
    },
    select: ITEM_SELECT,
  });
}

export async function updateItem(userId: string, id: string, input: UpdateClothingItemInput) {
  const { count } = await prisma.clothingItem.updateMany({
    where: { id, userId },
    data: {
      ...(input.type === undefined
        ? {}
        : // Re-derive the category whenever the type changes, otherwise the two
          // columns would disagree after an update.
          { type: input.type, category: categoryForType(input.type) }),
      ...(input.color === undefined ? {} : { color: input.color }),
      ...(input.name === undefined ? {} : { name: input.name }),
      ...(input.seasons === undefined ? {} : { seasons: input.seasons }),
      ...(input.favorite === undefined ? {} : { favorite: input.favorite }),
    },
  });

  if (count === 0) {
    throw new HttpError(404, 'Clothing item not found');
  }

  return getItem(userId, id);
}

export async function deleteItem(userId: string, id: string): Promise<void> {
  const { count } = await prisma.clothingItem.deleteMany({ where: { id, userId } });

  if (count === 0) {
    throw new HttpError(404, 'Clothing item not found');
  }
}
