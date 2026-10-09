// @ts-check
/**
 * @file config.js
 * @description Central application configuration and single source of truth for all constants,
 * numeric limits, environment parsing, and quota settings.
 */

try {
  if (typeof process.loadEnvFile === 'function') {
    process.loadEnvFile();
  }
} catch {
  // .env file is optional in environments where variables are already set
}

/**
 * Parses a comma-separated string of model names into an array.
 * @param {string | undefined} val
 * @param {string[]} fallback
 * @returns {string[]}
 */
function parseModelList(val, fallback) {
  if (!val || typeof val !== 'string') return [...fallback];
  const list = val.split(',').map(s => s.trim()).filter(Boolean);
  return list.length > 0 ? list : [...fallback];
}

const DEFAULT_PERSONA_MODELS = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'];
const DEFAULT_JUDGE_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
];

const config = Object.freeze({
  // Server
  PORT: parseInt(process.env.PORT || '3000', 10) || 3000,

  // Gemini API
  get GEMINI_API_KEY() {
    return process.env.GEMINI_API_KEY || '';
  },
  PERSONA_MODELS: parseModelList(process.env.PERSONA_MODELS, DEFAULT_PERSONA_MODELS),
  JUDGE_MODELS: parseModelList(process.env.JUDGE_MODELS, DEFAULT_JUDGE_MODELS),

  // Feature Flags
  get DEMO_MODE() {
    return process.env.DEMO_MODE === 'true';
  },
  get GROUNDING_ENABLED() {
    return process.env.GROUNDING_ENABLED === 'true';
  },

  // Thinking Levels ('LOW', 'MINIMAL', 'MEDIUM', 'HIGH')
  THINKING_LEVEL_PERSONA: process.env.THINKING_LEVEL_PERSONA || 'LOW',
  THINKING_LEVEL_JUDGE: process.env.THINKING_LEVEL_JUDGE || 'LOW',

  // Numeric Limits — Input
  MAX_PLAN_LENGTH: 2000,
  MIN_PLAN_LENGTH: 1,

  // Quota & Rate Limits (per-model free-tier estimates)
  QUOTAS: Object.freeze({
    FLASH_LITE: Object.freeze({
      RPM: 15,
      RPD: 500,
    }),
    FLASH: Object.freeze({
      RPM: 5,
      RPD: 20,
    }),
    DEFAULT_COOLDOWN_SECONDS: 60,
    MAX_RETRIES: 2,
    RETRY_BACKOFF_BASE_MS: 1000,
    CALL_TIMEOUT_MS: 15000,
    TIMEZONE: 'America/Los_Angeles',
  }),

  // Abuse Protection & Server Caps
  RATE_LIMIT: Object.freeze({
    WINDOW_MS: 15 * 60 * 1000, // 15 minutes
    MAX_REQUESTS_PER_IP: 20,
    GLOBAL_MAX_CONCURRENT_REVIEWS: 2,
  }),

  // In-Memory LRU Cache
  CACHE: Object.freeze({
    MAX_ENTRIES: 50,
    TTL_MS: 10 * 60 * 1000, // 10 minutes
  }),

  // Response Schema Limits (Token optimization)
  SCHEMA_LIMITS: Object.freeze({
    PERSONA_MAX_HEADLINE: 120,
    PERSONA_MAX_POINTS: 5,
    PERSONA_MAX_CLAIM: 200,
    PERSONA_MAX_FIX: 200,
    PERSONA_MAX_VERDICT: 300,

    JUDGE_MAX_RATIONALE: 500,
    JUDGE_TOP_RISKS_COUNT: 3,
    JUDGE_MAX_RISK: 150,
    JUDGE_MAX_HARDENED_PLAN: 2000,
    JUDGE_MAX_ACTION_ITEMS: 5,
    JUDGE_MAX_ACTION_TASK: 200,
    JUDGE_MAX_UNRESOLVED_QUESTIONS: 3,
    JUDGE_MAX_QUESTION: 150,
    JUDGE_MAX_KEY_TENSIONS: 2,
    JUDGE_MAX_KEY_TENSION_TOPIC: 80,
    JUDGE_MAX_KEY_TENSION_SUMMARY: 220,
  }),
});

export default config;
