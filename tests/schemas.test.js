import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ReviewRequestSchema,
  PersonaOutputSchema,
  QuickPersonasOutputSchema,
  JudgeOutputSchema,
  KeyTensionSchema,
  JudgeJsonSchema,
} from '../src/validation/schemas.js';

describe('schemas.js', () => {
  describe('ReviewRequestSchema', () => {
    it('accepts valid review payload', () => {
      const res = ReviewRequestSchema.safeParse({
        plan: 'I am launching a new product.',
        mode: 'live',
      });
      assert.ok(res.success);
      assert.equal(res.data.mode, 'live');
    });

    it('rejects empty plan', () => {
      const res = ReviewRequestSchema.safeParse({ plan: '   ' });
      assert.equal(res.success, false);
    });

    it('rejects plan exceeding 2000 characters', () => {
      const longPlan = 'a'.repeat(2001);
      const res = ReviewRequestSchema.safeParse({ plan: longPlan });
      assert.equal(res.success, false);
    });

    it('rejects invalid execution mode', () => {
      const res = ReviewRequestSchema.safeParse({
        plan: 'Valid plan',
        mode: 'unsupported_mode',
      });
      assert.equal(res.success, false);
    });
  });

  describe('PersonaOutputSchema', () => {
    it('validates a conforming persona output', () => {
      const res = PersonaOutputSchema.safeParse({
        headline: 'Critical financial flaw detected',
        points: [
          {
            claim: 'Runway is too short',
            severity: 5,
            suggestedFix: 'Raise $20k before resigning',
          },
        ],
        verdict: 'High chance of early insolvency',
      });
      assert.ok(res.success);
    });

    it('rejects severity outside 1-5 range', () => {
      const res = PersonaOutputSchema.safeParse({
        headline: 'Test',
        points: [{ claim: 'Risk', severity: 6, suggestedFix: 'Fix' }],
        verdict: 'Verdict',
      });
      assert.equal(res.success, false);
    });
  });

  describe('QuickPersonasOutputSchema', () => {
    it('requires all 5 persona objects', () => {
      const samplePersona = {
        headline: 'Sample',
        points: [{ claim: 'Point', severity: 3, suggestedFix: 'Fix' }],
        verdict: 'Verdict',
      };
      const res = QuickPersonasOutputSchema.safeParse({
        pessimist: samplePersona,
        accountant: samplePersona,
        skepticalParent: samplePersona,
        futureYou: samplePersona,
        optimist: samplePersona,
      });
      assert.ok(res.success);
    });

    it('fails if one persona key is missing', () => {
      const samplePersona = {
        headline: 'Sample',
        points: [{ claim: 'Point', severity: 3, suggestedFix: 'Fix' }],
        verdict: 'Verdict',
      };
      const res = QuickPersonasOutputSchema.safeParse({
        pessimist: samplePersona,
        accountant: samplePersona,
      });
      assert.equal(res.success, false);
    });
  });

  describe('JudgeOutputSchema', () => {
    it('validates a conforming Judge output with exactly 3 top risks', () => {
      const res = JudgeOutputSchema.safeParse({
        survivalScoreBefore: 20,
        survivalScoreAfter: 75,
        rationale: 'Solid mitigation strategy',
        topRisks: ['Risk A', 'Risk B', 'Risk C'],
        hardenedPlan: 'Phase 1... Phase 2...',
        actionItems: [{ task: 'Do X', dueInDays: 14 }],
        unresolvedQuestions: ['Question A'],
        missingPersonas: ['skepticalParent'],
        modeUsed: 'live',
      });
      assert.ok(res.success);
    });

    it('fails if topRisks does not have exactly 3 items', () => {
      const res = JudgeOutputSchema.safeParse({
        survivalScoreBefore: 20,
        survivalScoreAfter: 75,
        rationale: 'Rationale',
        topRisks: ['Only one risk'],
        hardenedPlan: 'Plan',
        actionItems: [],
        unresolvedQuestions: [],
        missingPersonas: [],
        modeUsed: 'quick',
      });
      assert.equal(res.success, false);
    });

    it('validates keyTensions array up to 2 items and defaults to empty array', () => {
      const validWithTensions = JudgeOutputSchema.safeParse({
        survivalScoreBefore: 23,
        survivalScoreAfter: 52,
        rationale: 'Solid plan',
        topRisks: ['R1', 'R2', 'R3'],
        hardenedPlan: 'Plan',
        actionItems: [{ task: 'T1', dueInDays: 7 }],
        keyTensions: [
          { topic: 'Timeline vs Scope', summary: 'Resolved via phased MVP' },
          { topic: 'Burn rate vs Handoff', summary: 'Resolved via hybrid consulting' },
        ],
        unresolvedQuestions: [],
        missingPersonas: [],
        modeUsed: 'live',
      });
      assert.ok(validWithTensions.success);
      assert.equal(validWithTensions.data.keyTensions.length, 2);

      // Rejects more than 2 key tensions
      const invalidExcessive = JudgeOutputSchema.safeParse({
        survivalScoreBefore: 23,
        survivalScoreAfter: 52,
        rationale: 'Solid plan',
        topRisks: ['R1', 'R2', 'R3'],
        hardenedPlan: 'Plan',
        actionItems: [{ task: 'T1', dueInDays: 7 }],
        keyTensions: [
          { topic: 'T1', summary: 'S1' },
          { topic: 'T2', summary: 'S2' },
          { topic: 'T3', summary: 'S3' },
        ],
        unresolvedQuestions: [],
        missingPersonas: [],
        modeUsed: 'live',
      });
      assert.equal(invalidExcessive.success, false);
    });
  });

  describe('KeyTensionSchema', () => {
    it('accepts valid topic and summary', () => {
      const res = KeyTensionSchema.safeParse({
        topic: 'Resignation timing',
        summary: 'Pessimist favored staying employed while Optimist pushed for speed.',
      });
      assert.ok(res.success);
    });

    it('rejects topic exceeding 80 characters', () => {
      const res = KeyTensionSchema.safeParse({
        topic: 'A'.repeat(81),
        summary: 'Summary text',
      });
      assert.equal(res.success, false);
    });

    it('rejects summary exceeding 220 characters', () => {
      const res = KeyTensionSchema.safeParse({
        topic: 'Topic',
        summary: 'B'.repeat(221),
      });
      assert.equal(res.success, false);
    });
  });

  describe('JudgeJsonSchema', () => {
    it('requires keyTensions in the JSON schema sent to Gemini', () => {
      assert.ok(Array.isArray(JudgeJsonSchema.required));
      assert.ok(JudgeJsonSchema.required.includes('keyTensions'));
      assert.equal(JudgeJsonSchema.properties.keyTensions.type, 'array');
      assert.equal(JudgeJsonSchema.properties.keyTensions.maxItems, 2);
    });
  });
});
