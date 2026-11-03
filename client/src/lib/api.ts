/**
 * Thin fetch wrapper for the Khzenty API.
 *
 * `credentials: 'include'` is the important part: the session lives in an
 * httpOnly cookie the browser must attach, and JavaScript can never read it.
 */

/** Base path. Relative by default, so the Vite dev proxy handles it. */
const API_BASE = import.meta.env['VITE_API_URL'] ?? '/api';

/** An error carrying the HTTP status, so callers can branch on 401 vs 409. */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

interface ApiErrorBody {
  error?: { message?: string; status?: number };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...init?.headers,
      },
    });
  } catch {
    // fetch only rejects on network failure, never on a 4xx/5xx.
    throw new ApiError(0, 'Could not reach the server. Is the API running?');
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const isJson = response.headers.get('content-type')?.includes('application/json') ?? false;
  const body: unknown = isJson ? await response.json() : null;

  if (!response.ok) {
    const message =
      (body as ApiErrorBody | null)?.error?.message ?? `Request failed (${response.status})`;

    throw new ApiError(response.status, message);
  }

  return body as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, data?: unknown) =>
    request<T>(path, {
      method: 'POST',
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    }),
};
