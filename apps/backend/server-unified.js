import express from 'express';
import cors from 'cors';
import { initializeDatabase, closeDatabase, getDatabase, DB_TYPE } from './db/database.js';
import logger from './db/logger.js';
import { config, validateAuthConfig } from './src/config.js';
import { errorHandler, notFound } from './src/middleware/error-handler.js';
import healthRouter from './src/routes/health.js';
import authRouter from './src/routes/auth.js';
import gamesRouter from './src/routes/games.js';
import consolesRouter from './src/routes/consoles.js';
import searchRouter from './src/routes/search.js';
import statsRouter from './src/routes/stats.js';
import coversRouter from './src/routes/covers.js';
import wishlistRouter from './src/routes/wishlist.js';
import sagasRouter, { getIgdbClient } from './src/routes/sagas.js';
import { runSagaJobs } from './src/services/sagas-sync.js';

const app = express();
const port = config.server.port;

// En QA/Prod las requests llegan por el nginx del front, dentro de la red Docker:
// confiar solo en proxies locales/privados para tomar la IP real de X-Forwarded-For.
app.set('trust proxy', 'loopback, uniquelocal');

app.use(cors({ origin: config.server.frontendUrl }));
app.use(express.json({ limit: '5mb' }));

app.use((req, res, next) => {
  logger.debug({ method: req.method, url: req.originalUrl }, 'request');
  next();
});

app.use(healthRouter);
app.use(authRouter);
app.use(gamesRouter);
app.use(consolesRouter);
app.use(searchRouter);
app.use(statsRouter);
app.use(coversRouter);
app.use(wishlistRouter);
app.use(sagasRouter);

app.use(errorHandler);
app.use(notFound);

// Resolución de sagas contra IGDB: una vez al arrancar y luego cada 24 h.
function scheduleSagaJobs() {
  if (!config.twitch.hasCredentials || process.env.NODE_ENV === 'test') return;
  const run = () => runSagaJobs(getDatabase(), getIgdbClient(), logger);
  setTimeout(run, 10_000);
  setInterval(run, 24 * 60 * 60 * 1000).unref();
}

async function startServer() {
  const authErrors = validateAuthConfig();
  if (authErrors.length > 0) {
    logger.error({ errors: authErrors }, 'Insecure auth configuration, refusing to start');
    process.exit(1);
  }
  try {
    await initializeDatabase();
    app.listen(port, () => {
      logger.info({ port, dbType: DB_TYPE.toUpperCase() }, 'Server started');
      if (config.auth.apiKey) logger.info('API key auth enabled');
    });
    scheduleSagaJobs();
  } catch (error) {
    logger.error({ err: error }, 'Failed to start server');
    process.exit(1);
  }
}

process.on('SIGINT', async () => {
  logger.info('Shutting down gracefully...');
  await closeDatabase();
  process.exit(0);
});

process.on('uncaughtException', (err) => {
  logger.error({ err }, 'Uncaught exception');
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled rejection');
});

if (process.env.NODE_ENV !== 'test') {
  startServer();
}

export { app };
