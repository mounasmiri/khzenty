import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import express from 'express';
import type { Pool, PoolClient } from 'pg';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { readPhotosFile } from '../prisma/demo-photos.js';
import { decideSeedMode, isLocalDatabaseUrl } from '../prisma/seed-target.js';
import { errorHandler } from '../src/middlewares/error.middleware.js';
import { createRateLimiter } from '../src/middlewares/rate-limit.middleware.js';
import { isTransientConnectError, withConnectRetry } from '../src/lib/db-connect-retry.js';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.resetModules();
});

/** A stand-in for `pg.Pool` whose `connect` fails a set number of times first. */
function fakePool(failures: unknown[]) {
  const client = { release: vi.fn() } as unknown as PoolClient;
  const connect = vi.fn(() => {
    const failure = failures.shift();

    return failure === undefined ? Promise.resolve(client) : Promise.reject(failure);
  });

  return { pool: { connect } as unknown as Pool, connect, client };
}

const refused = Object.assign(new Error(''), { code: 'ECONNREFUSED' });
const noDelay = { delayMs: () => 0 };

describe('connection retry (serverless database waking up)', () => {
  it('retries a refused connection and then succeeds, so the first query is not lost', async () => {
    const { pool, connect, client } = fakePool([refused, refused]);
    const onRetry = vi.fn();

    const patched = withConnectRetry(pool, { ...noDelay, onRetry });

    await expect(patched.connect()).resolves.toBe(client);
    expect(connect).toHaveBeenCalledTimes(3);
    expect(onRetry).toHaveBeenCalledTimes(2);
  });

  it('supports the callback form that pg.Pool.query uses internally', async () => {
    const { pool, client } = fakePool([refused]);
    const patched = withConnectRetry(pool, noDelay);

    const result = await new Promise<{ error: unknown; client: unknown; done: unknown }>((resolve) => {
      (patched.connect as unknown as (cb: (e: unknown, c: unknown, d: unknown) => void) => void)(
        (error, got, done) => {
          resolve({ error, client: got, done });
        },
      );
    });

    expect(result.error).toBeUndefined();
    expect(result.client).toBe(client);
    (result.done as () => void)();
    expect(client.release).toHaveBeenCalled();
  });

  it('gives up after the retry budget, with the real error', async () => {
    const { pool, connect } = fakePool(Array.from({ length: 10 }, () => refused));

    const patched = withConnectRetry(pool, { retries: 3, ...noDelay });

    await expect(patched.connect()).rejects.toBe(refused);
    expect(connect).toHaveBeenCalledTimes(4);
  });

  it('never retries an error that is not about connecting', async () => {
    const wrongPassword = Object.assign(new Error('password authentication failed'), { code: '28P01' });
    const { pool, connect } = fakePool([wrongPassword]);

    const patched = withConnectRetry(pool, noDelay);

    await expect(patched.connect()).rejects.toBe(wrongPassword);
    expect(connect).toHaveBeenCalledTimes(1);
  });

  it('recognises what a waking Neon compute produces, and nothing broader', () => {
    expect(isTransientConnectError(refused)).toBe(true);
    expect(isTransientConnectError(new Error('timeout exceeded when trying to connect'))).toBe(true);
    expect(isTransientConnectError(Object.assign(new Error('x'), { code: '57P03' }))).toBe(true);
    expect(isTransientConnectError(new Error('Connection terminated unexpectedly'))).toBe(true);

    expect(isTransientConnectError(Object.assign(new Error('x'), { code: '28P01' }))).toBe(false);
    expect(isTransientConnectError(Object.assign(new Error('x'), { code: '23505' }))).toBe(false);
    expect(isTransientConnectError(new Error('syntax error at or near'))).toBe(false);
    expect(isTransientConnectError(null)).toBe(false);
  });
});

