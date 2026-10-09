import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as modelPool from '../src/services/modelPool.js';
import config from '../config.js';

describe('modelPool.js', () => {
  beforeEach(() => {
    modelPool.resetModelPool();
  });

  it('determines model tiers accurately', () => {
    assert.equal(modelPool.getModelTier('gemini-3.5-flash-lite'), 'lite');
    assert.equal(modelPool.getModelTier('gemini-3.8-flash'), 'flash');
  });

  it('enforces sliding-window RPM limit and proactively marks model unavailable', () => {
    const model = 'gemini-3.5-flash-lite';
    const limit = config.QUOTAS.FLASH_LITE.RPM;
    const now = 1000000;

    assert.equal(modelPool.isModelAvailable(model, now), true);

    // Record requests up to limit
    for (let i = 0; i < limit; i++) {
      modelPool.recordRequest(model, now);
    }

    // Now model should be proactively skipped
    assert.equal(modelPool.isModelAvailable(model, now), false);

    // After 61 seconds, sliding window slides forward, model becomes available again
    assert.equal(modelPool.isModelAvailable(model, now + 61000), true);
  });

  it('enforces daily request limit (RPD) and proactively marks model unavailable', () => {
    const model = 'gemini-3.8-flash';
    const limit = config.QUOTAS.FLASH.RPD;
    const now = 1000000;

    for (let i = 0; i < limit; i++) {
      modelPool.recordRequest(model, now);
    }

    assert.equal(modelPool.isModelAvailable(model, now), false);
  });

  it('resets daily request count when day rolls over in America/Los_Angeles', () => {
    const model = 'gemini-3.8-flash';
    // 2026-10-09 23:59:00 UTC (4:59 PM LA)
    const day1 = new Date('2026-10-09T20:00:00Z').getTime();
    // 2026-10-10 09:00:00 UTC (2:00 AM LA next day)
    const day2 = new Date('2026-10-10T09:00:00Z').getTime();

    // Exhaust RPD on day 1
    for (let i = 0; i < config.QUOTAS.FLASH.RPD; i++) {
      modelPool.recordRequest(model, day1);
    }
    assert.equal(modelPool.isModelAvailable(model, day1), false);

    // On day 2, counter resets
    assert.equal(modelPool.isModelAvailable(model, day2), true);
  });

  it('records 429 cooldown and honors cooldown duration', () => {
    const model = 'gemini-3.5-flash-lite';
    const now = 5000000;
    modelPool.recordCooldown(model, 30, now);

    assert.equal(modelPool.isModelAvailable(model, now + 10000), false);
    assert.equal(modelPool.isModelAvailable(model, now + 31000), true);
  });

  it('round-robins persona models across available pool', () => {
    const m1 = modelPool.getPersonaModel();
    const m2 = modelPool.getPersonaModel();
    assert.ok(m1);
    assert.ok(m2);
    assert.notEqual(m1, m2);
  });

  it('selects judge model using ordered fallback chain', () => {
    const primary = modelPool.getJudgeModel();
    assert.equal(primary, config.JUDGE_MODELS[0]);

    // If primary is excluded, picks second
    const fallback = modelPool.getJudgeModel([primary]);
    assert.equal(fallback, config.JUDGE_MODELS[1]);
  });

  it('evaluates auto mode: returns live if healthy, quick if in cooldown', () => {
    const now = Date.now();
    assert.equal(modelPool.determineAutoMode(now), 'live');

    // Put one persona model in cooldown
    modelPool.recordCooldown(config.PERSONA_MODELS[0], 60, now);
    assert.equal(modelPool.determineAutoMode(now), 'quick');
  });
});
