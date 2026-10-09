// @ts-check
/**
 * @file scripts/review.js
 * @description CLI runner for Red Team My Life.
 * Usage:
 *   node scripts/review.js "I want to quit my job next month..." --mode live
 *   node scripts/review.js --file ./my-plan.txt --mode quick
 */

try {
  if (typeof process.loadEnvFile === 'function') {
    process.loadEnvFile();
  }
} catch {}

import { readFileSync, existsSync } from 'node:fs';
import { runReview } from '../src/orchestrator.js';

// Parse arguments
const args = process.argv.slice(2);
let plan = '';
let mode = 'auto';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--mode' && args[i + 1]) {
    mode = args[i + 1];
    i++;
  } else if (args[i] === '--file' && args[i + 1]) {
    const filePath = args[i + 1];
    if (!existsSync(filePath)) {
      console.error(`Error: File not found: ${filePath}`);
      process.exit(1);
    }
    plan = readFileSync(filePath, 'utf-8').trim();
    i++;
  } else if (!args[i].startsWith('--') && !plan) {
    plan = args[i].trim();
  }
}

if (!plan) {
  console.log(`
Usage:
  npm run review -- "<plan text>" [--mode auto|live|quick|demo]
  npm run review -- --file <path-to-plan> [--mode auto|live|quick|demo]

Examples:
  npm run review -- "I want to quit my job and launch an indie game studio with $20k savings." --mode live
  npm run review -- --mode demo
`);
  process.exit(1);
}

console.log('='.repeat(70));
console.log('🔥 RED TEAM MY LIFE — MULTI-AGENT STRESS TEST');
console.log(`Target Plan: "${plan.slice(0, 80)}${plan.length > 80 ? '...' : ''}"`);
console.log(`Requested Mode: ${mode}`);
console.log('='.repeat(70) + '\n');

// Mock response object to capture and pretty-print stream events
const mockRes = {
  writableEnded: false,
  destroyed: false,
  write(chunk) {
    const lines = String(chunk).split('\n');
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const event = JSON.parse(line.trim());
        renderCliEvent(event);
      } catch {
        // Ignore unparseable fragments
      }
    }
    return true;
  },
  flush() {},
  end() {},
};

/**
 * Pretty-prints an NDJSON event to the terminal.
 * @param {any} event
 */
function renderCliEvent(event) {
  switch (event.event) {
    case 'mode_selected':
      console.log(`⚡ [MODE SELECTED] Running in ${event.mode.toUpperCase()} mode...\n`);
      break;

    case 'persona_done': {
      const p = event.data;
      console.log(`----------------------------------------------------------------------`);
      console.log(`👤 PERSONA: ${event.persona.toUpperCase()}`);
      console.log(`💬 Headline: "${p.headline}"`);
      if (Array.isArray(p.points)) {
        for (const pt of p.points) {
          console.log(`   • [Severity ${pt.severity}/5] ${pt.claim}`);
          console.log(`     ↳ Fix: ${pt.suggestedFix}`);
        }
      }
      console.log(`⚖️ Verdict: ${p.verdict}\n`);
      break;
    }

    case 'persona_failed':
      console.log(`⚠️ [PERSONA FAILED] ${event.persona}: ${event.error}\n`);
      break;

    case 'degraded':
      console.log(`⚠️ [DEGRADED] ${event.from} ➔ ${event.to}: ${event.reason}\n`);
      break;

    case 'judge_done': {
      const j = event.data;
      console.log('='.repeat(70));
      console.log('🏆 EXECUTIVE JUDGE — HARDENED SYNTHESIS');
      console.log('='.repeat(70));
      console.log(`📊 SURVIVAL PROBABILITY:`);
      console.log(`   Initial Raw Plan:     ${j.survivalScoreBefore}%`);
      console.log(`   Hardened Plan:        ${j.survivalScoreAfter}% (${j.survivalScoreAfter - j.survivalScoreBefore >= 0 ? '+' : ''}${j.survivalScoreAfter - j.survivalScoreBefore}% Boost)`);
      console.log(`\n📋 Executive Rationale:\n   ${j.rationale}`);
      console.log(`\n⚠️ Top 3 Fatal Risks:`);
      if (Array.isArray(j.topRisks)) {
        j.topRisks.forEach((r, idx) => console.log(`   ${idx + 1}. ${r}`));
      }
      console.log(`\n🛡️ Hardened Revised Strategy:\n${j.hardenedPlan}`);
      console.log(`\n🎯 Immediate Action Items:`);
      if (Array.isArray(j.actionItems)) {
        j.actionItems.forEach(a => console.log(`   [Due in ${a.dueInDays} days] ${a.task}`));
      }
      if (j.unresolvedQuestions?.length > 0) {
        console.log(`\n❓ Critical Unresolved Questions:`);
        j.unresolvedQuestions.forEach(q => console.log(`   • ${q}`));
      }
      if (j.keyTensions?.length > 0) {
        console.log(`\n⚡ Key Persona Tensions:`);
        j.keyTensions.forEach(t => console.log(`   • ${t.topic}: ${t.summary}`));
      }
      console.log('\n' + '='.repeat(70) + '\n');
      break;
    }

    case 'safety':
      console.log('='.repeat(70));
      console.log('💙 SUPPORT & CRISIS RESOURCES');
      console.log('='.repeat(70));
      console.log(event.message);
      console.log('='.repeat(70) + '\n');
      break;

    case 'error':
      console.error(`❌ [ERROR] Code: ${event.code} | Message: ${event.message}`);
      if (event.sampleAvailable) {
        console.log('ℹ️ Benchmark sample is available. Run with `--mode demo` to test.');
      }
      break;
  }
}

// Execute review
runReview({ plan, mode, res: mockRes }).catch(err => {
  console.error('Fatal CLI execution error:', err.message);
  process.exit(1);
});
