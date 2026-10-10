// @ts-check
/**
 * @file public/js/states.js
 * @description Empty state (how it works + persona chips), crisis safety panel,
 * busy / error / rate-limit panels with retry countdown and sample-review option.
 */

import { h, clearElement } from './dom.js';
import { createIcon } from './icons.js';

// ──────────────────────────────────────────────
// Empty State
// ──────────────────────────────────────────────

const HOW_IT_WORKS_STEPS = [
  { num: '1', label: 'Describe the plan', detail: 'Write your career, business, or life plan in the textarea.' },
  { num: '2', label: 'Five personas attack it', detail: 'Pessimist, Accountant, Skeptical Parent, Future You, and Optimist each probe for flaws in parallel.' },
  { num: '3', label: 'Judge hardens it', detail: 'An Executive Judge reconciles the debate and delivers a hardened roadmap with action items.' },
];

/** @typedef {'skull'|'wallet'|'shield'|'hourglass'|'rocket'|'calendar'|'copy'|'check'|'print'|'refresh'|'info'|'arrow-right'} IconName */

/** @type {Array<{ id: string, label: string, role: string, icon: IconName }>} */
const PERSONA_CHIPS = [
  { id: 'pessimist', label: 'Pessimist', role: 'Execution failures', icon: 'skull' },
  { id: 'accountant', label: 'Accountant', role: 'Numbers & runway', icon: 'wallet' },
  { id: 'skepticalParent', label: 'Skeptical Parent', role: 'Family & reversibility', icon: 'shield' },
  { id: 'futureYou', label: 'Future You', role: 'First-person regret', icon: 'hourglass' },
  { id: 'optimist', label: 'Optimist', role: 'Honest strengths', icon: 'rocket' },
];

/**
 * Renders the empty state: 3-step how-it-works guide + persona chips.
 * @param {HTMLElement} el
 */
export function renderEmptyState(el) {
  clearElement(el);
  el.hidden = false;

  // 3-step How It Works
  const stepsRow = h(
    'div',
    { className: 'empty-steps-row' },
    ...HOW_IT_WORKS_STEPS.map((s) =>
      h(
        'div',
        { className: 'empty-step-card' },
        h('div', { className: 'empty-step-number', 'aria-hidden': 'true' }, s.num),
        h('div', { className: 'empty-step-body' },
          h('p', { className: 'empty-step-label' }, s.label),
          h('p', { className: 'empty-step-detail' }, s.detail)
        )
      )
    )
  );

  // Arrow connectors between steps (aria-hidden)
  const stepsGrid = h('div', { className: 'empty-steps-grid' });
  HOW_IT_WORKS_STEPS.forEach((s, i) => {
    stepsGrid.appendChild(
      h(
        'div',
        { className: 'empty-step-card' },
        h('div', { className: 'empty-step-number', 'aria-hidden': 'true' }, s.num),
        h('div', { className: 'empty-step-body' },
          h('p', { className: 'empty-step-label' }, s.label),
          h('p', { className: 'empty-step-detail' }, s.detail)
        )
      )
    );
    if (i < HOW_IT_WORKS_STEPS.length - 1) {
      stepsGrid.appendChild(
        h('div', { className: 'empty-step-arrow', 'aria-hidden': 'true' },
          createIcon('arrow-right', 'icon-arrow-step')
        )
      );
    }
  });

  // Persona chips row
  const chipsRow = h(
    'div',
    { className: 'empty-persona-chips', role: 'list', 'aria-label': 'The five AI personas' }
  );
  PERSONA_CHIPS.forEach((p) => {
    chipsRow.appendChild(
      h(
        'div',
        { className: `persona-chip persona-chip--${p.id}`, role: 'listitem' },
        h('span', { className: 'chip-icon', 'aria-hidden': 'true' }, createIcon(p.icon, 'chip-svg-icon')),
        h('span', { className: 'chip-name' }, p.label),
        h('span', { className: 'chip-role' }, p.role)
      )
    );
  });

  el.append(
    h('h2', { className: 'empty-state-heading' }, 'How it works'),
    stepsGrid,
    h('p', { className: 'empty-persona-label' }, 'The five AI personas'),
    chipsRow
  );
}

// ──────────────────────────────────────────────
// Safety Panel
// ──────────────────────────────────────────────

/**
 * Renders the warm crisis support panel.
 * @param {HTMLElement} el
 * @param {string} message
 */
