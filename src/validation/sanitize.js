// @ts-check
/**
 * @file src/validation/sanitize.js
 * @description Pre-validation sanitizer for Gemini model outputs.
 * Truncates over-length strings at word boundaries and truncates arrays to maximum limits,
 * while allowing Zod to enforce schema types and required fields.
 */

import config from '../../config.js';

const { SCHEMA_LIMITS } = config;

/**
 * Truncates a string to at most maxLength, cutting at the last whitespace boundary
 * within the limit to prevent broken words.
 *
 * @param {any} val - Input value
 * @param {number} maxLength - Maximum allowable characters
 * @returns {any} Truncated string or original value if not a string
 */
export function truncateAtWordBoundary(val, maxLength) {
  if (typeof val !== 'string' || val.length <= maxLength) {
    return val;
  }

  const slice = val.slice(0, maxLength);
  const lastSpace = slice.lastIndexOf(' ');

  if (lastSpace > 0) {
    return slice.slice(0, lastSpace).trim();
  }

  return slice.trim();
}

/**
 * Sanitizes an individual persona output object before Zod validation.
 * @param {any} data
 * @returns {any}
 */
export function sanitizePersonaOutput(data) {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const copy = { ...data };

  if (typeof copy.headline === 'string') {
    copy.headline = truncateAtWordBoundary(copy.headline, SCHEMA_LIMITS.PERSONA_MAX_HEADLINE);
  }

  if (typeof copy.verdict === 'string') {
    copy.verdict = truncateAtWordBoundary(copy.verdict, SCHEMA_LIMITS.PERSONA_MAX_VERDICT);
  }

  if (Array.isArray(copy.points)) {
    copy.points = copy.points
      .slice(0, SCHEMA_LIMITS.PERSONA_MAX_POINTS)
      .map(pt => {
        if (!pt || typeof pt !== 'object') return pt;
        const ptCopy = { ...pt };
        if (typeof ptCopy.claim === 'string') {
          ptCopy.claim = truncateAtWordBoundary(ptCopy.claim, SCHEMA_LIMITS.PERSONA_MAX_CLAIM);
        }
        if (typeof ptCopy.suggestedFix === 'string') {
          ptCopy.suggestedFix = truncateAtWordBoundary(ptCopy.suggestedFix, SCHEMA_LIMITS.PERSONA_MAX_FIX);
        }
        return ptCopy;
      });
  }

  return copy;
}

/**
 * Sanitizes quick-mode combined personas output before Zod validation.
 * @param {any} data
 * @returns {any}
 */
export function sanitizeQuickPersonasOutput(data) {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const copy = { ...data };
  const personas = ['pessimist', 'accountant', 'skepticalParent', 'futureYou', 'optimist'];

  for (const name of personas) {
    if (copy[name]) {
      copy[name] = sanitizePersonaOutput(copy[name]);
    }
  }

  return copy;
}

/**
 * Sanitizes Judge output before Zod validation.
 * @param {any} data
 * @returns {any}
 */
export function sanitizeJudgeOutput(data) {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const copy = { ...data };

  if (typeof copy.rationale === 'string') {
    copy.rationale = truncateAtWordBoundary(copy.rationale, SCHEMA_LIMITS.JUDGE_MAX_RATIONALE);
  }

  if (typeof copy.hardenedPlan === 'string') {
    copy.hardenedPlan = truncateAtWordBoundary(copy.hardenedPlan, SCHEMA_LIMITS.JUDGE_MAX_HARDENED_PLAN);
  }

  if (Array.isArray(copy.topRisks)) {
    copy.topRisks = copy.topRisks
      .slice(0, SCHEMA_LIMITS.JUDGE_TOP_RISKS_COUNT)
      .map(r => (typeof r === 'string' ? truncateAtWordBoundary(r, SCHEMA_LIMITS.JUDGE_MAX_RISK) : r));
  }

  if (Array.isArray(copy.actionItems)) {
    copy.actionItems = copy.actionItems
      .slice(0, SCHEMA_LIMITS.JUDGE_MAX_ACTION_ITEMS)
      .map(item => {
        if (!item || typeof item !== 'object') return item;
        const itemCopy = { ...item };
        if (typeof itemCopy.task === 'string') {
          itemCopy.task = truncateAtWordBoundary(itemCopy.task, SCHEMA_LIMITS.JUDGE_MAX_ACTION_TASK);
        }
        return itemCopy;
      });
  }

  if (Array.isArray(copy.keyTensions)) {
    copy.keyTensions = copy.keyTensions
      .slice(0, SCHEMA_LIMITS.JUDGE_MAX_KEY_TENSIONS)
      .map(t => {
        if (!t || typeof t !== 'object') return t;
        const tCopy = { ...t };
        if (typeof tCopy.topic === 'string') {
          tCopy.topic = truncateAtWordBoundary(tCopy.topic, SCHEMA_LIMITS.JUDGE_MAX_KEY_TENSION_TOPIC);
        }
        if (typeof tCopy.summary === 'string') {
          tCopy.summary = truncateAtWordBoundary(tCopy.summary, SCHEMA_LIMITS.JUDGE_MAX_KEY_TENSION_SUMMARY);
        }
        return tCopy;
      });
  }

  if (Array.isArray(copy.unresolvedQuestions)) {
    copy.unresolvedQuestions = copy.unresolvedQuestions
      .slice(0, SCHEMA_LIMITS.JUDGE_MAX_UNRESOLVED_QUESTIONS)
      .map(q => (typeof q === 'string' ? truncateAtWordBoundary(q, SCHEMA_LIMITS.JUDGE_MAX_QUESTION) : q));
  }

  return copy;
}

/**
 * Automatically routes input to appropriate sanitizer based on schema or object shape.
 * @param {any} rawJson
 * @param {import('zod').ZodSchema} [schema]
 * @returns {any} Sanitized object
 */
export function sanitizeModelOutput(rawJson, schema) {
  if (!rawJson || typeof rawJson !== 'object') {
    return rawJson;
  }

  // If Judge output shape
  if ('survivalScoreBefore' in rawJson || 'hardenedPlan' in rawJson) {
    return sanitizeJudgeOutput(rawJson);
  }

  // If Quick Personas output shape
  if ('pessimist' in rawJson && 'accountant' in rawJson && 'optimist' in rawJson) {
    return sanitizeQuickPersonasOutput(rawJson);
  }

  // If Single Persona output shape
  if ('headline' in rawJson || 'verdict' in rawJson || 'points' in rawJson) {
    return sanitizePersonaOutput(rawJson);
  }

  return rawJson;
}
