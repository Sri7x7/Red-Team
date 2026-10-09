import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { reviewRateLimiter, resetRateLimiter, getActiveReviewsCount } from '../src/middleware/rateLimiter.js';
import { errorHandler } from '../src/middleware/errorHandler.js';

describe('middleware', () => {
  beforeEach(() => {
    resetRateLimiter();
  });

  describe('rateLimiter.js', () => {
    it('blocks request when exceeding global concurrency cap', () => {
      const mockReq = { ip: '127.0.0.1', socket: {} };
      let statusCalled = null;
      let jsonCalled = null;
      let nextCount = 0;

      const mockRes = {
        setHeader: () => {},
        status: code => {
          statusCalled = code;
          return {
            json: data => {
              jsonCalled = data;
            },
          };
        },
        on: () => {},
      };

      // Fill concurrency up to limit (2)
      reviewRateLimiter(mockReq, mockRes, () => nextCount++);
      reviewRateLimiter(mockReq, mockRes, () => nextCount++);
      assert.equal(nextCount, 2);
      assert.equal(getActiveReviewsCount(), 2);

      // Third request should be blocked with 503
      reviewRateLimiter(mockReq, mockRes, () => nextCount++);
      assert.equal(statusCalled, 503);
      assert.equal(jsonCalled?.error?.code, 'concurrency_limit');
      assert.equal(nextCount, 2);
    });

    it('enforces per-IP rate limit and sets Retry-After', () => {
      const mockReq = { ip: '10.0.0.1', socket: {} };
      let statusCalled = null;
      let headersSet = {};

      const createRes = () => {
        const callbacks = {};
        return {
          setHeader: (k, v) => {
            headersSet[k] = v;
          },
          status: code => {
            statusCalled = code;
            return { json: () => {} };
          },
          on: (evt, cb) => {
            callbacks[evt] = cb;
          },
          end: () => {
            if (callbacks['finish']) callbacks['finish']();
          },
        };
      };

      // Send 20 requests (max per IP) and finish each so concurrency is freed
      for (let i = 0; i < 20; i++) {
        const res = createRes();
        reviewRateLimiter(mockReq, res, () => {
          res.end();
        });
      }

      // 21st request should be rate-limited with 429
      const res21 = createRes();
      reviewRateLimiter(mockReq, res21, () => {});
      assert.equal(statusCalled, 429);
      assert.ok(headersSet['Retry-After']);
    });
  });

  describe('errorHandler.js', () => {
    it('formats error into structured JSON without leaking secrets', () => {
      let statusVal = 0;
      let jsonVal = null;
      const mockRes = {
        headersSent: false,
        status: code => {
          statusVal = code;
          return {
            json: d => {
              jsonVal = d;
            },
          };
        },
      };

      const err = new Error('Invalid request param');
      // @ts-ignore
      err.status = 400;
      errorHandler(err, {}, mockRes, () => {});
      assert.equal(statusVal, 400);
      assert.equal(jsonVal?.error?.message, 'Invalid request param');
      assert.equal(jsonVal?.error?.code, 'invalid_request');
    });

    it('masks 500 internal errors with generic message', () => {
      let statusVal = 0;
      let jsonVal = null;
      const mockRes = {
        headersSent: false,
        status: code => {
          statusVal = code;
          return {
            json: d => {
              jsonVal = d;
            },
          };
        },
      };

      errorHandler(new Error('Sensitive DB failure details'), {}, mockRes, () => {});
      assert.equal(statusVal, 500);
      assert.equal(jsonVal?.error?.message, 'An unexpected internal error occurred');
      assert.equal(jsonVal?.error?.code, 'internal_error');
    });
  });
});
