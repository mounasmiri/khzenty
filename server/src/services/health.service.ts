import { env } from '../config/env.js';

export interface HealthStatus {
  status: 'ok';
  environment: typeof env.NODE_ENV;
  uptimeSeconds: number;
  timestamp: string;
}

export const healthService = {
  getStatus(): HealthStatus {
    return {
      status: 'ok',
      environment: env.NODE_ENV,
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  },
};
