import { hash, verify } from '@node-rs/argon2';

/**
 * OWASP's Argon2id baseline: 19 MiB of memory, 2 iterations, 1 lane.
 *
 * `@node-rs/argon2` already defaults to Argon2id, but the cost parameters are
 * stated explicitly so a future library default cannot silently weaken them.
 */
const ARGON2_OPTIONS = {
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashPassword(plain: string): Promise<string> {
  return hash(plain, ARGON2_OPTIONS);
}

export async function verifyPassword(digest: string, plain: string): Promise<boolean> {
  try {
    return await verify(digest, plain, ARGON2_OPTIONS);
  } catch {
    // A corrupt or non-Argon2 digest must read as "wrong password" rather than
    // throwing a 500 and telling the caller the record is malformed.
    return false;
  }
}
