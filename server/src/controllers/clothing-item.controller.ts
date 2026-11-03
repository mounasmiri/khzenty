import type { RequestHandler } from 'express';

import { HttpError } from '../lib/http-error.js';
import {
  createItem,
  deleteItem,
  getItem,
  listItems,
  updateItem,
} from '../services/clothing-item.service.js';

/**
 * `requireAuth` guarantees `req.user`, but narrowing it here keeps the service
 * calls honest and guards against the route being mounted without the gate.
 */
function userIdOf(req: Parameters<RequestHandler>[0]): string {
  if (!req.user) {
    throw new HttpError(401, 'Authentication required');
  }

  return req.user.id;
}

function itemIdOf(req: Parameters<RequestHandler>[0]): string {
  const id = req.params['id'];

  if (typeof id !== 'string' || id.length === 0) {
    throw new HttpError(400, 'An item id is required');
  }

  return id;
}

export const getItems: RequestHandler = async (req, res) => {
  res.status(200).json({ items: await listItems(userIdOf(req)) });
};

export const getItemById: RequestHandler = async (req, res) => {
  res.status(200).json({ item: await getItem(userIdOf(req), itemIdOf(req)) });
};

export const postItem: RequestHandler = async (req, res) => {
  res.status(201).json({ item: await createItem(userIdOf(req), req.body) });
};

export const patchItem: RequestHandler = async (req, res) => {
  res.status(200).json({ item: await updateItem(userIdOf(req), itemIdOf(req), req.body) });
};

export const deleteItemById: RequestHandler = async (req, res) => {
  await deleteItem(userIdOf(req), itemIdOf(req));
  res.status(204).send();
};
