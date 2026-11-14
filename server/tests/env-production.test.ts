import { afterEach, describe, expect, it, vi } from 'vitest';

const BASE = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  CLIENT_ORIGIN: 'https://app.khzenty.example',
  JWT_SECRET: 'q7Zk2LmP9xVb4TnR8sWc1YdH6gJf3AeU5oXi0BtK',
};

/** Loads the env module fresh and reports whether it tried to abort the process. */
async function bootWith(overrides: Record<string, string>): Promise<{ exited: boolean }> {
  vi.resetModules();
  for (const [key, value] of Object.entries({ ...BASE, ...overrides })) vi.stubEnv(key, value);

  const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);

  try {
    await import('../src/config/env.js');
  } catch {
    // With `exit` stubbed, the module goes on to read `parsed.data` of a failed
    // parse and throws; that is the same failure seen from the other side.
  }

  return { exited: exit.mock.calls.length > 0 };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.resetModules();
});

describe('production configuration', () => {
  it('boots with a strong secret and an https origin', async () => {
    expect((await bootWith({})).exited).toBe(false);
  });

  it('refuses the .env.example placeholder secret', async () => {
    const { exited } = await bootWith({
      JWT_SECRET: 'replace-me-with-a-generated-value-of-at-least-32-chars',
    });

    expect(exited).toBe(true);
  });

  it('refuses a repetitive secret', async () => {
    expect((await bootWith({ JWT_SECRET: 'a'.repeat(40) })).exited).toBe(true);
  });

  it('refuses a non-https origin', async () => {
    expect((await bootWith({ CLIENT_ORIGIN: 'http://app.khzenty.example' })).exited).toBe(true);
  });

  it('refuses a wildcard origin in any environment', async () => {
    expect((await bootWith({ NODE_ENV: 'development', CLIENT_ORIGIN: '*' })).exited).toBe(true);
  });

  it('keeps the demo sandbox off, with a cap of 200, unless told otherwise', async () => {
    vi.resetModules();
    for (const [key, value] of Object.entries(BASE)) vi.stubEnv(key, value);
    vi.stubEnv('DEMO_LOGIN_ENABLED', '');
    vi.stubEnv('DEMO_MAX_USERS', '');
    vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);

    // An empty string is "not set" to dotenv-style config, but zod would read it
    // as a value; remove the keys outright.
    delete process.env['DEMO_LOGIN_ENABLED'];
    delete process.env['DEMO_MAX_USERS'];

    const { env } = await import('../src/config/env.js');

    expect(env.DEMO_LOGIN_ENABLED).toBe(false);
    expect(env.DEMO_MAX_USERS).toBe(200);
  });

  it('turns the demo sandbox on only for the exact value "true"', async () => {
    vi.resetModules();
    for (const [key, value] of Object.entries({ ...BASE, DEMO_LOGIN_ENABLED: 'true' })) {
      vi.stubEnv(key, value);
    }
    vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);

    const { env } = await import('../src/config/env.js');

    expect(env.DEMO_LOGIN_ENABLED).toBe(true);
  });
});
