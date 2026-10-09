import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as cache from '../src/services/cache.js';
import config from '../config.js';

describe('cache.js (LRU Cache)', () => {
  beforeEach(() => {
    cache.clear();
  });

  it('stores and retrieves cached items', () => {
    const plan = 'My test business plan';
    const data = { survivalScore: 85 };
    cache.set(plan, 'live', data);

    const retrieved = cache.get(plan, 'live');
    assert.deepEqual(retrieved, data);
  });

  it('normalizes whitespace and casing in plan text', () => {
    const plan1 = '  Build   An   AI App  ';
    const plan2 = 'build an ai app';
    const data = { ok: true };

    cache.set(plan1, 'quick', data);
    const retrieved = cache.get(plan2, 'quick');
    assert.deepEqual(retrieved, data);
  });

  it('distinguishes keys by execution mode', () => {
    const plan = 'Identical plan';
    cache.set(plan, 'live', { mode: 'live' });
    cache.set(plan, 'quick', { mode: 'quick' });

    assert.equal(cache.get(plan, 'live').mode, 'live');
    assert.equal(cache.get(plan, 'quick').mode, 'quick');
  });

  it('evicts oldest entries when exceeding max limit', () => {
    // Fill up to max entries
    for (let i = 0; i < config.CACHE.MAX_ENTRIES; i++) {
      cache.set(`plan ${i}`, 'live', { idx: i });
    }
    assert.equal(cache.size(), config.CACHE.MAX_ENTRIES);

    // Adding one more should evict plan 0
    cache.set('new plan', 'live', { new: true });
    assert.equal(cache.size(), config.CACHE.MAX_ENTRIES);
    assert.equal(cache.get('plan 0', 'live'), null);
    assert.ok(cache.get('new plan', 'live'));
  });
});
