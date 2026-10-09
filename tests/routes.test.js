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

  it('GET /api/meta returns maxPlanLength, demoMode, personas, and examples without secrets', async () => {
    const app = createApp();
    const server = app.listen(0);
    const port = server.address().port;

    try {
      const res = await fetch(`http://localhost:${port}/api/meta`);
      assert.equal(res.status, 200);
      const data = await res.json();

      assert.equal(typeof data.maxPlanLength, 'number');
      assert.equal(typeof data.demoMode, 'boolean');
      assert.ok(Array.isArray(data.personas));
      assert.equal(data.personas.length, 5);

      for (const p of data.personas) {
        assert.ok(p.id);
        assert.ok(p.displayName);
        assert.ok(p.role);
        assert.ok(p.itemLabel);
        assert.ok(p.scoreLabel);
        assert.ok(p.fixLabel);
      }

      assert.ok(Array.isArray(data.examples));
      assert.equal(data.examples.length, 3);
      for (const ex of data.examples) {
        assert.ok(ex.id);
        assert.ok(ex.title);
        assert.ok(ex.plan);
      }

      const raw = JSON.stringify(data);
      assert.ok(!raw.includes('GEMINI_API_KEY'));
      assert.ok(!raw.includes('AIza'));
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

  it('POST /api/review streams NDJSON response with correct headers and events', async () => {
    const app = createApp();
    const server = app.listen(0);
    const port = server.address().port;

    try {
      const res = await fetch(`http://localhost:${port}/api/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: 'I want to switch careers and become a full-time artist.',
          mode: 'demo',
          exampleId: 'career-change',
        }),
      });

      assert.equal(res.status, 200);
      assert.ok(res.headers.get('content-type')?.includes('application/x-ndjson'));
      assert.ok(res.headers.get('cache-control')?.includes('no-cache'));

      const text = await res.text();
      const lines = text.trim().split('\n').filter(Boolean);
      assert.ok(lines.length >= 6);

      const events = lines.map(line => JSON.parse(line));
      assert.equal(events[0].event, 'mode_selected');
      assert.equal(events[events.length - 1].event, 'judge_done');
    } finally {
      server.close();
    }
  });

  it('POST /api/review respects client abort during streaming', async () => {
    const app = createApp();
    const server = app.listen(0);
    const port = server.address().port;

    try {
      const abortController = new AbortController();
      const fetchPromise = fetch(`http://localhost:${port}/api/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: 'I am launching a new startup and need feedback.',
          mode: 'demo',
          exampleId: 'startup-idea',
        }),
        signal: abortController.signal,
      });

      setTimeout(() => abortController.abort(), 30);

      await assert.rejects(async () => {
        const res = await fetchPromise;
        const reader = res.body?.getReader();
        if (reader) {
          while (true) {
            const { done } = await reader.read();
            if (done) break;
          }
        }
      });
    } finally {
      server.close();
    }
  });
});
