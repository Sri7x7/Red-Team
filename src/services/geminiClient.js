// @ts-check
/**
 * @file src/services/geminiClient.js
 * @description Wrapper for @google/genai SDK with timeout, retry with backoff, abort handling,
 * quota tracking, and strict output schema validation.
 */

import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import config from '../../config.js';
import * as modelPool from './modelPool.js';
import { sanitizeModelOutput } from '../validation/sanitize.js';

/** @type {any} */
let customClient = null;

/**
 * Allows tests to supply a mock Gemini client.
 * @param {any} client
 */
export function setMockClient(client) {
  customClient = client;
}

/**
 * Gets or instantiates the Gemini SDK client.
 * @returns {any}
 */
export function getClient() {
  if (customClient) return customClient;
  if (!config.GEMINI_API_KEY && !config.DEMO_MODE) {
    throw new Error('GEMINI_API_KEY environment variable is required');
  }
  return new GoogleGenAI({ apiKey: config.GEMINI_API_KEY });
}

/**
 * Checks if an error represents an HTTP 429 or quota limit exhaustion.
 * @param {any} error
 * @returns {boolean}
 */
export function isRateLimitError(error) {
  if (!error) return false;
  const status = error.status || error.code || error.statusCode;
  if (status === 429) return true;
  const message = String(error.message || '');
  return message.includes('429') || message.includes('RESOURCE_EXHAUSTED');
}

/**
 * Extracts Retry-After in seconds from an error if available.
 * @param {any} error
 * @returns {number | null}
 */
export function extractRetryAfter(error) {
  try {
    if (error?.response?.headers) {
      const header = error.response.headers.get?.('retry-after') || error.response.headers['retry-after'];
      if (header) {
        const parsed = parseInt(header, 10);
        if (!isNaN(parsed) && parsed > 0) return parsed;
      }
    }
  } catch {
    // Ignore header extraction failure
  }
  return null;
}

/**
 * Wraps a promise with an AbortSignal and timeout.
 * @template T
 * @param {Promise<T>} promise
 * @param {number} timeoutMs
 * @param {AbortSignal} [signal]
 * @returns {Promise<T>}
 */
function withAbortAndTimeout(promise, timeoutMs, signal) {
  let timerId;

  const timeoutPromise = new Promise((_, reject) => {
    timerId = setTimeout(() => {
      const timeoutError = new Error(`Gemini request timed out after ${timeoutMs}ms`);
      timeoutError.name = 'TimeoutError';
      reject(timeoutError);
    }, timeoutMs);
  });

  const abortPromise = new Promise((_, reject) => {
    if (signal) {
      if (signal.aborted) {
        const abortError = new Error('Request aborted by client');
        abortError.name = 'AbortError';
        reject(abortError);
        return;
      }
      signal.addEventListener('abort', () => {
        const abortError = new Error('Request aborted by client');
        abortError.name = 'AbortError';
        reject(abortError);
      }, { once: true });
    }
  });

  return Promise.race([promise, timeoutPromise, abortPromise]).finally(() => {
    clearTimeout(timerId);
  });
}

/**
 * @typedef {Object} GenerateOptions
 * @property {string} model - Model identifier
 * @property {string} [systemInstruction] - Role prompt
 * @property {string} contents - User message content
 * @property {import('zod').ZodSchema} schema - Zod schema to validate against
 * @property {string} [thinkingLevel] - 'MINIMAL' | 'LOW' | 'MEDIUM' | 'HIGH'
 * @property {AbortSignal} [signal] - Client disconnect abort signal
 */

/**
 * Executes a Gemini request with timeouts, retries, quota tracking, and schema validation.
 * @param {GenerateOptions} options
 * @returns {Promise<any>} Parsed and validated JSON data
 */
export async function generateStructuredJson(options) {
  const {
    model,
    systemInstruction,
    contents,
    schema,
    thinkingLevel = config.THINKING_LEVEL_PERSONA,
    signal,
  } = options;

  const client = getClient();
  let attempts = 0;
  const maxRetries = config.QUOTAS.MAX_RETRIES;

  let currentThinking = thinkingLevel;

  while (attempts <= maxRetries) {
    if (signal?.aborted) {
      const err = new Error('Request aborted by client');
      err.name = 'AbortError';
      throw err;
    }

    try {
      // Record request for sliding-window RPM & daily counts
      modelPool.recordRequest(model);

      const requestConfig = {
        responseMimeType: 'application/json',
      };

      if (systemInstruction) {
        // @ts-ignore
        requestConfig.systemInstruction = systemInstruction;
      }

      // Minimal/low thinking for efficiency
      if (currentThinking && ThinkingLevel[currentThinking]) {
        // @ts-ignore
        requestConfig.thinkingConfig = {
          thinkingLevel: ThinkingLevel[currentThinking],
        };
      }

      // Search grounding if enabled
      if (config.GROUNDING_ENABLED) {
        // @ts-ignore
        requestConfig.tools = [{ googleSearch: {} }];
      }

      const apiCall = client.models.generateContent({
        model,
        contents,
        config: requestConfig,
      });

      const response = await withAbortAndTimeout(
        apiCall,
        config.QUOTAS.CALL_TIMEOUT_MS,
        signal
      );

      const text = response?.text?.trim() || '';
      let rawJson;
      try {
        rawJson = JSON.parse(text);
      } catch {
        throw new Error('Model failed to return valid JSON');
      }

      // Sanitize over-length strings at word boundaries and drop excess array items
      const sanitizedJson = sanitizeModelOutput(rawJson, schema);

      // Strict output validation against zod schema
      const parseResult = schema.safeParse(sanitizedJson);
      if (!parseResult.success) {
        const validationError = new Error(
          `Model output failed schema validation: ${parseResult.error.message}`
        );
        // @ts-ignore
        validationError.isSchemaError = true;
        throw validationError;
      }

      return parseResult.data;
    } catch (err) {
      if (err.name === 'AbortError') {
        throw err;
      }

      // Check if thinking level MINIMAL was rejected and retry with LOW
      if (currentThinking === 'MINIMAL' && String(err.message || '').includes('Thinking level MINIMAL is not supported')) {
        currentThinking = 'LOW';
        continue;
      }

      // Rate limit / 429 handling
      if (isRateLimitError(err)) {
        const retryAfter = extractRetryAfter(err);
        modelPool.recordCooldown(model, retryAfter);
        throw err;
      }

      // Check if retryable transient error (5xx or network)
      const status = err.status || err.code;
      const isTransient = status >= 500 && status < 600;

      if (isTransient && attempts < maxRetries) {
        attempts += 1;
        const delay = config.QUOTAS.RETRY_BACKOFF_BASE_MS * Math.pow(2, attempts - 1);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }

      throw err;
    }
  }
}
