# Red Team My Life — Engineering Rules

> **Track:** AI Personal Assistant & Autonomous Agents
>
> Every contributor (human or AI) must follow these rules for every task.

---

## 1. Project Overview

A multi-agent web app where **5 AI personas** (Pessimist, Accountant, Skeptical Parent, Future You, Optimist) attack a user's plan **in parallel**, then a **Judge agent** returns a hardened plan with a before/after survival score.

---

## 2. Tech Stack & Architecture

| Layer | Choice |
|-------|--------|
| Runtime | Node.js 20+ |
| Server | Express (ES modules) |
| Frontend | Vanilla HTML / CSS / JS in `/public` — **no frameworks** |
| AI SDK | `@google/genai` (official) |
| Module system | ES modules (`"type": "module"` in `package.json`) |

---

## 3. AI / Gemini Configuration

### Models

- **Persona models** are read from `PERSONA_MODELS` (comma-separated). The model-pool module round-robins across them with failover. Use **Flash-Lite** models for higher free-tier quota.
- **Judge models** are read from `JUDGE_MODELS` (comma-separated). Treated as an **ordered fallback chain** — try the first, fall to the next on 429 or error. Use **full Flash** models for higher quality.
- **API key** is read **only** from `GEMINI_API_KEY`. Must **never** be exposed to the client. All Gemini calls happen **server-side only**.
- Never log user plans, prompts, API keys, or any PII.

### Free-Tier Quota Awareness

Free-tier limits vary by model family. Exact RPM, RPD, cooldown, and timeout values are defined in `config.js` as the **single source of truth** — never duplicate them elsewhere.

- **Flash-Lite** models have higher free-tier limits → used for persona agents.
- **Flash (full)** models have lower free-tier limits → used for the judge agent.

### Model Pool (`modelPool`)

- Maintains a **per-model sliding-window RPM limiter** and a **daily request counter** (resets at midnight `America/Los_Angeles`), with limits from `config.js`.
- **Proactively skips** a model when its RPM window or daily budget is exhausted — does not wait for a 429.
- Tracks **per-model cooldown** after a 429 (honours `Retry-After` header; else default from `config.js`).
- Picks the **next healthy model** from the configured list.
- Caps **concurrency** per model to stay within RPM.

### Execution Modes

| Mode | Behavior |
|------|----------|
| **auto** | Default. Starts in *live* if ≥ 2 healthy persona models with no active cooldowns; otherwise starts in *quick*. |
| **live** | 5 parallel persona calls, then 1 Judge call. On a failed persona, retry once on another healthy model. If ≥ 3 of 5 succeed, continue to Judge and report missing ones. If < 3 succeed, degrade to *quick*. |
| **quick** | 1 combined call returning all 5 personas, then 1 Judge call. |
| **demo** | Pre-saved JSON from `data/examples/`, streamed with realistic delays, zero API calls. |

### Degradation Strategy

On repeated failures, the system degrades: **live → quick → error/cached**.

- If the submitted plan **matches one of the 3 example plans** (by example ID or normalized text), serve the cached result from `data/examples/`.
- If the plan is a **custom plan** that doesn't match any example, **never serve an unrelated cached example**. Instead, emit an `error` event with `code: "busy"`, `retryAfterSeconds`, and `sampleAvailable: true` so the UI can offer clearly-labelled sample results.

The response stream always tells the client which mode actually ran.

### Token Efficiency

- Use **minimal / low thinking** for persona calls. At implementation time, check the current `@google/genai` docs for the correct parameter name (e.g., `thinkingLevel`, `thinkingBudget` — it varies by model family). Do **not** assume a parameter name.
- **Response schemas** must cap `items` counts and `maxLength` on strings to limit output tokens. Exact limits are defined in `config.js`.

### Demo Mode & Example Buttons

- When `DEMO_MODE=true` (or on auto-degradation to cached for a matching example), serve pre-saved JSON from `data/examples/*.json`, streamed with realistic delays, **zero API calls**.
- The frontend provides **3 example plan buttons** that also use this demo data.

### Google Search Grounding

- Controlled by `GROUNDING_ENABLED` (default `false`).
- **Optional** — never a core dependency. The app must work identically without it.

### Status Endpoint

- Expose `GET /api/status` returning current mode, per-model health/cooldown state, and feature flags.
- **Never** include API keys, prompts, or user data in the response.

---

## 4. Code Quality

- **Small, single-responsibility modules** — one concern per file.
- **JSDoc types** on every exported function and non-trivial internal function.
- **No dead code** — remove unused imports, variables, and functions immediately.
- **No magic numbers** — all constants live in a central `config.js` (plan length, RPM/RPD limits, cooldown defaults, timeouts, cache size/TTL, concurrency caps, max string lengths, max item counts).
- **Consistent error handling** — use a shared error-handling middleware for Express; always return structured JSON errors to the client.

---

## 5. Security

