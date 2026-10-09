// @ts-check
/**
 * @file src/validation/schemas.js
 * @description Zod validation schemas for input requests and agent outputs.
 */

import { z } from 'zod';
import config from '../../config.js';

const { SCHEMA_LIMITS, MAX_PLAN_LENGTH, MIN_PLAN_LENGTH } = config;

/**
 * Valid execution modes.
 */
export const ExecutionModeSchema = z.enum(['auto', 'live', 'quick', 'demo']);

/**
 * Review request schema.
 */
export const ReviewRequestSchema = z.object({
  plan: z
    .string()
    .trim()
    .min(MIN_PLAN_LENGTH, { message: 'Plan cannot be empty' })
    .max(MAX_PLAN_LENGTH, { message: `Plan cannot exceed ${MAX_PLAN_LENGTH} characters` }),
  mode: ExecutionModeSchema.default('auto').optional(),
  exampleId: z.string().trim().max(100).optional(),
});

/**
 * Single critique point from a persona.
 */
export const PersonaPointSchema = z.object({
  claim: z.string().trim().max(SCHEMA_LIMITS.PERSONA_MAX_CLAIM),
  severity: z.number().int().min(1).max(5),
  suggestedFix: z.string().trim().max(SCHEMA_LIMITS.PERSONA_MAX_FIX),
});

/**
 * Output schema for an individual persona.
 */
export const PersonaOutputSchema = z.object({
  headline: z.string().trim().max(SCHEMA_LIMITS.PERSONA_MAX_HEADLINE),
  points: z.array(PersonaPointSchema).max(SCHEMA_LIMITS.PERSONA_MAX_POINTS),
  verdict: z.string().trim().max(SCHEMA_LIMITS.PERSONA_MAX_VERDICT),
});

/**
 * Output schema for quick mode (single call containing all 5 personas).
 */
export const QuickPersonasOutputSchema = z.object({
  pessimist: PersonaOutputSchema,
  accountant: PersonaOutputSchema,
  skepticalParent: PersonaOutputSchema,
  futureYou: PersonaOutputSchema,
  optimist: PersonaOutputSchema,
});

/**
 * Action item in hardened plan.
 */
export const ActionItemSchema = z.object({
  task: z.string().trim().max(SCHEMA_LIMITS.JUDGE_MAX_ACTION_TASK),
  dueInDays: z.number().int().min(1).max(365),
});

/**
 * Key tension between personas.
 */
export const KeyTensionSchema = z.object({
  topic: z.string().trim().max(SCHEMA_LIMITS.JUDGE_MAX_KEY_TENSION_TOPIC),
  summary: z.string().trim().max(SCHEMA_LIMITS.JUDGE_MAX_KEY_TENSION_SUMMARY),
});

/**
 * Output schema for the Judge agent.
 */
export const JudgeOutputSchema = z.object({
  survivalScoreBefore: z.number().int().min(1).max(100),
  survivalScoreAfter: z.number().int().min(1).max(100),
  rationale: z.string().trim().max(SCHEMA_LIMITS.JUDGE_MAX_RATIONALE),
  topRisks: z
    .array(z.string().trim().max(SCHEMA_LIMITS.JUDGE_MAX_RISK))
    .length(SCHEMA_LIMITS.JUDGE_TOP_RISKS_COUNT),
  hardenedPlan: z.string().trim().max(SCHEMA_LIMITS.JUDGE_MAX_HARDENED_PLAN),
  actionItems: z.array(ActionItemSchema).max(SCHEMA_LIMITS.JUDGE_MAX_ACTION_ITEMS),
  keyTensions: z
    .array(KeyTensionSchema)
    .max(SCHEMA_LIMITS.JUDGE_MAX_KEY_TENSIONS)
    .default([]),
  unresolvedQuestions: z
    .array(z.string().trim().max(SCHEMA_LIMITS.JUDGE_MAX_QUESTION))
    .max(SCHEMA_LIMITS.JUDGE_MAX_UNRESOLVED_QUESTIONS),
  missingPersonas: z.array(z.string().trim()).default([]),
  modeUsed: z.enum(['live', 'quick', 'demo']),
});

/**
 * JSON Schema for Judge Output (with keyTensions explicitly required).
 */
export const JudgeJsonSchema = {
  type: 'object',
  properties: {
    survivalScoreBefore: { type: 'integer', minimum: 1, maximum: 100 },
    survivalScoreAfter: { type: 'integer', minimum: 1, maximum: 100 },
    rationale: { type: 'string', maxLength: SCHEMA_LIMITS.JUDGE_MAX_RATIONALE },
    topRisks: {
      type: 'array',
      items: { type: 'string', maxLength: SCHEMA_LIMITS.JUDGE_MAX_RISK },
      minItems: SCHEMA_LIMITS.JUDGE_TOP_RISKS_COUNT,
      maxItems: SCHEMA_LIMITS.JUDGE_TOP_RISKS_COUNT,
    },
    hardenedPlan: { type: 'string', maxLength: SCHEMA_LIMITS.JUDGE_MAX_HARDENED_PLAN },
    actionItems: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          task: { type: 'string', maxLength: SCHEMA_LIMITS.JUDGE_MAX_ACTION_TASK },
          dueInDays: { type: 'integer', minimum: 1, maximum: 365 },
        },
        required: ['task', 'dueInDays'],
      },
      maxItems: SCHEMA_LIMITS.JUDGE_MAX_ACTION_ITEMS,
    },
    keyTensions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          topic: { type: 'string', maxLength: SCHEMA_LIMITS.JUDGE_MAX_KEY_TENSION_TOPIC },
          summary: { type: 'string', maxLength: SCHEMA_LIMITS.JUDGE_MAX_KEY_TENSION_SUMMARY },
        },
        required: ['topic', 'summary'],
      },
      maxItems: SCHEMA_LIMITS.JUDGE_MAX_KEY_TENSIONS,
    },
    unresolvedQuestions: {
      type: 'array',
      items: { type: 'string', maxLength: SCHEMA_LIMITS.JUDGE_MAX_QUESTION },
      maxItems: SCHEMA_LIMITS.JUDGE_MAX_UNRESOLVED_QUESTIONS,
    },
    missingPersonas: {
      type: 'array',
      items: { type: 'string' },
    },
    modeUsed: {
      type: 'string',
      enum: ['live', 'quick', 'demo'],
    },
  },
  required: [
    'survivalScoreBefore',
    'survivalScoreAfter',
    'rationale',
    'topRisks',
    'hardenedPlan',
    'actionItems',
    'keyTensions',
    'unresolvedQuestions',
  ],
};
