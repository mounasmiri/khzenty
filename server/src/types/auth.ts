/**
 * The only user shape that may leave the API. Defined here rather than in the
 * service so the Express request augmentation can reference it without
 * importing service code.
 */
export interface PublicUser {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
}
