import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { env } from '../src/config/env.js';
import { prisma } from '../src/config/prisma.js';
import { errorHandler } from '../src/middlewares/error.middleware.js';
import { createRateLimiter } from '../src/middlewares/rate-limit.middleware.js';
import { app, createUser, resetDatabase, signIn, TEST_PASSWORD } from './helpers.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('health check', () => {
  it('reports ok with details outside production', async () => {
    const res = await request(app).get('/api/health').expect(200);

    expect(res.body).toMatchObject({ status: 'ok', environment: 'test' });
    expect(typeof res.body.uptimeSeconds).toBe('number');
  });

  it('answers 503 degraded when the database is unreachable', async () => {
    vi.spyOn(prisma, '$queryRaw').mockRejectedValue(new Error('connection refused'));

    const res = await request(app).get('/api/health').expect(503);

    expect(res.body.status).toBe('degraded');
  });

  it('reveals nothing but the status in production', async () => {
    const original = env.NODE_ENV;
    (env as { NODE_ENV: string }).NODE_ENV = 'production';

    try {
      const ok = await request(app).get('/api/health').expect(200);
      expect(ok.body).toEqual({ status: 'ok' });

      vi.spyOn(prisma, '$queryRaw').mockRejectedValue(new Error('password authentication failed'));
      const down = await request(app).get('/api/health').expect(503);
      expect(down.body).toEqual({ status: 'degraded' });
    } finally {
      (env as { NODE_ENV: string }).NODE_ENV = original;
    }
  });

  it('is not rate limited', async () => {
    for (let i = 0; i < 30; i += 1) {
      await request(app).get('/api/health').expect(200);
    }
  });
});

describe('headers and parsing', () => {
  it('sends security headers and does not advertise Express', async () => {
    const res = await request(app).get('/api/health');

    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toBeDefined();
  });

  it('answers 400, not 500, for malformed JSON, and leaks nothing', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('content-type', 'application/json')
      .send('{"email": ')
      .expect(400);

    expect(res.body.error.message).toBe('Request body is not valid JSON');
    expect(JSON.stringify(res.body)).not.toMatch(/SyntaxError|node_modules/);
  });

  it('answers 413 for an oversized body', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'a@b.co', password: 'x'.repeat(200_000) })
      .expect(413);

    expect(res.body.error.status).toBe(413);
  });

  it('does not echo the requested path in a 404', async () => {
    const res = await request(app).get('/api/nope-reflected-marker').expect(404);

    expect(JSON.stringify(res.body)).not.toContain('reflected-marker');
  });

  it('only ever allows the configured origin — never a wildcard or an echo', async () => {
    const res = await request(app).get('/api/health').set('origin', 'https://evil.example');

    // Always the one configured origin, so the browser rejects the foreign page.
    expect(res.headers['access-control-allow-origin']).toBe(env.CLIENT_ORIGIN);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });
});

describe('CSRF origin check', () => {
  it('refuses a state-changing request that declares a foreign origin', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('origin', 'https://evil.example')
      .send({ email: 'a@b.co', password: 'whatever' })
      .expect(403);

    expect(res.body.error.message).toBe('Cross-origin request refused');
  });

  it('allows the configured origin, and requests with no Origin header', async () => {
    await request(app)
      .post('/api/auth/login')
      .set('origin', env.CLIENT_ORIGIN)
      .send({ email: 'a@b.co', password: 'whatever' })
      .expect(401);

    await request(app).post('/api/auth/login').send({ email: 'a@b.co', password: 'x' }).expect(401);
  });

  it('never blocks reads', async () => {
    await request(app).get('/api/health').set('origin', 'https://evil.example').expect(200);
  });
});

describe('session cookie', () => {
  it('is httpOnly and SameSite=Lax, and logout expires it', async () => {
    await resetDatabase();
    await createUser('cookie@khzenty.test');

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'cookie@khzenty.test', password: TEST_PASSWORD })
      .expect(200);

    const set = (login.headers['set-cookie'] as unknown as string[])[0] ?? '';
    expect(set).toMatch(/HttpOnly/i);
    expect(set).toMatch(/SameSite=Lax/i);
    expect(set).toMatch(/Expires=/i);

    const agent = await signIn('cookie@khzenty.test');
    const out = await agent.post('/api/auth/logout').expect(204);
    expect((out.headers['set-cookie'] as unknown as string[])[0]).toMatch(
      /Expires=Thu, 01 Jan 1970/,
    );
    await agent.get('/api/auth/me').expect(401);
  });
});

describe('id parameters', () => {
  it('rejects ids with unexpected characters before any query runs', async () => {
    await resetDatabase();
    await createUser('ids@khzenty.test');
    const agent = await signIn('ids@khzenty.test');

    for (const path of ['/api/items', '/api/outfits', '/api/trips']) {
      await agent.get(`${path}/${encodeURIComponent("x' OR 1=1 --")}`).expect(400);
      await agent.get(`${path}/${'a'.repeat(65)}`).expect(400);
    }

    await agent.post('/api/wear-log/bad%20id/undo').expect(400);
    await agent.get('/api/items/cmwgm8qyn00106cktl3yjlwfd').expect(404);
  });
});

describe('rate limiting', () => {
  function limitedApp(limit: number) {
    const limited = express();
    limited.set('trust proxy', 0);
    limited.use(express.json());
    limited.post(
      '/login',
      createRateLimiter({ limit, windowMs: 60_000, enabledInTest: true }),
      (_req, res) => {
        res.status(401).json({ error: 'nope' });
      },
    );
    limited.use(errorHandler);

    return limited;
  }

  it('answers 429 in the standard JSON shape once the limit is passed', async () => {
    const limited = limitedApp(3);

    for (let i = 0; i < 3; i += 1) {
      await request(limited).post('/login').send({}).expect(401);
    }

    const blocked = await request(limited).post('/login').send({}).expect(429);

    expect(blocked.body.error.status).toBe(429);
    expect(blocked.headers['ratelimit']).toBeDefined();
  });

  it('cannot be dodged with a spoofed X-Forwarded-For when no proxy is trusted', async () => {
    const limited = limitedApp(2);

    await request(limited).post('/login').set('x-forwarded-for', '1.1.1.1').send({}).expect(401);
    await request(limited).post('/login').set('x-forwarded-for', '2.2.2.2').send({}).expect(401);
    await request(limited).post('/login').set('x-forwarded-for', '3.3.3.3').send({}).expect(429);
  });
});
