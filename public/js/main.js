// @ts-check
/**
 * @file public/js/main.js
 * @description Main application controller for Red Team My Life.
 * Wires API streaming, DOM components, accessibility announcements, and state transitions.
 * Strict CSP: no inline scripts, no inner-HTML, no style-attr attributes.
 */

import { fetchMetadata, streamReview } from './api.js';
import { createPersonaGrid, updatePersonaCard, markPersonaFailed } from './cards.js';
import { createJudgeSkeleton, renderJudgePanel } from './judge.js';
import { formatCharCounter } from './lib.js';
import { h, clearElement } from './dom.js';
import { createIcon } from './icons.js';
import { createProgressStrip, updateProgressStrip } from './progress.js';
import { renderEmptyState, renderSafetyPanel, renderErrorPanel } from './states.js';

// ──────────────────────────────────────────────
// App State
// ──────────────────────────────────────────────

/** @type {any} */
let appMetadata = null;
/** @type {AbortController | null} */
let currentAbortController = null;
/** @type {string | null} */
let currentExampleId = null;
/** @type {ReturnType<typeof setInterval> | null} */
let countdownInterval = null;

/**
 * Streaming progress state.
 * @type {{ planSent: boolean, personasDone: number, totalPersonas: number, judgeStarted: boolean, judgeDone: boolean, mode: string | null, degradedFrom: string | null, degradedTo: string | null }}
 */
let progressState = resetProgressState();

function resetProgressState() {
  return {
    planSent: false, personasDone: 0, totalPersonas: 5,
    judgeStarted: false, judgeDone: false,
    mode: null, degradedFrom: null, degradedTo: null,
  };
}

// ──────────────────────────────────────────────
// DOM References
// ──────────────────────────────────────────────

const formEl        = /** @type {HTMLFormElement} */     (document.getElementById('review-form'));
const planInput     = /** @type {HTMLTextAreaElement} */ (document.getElementById('plan-input'));
const charCounter   = /** @type {HTMLElement} */         (document.getElementById('char-counter'));
const modeSelect    = /** @type {HTMLSelectElement} */   (document.getElementById('mode-select'));
const exampleBtns   = /** @type {HTMLElement} */         (document.getElementById('example-buttons'));
const submitBtn     = /** @type {HTMLButtonElement} */   (document.getElementById('submit-btn'));
const stopBtn       = /** @type {HTMLButtonElement} */   (document.getElementById('stop-btn'));
const statusRegion  = /** @type {HTMLElement} */         (document.getElementById('status-region'));
const safetyPanel   = /** @type {HTMLElement} */         (document.getElementById('safety-panel'));
const errorPanel    = /** @type {HTMLElement} */         (document.getElementById('error-panel'));
const emptyState    = /** @type {HTMLElement} */         (document.getElementById('empty-state'));
const progressWrap  = /** @type {HTMLElement} */         (document.getElementById('progress-wrap'));
const resultsSection= /** @type {HTMLElement} */         (document.getElementById('results-section'));
const resultsHeading= /** @type {HTMLElement} */         (document.getElementById('results-heading'));
const personaCont   = /** @type {HTMLElement} */         (document.getElementById('persona-cards-container'));
const judgeCont     = /** @type {HTMLElement} */         (document.getElementById('judge-container'));

// ──────────────────────────────────────────────
// Live Region Announcement
// ──────────────────────────────────────────────

/** @param {string} message */
function announce(message) {
  if (!message) return;
  const el = document.getElementById('status-region');
  if (el) el.textContent = message;
}

// ──────────────────────────────────────────────
// Character Counter
// ──────────────────────────────────────────────

function updateCounter() {
  const max = appMetadata?.maxPlanLength || 2000;
  charCounter.textContent = formatCharCounter(planInput.value.length, max);
}

// ──────────────────────────────────────────────
// Running State Management
// ──────────────────────────────────────────────

/** @param {boolean} running */
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
    if (emptyState) emptyState.hidden = true;
    if (progressWrap) progressWrap.hidden = false;
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

// ──────────────────────────────────────────────
// Banner Clearing
// ──────────────────────────────────────────────

function clearBanners() {
  clearElement(statusRegion);
  safetyPanel.hidden = true;
  clearElement(safetyPanel);
  errorPanel.hidden = true;
  clearElement(errorPanel);
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
}

