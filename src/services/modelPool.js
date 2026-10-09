// @ts-check
/**
 * @file src/services/modelPool.js
 * @description Quota-aware model pool tracking per-model sliding-window RPM, daily request limits
 * (reset at midnight America/Los_Angeles), and 429 cooldowns.
 */

import config from '../../config.js';

/**
 * @typedef {Object} ModelState
 * @property {string} id
 * @property {'lite' | 'flash'} tier
 * @property {number[]} requestTimestamps - Timestamps within current sliding minute
 * @property {number} dailyCount
 * @property {string} dailyDate - YYYY-MM-DD in America/Los_Angeles
 * @property {number | null} cooldownUntil - Milliseconds timestamp
 */

/** @type {Map<string, ModelState>} */
const modelStates = new Map();

let personaRoundRobinIndex = 0;

/**
 * Determines whether a model is Flash-Lite or full Flash based on its name.
 * @param {string} modelId
 * @returns {'lite' | 'flash'}
 */
export function getModelTier(modelId) {
  return modelId.toLowerCase().includes('lite') ? 'lite' : 'flash';
}

/**
 * Returns RPM limit for a given model.
 * @param {string} modelId
 * @returns {number}
 */
export function getRpmLimit(modelId) {
  const tier = getModelTier(modelId);
  return tier === 'lite' ? config.QUOTAS.FLASH_LITE.RPM : config.QUOTAS.FLASH.RPM;
}

/**
 * Returns RPD limit for a given model.
 * @param {string} modelId
 * @returns {number}
 */
export function getRpdLimit(modelId) {
  const tier = getModelTier(modelId);
  return tier === 'lite' ? config.QUOTAS.FLASH_LITE.RPD : config.QUOTAS.FLASH.RPD;
}

/**
 * Formats current date in America/Los_Angeles timezone (YYYY-MM-DD).
 * @param {number} [now]
 * @returns {string}
 */
export function getLosAngelesDateString(now = Date.now()) {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: config.QUOTAS.TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(now));
  } catch {
    return new Date(now).toISOString().split('T')[0];
  }
}

/**
 * Gets or initializes the internal state for a model.
 * @param {string} modelId
 * @param {number} [now]
 * @returns {ModelState}
 */
export function getOrCreateState(modelId, now = Date.now()) {
  let state = modelStates.get(modelId);
  const currentDate = getLosAngelesDateString(now);

  if (!state) {
    state = {
      id: modelId,
      tier: getModelTier(modelId),
      requestTimestamps: [],
      dailyCount: 0,
      dailyDate: currentDate,
      cooldownUntil: null,
    };
    modelStates.set(modelId, state);
  } else if (state.dailyDate !== currentDate) {
    // Midnight reset in America/Los_Angeles
    state.dailyCount = 0;
    state.dailyDate = currentDate;
  }

  // Clean up sliding-window timestamps older than 60 seconds
  const oneMinuteAgo = now - 60000;
  state.requestTimestamps = state.requestTimestamps.filter(t => t > oneMinuteAgo);

  // Clear expired cooldown
  if (state.cooldownUntil && now >= state.cooldownUntil) {
    state.cooldownUntil = null;
  }

  return state;
}

/**
 * Checks if a model is currently available (not in cooldown, under RPM, under RPD).
 * @param {string} modelId
 * @param {number} [now]
 * @returns {boolean}
 */
export function isModelAvailable(modelId, now = Date.now()) {
  const state = getOrCreateState(modelId, now);

  if (state.cooldownUntil && now < state.cooldownUntil) {
    return false;
  }

  if (state.requestTimestamps.length >= getRpmLimit(modelId)) {
    return false; // Proactive RPM limit skip
  }

  if (state.dailyCount >= getRpdLimit(modelId)) {
    return false; // Proactive RPD limit skip
  }

  return true;
}

/**
 * Records a request sent to a model.
 * @param {string} modelId
 * @param {number} [now]
 */
export function recordRequest(modelId, now = Date.now()) {
  const state = getOrCreateState(modelId, now);
  state.requestTimestamps.push(now);
  state.dailyCount += 1;
}

/**
 * Sets a cooldown on a model after a 429 response.
 * @param {string} modelId
 * @param {number | null} [retryAfterSeconds]
 * @param {number} [now]
 */
export function recordCooldown(modelId, retryAfterSeconds = null, now = Date.now()) {
  const state = getOrCreateState(modelId, now);
  const seconds = retryAfterSeconds || config.QUOTAS.DEFAULT_COOLDOWN_SECONDS;
  state.cooldownUntil = now + seconds * 1000;
}

/**
 * Picks the next available persona model using round-robin with failover.
 * @param {string[]} [exclude] Models to exclude (e.g., if retrying)
 * @param {number} [now]
 * @returns {string | null} Selected model ID or null if all unavailable
 */
export function getPersonaModel(exclude = [], now = Date.now()) {
  const pool = config.PERSONA_MODELS;
  if (pool.length === 0) return null;

  for (let i = 0; i < pool.length; i++) {
    const idx = (personaRoundRobinIndex + i) % pool.length;
    const candidate = pool[idx];

    if (!exclude.includes(candidate) && isModelAvailable(candidate, now)) {
      personaRoundRobinIndex = (idx + 1) % pool.length;
      return candidate;
    }
  }

  return null;
}

/**
 * Picks the first available judge model from the ordered fallback chain.
 * @param {string[]} [exclude]
 * @param {number} [now]
 * @returns {string | null}
 */
export function getJudgeModel(exclude = [], now = Date.now()) {
  const pool = config.JUDGE_MODELS;
  for (const candidate of pool) {
    if (!exclude.includes(candidate) && isModelAvailable(candidate, now)) {
      return candidate;
    }
  }
  return null;
}

/**
 * Evaluates auto-mode selection logic:
 * Starts in 'live' if at least 2 healthy persona models and none are in cooldown;
 * otherwise starts in 'quick'.
 * @param {number} [now]
 * @returns {'live' | 'quick'}
 */
export function determineAutoMode(now = Date.now()) {
  const personaPool = config.PERSONA_MODELS;
  let healthyCount = 0;

  for (const modelId of personaPool) {
    const state = getOrCreateState(modelId, now);
    if (state.cooldownUntil && now < state.cooldownUntil) {
      return 'quick'; // Any model in cooldown triggers quick mode
    }
    if (isModelAvailable(modelId, now)) {
      healthyCount += 1;
    }
  }

  return healthyCount >= 2 ? 'live' : 'quick';
}

/**
 * Returns sanitized diagnostics for /api/status.
 * @param {number} [now]
 * @returns {Object}
 */
export function getModelPoolStatus(now = Date.now()) {
  /**
   * @param {string} id
   */
  const mapModel = id => {
    const state = getOrCreateState(id, now);
    return {
      id,
      tier: state.tier,
      healthy: isModelAvailable(id, now),
      rpm: {
        used: state.requestTimestamps.length,
        limit: getRpmLimit(id),
      },
      rpd: {
        used: state.dailyCount,
        limit: getRpdLimit(id),
      },
      cooldownUntil: state.cooldownUntil ? new Date(state.cooldownUntil).toISOString() : null,
    };
  };

  return {
    personas: config.PERSONA_MODELS.map(mapModel),
    judge: config.JUDGE_MODELS.map(mapModel),
  };
}

/**
 * Resets all model states. Used in tests.
 */
export function resetModelPool() {
  modelStates.clear();
  personaRoundRobinIndex = 0;
}
