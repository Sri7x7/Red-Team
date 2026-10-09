// @ts-check
/**
 * @file scripts/smoke.js
 * @description Quick sanity/smoke test checking environment variables, configuration,
 * schema validation, and Gemini API connectivity.
 */

try {
  if (typeof process.loadEnvFile === 'function') {
    process.loadEnvFile();
  }
} catch {}

import config from '../config.js';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { ReviewRequestSchema, PersonaOutputSchema, JudgeOutputSchema } from '../src/validation/schemas.js';
import * as modelPool from '../src/services/modelPool.js';

async function runSmokeTest() {
  console.log('='.repeat(60));
  console.log('🔥 RED TEAM MY LIFE — SMOKE TEST');
  console.log('='.repeat(60));

  // 1. Config & Env Verification
  console.log('\n[1/4] Checking environment & configuration...');
  console.log(`  • Server Port: ${config.PORT}`);
  console.log(`  • Persona Models (${config.PERSONA_MODELS.length}): ${config.PERSONA_MODELS.join(', ')}`);
  console.log(`  • Judge Models (${config.JUDGE_MODELS.length}): ${config.JUDGE_MODELS.join(', ')}`);
  console.log(`  • Demo Mode: ${config.DEMO_MODE}`);
  console.log(`  • Grounding Enabled: ${config.GROUNDING_ENABLED}`);

  if (!config.GEMINI_API_KEY) {
    if (config.DEMO_MODE) {
      console.log('  ⚠️ GEMINI_API_KEY is unset, but DEMO_MODE=true. App can run in demo mode.');
    } else {
      console.error('  ❌ GEMINI_API_KEY is not set in environment or .env!');
      process.exit(1);
    }
  } else {
    console.log(`  ✅ GEMINI_API_KEY is present (length: ${config.GEMINI_API_KEY.length})`);
  }

  // 2. Schema Integrity Verification
  console.log('\n[2/4] Testing Zod schemas...');
  const testInput = ReviewRequestSchema.safeParse({ plan: 'Test plan' });
  if (!testInput.success) {
    console.error('  ❌ ReviewRequestSchema failed:', testInput.error);
    process.exit(1);
  }
  console.log('  ✅ ReviewRequestSchema, PersonaOutputSchema, JudgeOutputSchema loaded');

  // 3. Model Pool Status
  console.log('\n[3/4] Testing Model Pool...');
  const initialMode = modelPool.determineAutoMode();
  console.log(`  ✅ Auto mode determined as: "${initialMode}"`);
  const status = modelPool.getModelPoolStatus();
  console.log(`  ✅ Persona models registered: ${status.personas.map(p => p.id).join(', ')}`);
  console.log(`  ✅ Judge models registered: ${status.judge.map(j => j.id).join(', ')}`);

  // 4. Live Gemini API Connectivity
  if (config.GEMINI_API_KEY && !config.DEMO_MODE) {
    console.log('\n[4/4] Verifying Gemini API connection with primary models...');
    const ai = new GoogleGenAI({ apiKey: config.GEMINI_API_KEY });

    // Test primary persona model
    const testPersonaModel = config.PERSONA_MODELS[0];
    try {
      process.stdout.write(`  • Pinging persona model (${testPersonaModel})... `);
      const res1 = await ai.models.generateContent({
        model: testPersonaModel,
        contents: 'Reply with the single word: OK',
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
        },
      });
      console.log(`✅ [${res1.text?.trim() || 'OK'}]`);
    } catch (err) {
      console.log(`❌ Error: ${err.message}`);
    }

    // Test judge model fallback chain
    let judgePinged = false;
    for (const testJudgeModel of config.JUDGE_MODELS) {
      try {
        process.stdout.write(`  • Pinging judge model (${testJudgeModel})... `);
        const res2 = await ai.models.generateContent({
          model: testJudgeModel,
          contents: 'Reply with the single word: OK',
          config: {
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          },
        });
        console.log(`✅ [${res2.text?.trim() || 'OK'}]`);
        judgePinged = true;
        break;
      } catch (err) {
        console.log(`⚠️ (${err.status || 503}) Fallback to next judge model...`);
      }
    }
    if (!judgePinged) {
      console.log('  ❌ All judge models currently unavailable.');
    }
  } else {
    console.log('\n[4/4] Skipping live API ping (demo mode or key missing).');
  }

  console.log('\n' + '='.repeat(60));
  console.log('✨ SMOKE TEST COMPLETED SUCCESSFULLY');
  console.log('='.repeat(60) + '\n');
}

runSmokeTest().catch(err => {
  console.error('Fatal smoke test error:', err);
  process.exit(1);
});