export function renderSafetyPanel(el, message) {
  clearElement(el);
  el.hidden = false;

  el.append(
    h('div', { className: 'safety-icon-wrap', 'aria-hidden': 'true' },
      createIcon('info', 'safety-icon')
    ),
    h('div', { className: 'safety-body' },
      h('h3', { className: 'safety-title' }, 'You\'re not alone — support is here'),
      h('p', { className: 'safety-message' }, message),
      h(
        'div',
        { className: 'safety-helplines' },
        h('p', { className: 'helpline-primary' }, 'Tele-MANAS (India): 14416'),
        h('p', { className: 'helpline-secondary' }, 'Local emergency services: 112')
      )
    )
  );
}

// ──────────────────────────────────────────────
// Error / Rate-limit / Busy Panel
// ──────────────────────────────────────────────

/**
 * @typedef {Object} ErrorOpts
 * @property {string} [code]
 * @property {string} [message]
 * @property {number|null} [retryAfterSeconds]
 * @property {boolean} [sampleAvailable]
 * @property {any} [appMetadata]
 * @property {HTMLTextAreaElement} [planInput]
 * @property {HTMLSelectElement} [modeSelect]
 * @property {HTMLFormElement} [formEl]
 * @property {() => void} [onClear]
 * @property {(msg: string) => void} [onUpdateCounter]
 * @property {(id: string) => void} [onSetExampleId]
 */

/**
 * Renders structured error / rate-limit panel with retry countdown + sample option.
 * @param {HTMLElement} el
 * @param {ErrorOpts} opts
 * @returns {{ countdownInterval: ReturnType<typeof setInterval> | null }}
 */
export function renderErrorPanel(el, opts) {
  const {
    code, message, retryAfterSeconds, sampleAvailable,
    appMetadata, planInput, modeSelect, formEl,
    onClear, onUpdateCounter, onSetExampleId,
  } = opts;

  clearElement(el);
  el.hidden = false;

  let title = 'Unable to complete review';
  let desc = message || 'An unexpected error occurred while reviewing your plan.';

  if (code === 'busy' || code === 'concurrency_limit' || code === 'rate_limited') {
    title = 'System at full capacity';
    desc = desc || 'All council seats are occupied. Please wait a moment before retrying.';
  } else if (code === 'demo_only') {
    title = 'Demo mode active';
    desc = 'Running without live API access. Select one of the benchmark plans below to explore a full council review.';
  } else if (code === 'invalid_request') {
    title = 'Plan could not be submitted';
  } else if (code === 'network_error') {
    title = 'Connection issue';
    desc = desc || 'A network error occurred. Please check your connection and try again.';
  }

  const actionsRow = h('div', { className: 'error-actions' });

  // Retry button
  const retryBtn = h(
    'button',
    {
      type: 'button',
      className: 'btn-secondary',
      onClick: () => {
        if (onClear) onClear();
        if (formEl) formEl.requestSubmit();
      },
    },
    createIcon('refresh', 'btn-icon'),
    h('span', {}, 'Try Again')
  );
  actionsRow.appendChild(retryBtn);

  let countdownInterval = null;
  if (typeof retryAfterSeconds === 'number' && retryAfterSeconds > 0) {
    let remaining = retryAfterSeconds;
    const countdownSpan = h('span', { className: 'countdown-timer' }, `Retry in ${remaining}s`);
    actionsRow.appendChild(countdownSpan);
    /** @type {HTMLButtonElement} */ (retryBtn).disabled = true;

    countdownInterval = setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        clearInterval(countdownInterval);
        countdownInterval = null;
        /** @type {HTMLButtonElement} */ (retryBtn).disabled = false;
        countdownSpan.textContent = 'Ready to retry.';
      } else {
        countdownSpan.textContent = `Retry in ${remaining}s`;
      }
    }, 1000);
  }

  // Sample review button
  if (sampleAvailable && appMetadata?.examples?.[0]) {
    const firstEx = appMetadata.examples[0];
    const sampleBtn = h(
      'button',
      {
        type: 'button',
        className: 'btn-primary',
        onClick: () => {
          if (onClear) onClear();
          if (planInput) planInput.value = firstEx.plan;
          if (onSetExampleId) onSetExampleId(firstEx.id);
          if (onUpdateCounter) onUpdateCounter(firstEx.plan);
          if (modeSelect) modeSelect.value = 'demo';
          if (formEl) formEl.requestSubmit();
        },
      },
      h('span', {}, 'Show a sample review')
    );
    actionsRow.appendChild(sampleBtn);
  }

  el.append(
    h('div', { className: 'error-icon-wrap', 'aria-hidden': 'true' },
      createIcon('info', 'error-icon')
    ),
    h('div', { className: 'error-body' },
      h('h3', { className: 'error-title' }, title),
      h('p', { className: 'error-message' }, desc),
      actionsRow
    )
  );

  return { countdownInterval };
}