describe('client IP behind Vercel and Render', () => {
  // Chain: browser -> Vercel (rewrite) -> Render load balancer -> this server.
  // Vercel sets X-Forwarded-For to the visitor's IP; Render appends the address
  // it saw, which is Vercel's. So the header reaches the app as "<visitor>, <vercel>".
  function limitedApp(trustProxy: number) {
    const limited = express();
    limited.set('trust proxy', trustProxy);
    limited.post('/hit', createRateLimiter({ limit: 1, windowMs: 60_000, enabledInTest: true }), (_req, res) => {
      res.status(200).json({ ok: true });
    });
    limited.use(errorHandler);

    return limited;
  }

  const hit = (app: express.Express, visitor: string) =>
    request(app).post('/hit').set('x-forwarded-for', `${visitor}, 76.76.21.21`);

  it('TRUST_PROXY=2 tells visitors apart, so one cannot exhaust everyone\'s budget', async () => {
    const app = limitedApp(2);

    await hit(app, '203.0.113.7').expect(200);
    await hit(app, '203.0.113.7').expect(429);
    // A different visitor, through the same Vercel address, is unaffected.
    await hit(app, '198.51.100.9').expect(200);
  });

  it('TRUST_PROXY=1 would see only Vercel\'s address and put every visitor in one bucket', async () => {
    const app = limitedApp(1);

    await hit(app, '203.0.113.7').expect(200);
    await hit(app, '198.51.100.9').expect(429);
  });

  it('cannot be spoofed by a header the visitor adds themselves', async () => {
    const app = limitedApp(2);

    // The visitor prepends a fake address; Vercel replaces the header with the
    // real one, so the app still sees "<real>, <vercel>" and the fake is
    // never the second-from-last entry.
    await request(app).post('/hit').set('x-forwarded-for', '203.0.113.7, 76.76.21.21').expect(200);
    await request(app).post('/hit').set('x-forwarded-for', '10.9.9.9, 203.0.113.7, 76.76.21.21').expect(429);
  });
});

describe('production behind the Vercel rewrite', () => {
  const ORIGIN = 'https://khzenty.vercel.app';

  async function productionApp() {
    vi.resetModules();
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('CLIENT_ORIGIN', ORIGIN);
    vi.stubEnv('TRUST_PROXY', '2');
    vi.stubEnv('JWT_SECRET', 'q7Zk2LmP9xVb4TnR8sWc1YdH6gJf3AeU5oXi0BtK');
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const { createApp } = await import('../src/app.js');
    const { prisma } = await import('../src/config/prisma.js');

    return { app: createApp(), prisma };
  }

  it('sets a Secure, HttpOnly, SameSite=Lax cookie and accepts the Vercel origin', async () => {
    const { app, prisma } = await productionApp();
    const email = `prod-cookie-${Date.now()}@khzenty.test`;

    try {
      const res = await request(app)
        .post('/api/auth/register')
        .set('origin', ORIGIN)
        .set('x-forwarded-proto', 'https')
        .set('x-forwarded-for', '203.0.113.7, 76.76.21.21')
        .send({ email, password: 'a-long-enough-password' })
        .expect(201);

      const cookie = (res.headers['set-cookie'] as unknown as string[])[0] ?? '';
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/Secure/i);
      expect(cookie).toMatch(/SameSite=Lax/i);
      expect(cookie).not.toMatch(/Domain=/i);
      expect(cookie).toMatch(/Expires=/i);
    } finally {
      await prisma.user.deleteMany({ where: { email } });
      await prisma.$disconnect();
    }
  });

  it('refuses a write whose Origin is anything but the Vercel origin', async () => {
    const { app, prisma } = await productionApp();

    try {
      for (const origin of ['https://khzenty-git-branch.vercel.app', 'http://khzenty.vercel.app', 'https://evil.example']) {
        await request(app)
          .post('/api/auth/login')
          .set('origin', origin)
          .send({ email: 'a@b.co', password: 'x' })
          .expect(403);
      }

      await request(app)
        .post('/api/auth/login')
        .set('origin', ORIGIN)
        .send({ email: 'a@b.co', password: 'x' })
        .expect(401);
    } finally {
      await prisma.$disconnect();
    }
  });

  it('answers the health check with only a status', async () => {
    const { app, prisma } = await productionApp();

    try {
      const res = await request(app).get('/api/health').expect(200);

      expect(res.body).toEqual({ status: 'ok' });
    } finally {
      await prisma.$disconnect();
    }
  });
});

