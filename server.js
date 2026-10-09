// @ts-check
/**
 * @file server.js
 * @description Express server entry point for Red Team My Life.
 */

import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import config from './config.js';
import { helmetMiddleware } from './src/middleware/helmet.js';
import { errorHandler } from './src/middleware/errorHandler.js';
import { reviewRouter } from './src/routes/review.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Creates and configures the Express application.
 * @returns {import('express').Express}
 */
export function createApp() {
  const app = express();

  // Trust proxy for reverse proxy deployments (Cloud Run)
  app.set('trust proxy', config.TRUST_PROXY);

  // Security headers
  app.use(helmetMiddleware);

  // Request body limits
  app.use(express.json({ limit: config.BODY_LIMIT }));

  // Static frontend in /public
  app.use(express.static(join(__dirname, 'public')));

  // API routes
  app.use('/api', reviewRouter);

  // Central error handler
  app.use(errorHandler);

  return app;
}

export const app = createApp();

// Only start listening if executed directly from the command line
const isDirectExecution = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isDirectExecution) {
  app.listen(config.PORT, () => {
    console.log(`[Red Team My Life] Server running on http://localhost:${config.PORT}`);
    console.log(`[Red Team My Life] Persona models: ${config.PERSONA_MODELS.join(', ')}`);
    console.log(`[Red Team My Life] Judge models: ${config.JUDGE_MODELS.join(', ')}`);
  });
}
