import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import * as geminiClient from '../src/services/geminiClient.js';
import * as modelPool from '../src/services/modelPool.js';

describe('geminiClient.js', () => {
  it('successfully generates and validates structured JSON', async () => {
    const testSchema = z.object({ value: z.number() });

    geminiClient.setMockClient({
      models: {
        generateContent: async () => ({
          text: JSON.stringify({ value: 42 }),
        }),
      },
    });

    const result = await geminiClient.generateStructuredJson({
      model: 'test-model',
      contents: 'Give me 42',
      schema: testSchema,
    });

    assert.equal(result.value, 42);
  });

  it('rejects with schema error if model output violates schema', async () => {
    const testSchema = z.object({ requiredField: z.string() });

    geminiClient.setMockClient({
      models: {
        generateContent: async () => ({
          text: JSON.stringify({ wrongField: 123 }),
        }),
      },
    });

    await assert.rejects(
      async () => {
        await geminiClient.generateStructuredJson({
          model: 'test-model',
          contents: 'Test',
          schema: testSchema,
        });
      },
      err => err.isSchemaError === true
    );
  });

  it('detects 429 rate limit error, sets cooldown, and model pool rotates to next model', async () => {
    const testSchema = z.object({ ok: z.boolean() });
    const model = 'gemini-3.5-flash-lite';
    modelPool.resetModelPool();

    geminiClient.setMockClient({
      models: {
        generateContent: async () => {
          const err = new Error('Resource has been exhausted (e.g. check quota).');
          err.status = 429;
          throw err;
        },
      },
    });

    await assert.rejects(async () => {
      await geminiClient.generateStructuredJson({
        model,
        contents: 'Test',
        schema: testSchema,
      });
    });

    // Model is in cooldown
    assert.equal(modelPool.isModelAvailable(model), false);

    // ModelPool picks next available persona model
    const nextModel = modelPool.getPersonaModel();
    assert.ok(nextModel);
    assert.notEqual(nextModel, model);
  });

  it('retries on 5xx transient server error', async () => {
    const testSchema = z.object({ success: z.boolean() });
    let attempts = 0;

    geminiClient.setMockClient({
      models: {
        generateContent: async () => {
          attempts++;
          if (attempts === 1) {
            const err = new Error('Internal Server Error');
            err.status = 503;
            throw err;
          }
          return {
            text: JSON.stringify({ success: true }),
          };
        },
      },
    });

    const res = await geminiClient.generateStructuredJson({
      model: 'test-model',
      contents: 'Ping',
      schema: testSchema,
    });

    assert.equal(res.success, true);
    assert.equal(attempts, 2);
  });

  it('aborts when AbortSignal triggers', async () => {
    const testSchema = z.object({ ok: z.boolean() });
    const abortController = new AbortController();

    geminiClient.setMockClient({
      models: {
        generateContent: async () => {
          // Never resolves
          return new Promise(() => {});
        },
      },
    });

    // Abort after 20ms
    setTimeout(() => abortController.abort(), 20);

    await assert.rejects(
      async () => {
        await geminiClient.generateStructuredJson({
          model: 'test-model',
          contents: 'Test',
          schema: testSchema,
          signal: abortController.signal,
        });
      },
      err => err.name === 'AbortError'
    );
  });
});
