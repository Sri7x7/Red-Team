# Accessibility Conformance (WCAG 2.1 AA)

This document details the accessibility features implemented in **Red Team My Life**. Every feature listed is verified against the active frontend implementation.

---

## Implemented Accessibility Features

### 1. Skip Link
- **Implementation**: A high-visibility skip link `<a href="#main" class="skip-link">Skip to main content</a>` is positioned at the very top of `<body>`.
- **Behavior**: Hidden off-screen by default (`top: -9999px`), shifts to `top: 1rem` with a prominent focus ring (`outline: 3px solid var(--focus-ring)`) when focused via keyboard Tab, navigating directly to the `<main id="main">` content area.
- **File References**:
  - [index.html](file:///c:/Users/Srikanth%20Gowda/OneDrive/Desktop/Srikanth_Samrajya/Hackathon/Red-Team/public/index.html#L12)
  - [styles.css](file:///c:/Users/Srikanth%20Gowda/OneDrive/Desktop/Srikanth_Samrajya/Hackathon/Red-Team/public/styles.css) — `.skip-link`, `.skip-link:focus`

---

### 2. Semantic Landmarks & Document Structure
- **Implementation**: The DOM uses HTML5 semantic landmark elements:
  - `<header class="app-header">`: Brand title, tagline, and council badge.
  - `<main id="main">`: Primary operational area (form, results, panels).
  - `<section aria-labelledby="form-heading">`: Plan input with hidden `<h2>` heading for screen reader navigation.
  - `<section id="results-section" aria-labelledby="results-heading">`: Results with accessible `<h2>` (`tabindex="-1"` for programmatic focus).
  - `<article>` cards: Each persona critique is an article with `tabIndex=0` and descriptive `aria-label`.
  - `<footer class="app-footer">`: Privacy and disclaimer.
- **Heading Hierarchy**: Single `<h1>` (app title), `<h2>` (form and results), `<h3>` (persona names, judge heading, safety/error titles), `<h4>` (judge section headings), `<h5>` (phase card titles).
- **File References**:
  - [index.html](file:///c:/Users/Srikanth%20Gowda/OneDrive/Desktop/Srikanth_Samrajya/Hackathon/Red-Team/public/index.html)
  - [cards.js](file:///c:/Users/Srikanth%20Gowda/OneDrive/Desktop/Srikanth_Samrajya/Hackathon/Red-Team/public/js/cards.js)

---

### 3. ARIA Live Regions & Status Announcements

- **Polite Updates**:
  - Character counter (`#char-counter`) uses `aria-live="polite"` to inform screen reader users of character budgets without interruption.
  - `#status-region` with `role="status" aria-live="polite" aria-atomic="true"` announces mode selections, persona completion, degradation events, and completion states.
- **Assertive Alerts**:
  - `#safety-panel` with `role="alert" aria-live="assertive"` immediately announces crisis support details (Tele-MANAS 14416) when safety guard triggers.
  - `#error-panel` with `role="alert" aria-live="assertive"` for server errors, rate limits, and network failures.
- **Busy State**:
  - `#results-section` toggles `aria-busy="true"` while agents generate analyses, switching to `"false"` when the judge synthesis completes.
- **File References**:
  - [index.html](file:///c:/Users/Srikanth%20Gowda/OneDrive/Desktop/Srikanth_Samrajya/Hackathon/Red-Team/public/index.html#L85-L93)
  - [main.js](file:///c:/Users/Srikanth%20Gowda/OneDrive/Desktop/Srikanth_Samrajya/Hackathon/Red-Team/public/js/main.js) — `announce()`, `setRunningState()`

---

### 4. Focus Management

- **Keyboard Traversal**:
  - When review completes with judge synthesis, focus is programmatically moved to `#results-heading` (`resultsHeading.focus()`), enabling screen readers to read synthesis from the beginning.
  - Selecting a benchmark plan auto-focuses the plan `<textarea>` so users can immediately review/edit.
  - Error recovery actions return focus to the textarea after clearing alert banners.
- **Ctrl+Enter Shortcut**: `planInput` listens for `Ctrl+Enter` / `Cmd+Enter` to submit the form, avoiding mouse dependency.
- **File References**:
  - [main.js](file:///c:/Users/Srikanth%20Gowda/OneDrive/Desktop/Srikanth_Samrajya/Hackathon/Red-Team/public/js/main.js) — `init()` keyboard listener, `handleFormSubmit` focus management

---

### 5. High-Contrast Design Tokens (WCAG AA)

- **Contrast Ratios**:
  - Light mode: Deep text (`--text-main: #18181B`) on warm neutral background (`--bg-app: #F7F7F5`), white surfaces (`--bg-surface: #FFFFFF`). Main text contrast ratio: **15.5:1** (far exceeds 4.5:1).
  - Dark mode: Near-white text (`--text-main: #F1F5F9`) on dark canvas (`--bg-surface: #181C24`). Contrast ratio: **14.2:1**.
  - Persona badge colors use dedicated muted variants for text (e.g., `--color-pessimist-muted: #991B1B`) on their tinted backgrounds for AA compliance.
  - All status and focus ring colors meet 3:1 minimum for non-text elements.
- **File References**:
  - [styles.css](file:///c:/Users/Srikanth%20Gowda/OneDrive/Desktop/Srikanth_Samrajya/Hackathon/Red-Team/public/styles.css) — `:root` tokens and `@media (prefers-color-scheme: dark)`

---

### 6. Reduced Motion Support

- **Media Query**: `@media (prefers-reduced-motion: reduce)` ruleset implemented.
- **Behavior**:
  - All `animation-duration` and `transition-duration` clamped to `0.01ms`.
  - Smooth scrolling disabled (`scroll-behavior: auto !important`).
  - Hover transforms (`translateY`) disabled.
  - Shimmer animations, pulse dots, and card hover transitions suppressed.
- **File References**:
  - [styles.css](file:///c:/Users/Srikanth%20Gowda/OneDrive/Desktop/Srikanth_Samrajya/Hackathon/Red-Team/public/styles.css) — `@media (prefers-reduced-motion: reduce)` block

---

### 7. 44px Minimum Touch & Click Targets

- **Target Sizes**:
  - All primary buttons (`.btn-primary`, `.btn-stop`, `.btn-secondary`): `min-height: 44px; min-width: 44px`.
  - Example card buttons (`.example-card-btn`): `min-height: 64px`.
  - Mode selector (`.mode-select`): `min-height: 44px`.
  - Calendar export links (`.btn-calendar`): `min-height: 44px`.
  - Conforms to WCAG 2.5.5 (Target Size — Enhanced) and 2.5.8 (Target Size — Minimum).
- **File References**:
  - [styles.css](file:///c:/Users/Srikanth%20Gowda/OneDrive/Desktop/Srikanth_Samrajya/Hackathon/Red-Team/public/styles.css) — button classes

---

### 8. Text Labels for Severity (Non-Color-Dependent)

- **Accessible Indicators**:
  - Severity ratings never rely solely on color or bar widths.
  - Every rating container uses `role="meter"` with `aria-valuenow`, `aria-valuemin="1"`, `aria-valuemax="5"`, and descriptive `aria-valuetext` (e.g., `"Severity 5 of 5 - Critical"`, `"Impact 4 of 5 - High"`).
  - A visible text label (`<span class="rating-text">`) renders alongside the graphical segmented bar.
  - Optimist persona uses distinct impact labels (Minor → Major Catalyst) instead of severity labels.
- **File References**:
  - [cards.js](file:///c:/Users/Srikanth%20Gowda/OneDrive/Desktop/Srikanth_Samrajya/Hackathon/Red-Team/public/js/cards.js) — `createSegmentedBar()`
  - [lib.js](file:///c:/Users/Srikanth%20Gowda/OneDrive/Desktop/Srikanth_Samrajya/Hackathon/Red-Team/public/js/lib.js) — `getSeverityText()`

---

### 9. Responsive Layout (360px Support)

- **Breakpoints**:
  - `≤360px`: Single column, smaller padding, stacked form actions, hidden progress step labels.
  - `≤640px`: Single-column persona grid, stacked example cards, stacked export actions, vertical empty-state steps with rotated arrows.
  - `≥900px`: 2-column persona grid.
- **No Horizontal Scroll**: All content fits within viewport at 360px width via flexible grid columns and `overflow-x: auto` on pre-formatted hardened plan content.
- **File References**:
  - [styles.css](file:///c:/Users/Srikanth%20Gowda/OneDrive/Desktop/Srikanth_Samrajya/Hackathon/Red-Team/public/styles.css) — `@media` queries

---

### 10. Show/Hide Toggle with aria-expanded

- **Implementation**: Persona cards show the top 2 critique points by default. A `<button aria-expanded="false" aria-controls="hidden-points-{id}">Show all N points</button>` toggle reveals remaining points.
- **Behavior**: On click, `aria-expanded` toggles between `"true"` and `"false"`, and the hidden container's `hidden` attribute is toggled. The button text updates to "Show fewer" when expanded.
- **File References**:
  - [cards.js](file:///c:/Users/Srikanth%20Gowda/OneDrive/Desktop/Srikanth_Samrajya/Hackathon/Red-Team/public/js/cards.js) — `updatePersonaCard()` toggle logic

---

### 11. Progress Strip with Accessible Meter

- **Implementation**: A 4-step progress strip with `role="progressbar"`, `aria-valuenow`, `aria-valuemin="0"`, `aria-valuemax="100"`, and `aria-valuetext` describing current step.
- **Step states**: Visual distinction via `.step-upcoming`, `.step-active`, `.step-completed` classes with non-color-dependent numbering and text labels.
- **File References**:
  - [progress.js](file:///c:/Users/Srikanth%20Gowda/OneDrive/Desktop/Srikanth_Samrajya/Hackathon/Red-Team/public/js/progress.js) — `updateProgressStrip()`

---

### 12. Safe DOM Construction (CSP Compliance)

- **No innerHTML**: All DOM elements constructed via safe `h()` helper from [dom.js](file:///c:/Users/Srikanth%20Gowda/OneDrive/Desktop/Srikanth_Samrajya/Hackathon/Red-Team/public/js/dom.js) or `document.createElementNS` (SVG).
- **No inline styles**: Dynamic sizing only via CSS custom properties (`element.style.setProperty('--progress-width', ...)`).
- **No external fonts/CDNs**: System font stack only.
- **Enforced by test**: [frontend-security.test.js](file:///c:/Users/Srikanth%20Gowda/OneDrive/Desktop/Srikanth_Samrajya/Hackathon/Red-Team/tests/frontend-security.test.js) scans every file in `public/` for forbidden patterns.

---

### 13. Print Stylesheet

- **Implementation**: `@media print` hides form inputs, example buttons, progress strip, export bar, and footer. Results section is forced visible. Hidden point groups are expanded. Cards use `break-inside: avoid`.
- **File References**:
  - [styles.css](file:///c:/Users/Srikanth%20Gowda/OneDrive/Desktop/Srikanth_Samrajya/Hackathon/Red-Team/public/styles.css) — `@media print` block
