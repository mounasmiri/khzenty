import { createApp } from './app.js';
import { env } from './config/env.js';
import { prisma } from './config/prisma.js';
import { purgeExpiredDemoUsers } from './services/demo-session.service.js';

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.log(`[khzenty] API ready on http://localhost:${env.PORT} (${env.NODE_ENV})`);
});

// Expired demo copies are also removed on every demo sign-in; doing it at boot
// too means they do not linger across a quiet period or after the flag is
// switched off. Failure here must never stop the server starting.
purgeExpiredDemoUsers()
  .then((count) => {
    if (count > 0) console.log(`[khzenty] Removed ${count} expired demo account(s).`);
  })
  .catch((error: unknown) => {
    console.error('[khzenty] Demo cleanup at boot failed:', error);
  });

// Without this, a failed bind (typically EADDRINUSE) leaves the process alive
// but not listening, with no indication of why.
server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`[khzenty] Port ${env.PORT} is already in use.`);
  } else {
    console.error('[khzenty] Server error:', error);
  }

  process.exit(1);
});

let shuttingDown = false;

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  // A second Ctrl-C should not start a competing shutdown.
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`[khzenty] ${signal} received, closing server...`);

  // Don't hang forever on a stuck connection.
  const failsafe = setTimeout(() => process.exit(1), 10_000);
  failsafe.unref();

  try {
    await new Promise<void>((resolve, reject) => {
      server.close((err: NodeJS.ErrnoException | undefined) => {
        // Already closed (or never bound) is a fine state to shut down from.
        if (err && err.code !== 'ERR_SERVER_NOT_RUNNING') {
          reject(err);
          return;
        }

        resolve();
      });
    });

    // Release the pg pool only after the last request has drained.
    await prisma.$disconnect();

    // Deliberately no `process.exit(0)` here. Every handle is closed, so the
    // event loop drains and Node exits 0 on its own. Forcing the exit races
    // libuv's teardown and aborts the process on Windows.
    clearTimeout(failsafe);
  } catch (error) {
    console.error('[khzenty] Error during shutdown:', error);
    process.exit(1);
  }
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
