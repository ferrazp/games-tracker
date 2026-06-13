import express from 'express';
import cors from 'cors';
import { initializeDatabase, closeDatabase, DB_TYPE } from './db/database.js';
import logger from './db/logger.js';
import { config } from './src/config.js';
import { errorHandler, notFound } from './src/middleware/error-handler.js';
import healthRouter from './src/routes/health.js';
import authRouter from './src/routes/auth.js';
import gamesRouter from './src/routes/games.js';
import consolesRouter from './src/routes/consoles.js';
import searchRouter from './src/routes/search.js';
import statsRouter from './src/routes/stats.js';
import coversRouter from './src/routes/covers.js';

const app = express();
const port = config.server.port;

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

app.use(errorHandler);
app.use(notFound);

async function startServer() {
  try {
    await initializeDatabase();
    app.listen(port, () => {
      logger.info({ port, dbType: DB_TYPE.toUpperCase() }, 'Server started');
      if (config.auth.apiKey) logger.info('API key auth enabled');
    });
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
