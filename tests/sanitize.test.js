import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  truncateAtWordBoundary,
  sanitizePersonaOutput,
  sanitizeJudgeOutput,
  sanitizeQuickPersonasOutput,
} from '../src/validation/sanitize.js';
import {
  PersonaOutputSchema,
  JudgeOutputSchema,
  QuickPersonasOutputSchema,
} from '../src/validation/schemas.js';

describe('sanitize.js', () => {
  it('truncates over-length strings cleanly at last word boundary', () => {
    const longText = 'The quick brown fox jumps over the lazy dog and runs away into the wild forest.';
    // Length is 80 chars
    const truncated35 = truncateAtWordBoundary(longText, 35);
    assert.equal(truncated35, 'The quick brown fox jumps over the');
    assert.ok(truncated35.length <= 35);

    const truncated31 = truncateAtWordBoundary(longText, 31);
    assert.equal(truncated31, 'The quick brown fox jumps over');
    assert.ok(truncated31.length <= 31);

    // Hard cut when no space exists within limit
    const noSpace = 'Supercalifragilisticexpialidocious';
    assert.equal(truncateAtWordBoundary(noSpace, 10), 'Supercalif');
  });

  it('truncates over-length claim at word boundary and passes schema validation', () => {
    const overLengthClaim = 'A'.repeat(150) + ' ' + 'B'.repeat(40) + ' ' + 'C'.repeat(30);
    // Over 200 chars limit (SCHEMA_LIMITS.PERSONA_MAX_CLAIM is 200)
    assert.ok(overLengthClaim.length > 200);

    const raw = {
      headline: 'Normal headline',
      points: [
        {
          claim: overLengthClaim,
          severity: 3,
          suggestedFix: 'Standard fix under limit',
        },
      ],
      verdict: 'Standard verdict under limit',
    };

    // Without sanitization, schema fails
    const failRes = PersonaOutputSchema.safeParse(raw);
    assert.equal(failRes.success, false);

    // With sanitization, claim is truncated at word boundary and succeeds
    const sanitized = sanitizePersonaOutput(raw);
    assert.ok(sanitized.points[0].claim.length <= 200);
    const passRes = PersonaOutputSchema.safeParse(sanitized);
    assert.ok(passRes.success);
  });

  it('drops array items beyond max limit', () => {
    const raw = {
      headline: 'Headline',
      points: [
        { claim: 'Point 1', severity: 2, suggestedFix: 'Fix 1' },
        { claim: 'Point 2', severity: 3, suggestedFix: 'Fix 2' },
        { claim: 'Point 3', severity: 4, suggestedFix: 'Fix 3' },
        { claim: 'Point 4', severity: 2, suggestedFix: 'Fix 4' },
        { claim: 'Point 5', severity: 3, suggestedFix: 'Fix 5' },
        { claim: 'Point 6 (excess)', severity: 1, suggestedFix: 'Fix 6' },
        { claim: 'Point 7 (excess)', severity: 1, suggestedFix: 'Fix 7' },
      ],
      verdict: 'Verdict',
    };

    // Without sanitization, fails (max 5 points)
    assert.equal(PersonaOutputSchema.safeParse(raw).success, false);

    const sanitized = sanitizePersonaOutput(raw);
    assert.equal(sanitized.points.length, 5);
    assert.ok(PersonaOutputSchema.safeParse(sanitized).success);
  });

  it('fails when a required field is missing', () => {
    const rawMissing = {
      headline: 'Headline only',
      // missing points and verdict
    };

    const sanitized = sanitizePersonaOutput(rawMissing);
    const res = PersonaOutputSchema.safeParse(sanitized);
    assert.equal(res.success, false);
  });

  it('fails when field type is incorrect', () => {
    const rawWrongType = {
      headline: 12345, // should be string
      points: [{ claim: 'Claim', severity: 'HIGH', suggestedFix: 'Fix' }], // severity should be int
      verdict: 'Verdict',
    };

    const sanitized = sanitizePersonaOutput(rawWrongType);
    const res = PersonaOutputSchema.safeParse(sanitized);
    assert.equal(res.success, false);
  });

  it('sanitizes judge output including hardenedPlan, topRisks, actionItems, and keyTensions', () => {
    const rawJudge = {
      survivalScoreBefore: 23,
      survivalScoreAfter: 52,
      rationale: 'Long rationale '.repeat(35), // > 500 chars
      topRisks: ['Risk 1', 'Risk 2', 'Risk 3', 'Excess Risk 4', 'Excess Risk 5'],
      hardenedPlan: 'Phase 1 '.repeat(300), // > 2000 chars
      actionItems: [
        { task: 'Task 1', dueInDays: 7 },
        { task: 'Task 2', dueInDays: 14 },
        { task: 'Task 3', dueInDays: 21 },
        { task: 'Task 4', dueInDays: 28 },
        { task: 'Task 5', dueInDays: 35 },
        { task: 'Excess Task 6', dueInDays: 42 },
      ],
      keyTensions: [
        { topic: 'Topic 1', summary: 'Summary 1' },
        { topic: 'Topic 2', summary: 'Summary 2' },
        { topic: 'Excess Topic 3', summary: 'Summary 3' },
      ],
      unresolvedQuestions: ['Q1', 'Q2', 'Q3', 'Excess Q4'],
      missingPersonas: [],
      modeUsed: 'live',
    };

    // Raw fails schema
    assert.equal(JudgeOutputSchema.safeParse(rawJudge).success, false);

    const sanitized = sanitizeJudgeOutput(rawJudge);
    assert.ok(sanitized.hardenedPlan.length <= 2000);
    assert.ok(sanitized.rationale.length <= 500);
    assert.equal(sanitized.topRisks.length, 3);
    assert.equal(sanitized.actionItems.length, 5);
    assert.equal(sanitized.keyTensions.length, 2);
    assert.equal(sanitized.unresolvedQuestions.length, 3);

    const res = JudgeOutputSchema.safeParse(sanitized);
    assert.ok(res.success);
  });
});
