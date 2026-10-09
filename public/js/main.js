// @ts-check
/**
 * @file public/js/main.js
 * @description Main application controller for Red Team My Life.
 * Wires together API streaming, DOM components, accessibility announcements,
 * and state transitions with safe DOM construction and strict CSP.
 */

import { fetchMetadata, streamReview } from './api.js';
import { createPersonaGrid, updatePersonaCard, markPersonaFailed } from './cards.js';
import { createJudgeSkeleton, renderJudgePanel } from './judge.js';
import { formatCharCounter } from './lib.js';
import { h, clearElement } from './dom.js';
import { createIcon } from './icons.js';

// Application State
let appMetadata = null;
let currentAbortController = null;
let currentExampleId = null;
let countdownInterval = null;

// DOM References
const formEl = /** @type {HTMLFormElement} */ (document.getElementById('review-form'));
const planInput = /** @type {HTMLTextAreaElement} */ (document.getElementById('plan-input'));
const charCounter = /** @type {HTMLElement} */ (document.getElementById('char-counter'));
const modeSelect = /** @type {HTMLSelectElement} */ (document.getElementById('mode-select'));
const exampleButtonsContainer = /** @type {HTMLElement} */ (document.getElementById('example-buttons'));
const submitBtn = /** @type {HTMLButtonElement} */ (document.getElementById('submit-btn'));
const stopBtn = /** @type {HTMLButtonElement} */ (document.getElementById('stop-btn'));
const statusRegion = /** @type {HTMLElement} */ (document.getElementById('status-region'));
const safetyPanel = /** @type {HTMLElement} */ (document.getElementById('safety-panel'));
const errorPanel = /** @type {HTMLElement} */ (document.getElementById('error-panel'));
const resultsSection = /** @type {HTMLElement} */ (document.getElementById('results-section'));
const resultsHeading = /** @type {HTMLElement} */ (document.getElementById('results-heading'));
const personaContainer = /** @type {HTMLElement} */ (document.getElementById('persona-cards-container'));
const judgeContainer = /** @type {HTMLElement} */ (document.getElementById('judge-container'));

/**
 * Announces messages to screen readers via polite live region.
 * @param {string} message
 */
function announce(message) {
  if (!message) return;
  const liveEl = document.getElementById('status-region');
  if (liveEl) {
    liveEl.textContent = message;
  }
}

/**
 * Updates the textarea character counter.
 */
function updateCounter() {
  const max = appMetadata?.maxPlanLength || 2000;
  charCounter.textContent = formatCharCounter(planInput.value.length, max);
}

/**
 * Sets form interactive state.
 * @param {boolean} running
 */
function setRunningState(running) {
  if (running) {
    submitBtn.disabled = true;
    submitBtn.hidden = true;
    submitBtn.setAttribute('aria-hidden', 'true');
    stopBtn.hidden = false;
    stopBtn.removeAttribute('aria-hidden');
    stopBtn.disabled = false;
    planInput.disabled = true;
    modeSelect.disabled = true;
    resultsSection.hidden = false;
    resultsSection.setAttribute('aria-busy', 'true');
  } else {
    submitBtn.disabled = false;
    submitBtn.hidden = false;
    submitBtn.removeAttribute('aria-hidden');
    stopBtn.hidden = true;
    stopBtn.setAttribute('aria-hidden', 'true');
    stopBtn.disabled = true;
    planInput.disabled = false;
    modeSelect.disabled = false;
    resultsSection.setAttribute('aria-busy', 'false');
  }
}

/**
 * Clears status and notification panels.
 */
function clearBanners() {
  clearElement(statusRegion);
  statusRegion.className = 'status-region';
  safetyPanel.hidden = true;
  clearElement(safetyPanel);
  errorPanel.hidden = true;
  clearElement(errorPanel);
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
}

/**
 * Renders support resource panel when safety guard triggers.
 * @param {string} message
 */
function renderSafetyPanel(message) {
  clearBanners();
  resultsSection.hidden = true;
  safetyPanel.hidden = false;

  safetyPanel.append(
    h('h3', { className: 'safety-title' }, 'Support & Crisis Resources'),
    h('p', { className: 'safety-message' }, message)
  );

  announce('Crisis support resources displayed.');
  safetyPanel.scrollIntoView({ behavior: 'smooth' });
}

/**
 * Renders structured error messages with recovery options.
 * @param {object} err
 * @param {string} [err.code]
 * @param {string} [err.message]
 * @param {number|null} [err.retryAfterSeconds]
 * @param {boolean} [err.sampleAvailable]
 */
