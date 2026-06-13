import logger from '../../db/logger.js';

export function errorHandler(err, req, res, next) {
  logger.error({ err }, 'Unhandled error');
  res.status(500).json({ error: 'Internal server error' });
}

export function notFound(req, res) {
  res.status(404).json({ error: 'Endpoint not found' });
}
