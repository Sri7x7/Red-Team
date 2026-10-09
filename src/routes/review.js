// @ts-check
/**
 * @file src/routes/review.js
 * @description Express route handlers for POST /api/review (NDJSON stream) and GET /api/status.
 */

import { Router } from 'express';
import { ReviewRequestSchema } from '../validation/schemas.js';
import { runReview } from '../orchestrator.js';
import { getModelPoolStatus } from '../services/modelPool.js';
import { reviewRateLimiter, getActiveReviewsCount } from '../middleware/rateLimiter.js';
import { PERSONA_METADATA } from '../agents/personas.js';
import { getAllExamplesSummary } from '../services/exampleStore.js';
import config from '../../config.js';

export const reviewRouter = Router();

/**
 * POST /api/review
 * Initiates multi-agent plan attack and streams NDJSON results.
 */
reviewRouter.post('/review', reviewRateLimiter, async (req, res, next) => {
  // Validate request body
  const parseResult = ReviewRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: {
        code: 'invalid_request',
        message: parseResult.error.issues?.[0]?.message || 'Invalid request payload',
      },
    });
    return;
  }

  const { plan, mode, exampleId } = parseResult.data;

  // Set NDJSON streaming headers
  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('Connection', 'keep-alive');
  res.status(200);

  // Tie client disconnect to AbortController
  const abortController = new AbortController();
  req.on('close', () => {
    abortController.abort();
  });

  try {
    await runReview({
      plan,
      mode,
      exampleId,
      res,
      signal: abortController.signal,
    });
  } catch (err) {
    if (!res.writableEnded) {
      res.write(
        JSON.stringify({
          event: 'error',
          message: err.message || 'An error occurred during multi-agent analysis',
          code: 'internal',
          retryAfterSeconds: null,
          sampleAvailable: true,
        }) + '\n'
      );
    }
  } finally {
    if (!res.writableEnded) {
      res.end();
    }
  }
});

/**
 * GET /api/status
 * Returns sanitized system health and model cooldown status. Never exposes keys or plans.
 */
reviewRouter.get('/status', (req, res) => {
  res.json({
    mode: 'auto',
    demoMode: config.DEMO_MODE,
    groundingEnabled: config.GROUNDING_ENABLED,
    models: getModelPoolStatus(),
    activeReviews: getActiveReviewsCount(),
    maxConcurrentReviews: config.RATE_LIMIT.GLOBAL_MAX_CONCURRENT_REVIEWS,
  });
});

/**
 * GET /api/meta
 * Returns configuration metadata for the frontend: plan limits, demoMode,
 * persona details with labels and themes, and benchmark example plans.
 * Never leaks API keys, prompts, or sensitive internal state.
 */
reviewRouter.get('/meta', (req, res) => {
  const personaRoles = {
    pessimist: 'Operational risk & structural failure points',
    accountant: 'Fiduciary stress-testing & financial assumptions',
    skepticalParent: 'Family safety nets & life reversibility',
    futureYou: 'Hindsight reflection & regret asymmetry',
    optimist: 'Strategic upsides & compounding catalysts',
  };

  const personas = Object.entries(PERSONA_METADATA).map(([id, meta]) => ({
    id,
    displayName: meta.displayName,
    role: personaRoles[id] || 'Council advisor',
    ...meta,
  }));

  res.json({
    maxPlanLength: config.MAX_PLAN_LENGTH,
    demoMode: config.DEMO_MODE,
    personas,
    examples: getAllExamplesSummary(),
  });
});

