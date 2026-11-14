import { prisma } from '../config/prisma.js';
import { HttpError } from '../lib/http-error.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import type { LoginInput, RegisterInput } from '../schemas/auth.schema.js';
import type { PublicUser } from '../types/auth.js';

/**
 * The single projection used for every user the API returns. `passwordHash` is
 * absent by construction rather than stripped afterwards, so it cannot leak by
 * someone forgetting to remove it.
 */
const PUBLIC_USER_SELECT = {
  id: true,
  email: true,
  name: true,
  isDemo: true,
  createdAt: true,
} as const;

/**
 * Hashed once on first use. Login verifies against this when no user matches,
 * so a missing account costs the same time as a wrong password and response
 * timing does not reveal which emails are registered.
 */
let dummyDigest: string | null = null;

async function getDummyDigest(): Promise<string> {
  dummyDigest ??= await hashPassword('no-such-user-placeholder');
  return dummyDigest;
}

/**
 * Duck-typed rather than importing Prisma's error class, which keeps this
 * service decoupled from the generated client. P2002 is the unique constraint.
 */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === 'P2002'
  );
}

export async function register(input: RegisterInput): Promise<PublicUser> {
  const passwordHash = await hashPassword(input.password);

  try {
    return await prisma.user.create({
      data: {
        email: input.email,
        name: input.name ?? null,
        passwordHash,
      },
      select: PUBLIC_USER_SELECT,
    });
  } catch (error) {
    // Relying on the unique constraint instead of a prior read closes the race
    // where two simultaneous registrations both see a free email.
    if (isUniqueViolation(error)) {
      throw new HttpError(409, 'An account with that email already exists');
    }

    throw error;
  }
}

export async function login(input: LoginInput): Promise<PublicUser> {
  const record = await prisma.user.findUnique({
    where: { email: input.email },
    select: { ...PUBLIC_USER_SELECT, passwordHash: true },
  });

  const digest = record?.passwordHash ?? (await getDummyDigest());
  const passwordMatches = await verifyPassword(digest, input.password);

  if (!record || !passwordMatches) {
    // Deliberately one message for both causes: distinguishing them would turn
    // this endpoint into an account-enumeration oracle.
    throw new HttpError(401, 'Invalid email or password');
  }

  const { passwordHash: _passwordHash, ...user } = record;
  return user;
}

export function findUserById(id: string): Promise<PublicUser | null> {
  return prisma.user.findUnique({ where: { id }, select: PUBLIC_USER_SELECT });
}