// ──────────────────────────────────────────────
// Progress Strip
// ──────────────────────────────────────────────

/** @type {HTMLElement | null} */
let progressStripEl = null;

function refreshProgressStrip() {
  if (progressStripEl && progressWrap) {
    updateProgressStrip(progressStripEl, progressState);
  }
}

// ──────────────────────────────────────────────
// New Review Reset
// ──────────────────────────────────────────────

function handleNewReview() {
  // Clear results area and show input form fresh
  clearElement(personaCont);
  clearElement(judgeCont);
  resultsSection.hidden = true;
  clearBanners();
  if (progressStripEl) {
    progressStripEl.hidden = true;
  }
  progressState = resetProgressState();
  planInput.value = '';
  currentExampleId = null;
  updateCounter();
  if (emptyState) renderEmptyState(emptyState);
  planInput.focus();
  announce('Review cleared. Ready for a new plan.');
}

// ──────────────────────────────────────────────
// Form Submit
// ──────────────────────────────────────────────

/** @param {SubmitEvent} e */
async function handleFormSubmit(e) {
  e.preventDefault();
  const rawPlan = planInput.value.trim();
  if (!rawPlan) { planInput.focus(); return; }

  clearBanners();
  progressState = resetProgressState();
  progressState.planSent = true;
  progressState.totalPersonas = (appMetadata?.personas || []).length || 5;
  setRunningState(true);
  refreshProgressStrip();

  // Init persona grid
  clearElement(personaCont);
  const { gridEl, cardMap } = createPersonaGrid(appMetadata?.personas || []);
  personaCont.appendChild(gridEl);

  // Init judge skeleton
  clearElement(judgeCont);
  const judgeSkeleton = createJudgeSkeleton();
  judgeCont.appendChild(judgeSkeleton);

  announce('Plan submitted. Council members are reviewing in parallel.');

  currentAbortController = new AbortController();
  const selectedMode = /** @type {'auto' | 'live' | 'quick' | 'demo'} */ (modeSelect.value);
  let activeMode = selectedMode;

  // Stagger queue for quick mode
  const quickRevealQueue = /** @type {Array<() => void>} */ ([]);
  let isQueueProcessing = false;
  const isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  async function processQuickQueue() {
    if (isQueueProcessing) return;
    isQueueProcessing = true;
    while (quickRevealQueue.length > 0) {
      const item = quickRevealQueue.shift();
      if (item) item();
      if (!isReducedMotion) await new Promise(r => setTimeout(r, 150));
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
          progressState.mode = event.mode;
          refreshProgressStrip();
          announce(`Running in ${event.mode} mode.`);
          break;
        }

        case 'degraded': {
          progressState.degradedFrom = event.from;
          progressState.degradedTo = event.to;
          progressState.mode = event.to;
          refreshProgressStrip();
          announce(`Mode adjusted to ${event.to}: ${event.reason}`);
          break;
        }

        case 'persona_done': {
          progressState.personasDone += 1;
          refreshProgressStrip();

          const cardEl = cardMap.get(event.persona);
          const meta = (appMetadata?.personas || []).find(
            (/** @type {any} */ p) => p.id === event.persona
          ) || { id: event.persona, displayName: event.persona, role: 'Council Member', itemLabel: 'Risk', scoreLabel: 'Severity', fixLabel: 'Fix', icon: 'skull' };

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
          const meta = (appMetadata?.personas || []).find(
            (/** @type {any} */ p) => p.id === event.persona
          ) || { id: event.persona, displayName: event.persona, role: 'Council Member', icon: 'skull' };
          if (cardEl) {
            markPersonaFailed(cardEl, meta, event.error);
            announce(`${meta.displayName} analysis unavailable.`);
          }
          break;
        }

        case 'judge_done': {
          // Flush quick-mode queue
          while (quickRevealQueue.length > 0) {
            const fn = quickRevealQueue.shift();
            if (fn) fn();
          }
          progressState.judgeStarted = true;
          progressState.judgeDone = true;
          refreshProgressStrip();

          renderJudgePanel(judgeCont, event.data, announce, {
            onNewReview: handleNewReview,
          });
          setRunningState(false);
          announce('Executive Judge hardened synthesis completed.');
          resultsHeading.focus();
          break;
        }

        case 'safety': {
          setRunningState(false);
          resultsSection.hidden = true;
          if (progressWrap) progressWrap.hidden = true;
          renderSafetyPanel(safetyPanel, event.message);
          announce('Crisis support resources displayed.');
          safetyPanel.scrollIntoView({ behavior: 'smooth' });
          break;
        }

        case 'error': {
          setRunningState(false);
          const { countdownInterval: ci } = renderErrorPanel(errorPanel, {
            code: event.code,
            message: event.message,
            retryAfterSeconds: event.retryAfterSeconds,
            sampleAvailable: event.sampleAvailable,
            appMetadata,
            planInput,
            modeSelect,
            formEl,
            onClear: clearBanners,
            onUpdateCounter: () => updateCounter(),
            onSetExampleId: (id) => { currentExampleId = id; },
          });
          if (ci) countdownInterval = ci;
          announce(`Error: ${event.message || 'Review failed.'}`);
          errorPanel.scrollIntoView({ behavior: 'smooth' });
          break;
        }
      }
    },
    onError: err => {
      setRunningState(false);
      const { countdownInterval: ci } = renderErrorPanel(errorPanel, {
        // @ts-ignore
        code: err.code || 'network_error',
        message: err.message,
        // @ts-ignore
        retryAfterSeconds: err.retryAfterSeconds,
        sampleAvailable: true,
        appMetadata,
        planInput,
        modeSelect,
        formEl,
        onClear: clearBanners,
        onUpdateCounter: () => updateCounter(),
        onSetExampleId: (id) => { currentExampleId = id; },
      });
      if (ci) countdownInterval = ci;
      announce('Connection error. Please retry.');
      errorPanel.scrollIntoView({ behavior: 'smooth' });
    },
  });

  currentAbortController = null;
}

