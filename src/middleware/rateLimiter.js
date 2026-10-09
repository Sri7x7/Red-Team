// @ts-check
/**
 * @file src/middleware/rateLimiter.js
 * @description Abuse protection: per-IP sliding window rate limiting and
 * global concurrency cap (max 2 simultaneous reviews).
 */

import config from '../../config.js';

/** @type {Map<string, number[]>} */
const ipWindows = new Map();

let activeReviewsCount = 0;

/**
 * Returns current count of active in-flight reviews.
 * @returns {number}
 */
export function getActiveReviewsCount() {
  return activeReviewsCount;
}

/**
 * Middleware enforcing per-IP rate limit and global concurrency cap on reviews.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export function reviewRateLimiter(req, res, next) {
  const now = Date.now();
  const ip = req.ip || req.socket.remoteAddress || 'unknown';

  // 1. Global concurrency cap check
  if (activeReviewsCount >= config.RATE_LIMIT.GLOBAL_MAX_CONCURRENT_REVIEWS) {
    const retrySec = config.RATE_LIMIT.CONCURRENCY_RETRY_AFTER_SECONDS || 5;
    res.setHeader('Retry-After', String(retrySec));
    res.status(503).json({
      error: {
        code: 'concurrency_limit',
        message: `Server is currently processing maximum simultaneous reviews. Please retry in ${retrySec} seconds.`,
      },
    });
    return;
  }

  // 2. Per-IP sliding window rate limit check
  const windowStart = now - config.RATE_LIMIT.WINDOW_MS;
  let timestamps = ipWindows.get(ip) || [];
  timestamps = timestamps.filter(t => t > windowStart);

  if (timestamps.length >= config.RATE_LIMIT.MAX_REQUESTS_PER_IP) {
    const oldest = timestamps[0];
    const retryAfterSec = Math.max(1, Math.ceil((oldest + config.RATE_LIMIT.WINDOW_MS - now) / 1000));
    res.setHeader('Retry-After', String(retryAfterSec));
    res.status(429).json({
      error: {
        code: 'rate_limited',
        message: `Too many requests from this IP. Please retry in ${retryAfterSec} seconds.`,
      },
    });
    return;
  }

  // Record this request
  timestamps.push(now);
  ipWindows.set(ip, timestamps);

  // Track concurrency lifecycle
  activeReviewsCount += 1;

  let released = false;
  const release = () => {
    if (!released) {
      released = true;
      activeReviewsCount = Math.max(0, activeReviewsCount - 1);
    }
  };

  res.on('finish', release);
  res.on('close', release);

  next();
}

/**
 * Resets rate limiter state. Used for tests.
 */
export function resetRateLimiter() {
  ipWindows.clear();
  activeReviewsCount = 0;
}
