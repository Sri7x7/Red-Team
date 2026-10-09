import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server.js';

describe('routes /api & server middleware', () => {
  it('GET /api/status returns health and does not leak secrets', async () => {
    const app = createApp();
    const server = app.listen(0);
    const port = server.address().port;

    try {
      const res = await fetch(`http://localhost:${port}/api/status`);
      assert.equal(res.status, 200);
      const data = await res.json();

      assert.equal(typeof data.mode, 'string');
      assert.ok(Array.isArray(data.models.personas));
      assert.ok(Array.isArray(data.models.judge));

      const rawText = JSON.stringify(data);
      assert.ok(!rawText.includes('AIza'));
      assert.ok(!rawText.includes('GEMINI_API_KEY'));
    } finally {
      server.close();
    }
  });

  it('POST /api/review rejects invalid empty payload with 400 and safe error body', async () => {
    const app = createApp();
    const server = app.listen(0);
    const port = server.address().port;

    try {
      const res = await fetch(`http://localhost:${port}/api/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: '' }),
      });

      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.error.code, 'invalid_request');
      assert.ok(typeof data.error.message === 'string');
      // Ensure error body does not echo plan content
      assert.equal(data.plan, undefined);
    } finally {
      server.close();
    }
  });

  it('rejects malformed JSON with 400 invalid_request', async () => {
    const app = createApp();
    const server = app.listen(0);
    const port = server.address().port;

    try {
      const res = await fetch(`http://localhost:${port}/api/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{"plan": broken json',
      });

      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.error.code, 'invalid_request');
      assert.equal(data.error.message, 'Malformed JSON payload');
    } finally {
      server.close();
    }
  });

  it('rejects oversized payload with 413 payload_too_large', async () => {
    const app = createApp();
    const server = app.listen(0);
    const port = server.address().port;

    try {
      // Body exceeds the 64kb limit
      const oversized = JSON.stringify({ plan: 'x'.repeat(70000) });
      const res = await fetch(`http://localhost:${port}/api/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: oversized,
      });

      assert.equal(res.status, 413);
      const data = await res.json();
      assert.equal(data.error.code, 'payload_too_large');
    } finally {
      server.close();
    }
  });

  it('enforces security headers including Content-Security-Policy', async () => {
    const app = createApp();
    const server = app.listen(0);
    const port = server.address().port;

    try {
      const res = await fetch(`http://localhost:${port}/api/status`);
      assert.ok(res.headers.get('content-security-policy'));
      assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    } finally {
      server.close();
    }
  });

  it('returns 404 structured error for unknown routes', async () => {
    const app = createApp();
    const server = app.listen(0);
    const port = server.address().port;

    try {
      const res = await fetch(`http://localhost:${port}/api/unknown-endpoint`);
      assert.equal(res.status, 404);
    } finally {
      server.close();
    }
  });
});