// ──────────────────────────────────────────────
// Stop Button
// ──────────────────────────────────────────────

function handleStopClick() {
  if (currentAbortController) {
    currentAbortController.abort();
    currentAbortController = null;
    setRunningState(false);
    statusRegion.textContent = 'Analysis stopped by user.';
    announce('Analysis cancelled.');
  }
}

// ──────────────────────────────────────────────
// Boot / Init
// ──────────────────────────────────────────────

async function init() {
  // ── Progress strip setup ───────────────────
  if (progressWrap) {
    progressStripEl = createProgressStrip();
    progressWrap.appendChild(progressStripEl);
  }

  // ── Empty state ────────────────────────────
  if (emptyState) renderEmptyState(emptyState);

  // ── Keyboard shortcut: Ctrl/Cmd+Enter ─────
  planInput.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      formEl.requestSubmit();
    }
  });

  // ── Character counter ──────────────────────
  planInput.addEventListener('input', () => {
    updateCounter();
    currentExampleId = null;
  });

  // ── Form & Stop ────────────────────────────
  formEl.addEventListener('submit', handleFormSubmit);
  stopBtn.addEventListener('click', handleStopClick);

  // ── Fetch /api/meta ────────────────────────
  try {
    appMetadata = await fetchMetadata();

    if (appMetadata.maxPlanLength) {
      planInput.setAttribute('maxlength', String(appMetadata.maxPlanLength));
    }
    updateCounter();

    // Populate benchmark example cards
    clearElement(exampleBtns);
    if (Array.isArray(appMetadata.examples)) {
      appMetadata.examples.forEach((/** @type {any} */ ex) => {
        const preview = ex.plan.slice(0, 80).replace(/\n/g, ' ');
        const btn = h(
          'button',
          {
            type: 'button',
            className: 'example-card-btn',
            'aria-label': `Load benchmark plan: ${ex.title}`,
            onClick: () => {
              planInput.value = ex.plan;
              currentExampleId = ex.id;
              updateCounter();
              planInput.focus();
              announce(`Loaded benchmark plan: ${ex.title}`);
            },
          },
          h('span', { className: 'example-card-title' }, ex.title),
          h('span', { className: 'example-card-preview' }, preview + (ex.plan.length > 80 ? '…' : ''))
        );
        exampleBtns.appendChild(btn);
      });
    }
  } catch (err) {
    console.warn('Could not load /api/meta; running with defaults.', err);
    updateCounter();
  }
}

init();
