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
      }

      const jRes = JudgeOutputSchema.safeParse(data.judge);
      assert.ok(jRes.success, `${filename} judge output invalid: ${jRes.error?.message}`);
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
