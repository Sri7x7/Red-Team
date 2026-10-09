import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PersonaOutputSchema, JudgeOutputSchema } from '../src/validation/schemas.js';
import { findMatchingExample } from '../src/orchestrator.js';

describe('data/examples/ benchmark files', () => {
  const examplesDir = join(process.cwd(), 'data', 'examples');
  const files = readdirSync(examplesDir).filter(f => f.endsWith('.json'));

  it('contains exactly 3 pre-saved example benchmark files', () => {
    assert.equal(files.length, 3);
  });

  for (const filename of files) {
    it(`validates ${filename} against PersonaOutput and JudgeOutput schemas`, () => {
      const raw = readFileSync(join(examplesDir, filename), 'utf-8');
      const data = JSON.parse(raw);

      assert.ok(data.exampleId, `${filename} missing exampleId`);
      assert.ok(data.planText, `${filename} missing planText`);
      assert.ok(data.personas, `${filename} missing personas`);

      const personaKeys = ['pessimist', 'accountant', 'skepticalParent', 'futureYou', 'optimist'];
      for (const k of personaKeys) {
        assert.ok(data.personas[k], `${filename} missing persona ${k}`);
        const pRes = PersonaOutputSchema.safeParse(data.personas[k]);
        assert.ok(pRes.success, `${filename} persona ${k} invalid: ${pRes.error?.message}`);

        // Calibration: at most ONE point rated 5
        const countFives = data.personas[k].points.filter(p => p.severity === 5).length;
        assert.ok(
          countFives <= 1,
          `${filename} persona ${k} has ${countFives} points with severity 5 (max allowed: 1)`
        );

        // Verify concrete suggestedFix
        for (const pt of data.personas[k].points) {
          assert.ok(pt.suggestedFix.length > 10, `${filename} ${k} fix is too short`);
        }
      }

      // Persona lane assertions
      // Future You: 2-3 points, first person
      assert.ok(
        data.personas.futureYou.points.length >= 2 && data.personas.futureYou.points.length <= 3,
        `${filename} Future You must have 2-3 points`
      );
      const futureYouUsesFirstPerson = data.personas.futureYou.points.some(p =>
        /\b(I\b|my\b|I've\b|myself\b)/i.test(p.claim)
      );
      assert.ok(futureYouUsesFirstPerson, `${filename} Future You must use first person in claims`);

      // Accountant: labeled assumptions with ranges
      const accountantHasAssumptions = data.personas.accountant.points.some(p =>
        p.claim.toLowerCase().includes('assumption:') || p.suggestedFix.toLowerCase().includes('assumption:')
      );
      assert.ok(accountantHasAssumptions, `${filename} Accountant must label assumptions`);

      // Judge validation
      const jRes = JudgeOutputSchema.safeParse(data.judge);
      assert.ok(jRes.success, `${filename} judge output invalid: ${jRes.error?.message}`);

      // Judge keyTensions: array with 1-2 items
      assert.ok(Array.isArray(data.judge.keyTensions), `${filename} judge must have keyTensions array`);
      assert.ok(data.judge.keyTensions.length >= 1 && data.judge.keyTensions.length <= 2);

      // Judge score delta capped at 30
      const scoreJump = data.judge.survivalScoreAfter - data.judge.survivalScoreBefore;
      assert.ok(
        scoreJump <= 30,
        `${filename} survival score jump (${scoreJump}) exceeds 30 cap`
      );

      // Judge scores are not multiples of 5
      assert.ok(
        data.judge.survivalScoreBefore % 5 !== 0,
        `${filename} survivalScoreBefore (${data.judge.survivalScoreBefore}) should not be a multiple of 5`
      );
      assert.ok(
        data.judge.survivalScoreAfter % 5 !== 0,
        `${filename} survivalScoreAfter (${data.judge.survivalScoreAfter}) should not be a multiple of 5`
      );
    });
  }

  it('matches benchmark examples by exampleId or normalized text', () => {
    const match1 = findMatchingExample('custom text', 'career-change');
    assert.ok(match1);
    assert.equal(match1.exampleId, 'career-change');

    const match2 = findMatchingExample('Quit Corporate Job to Become Full-Time Indie Game Developer');
    assert.ok(match2);
    assert.equal(match2.exampleId, 'career-change');
  });

  it('ensures a custom unrelated plan NEVER matches an example', () => {
    const customPlan = 'I want to open an authentic sourdough bakery in Seattle with $80k savings.';
    const match = findMatchingExample(customPlan);
    assert.equal(match, null);
  });
});
