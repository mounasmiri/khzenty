/**
 * Decides whether a seed run is a local development seed or a deliberate
 * production refresh of the demo template.
 *
 * Kept free of Prisma and of `process.env` so it can be tested in isolation.
 * The check looks at **where the database is**, not only at `NODE_ENV`: a seed
 * run from a laptop has `NODE_ENV` unset, so keying only on that would let
 * `DATABASE_URL=<production>` through without any opt-in.
 */

export type SeedMode = 'development' | 'production';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]', 'host.docker.internal', 'postgres']);

export function isLocalDatabaseUrl(databaseUrl: string): boolean {
  try {
    return LOCAL_HOSTS.has(new URL(databaseUrl).hostname.toLowerCase());
  } catch {
    // An unparseable URL is not something to assume is local.
    return false;
  }
}

export interface SeedTargetInput {
  nodeEnv: string | undefined;
  databaseUrl: string;
  /** The value of `SEED_ALLOW_PRODUCTION`. */
  allowProduction: string | undefined;
}

/**
 * `production` mode only ever touches the demo template account, gives it no
 * usable password, and creates no dev accounts. Anything that is not clearly a
 * local database needs `SEED_ALLOW_PRODUCTION=true`, spelled exactly.
 */
export function decideSeedMode({ nodeEnv, databaseUrl, allowProduction }: SeedTargetInput): SeedMode {
  const optedIn = allowProduction === 'true';
  const looksLikeProduction = nodeEnv === 'production' || !isLocalDatabaseUrl(databaseUrl);

  if (looksLikeProduction && !optedIn) {
    throw new Error(
      'Refusing to seed: this is not a local database (or NODE_ENV=production). ' +
        'To refresh the demo template there on purpose, run with SEED_ALLOW_PRODUCTION=true.',
    );
  }

  return optedIn ? 'production' : 'development';
}
