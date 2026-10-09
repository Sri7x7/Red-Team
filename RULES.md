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

- **Model name** is read from the `GEMINI_MODEL` environment variable; default to `gemini-2.5-flash`.
- **API key** is read **only** from the `GEMINI_API_KEY` environment variable.
- The API key must **never** be exposed to the client. All Gemini calls happen **server-side only**.
- Never log user plans, API keys, or any PII.

---

## 4. Code Quality

- **Small, single-responsibility modules** — one concern per file.
- **JSDoc types** on every exported function and non-trivial internal function.
- **No dead code** — remove unused imports, variables, and functions immediately.
- **No magic numbers** — all constants live in a central `config.js`.
- **Consistent error handling** — use a shared error-handling middleware for Express; always return structured JSON errors to the client.

---

## 5. Security

| Concern | Rule |
|---------|------|
| Input validation | Validate **all** user input with `zod` schemas before processing. |
| HTTP headers | Use `helmet` with a **strict Content-Security-Policy**. |
| Rate limiting | Apply rate limiting to all API endpoints. |
| Request size | Enforce request body size limits. |
| Secrets | **Never** log user plans or API keys. |
| Prompt injection | Treat all user-supplied text as **untrusted data** in prompts; use clear system/user message separation. |

---

## 6. Efficiency

- **Parallel agent calls** — fire all 5 persona requests concurrently (e.g., `Promise.all` / `Promise.allSettled`).
- **Timeouts** — every external call must have a timeout.
- **Retry with exponential backoff** — for transient Gemini failures.
- **Minimal token usage** — keep prompts concise; avoid echoing the full plan back unnecessarily.

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
├── config.js              # central constants
├── server.js              # Express entry point
├── src/
│   ├── agents/            # one file per persona + judge
│   ├── routes/            # Express route handlers
│   ├── middleware/         # helmet, rate-limit, error handler
│   ├── services/          # Gemini client wrapper, retry logic
│   └── validation/        # zod schemas
├── public/                # vanilla frontend
│   ├── index.html
│   ├── styles.css
│   └── app.js
└── tests/                 # mirrors src/ structure
```

---

## 11. Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GEMINI_API_KEY` | **Yes** | — | Google Gemini API key |
| `GEMINI_MODEL` | No | `gemini-2.5-flash` | Gemini model identifier |
| `PORT` | No | `3000` | HTTP server port |

---

*These rules are the single source of truth. Update this document when rules change — never silently deviate.*
