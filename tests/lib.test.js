import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseNdjsonChunk,
  getSeverityText,
  buildCalendarUrl,
  formatCharCounter,
} from '../public/js/lib.js';

describe('public/js/lib.js (pure frontend helpers)', () => {
  describe('parseNdjsonChunk', () => {
    it('parses complete lines and returns empty remaining buffer', () => {
      const chunk = '{"event":"mode_selected","mode":"live"}\n{"event":"persona_done","persona":"pessimist"}\n';
      const { events, remainingBuffer } = parseNdjsonChunk(chunk);
      assert.equal(events.length, 2);
      assert.equal(events[0].event, 'mode_selected');
      assert.equal(events[1].persona, 'pessimist');
      assert.equal(remainingBuffer, '');
    });

    it('buffers trailing incomplete lines across chunk boundaries', () => {
      const chunk1 = '{"event":"mode_selected","mode":"quick"}\n{"event":"persona_done","pers';
      const res1 = parseNdjsonChunk(chunk1);
      assert.equal(res1.events.length, 1);
      assert.equal(res1.events[0].mode, 'quick');
      assert.equal(res1.remainingBuffer, '{"event":"persona_done","pers');

      const chunk2 = res1.remainingBuffer + 'ona":"accountant"}\n';
      const res2 = parseNdjsonChunk(chunk2);
      assert.equal(res2.events.length, 1);
      assert.equal(res2.events[0].persona, 'accountant');
      assert.equal(res2.remainingBuffer, '');
    });

    it('skips empty lines and handles whitespace', () => {
      const chunk = '\n  \n{"event":"test"}\n\n';
      const { events, remainingBuffer } = parseNdjsonChunk(chunk);
      assert.equal(events.length, 1);
      assert.equal(events[0].event, 'test');
      assert.equal(remainingBuffer, '');
    });

    it('returns empty results for empty or null inputs', () => {
      assert.deepEqual(parseNdjsonChunk(''), { events: [], remainingBuffer: '' });
      // @ts-ignore
      assert.deepEqual(parseNdjsonChunk(null), { events: [], remainingBuffer: '' });
    });
  });

  describe('getSeverityText', () => {
    it('returns appropriate descriptive labels for standard severity 1 to 5', () => {
      assert.equal(getSeverityText(1), 'Severity 1 of 5 - Minimal');
      assert.equal(getSeverityText(2), 'Severity 2 of 5 - Low');
      assert.equal(getSeverityText(3), 'Severity 3 of 5 - Moderate');
      assert.equal(getSeverityText(4), 'Severity 4 of 5 - High');
      assert.equal(getSeverityText(5), 'Severity 5 of 5 - Critical');
    });

    it('returns impact labels for the Optimist persona', () => {
      assert.equal(getSeverityText(1, true), 'Impact 1 of 5 - Minor');
      assert.equal(getSeverityText(3, true), 'Impact 3 of 5 - Notable');
      assert.equal(getSeverityText(4, true), 'Impact 4 of 5 - High');
      assert.equal(getSeverityText(5, true), 'Impact 5 of 5 - Major Catalyst');
    });

    it('clamps out-of-range scores to [1, 5]', () => {
      assert.equal(getSeverityText(0), 'Severity 1 of 5 - Minimal');
      assert.equal(getSeverityText(99), 'Severity 5 of 5 - Critical');
    });
  });

  describe('buildCalendarUrl', () => {
    it('computes due date and builds valid Google Calendar URL with correct parameters', () => {
      const fixedBase = new Date('2026-10-10T00:00:00Z');
      const urlStr = buildCalendarUrl('Publish MVP vertical slice', 14, fixedBase);
      const url = new URL(urlStr);

      assert.equal(url.origin, 'https://calendar.google.com');
      assert.equal(url.pathname, '/calendar/render');
      assert.equal(url.searchParams.get('action'), 'TEMPLATE');
      assert.equal(url.searchParams.get('text'), 'Publish MVP vertical slice');
      // 2026-10-10 + 14 days = 2026-10-24, next day = 2026-10-25
      assert.equal(url.searchParams.get('dates'), '20261024/20261025');
      assert.ok(url.searchParams.get('details')?.includes('Red Team My Life'));
    });
  });

  describe('formatCharCounter', () => {
    it('formats character count string properly', () => {
      assert.equal(formatCharCounter(150, 2000), '150 / 2000');
      assert.equal(formatCharCounter(0, 2000), '0 / 2000');
      assert.equal(formatCharCounter(2000, 2000), '2000 / 2000');
    });
  });
});