| Concern | Rule |
|---------|------|
| Input validation | Validate **all** user input with `zod` schemas before processing. |
| Output validation | Validate **every** model output against its zod schema; invalid output counts as a failed call. |
| HTTP headers | Use `helmet` with a **strict Content-Security-Policy**. |
| Rate limiting | Per-IP rate limit on `/api/review`; global cap of 2 simultaneous reviews — excess gets 503 with `Retry-After`. |
| Request size | Enforce request body size limits. |
| Secrets | **Never** log user plans, prompts, or API keys. |
| Prompt injection (input) | Treat all user-supplied text as **untrusted data** in prompts; inject into a clearly delimited `<user_plan>` block in the user message. Strip delimiter tokens from user input before sending. |
| Prompt injection (inter-agent) | Treat persona outputs as **untrusted data** when passed to the Judge. Wrap each in delimited blocks and instruct the Judge to ignore any instructions found inside them. Strip delimiter tokens from persona outputs. |

---

## 6. Efficiency

- **Parallel agent calls** — in *live* mode, fire all 5 persona requests concurrently via `Promise.allSettled`; in *quick* mode, use a single combined call.
- **Timeouts** — every external call must have a timeout (value from `config.js`).
- **Retry with exponential backoff** — for transient Gemini failures. On 429, honour `Retry-After` or use the default cooldown from `config.js`.
- **Auto-degradation** — on repeated failures: live → quick → error/cached (see §3 Degradation Strategy). Always inform the user which mode ran.
- **Minimal token usage** — keep prompts concise; avoid echoing the full plan back unnecessarily.
- **Model pool** — round-robin personas across `PERSONA_MODELS`; fall through `JUDGE_MODELS` chain for the judge. Proactively skip exhausted models. Cap concurrency per model.
- **Client disconnect** — abort in-flight Gemini calls when the client disconnects (use `AbortController` tied to the request `close` event).
- **In-memory LRU cache** — keyed by hash of normalized plan + mode, TTL and max entries from `config.js`, never persisted, never logged. Implemented in the Gemini services layer.

---

## 7. Accessibility (WCAG 2.1 AA)

- Use **semantic HTML** (`<main>`, `<section>`, `<article>`, `<nav>`, `<header>`, `<footer>`, headings in order).
- All interactive elements must be **keyboard operable**.
- Use **ARIA live regions** to announce dynamic content updates (agent responses, scores).
- Maintain a minimum **4.5:1 contrast ratio** for normal text.
- All form controls must have visible, associated `<label>` elements.

---

## 8. Testing

- Use the built-in `node:test` runner (Node 20+).
- **Mock the Gemini client** — tests must not make real API calls.
- **Every module gets tests** — place test files alongside source as `<module>.test.js` or in a `/tests` mirror.
- Run all tests via `npm test`.

---

## 9. Repository Hygiene

| Rule | Detail |
|------|--------|
| Branching | Single branch: `main`. |
| Size | Keep repo **under 10 MB**. |
| Secrets | **No committed secrets** — `.env` is gitignored. |
| Dependencies | `node_modules/` is gitignored. |
| Commits | Commit after **each completed task** with a clear, descriptive message. |

---

## 10. File & Folder Structure (target)

```
Red-Team/
├── RULES.md
├── .gitignore
├── .env.example
├── package.json
├── config.js                  # central constants (single source of truth for all limits)
├── server.js                  # Express entry point
├── docs/
│   └── ARCHITECTURE.md        # system design & API contract
├── data/
│   └── examples/              # pre-saved demo JSON (3 plans)
├── src/
│   ├── agents/                # one file per persona + judge
│   ├── orchestrator.js        # mode selection, degradation, streaming
│   ├── routes/                # Express route handlers
│   ├── middleware/            # helmet, rate-limit, error handler
│   ├── services/              # Gemini client wrapper, retry logic, modelPool, cache
│   └── validation/            # zod schemas
├── public/                    # vanilla frontend
│   ├── index.html
│   ├── styles.css
│   └── app.js
└── tests/                     # mirrors src/ structure
```

---

## 11. Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GEMINI_API_KEY` | **Yes** | — | Google Gemini API key (server-side only) |
| `PERSONA_MODELS` | No | see `config.js` | Comma-separated Flash-Lite models, round-robin with failover |
| `JUDGE_MODELS` | No | see `config.js` | Comma-separated full Flash models, ordered fallback chain |
| `DEMO_MODE` | No | `false` | `true` = zero API calls, serve demo JSON |
| `GROUNDING_ENABLED` | No | `false` | Enable Google Search grounding (optional) |
| `PORT` | No | `3000` | HTTP server port |

All numeric limits (RPM, RPD, cooldown duration, timeouts, max plan length, cache size, cache TTL, concurrency caps, max string lengths, max item counts) are defined in `config.js`, not in environment variables.

---

*These rules are the single source of truth. Update this document when rules change — never silently deviate.*
