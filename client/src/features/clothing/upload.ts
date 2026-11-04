import { ApiError, api } from '@/lib/api';

/** Mirrors the server's `UploadSignature`. */
interface UploadSignature {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  folder: string;
  allowedFormats: string[];
  signature: string;
  maxBytes: number;
  uploadUrl: string;
}

/** Carries a message that is safe and useful to show the user. */
export class UploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UploadError';
  }
}

/** Progress stages, so the form can say what is actually happening. */
export type UploadStage = 'signing' | 'uploading' | 'confirming';

function megabytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function extensionOf(file: File): string {
  // Prefer the MIME subtype: a file named ".jpeg" and one named ".jpg" are the
  // same thing, and a wrong extension should not pass a check the server will
  // later fail on the real format.
  const fromMime = file.type.startsWith('image/') ? file.type.slice('image/'.length) : '';
  const fromName = file.name.split('.').pop() ?? '';

  return (fromMime || fromName).toLowerCase();
}

/**
 * Uploads an image for an existing item.
 *
 * Three steps: ask our server for a signature, send the file straight to
 * Cloudinary, then tell our server which asset to record. Image bytes never
 * touch the API.
 *
 * The item must already exist, because the confirm step addresses it by id —
 * which is why the form saves before uploading.
 */
export async function uploadItemImage(
  itemId: string,
  file: File,
  onStage?: (stage: UploadStage) => void,
): Promise<{ imageUrl: string | null }> {
  onStage?.('signing');

  let upload: UploadSignature;

  try {
    ({ upload } = await api.post<{ upload: UploadSignature }>('/uploads/signature'));
  } catch (error) {
    if (error instanceof ApiError && error.status === 503) {
      throw new UploadError('Image upload is not configured on this server.');
    }

    throw error;
  }

  // Checked here only to fail fast with a clear message. The server re-checks
  // both against the real asset, so this is convenience, not enforcement.
  const extension = extensionOf(file);

  if (!upload.allowedFormats.includes(extension)) {
    throw new UploadError(
      `${extension || 'That file'} is not supported. Use ${upload.allowedFormats.join(', ')}.`,
    );
  }

  if (file.size > upload.maxBytes) {
    throw new UploadError(
      `That image is ${megabytes(file.size)}. The limit is ${megabytes(upload.maxBytes)}.`,
    );
  }

  onStage?.('uploading');

  const form = new FormData();
  form.append('file', file);
  form.append('api_key', upload.apiKey);
  form.append('timestamp', String(upload.timestamp));
  form.append('folder', upload.folder);
  // Must match what the server signed, byte for byte, or Cloudinary rejects it.
  form.append('allowed_formats', upload.allowedFormats.join(','));
  form.append('signature', upload.signature);

  let cloudinaryResponse: Response;

  try {
    // Deliberately a bare fetch, not the api helper: this is a third-party
    // origin, so no session cookie should be sent, and Content-Type must be
    // left to the browser so it can set the multipart boundary.
    cloudinaryResponse = await fetch(upload.uploadUrl, { method: 'POST', body: form });
  } catch {
    throw new UploadError('Could not reach Cloudinary. Check your connection and try again.');
  }

  const payload: unknown = await cloudinaryResponse.json().catch(() => null);

  if (!cloudinaryResponse.ok) {
    const message = (payload as { error?: { message?: string } } | null)?.error?.message;
    throw new UploadError(message ?? 'Cloudinary rejected the upload.');
  }

  const publicId = (payload as { public_id?: string } | null)?.public_id;

  if (!publicId) {
    throw new UploadError('Cloudinary did not return an image id.');
  }

  onStage?.('confirming');

  // Only the id is sent: the server reads the URL, format and size back from
  // Cloudinary rather than trusting anything reported here.
  const { item } = await api.put<{ item: { id: string; imageUrl: string | null } }>(
    `/items/${encodeURIComponent(itemId)}/image`,
    { publicId },
  );

  return { imageUrl: item.imageUrl };
}
