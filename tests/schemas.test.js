import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ReviewRequestSchema,
  PersonaOutputSchema,
  QuickPersonasOutputSchema,
  JudgeOutputSchema,
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
  });
});
