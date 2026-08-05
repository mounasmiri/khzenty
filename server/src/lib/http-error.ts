/**
 * An error that carries an HTTP status.
 *
 * Services throw these to signal a failure the client is allowed to know about.
 * Anything else that reaches the error middleware is treated as an unexpected
 * 500 and its message is not sent to the client.
 */
export class HttpError extends Error {
  readonly status: number;

  /** Whether `message` is safe to return to the client. */
  readonly expose: boolean;

  constructor(status: number, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'HttpError';
    this.status = status;
    this.expose = status < 500;
  }
}
