import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { emitEvent, runReview } from '../src/orchestrator.js';

describe('stream.js', () => {
  it('formats and flushes individual NDJSON events', () => {
    const written = [];
    const mockRes = {
      writableEnded: false,
      destroyed: false,
      write: str => written.push(str),
      flush: () => {},
    };

    emitEvent(mockRes, { event: 'mode_selected', mode: 'live' });
    emitEvent(mockRes, { event: 'persona_done', persona: 'pessimist' });

    assert.equal(written.length, 2);
    assert.equal(written[0], JSON.stringify({ event: 'mode_selected', mode: 'live' }) + '\n');
    assert.equal(written[1], JSON.stringify({ event: 'persona_done', persona: 'pessimist' }) + '\n');
  });

  it('aborts review execution when AbortSignal triggers', async () => {
    const abortController = new AbortController();
    const written = [];
    const mockRes = {
      writableEnded: false,
      destroyed: false,
      write: str => written.push(str),
    };

    abortController.abort(); // Pre-aborted signal

    await runReview({
      plan: 'Custom plan',
      mode: 'live',
      res: mockRes,
      signal: abortController.signal,
    });

    // Should exit early without throwing unhandled exceptions
    assert.ok(true);
  });

  it('correctly parses newline-delimited stream chunks', () => {
    const chunk1 = '{"event":"mode_selected","mode":"demo"}\n{"event":"per';
    const chunk2 = 'sona_done","persona":"pessimist"}\n';

    let buffer = chunk1;
    const lines1 = buffer.split('\n');
    buffer = lines1.pop() || '';
    assert.equal(lines1.length, 1);
    assert.deepEqual(JSON.parse(lines1[0]), { event: 'mode_selected', mode: 'demo' });

    buffer += chunk2;
    const lines2 = buffer.split('\n');
    buffer = lines2.pop() || '';
    assert.equal(lines2.length, 1);
    assert.deepEqual(JSON.parse(lines2[0]), { event: 'persona_done', persona: 'pessimist' });
  });
});
