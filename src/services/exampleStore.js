// @ts-check
/**
 * @file src/services/exampleStore.js
 * @description In-memory store and validator for benchmark example plans in /data/examples/*.json.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PersonaOutputSchema, JudgeOutputSchema } from '../validation/schemas.js';

/**
 * Normalizes text for comparison: trims, collapses whitespace, lowercases,
 * and strips trailing punctuation.
 * @param {string} [text]
 * @returns {string}
 */
export function normalizeText(text) {
  if (typeof text !== 'string') return '';
  return text
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .replace(/[.,!?;:]+$/, '');
}

/**
 * Validates and loads all example benchmark JSON files.
 * @returns {Map<string, any>}
 */
export function loadAndValidateExamples() {
  const store = new Map();
  const dir = join(process.cwd(), 'data', 'examples');

  const files = readdirSync(dir).filter(f => f.endsWith('.json'));
  for (const file of files) {
    const raw = readFileSync(join(dir, file), 'utf-8');
    const data = JSON.parse(raw);

    // Validate structure against schemas
    if (!data.exampleId || !data.planText || !data.personas || !data.judge) {
      throw new Error(`Example file ${file} is missing required fields`);
    }

    const personaKeys = ['pessimist', 'accountant', 'skepticalParent', 'futureYou', 'optimist'];
    for (const key of personaKeys) {
      const pRes = PersonaOutputSchema.safeParse(data.personas[key]);
      if (!pRes.success) {
        throw new Error(`Example file ${file} has invalid persona '${key}': ${pRes.error.message}`);
      }
    }

    const jRes = JudgeOutputSchema.safeParse(data.judge);
    if (!jRes.success) {
      throw new Error(`Example file ${file} has invalid judge output: ${jRes.error.message}`);
    }

    store.set(data.exampleId, data);
  }

  return store;
}

export const exampleStore = loadAndValidateExamples();

/**
 * Finds a matching example benchmark plan by ID or normalized plan/title text.
 * A custom plan must strictly return null.
 * @param {string} plan
 * @param {string} [exampleId]
 * @returns {any | null}
 */
export function findMatchingExample(plan, exampleId) {
  if (exampleId && exampleStore.has(exampleId)) {
    return exampleStore.get(exampleId);
  }

  const normInput = normalizeText(plan);
  if (!normInput) return null;

  for (const example of exampleStore.values()) {
    const normTitle = normalizeText(example.title);
    const normPlan = normalizeText(example.planText);

    // Match exact normalized title or exact normalized plan text
    if (normInput === normTitle || normInput === normPlan) {
      return example;
    }
  }

  return null;
}
