// @ts-check
/**
 * @file src/orchestrator.js
 * @description Coordinates multi-agent execution, automatic degradation,
 * quota handling, LRU caching, and NDJSON event streaming.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import config from '../config.js';
import * as modelPool from './services/modelPool.js';
import * as cache from './services/cache.js';
import { exampleStore, findMatchingExample } from './services/exampleStore.js';
import { callPersona, callAllPersonas } from './agents/personas.js';
import { callJudge } from './agents/judge.js';
import { checkPlanSafety } from './services/safetyGuard.js';

export { findMatchingExample };

const PERSONA_NAMES = ['pessimist', 'accountant', 'skepticalParent', 'futureYou', 'optimist'];

/**
 * Emits an NDJSON event to the HTTP response stream.
 * @param {import('express').Response} res
 * @param {Object} event
 */
export function emitEvent(res, event) {
  if (res.writableEnded || res.destroyed) return;
  res.write(JSON.stringify(event) + '\n');
  // @ts-ignore
  if (typeof res.flush === 'function') {
    // @ts-ignore
    res.flush();
  }
}

/**
 * Streams a pre-saved example result with simulated delays.
 * @param {import('express').Response} res
 * @param {any} example
 * @param {AbortSignal} [signal]
 */
async function streamExample(res, example, signal) {
  emitEvent(res, { event: 'mode_selected', mode: 'demo' });

  for (const name of PERSONA_NAMES) {
    if (signal?.aborted) return;
    await new Promise(r => setTimeout(r, 80));
    if (example.personas?.[name]) {
      emitEvent(res, {
        event: 'persona_done',
        persona: name,
        data: example.personas[name],
        model: 'pre-saved-benchmark',
      });
    }
  }

  if (signal?.aborted) return;
  await new Promise(r => setTimeout(r, 120));

  emitEvent(res, {
    event: 'judge_done',
    data: example.judge,
    model: 'pre-saved-benchmark',
  });
}

/**
 * Main review execution entry point.
 * @param {Object} params
 * @param {string} params.plan
 * @param {'auto' | 'live' | 'quick' | 'demo'} [params.mode]
 * @param {string} [params.exampleId]
 * @param {import('express').Response} params.res
 * @param {AbortSignal} [params.signal]
 */
export async function runReview({ plan, mode = 'auto', exampleId, res, signal }) {
  // 0. Safety Guard: Check for crisis/self-harm before any caching, demo-matching, or API calls
  const safetyCheck = checkPlanSafety(plan);
  if (safetyCheck.isTriggered) {
    emitEvent(res, {
      event: 'safety',
      mode: 'support',
      message: safetyCheck.message,
    });
    return;
  }

  // 1. Check if matching benchmark example exists
  const matchedExample = findMatchingExample(plan, exampleId);

  // 2. In DEMO_MODE or explicit demo mode
  if (config.DEMO_MODE || mode === 'demo') {
    if (matchedExample) {
      await streamExample(res, matchedExample, signal);
      return;
    }

    if (config.DEMO_MODE) {
      emitEvent(res, {
        event: 'error',
        message: 'DEMO_MODE is active. Custom plans cannot be processed without live API calls.',
        code: 'demo_only',
        retryAfterSeconds: null,
        sampleAvailable: true,
      });
      return;
    }

    // Explicit mode=demo without match: serve the first benchmark sample
    const fallbackExample = Array.from(exampleStore.values())[0];
    if (fallbackExample) {
      await streamExample(res, fallbackExample, signal);
      return;
    }
  }

  // If exampleId was supplied and matched, stream it
  if (matchedExample && exampleId) {
    await streamExample(res, matchedExample, signal);
    return;
  }

  // Check in-memory LRU cache
  const cachedResult = cache.get(plan, mode);
  if (cachedResult) {
    emitEvent(res, { event: 'mode_selected', mode: cachedResult.modeUsed || 'live' });
    for (const [persona, data] of Object.entries(cachedResult.personas || {})) {
      emitEvent(res, {
        event: 'persona_done',
        persona,
        data,
        model: cachedResult.personaModels?.[persona] || 'cached',
      });
    }
    emitEvent(res, {
      event: 'judge_done',
      data: cachedResult.judge,
      model: cachedResult.judgeModel || 'cached',
    });
    return;
  }

  // Determine starting mode
  let effectiveMode = mode;
  if (effectiveMode === 'auto') {
    effectiveMode = modelPool.determineAutoMode();
  }

  // Try live mode if selected
  if (effectiveMode === 'live') {
    emitEvent(res, { event: 'mode_selected', mode: 'live' });
    const success = await executeLiveMode({ plan, res, signal });
    if (success) return;

    // Degrade to quick mode
    emitEvent(res, {
      event: 'degraded',
      from: 'live',
      to: 'quick',
      reason: 'Fewer than 3 personas succeeded in parallel live mode',
    });
    effectiveMode = 'quick';
  }

  // Try quick mode
  if (effectiveMode === 'quick') {
    // If not already announced in live mode, announce quick mode
    if (mode === 'quick' || mode === 'auto') {
      emitEvent(res, { event: 'mode_selected', mode: 'quick' });
    }
    const success = await executeQuickMode({ plan, res, signal });
    if (success) return;
  }

  // Final degradation step:
  // Check if submitted plan matches one of the 3 pre-saved examples
  const matched = findMatchingExample(plan, exampleId);
  if (matched) {
    emitEvent(res, {
      event: 'degraded',
      from: 'quick',
      to: 'demo',
      reason: 'API quota exhausted; loaded pre-saved benchmark analysis',
    });
    await streamExample(res, matched, signal);
    return;
  }

  // Custom plan — NEVER serve an unrelated cached example!
  emitEvent(res, {
    event: 'error',
    message: 'AI review capacity is currently congested. Please wait a moment or try one of the benchmark samples.',
    code: 'busy',
    retryAfterSeconds: config.QUOTAS.DEFAULT_COOLDOWN_SECONDS,
    sampleAvailable: true,
  });
}