describe('CLIENT_ORIGIN normalisation', () => {
  it('strips a trailing slash and any path, matching what browsers send in Origin', async () => {
    vi.resetModules();
    vi.stubEnv('CLIENT_ORIGIN', 'https://khzenty.vercel.app/');

    const { env } = await import('../src/config/env.js');

    expect(env.CLIENT_ORIGIN).toBe('https://khzenty.vercel.app');
  });
});

describe('seed target safety', () => {
  const NEON = 'postgresql://u:p@ep-quiet-sun-123456.eu-central-1.aws.neon.tech/neondb?sslmode=require';
  const LOCAL = 'postgresql://postgres:postgres@localhost:5433/khzenty';

  it('recognises a local database by its host', () => {
    expect(isLocalDatabaseUrl(LOCAL)).toBe(true);
    expect(isLocalDatabaseUrl('postgresql://u:p@127.0.0.1:5432/x')).toBe(true);
    expect(isLocalDatabaseUrl(NEON)).toBe(false);
    expect(isLocalDatabaseUrl('not a url')).toBe(false);
    expect(isLocalDatabaseUrl('')).toBe(false);
  });

  it('seeds a local database in development mode without any opt-in', () => {
    expect(decideSeedMode({ nodeEnv: undefined, databaseUrl: LOCAL, allowProduction: undefined })).toBe('development');
    expect(decideSeedMode({ nodeEnv: 'development', databaseUrl: LOCAL, allowProduction: 'false' })).toBe('development');
  });

  it('refuses a remote database even when NODE_ENV is not production', () => {
    expect(() => decideSeedMode({ nodeEnv: undefined, databaseUrl: NEON, allowProduction: undefined })).toThrow(
      /Refusing to seed/,
    );
    expect(() => decideSeedMode({ nodeEnv: 'development', databaseUrl: NEON, allowProduction: 'yes' })).toThrow();
    expect(() => decideSeedMode({ nodeEnv: 'development', databaseUrl: NEON, allowProduction: 'TRUE' })).toThrow();
  });

  it('refuses NODE_ENV=production, even against a local database, without the opt-in', () => {
    expect(() => decideSeedMode({ nodeEnv: 'production', databaseUrl: LOCAL, allowProduction: undefined })).toThrow();
  });

  it('allows a remote database only with SEED_ALLOW_PRODUCTION=true, in production mode', () => {
    expect(decideSeedMode({ nodeEnv: undefined, databaseUrl: NEON, allowProduction: 'true' })).toBe('production');
    expect(decideSeedMode({ nodeEnv: 'production', databaseUrl: NEON, allowProduction: 'true' })).toBe('production');
  });
});

describe('demo photo file', () => {
  async function withFile(content: string, run: (path: string) => Promise<void>) {
    const dir = await mkdtemp(join(tmpdir(), 'khz-photos-'));
    const path = join(dir, 'photos.json');

    try {
      await writeFile(path, content, 'utf8');
      await run(path);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  const good = {
    imageUrl: 'https://res.cloudinary.com/demo/image/upload/v1/khzenty/x.webp',
    imagePublicId: 'khzenty/x',
  };

  it('reads valid Cloudinary links', async () => {
    await withFile(JSON.stringify({ seed_white_shirt: good }), async (path) => {
      const photos = await readPhotosFile(path);

      expect(photos.get('seed_white_shirt')).toEqual(good);
    });
  });

  it('rejects links that are not Cloudinary https URLs, or lack a public id', async () => {
    for (const bad of [
      { seed_a: { ...good, imageUrl: 'http://res.cloudinary.com/x.webp' } },
      { seed_a: { ...good, imageUrl: 'https://evil.example/x.webp' } },
      { seed_a: { ...good, imagePublicId: '' } },
      { seed_a: null },
      [],
    ]) {
      await withFile(JSON.stringify(bad), async (path) => {
        await expect(readPhotosFile(path)).rejects.toThrow();
      });
    }
  });

  it('explains a missing or malformed file', async () => {
    await expect(readPhotosFile(join(tmpdir(), 'no-such-photos-file.json'))).rejects.toThrow(/Could not read/);
    await withFile('{ not json', async (path) => {
      await expect(readPhotosFile(path)).rejects.toThrow(/Could not read/);
    });
  });
});