function renderErrorPanel({ code, message, retryAfterSeconds, sampleAvailable }) {
  clearBanners();
  errorPanel.hidden = false;

  let title = 'Unable to Complete Analysis';
  let desc = message || 'An unexpected error occurred while reviewing your plan.';

  if (code === 'busy' || code === 'concurrency_limit' || code === 'rate_limited') {
    title = 'System at Full Capacity';
  } else if (code === 'demo_only') {
    title = 'Demo Mode Active';
    desc = 'Running in zero-API demo mode. Select one of the 3 benchmark plans below to explore full Council review capabilities.';
  } else if (code === 'invalid_request') {
    title = 'Invalid Plan Submission';
  }

  const actionsRow = h('div', { className: 'error-actions' });

  // Retry Button
  const retryBtn = h(
    'button',
    {
      type: 'button',
      className: 'btn-secondary',
      onClick: () => {
        clearBanners();
        formEl.requestSubmit();
      },
    },
    createIcon('refresh', 'btn-icon'),
    h('span', {}, 'Try Again')
  );
  actionsRow.appendChild(retryBtn);

  // Countdown timer if retry-after is provided
  let countdownSpan = null;
  if (typeof retryAfterSeconds === 'number' && retryAfterSeconds > 0) {
    let remaining = retryAfterSeconds;
    countdownSpan = h('span', { className: 'countdown-timer' }, `Retry available in ${remaining}s`);
    actionsRow.appendChild(countdownSpan);

    retryBtn.disabled = true;
    countdownInterval = setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        clearInterval(countdownInterval);
        countdownInterval = null;
        retryBtn.disabled = false;
        if (countdownSpan) countdownSpan.textContent = 'Ready to retry.';
      } else if (countdownSpan) {
        countdownSpan.textContent = `Retry available in ${remaining}s`;
      }
    }, 1000);
  }

  // Sample Review Button
  if (sampleAvailable && appMetadata?.examples?.[0]) {
    const sampleBtn = h(
      'button',
      {
        type: 'button',
        className: 'btn-primary',
        onClick: () => {
          clearBanners();
          const firstEx = appMetadata.examples[0];
          planInput.value = firstEx.plan;
          currentExampleId = firstEx.id;
          updateCounter();
          modeSelect.value = 'demo';
          formEl.requestSubmit();
        },
      },
      h('span', {}, 'Show a Sample Review')
    );
    actionsRow.appendChild(sampleBtn);
  }

  errorPanel.append(
    h('h3', { className: 'error-title' }, title),
    h('p', { className: 'error-message' }, desc),
    actionsRow
  );

  announce(`Error: ${title}. ${desc}`);
  errorPanel.scrollIntoView({ behavior: 'smooth' });
}

/**
 * Handles plan form submission and runs the review pipeline.
 * @param {SubmitEvent} e
 */