/**
 * Executes 5 personas in parallel with single retry and continues to Judge.
 * @param {Object} params
 * @param {string} params.plan
 * @param {import('express').Response} params.res
 * @param {AbortSignal} [params.signal]
 * @returns {Promise<boolean>} True if completed successfully
 */
async function executeLiveMode({ plan, res, signal }) {
  const personaResults = {};
  const personaModels = {};
  const failedPersonas = [];

  const personaPromises = PERSONA_NAMES.map(async personaName => {
    if (signal?.aborted) return;
    const model = modelPool.getPersonaModel();
    if (!model) {
      failedPersonas.push(personaName);
      emitEvent(res, {
        event: 'persona_failed',
        persona: personaName,
        error: 'No healthy persona models available',
        model: 'none',
      });
      return;
    }

    try {
      const result = await callPersona(personaName, plan, model, signal);
      personaResults[personaName] = result;
      personaModels[personaName] = model;
      emitEvent(res, { event: 'persona_done', persona: personaName, data: result, model });
    } catch (firstErr) {
      if (signal?.aborted) return;
      // Retry ONCE on another healthy model
      const fallbackModel = modelPool.getPersonaModel([model]);
      if (fallbackModel) {
        try {
          const retryResult = await callPersona(personaName, plan, fallbackModel, signal);
          personaResults[personaName] = retryResult;
          personaModels[personaName] = fallbackModel;
          emitEvent(res, { event: 'persona_done', persona: personaName, data: retryResult, model: fallbackModel });
          return;
        } catch {
          // Retry failed as well
        }
      }
      failedPersonas.push(personaName);
      emitEvent(res, {
        event: 'persona_failed',
        persona: personaName,
        error: firstErr?.message || 'Persona analysis failed',
        model: fallbackModel || model,
      });
    }
  });

  await Promise.allSettled(personaPromises);

  if (signal?.aborted) return true;

  const successfulCount = Object.keys(personaResults).length;
  if (successfulCount < 3) {
    return false; // Trigger degradation to quick mode
  }

  // Continue to Judge through fallback chain
  const triedJudgeModels = [];
  let judgeResult = null;
  let selectedJudgeModel = null;

  while (true) {
    if (signal?.aborted) return false;
    const judgeModel = modelPool.getJudgeModel(triedJudgeModels);
    if (!judgeModel) break;
    triedJudgeModels.push(judgeModel);

    try {
      judgeResult = await callJudge(
        personaResults,
        failedPersonas,
        plan,
        'live',
        judgeModel,
        signal
      );
      selectedJudgeModel = judgeModel;
      break;
    } catch {
      // Continue to next judge model in fallback chain
    }
  }

  if (!judgeResult) {
    return false;
  }

  emitEvent(res, { event: 'judge_done', data: judgeResult, model: selectedJudgeModel });

  // Store in LRU cache
  cache.set(plan, 'live', {
    modeUsed: 'live',
    personas: personaResults,
    personaModels,
    judge: judgeResult,
    judgeModel: selectedJudgeModel,
  });

  return true;
}

/**
 * Executes a single combined call for all 5 personas, then calls the Judge.
 * @param {Object} params
 * @param {string} params.plan
 * @param {import('express').Response} params.res
 * @param {AbortSignal} [params.signal]
 * @returns {Promise<boolean>} True if completed successfully
 */
async function executeQuickMode({ plan, res, signal }) {
  if (signal?.aborted) return false;

  const personaModel = modelPool.getPersonaModel();
  if (!personaModel) return false;

  let personasData;
  let usedPersonaModel = personaModel;
  try {
    personasData = await callAllPersonas(plan, personaModel, signal);
  } catch {
    // Retry once on fallback model
    const fallbackModel = modelPool.getPersonaModel([personaModel]);
    if (!fallbackModel) return false;
    try {
      personasData = await callAllPersonas(plan, fallbackModel, signal);
      usedPersonaModel = fallbackModel;
    } catch {
      return false;
    }
  }

  if (signal?.aborted) return false;

  // Emit persona_done for each persona
  for (const name of PERSONA_NAMES) {
    if (personasData[name]) {
      emitEvent(res, {
        event: 'persona_done',
        persona: name,
        data: personasData[name],
        model: usedPersonaModel,
      });
    }
  }

  // Continue to Judge through fallback chain
  const triedJudgeModels = [];
  let judgeResult = null;
  let selectedJudgeModel = null;

  while (true) {
    if (signal?.aborted) return false;
    const judgeModel = modelPool.getJudgeModel(triedJudgeModels);
    if (!judgeModel) break;
    triedJudgeModels.push(judgeModel);

    try {
      judgeResult = await callJudge(
        personasData,
        [],
        plan,
        'quick',
        judgeModel,
        signal
      );
      selectedJudgeModel = judgeModel;
      break;
    } catch {
      // Continue to next judge model
    }
  }

  if (!judgeResult) {
    return false;
  }

  emitEvent(res, { event: 'judge_done', data: judgeResult, model: selectedJudgeModel });

  // Store in LRU cache
  cache.set(plan, 'quick', {
    modeUsed: 'quick',
    personas: personasData,
    personaModels: Object.fromEntries(PERSONA_NAMES.map(p => [p, usedPersonaModel])),
    judge: judgeResult,
    judgeModel: selectedJudgeModel,
  });

  return true;
}

