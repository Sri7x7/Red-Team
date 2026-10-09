// @ts-check
/**
 * @file public/js/api.js
 * @description Frontend API client for metadata fetching and streaming NDJSON reviews.
 */

import { parseNdjsonChunk } from './lib.js';

/**
 * Fetches application metadata including limits, personas, and benchmark examples.
 * @returns {Promise<{
 *   maxPlanLength: number,
 *   demoMode: boolean,
 *   personas: Array<any>,
 *   examples: Array<{ id: string, title: string, plan: string }>
 * }>}
 */
export async function fetchMetadata() {
  const res = await fetch('/api/meta');
  if (!res.ok) {
    throw new Error(`Failed to load application metadata: ${res.status}`);
  }
  return res.json();
}

/**
 * Submits a plan for multi-agent stress testing and streams NDJSON events in real-time.
 * @param {object} params
 * @param {string} params.plan
 * @param {'auto' | 'live' | 'quick' | 'demo'} params.mode
 * @param {string} [params.exampleId]
 * @param {AbortSignal} [params.signal]
 * @param {(event: any) => void} params.onEvent
 * @param {(error: Error) => void} params.onError
 * @returns {Promise<void>}
 */
export async function streamReview({ plan, mode, exampleId, signal, onEvent, onError }) {
  try {
    const res = await fetch('/api/review', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ plan, mode, exampleId }),
      signal,
    });

    if (!res.ok) {
      let errPayload = null;
      try {
        errPayload = await res.json();
      } catch {
        // Non-JSON response
      }

      const retryAfter = res.headers.get('Retry-After');
      const err = new Error(errPayload?.error?.message || `Request failed with status ${res.status}`);
      // @ts-ignore
      err.status = res.status;
      // @ts-ignore
      err.code = errPayload?.error?.code || (res.status === 429 ? 'rate_limited' : res.status === 503 ? 'concurrency_limit' : 'http_error');
      // @ts-ignore
      err.retryAfterSeconds = retryAfter ? parseInt(retryAfter, 10) : null;
      throw err;
    }

    if (!res.body) {
      throw new Error('Response body is not readable');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const { events, remainingBuffer } = parseNdjsonChunk(buffer);
      buffer = remainingBuffer;

      for (const event of events) {
        onEvent(event);
      }
    }

    // Flush any trailing line in buffer
    if (buffer.trim()) {
      try {
        const lastEvent = JSON.parse(buffer.trim());
        onEvent(lastEvent);
      } catch {
        // Ignore partial fragment
      }
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      // Stream aborted by user via Stop button
      return;
    }
    onError(err);
  }
}