async function handleFormSubmit(e) {
  e.preventDefault();

  const rawPlan = planInput.value.trim();
  if (!rawPlan) {
    planInput.focus();
    return;
  }

  clearBanners();
  setRunningState(true);

  // Initialize 5 persona cards in thinking skeleton state
  clearElement(personaContainer);
  const { gridEl, cardMap } = createPersonaGrid(appMetadata.personas || []);
  personaContainer.appendChild(gridEl);

  // Initialize Judge skeleton state
  clearElement(judgeContainer);
  const judgeSkeleton = createJudgeSkeleton();
  judgeContainer.appendChild(judgeSkeleton);

  announce('Plan submitted. Council members are reviewing in parallel.');

  currentAbortController = new AbortController();
  const selectedMode = /** @type {'auto' | 'live' | 'quick' | 'demo'} */ (modeSelect.value);
  let activeMode = selectedMode;

  // Stagger queue for quick mode
  const quickRevealQueue = [];
  let isQueueProcessing = false;
  const isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  async function processQuickQueue() {
    if (isQueueProcessing) return;
    isQueueProcessing = true;
    while (quickRevealQueue.length > 0) {
      const item = quickRevealQueue.shift();
      if (item) {
        item();
      }
      if (!isReducedMotion) {
        await new Promise(r => setTimeout(r, 150));
      }
    }
    isQueueProcessing = false;
  }

  await streamReview({
    plan: rawPlan,
    mode: selectedMode,
    exampleId: currentExampleId || undefined,
    signal: currentAbortController.signal,
    onEvent: event => {
      switch (event.event) {
        case 'mode_selected': {
          activeMode = event.mode;
          statusRegion.className = 'status-region status-info';
          const modeLabels = {
            live: 'Live Parallel Debate Mode',
            quick: 'Quick Combined Mode',
            demo: 'Benchmark Demo Mode',
          };
          statusRegion.textContent = `⚡ Operating in ${modeLabels[event.mode] || event.mode.toUpperCase()}`;
          announce(`Running in ${event.mode} mode.`);
          break;
        }

        case 'degraded': {
          statusRegion.className = 'status-region status-degraded';
          statusRegion.textContent = `⚠️ Mode adjusted from ${event.from} to ${event.to}: ${event.reason}`;
          announce(`Mode degraded to ${event.to}: ${event.reason}`);
          break;
        }

        case 'persona_done': {
          const cardEl = cardMap.get(event.persona);
          const meta = (appMetadata.personas || []).find(p => p.id === event.persona) || {
            id: event.persona,
            displayName: event.persona,
            role: 'Council Member',
            itemLabel: 'Risk',
            scoreLabel: 'Severity',
            fixLabel: 'Fix',
            icon: 'skull',
          };

          if (cardEl) {
            const revealAction = () => {
              updatePersonaCard(cardEl, event.data, meta);
              announce(`${meta.displayName} evaluation completed.`);
            };

            if (activeMode === 'quick') {
              quickRevealQueue.push(revealAction);
              processQuickQueue();
            } else {
              revealAction();
            }
          }
          break;
        }

        case 'persona_failed': {
          const cardEl = cardMap.get(event.persona);
          const meta = (appMetadata.personas || []).find(p => p.id === event.persona) || {
            id: event.persona,
            displayName: event.persona,
            role: 'Council Member',
            icon: 'skull',
          };
          if (cardEl) {
            markPersonaFailed(cardEl, meta, event.error);
            announce(`${meta.displayName} analysis unavailable.`);
          }
          break;
        }

        case 'judge_done': {
          // Flush any pending persona card reveals first
          while (quickRevealQueue.length > 0) {
            const flushFn = quickRevealQueue.shift();
            if (flushFn) flushFn();
          }

          renderJudgePanel(judgeContainer, event.data, announce);
          setRunningState(false);
          announce('Executive Judge hardened synthesis completed.');

          // Move keyboard focus to results heading for accessibility
          resultsHeading.focus();
          break;
        }

        case 'safety': {
          setRunningState(false);
          renderSafetyPanel(event.message);
          break;
        }

        case 'error': {
          setRunningState(false);
          renderErrorPanel(event);
          break;
        }
      }
    },
    onError: err => {
      setRunningState(false);
      renderErrorPanel({
        // @ts-ignore
        code: err.code || 'network_error',
        message: err.message,
        // @ts-ignore
        retryAfterSeconds: err.retryAfterSeconds,
        sampleAvailable: true,
      });
    },
  });

  currentAbortController = null;
}

/**
 * Handles Stop button click to cancel in-flight stream.
 */
function handleStopClick() {
  if (currentAbortController) {
    currentAbortController.abort();
    currentAbortController = null;
    setRunningState(false);
    statusRegion.className = 'status-region status-info';
    statusRegion.textContent = '🛑 Analysis stopped by user.';
    announce('Analysis cancelled.');
  }
}

/**
 * Initializes application on page load.
 */
async function init() {
  // Event listeners
  planInput.addEventListener('input', () => {
    updateCounter();
    currentExampleId = null; // Clear example association when user edits manually
  });

  formEl.addEventListener('submit', handleFormSubmit);
  stopBtn.addEventListener('click', handleStopClick);

  // Fetch /api/meta
  try {
    appMetadata = await fetchMetadata();

    // Set max length
    if (appMetadata.maxPlanLength) {
      planInput.setAttribute('maxlength', String(appMetadata.maxPlanLength));
      updateCounter();
    }

    // Populate benchmark example buttons
    clearElement(exampleButtonsContainer);
    if (Array.isArray(appMetadata.examples)) {
      appMetadata.examples.forEach(ex => {
        const btn = h(
          'button',
          {
            type: 'button',
            className: 'btn-example',
            'aria-label': `Load example: ${ex.title}`,
            onClick: () => {
              planInput.value = ex.plan;
              currentExampleId = ex.id;
              updateCounter();
              planInput.focus();
              announce(`Loaded benchmark plan: ${ex.title}`);
            },
          },
          h('span', {}, ex.title)
        );
        exampleButtonsContainer.appendChild(btn);
      });
    }
  } catch (err) {
    console.warn('Could not load /api/meta; running with defaults.', err);
    updateCounter();
  }
}

// Boot
init();
