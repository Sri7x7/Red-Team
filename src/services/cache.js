// @ts-check
/**
 * @file src/services/cache.js
 * @description In-memory LRU cache keyed by hash of normalized plan and execution mode.
 * Never persists to disk, never logs plan contents or keys.
 */

import { createHash } from 'node:crypto';
import config from '../../config.js';

/**
 * @typedef {Object} CacheEntry
 * @property {number} expiresAt - Timestamp when the entry expires
 * @property {any} data - The cached result
 */

/** @type {Map<string, CacheEntry>} */
const cache = new Map();

/**
 * Computes a secure hash of the normalized plan and mode.
 * @param {string} plan
 * @param {string} mode
 * @returns {string}
 */
export function createCacheKey(plan, mode) {
  const normalized = plan.trim().replace(/\s+/g, ' ').toLowerCase();
  return createHash('sha256').update(`${mode}:${normalized}`).digest('hex');
}

/**
 * Retrieves a cached item if present and not expired.
 * Also promotes the key to most-recently-used.
 * @param {string} plan
 * @param {string} mode
 * @returns {any | null}
 */
export function get(plan, mode) {
  const key = createCacheKey(plan, mode);
  const entry = cache.get(key);

  if (!entry) return null;

  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }

  // Refresh LRU order: delete and re-insert
  cache.delete(key);
  cache.set(key, entry);

  return entry.data;
}

/**
 * Stores an item in the LRU cache.
 * Evicts the oldest entry if size exceeds config.CACHE.MAX_ENTRIES.
 * @param {string} plan
 * @param {string} mode
 * @param {any} data
 */
export function set(plan, mode, data) {
  const key = createCacheKey(plan, mode);

  // If already present, delete to refresh position
  if (cache.has(key)) {
    cache.delete(key);
  } else if (cache.size >= config.CACHE.MAX_ENTRIES) {
    // Evict oldest (first key in map iteration)
    const oldestKey = cache.keys().next().value;
    if (oldestKey) {
      cache.delete(oldestKey);
    }
  }

  cache.set(key, {
    expiresAt: Date.now() + config.CACHE.TTL_MS,
    data,
  });
}

/**
 * Clears the cache. Used for testing.
 */
export function clear() {
  cache.clear();
}

/**
 * Returns current cache size.
 * @returns {number}
 */
export function size() {
  return cache.size;
}
