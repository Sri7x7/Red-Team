import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import config from '../config.js';
import * as geminiClient from '../src/services/geminiClient.js';

describe('config.js', () => {
  it('exports frozen configuration object', () => {
    assert.ok(Object.isFrozen(config));
    assert.ok(Object.isFrozen(config.QUOTAS));
    assert.ok(Object.isFrozen(config.RATE_LIMIT));
    assert.ok(Object.isFrozen(config.SCHEMA_LIMITS));
  });

  it('contains valid numeric limits from architecture specification', () => {
    assert.equal(config.MAX_PLAN_LENGTH, 2000);
    assert.equal(config.MIN_PLAN_LENGTH, 1);
    assert.equal(config.QUOTAS.FLASH_LITE.RPM, 15);
    assert.equal(config.QUOTAS.FLASH_LITE.RPD, 500);
    assert.equal(config.QUOTAS.FLASH.RPM, 5);
    assert.equal(config.QUOTAS.FLASH.RPD, 20);
    assert.equal(config.QUOTAS.DEFAULT_COOLDOWN_SECONDS, 60);
    assert.equal(config.CACHE.MAX_ENTRIES, 50);
    assert.equal(config.CACHE.TTL_MS, 600000);
    assert.equal(config.RATE_LIMIT.GLOBAL_MAX_CONCURRENT_REVIEWS, 2);
  });

  it('has valid model lists for personas and judge', () => {
    assert.ok(Array.isArray(config.PERSONA_MODELS));
    assert.ok(config.PERSONA_MODELS.length >= 2);
    assert.ok(Array.isArray(config.JUDGE_MODELS));
    assert.ok(config.JUDGE_MODELS.length >= 2);
  });

  it('throws when GEMINI_API_KEY is missing and not in DEMO_MODE', () => {
    geminiClient.setMockClient(null);
    const origKey = process.env.GEMINI_API_KEY;
    const origDemo = process.env.DEMO_MODE;

    process.env.GEMINI_API_KEY = '';
    process.env.DEMO_MODE = 'false';

    try {
      assert.throws(() => {
        geminiClient.getClient();
      }, /GEMINI_API_KEY environment variable is required/);
    } finally {
      process.env.GEMINI_API_KEY = origKey;
      process.env.DEMO_MODE = origDemo;
    }
  });
});
