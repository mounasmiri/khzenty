import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';

export interface HealthStatus {
  status: 'ok' | 'degraded';
  /** Development and test only: production reveals nothing but `status`. */
  environment?: typeof env.NODE_ENV;
  uptimeSeconds?: number;
  timestamp?: string;
}

/**
 * Long enough for a serverless database to wake (a cold Neon compute), short
 * enough to answer inside a platform health check's own 5 s limit.
 */
const DB_CHECK_TIMEOUT_MS = 4000;

async function databaseReachable(): Promise<boolean> {
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_resolve, reject) => {
        setTimeout(() => reject(new Error('database check timed out')), DB_CHECK_TIMEOUT_MS).unref();
      }),
    ]);

    return true;
  } catch {
    // Deliberately not logged with the error: a probe hits this every few
    // seconds during an outage, and the cause is visible in the database's logs.
    return false;
  }
}

export const healthService = {
  async getStatus(): Promise<{ httpStatus: 200 | 503; body: HealthStatus }> {
    const healthy = await databaseReachable();
    const status = healthy ? 'ok' : 'degraded';

    if (env.NODE_ENV === 'production') {
      // Anything more (environment, uptime) helps an attacker fingerprint the
      // deployment and helps no legitimate probe.
      return { httpStatus: healthy ? 200 : 503, body: { status } };
    }

    return {
      httpStatus: healthy ? 200 : 503,
      body: {
        status,
        environment: env.NODE_ENV,
        uptimeSeconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
      },
    };
  },
};
