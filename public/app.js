// @ts-check
/**
 * @file public/app.js
 * @description Frontend logic for Red Team My Life.
 * Streams NDJSON responses, renders progressive updates, handles error degradation,
 * and animates survival probability scores.
 */

// DOM Elements
const planInput = /** @type {HTMLTextAreaElement} */ (document.getElementById('plan-input'));
const charCounter = document.getElementById('char-counter');
const reviewForm = /** @type {HTMLFormElement} */ (document.getElementById('review-form'));
const submitBtn = /** @type {HTMLButtonElement} */ (document.getElementById('submit-btn'));
const btnSpinner = submitBtn.querySelector('.btn-spinner');
const btnText = submitBtn.querySelector('.btn-text');
const modeSelect = /** @type {HTMLSelectElement} */ (document.getElementById('mode-select'));
const streamStatusCard = document.getElementById('stream-status-card');
const streamModeBadge = document.getElementById('stream-mode-badge');
const streamStatusMsg = document.getElementById('stream-status-msg');
const progressFill = document.getElementById('stream-progress-fill');
const errorAlert = document.getElementById('error-alert');
const errorTitle = document.getElementById('error-title');
const errorBody = document.getElementById('error-body');
const btnLoadSample = document.getElementById('btn-load-sample');
const btnDismissError = document.getElementById('btn-dismiss-error');
const judgeSection = document.getElementById('judge-section');
const statusLabel = document.getElementById('status-label');

let currentAbortController = null;
let selectedExampleId = null;

// Benchmark Example Definitions
const EXAMPLE_PLANS = {
  'career-change': "I am quitting my $130k software engineer job next month to develop a retro pixel-art RPG full-time. I have $25k in savings (about 5 months of living expenses). I have built game prototypes before but never shipped a commercial title. I plan to finish the game in 6 months, launch on Steam, and sustain myself from game sales.",
  'startup-idea': "Building an AI phone receptionist and appointment scheduler specifically for private dental practices. Target price $199/month. I plan to build the product over 3 months, run Google Ads, and acquire 50 dental practices in the first quarter post-launch.",
  'big-purchase': "I make $75k/year pre-tax. I have $5k saved for a down payment and plan to finance a new $65k electric SUV on a 72-month loan at 6.8% interest (about $1,020/month payment). I justify this because I will save $180/month on gasoline and the car has high safety ratings.",
};

// Initial System Health Check
async function checkSystemStatus() {
  try {
    const res = await fetch('/api/status');
    if (!res.ok) throw new Error('Status unavailable');
    const data = await res.json();
    const healthyPersonas = data.models?.personas?.filter(p => p.healthy).length || 0;
    if (data.demoMode) {
      statusLabel.textContent = 'Demo Mode (Zero API Calls)';
    } else {
      statusLabel.textContent = `Online • ${healthyPersonas} Models Ready`;
    }
  } catch {
    statusLabel.textContent = 'API Connected';
  }
}

// Character counter listener
planInput.addEventListener('input', () => {
  const len = planInput.value.length;
  charCounter.textContent = `${len} / 2000`;
  if (len > 2000) {
    charCounter.style.color = '#ef4444';
  } else {
    charCounter.style.color = '';
  }
});

// Example buttons
document.querySelectorAll('.btn-example').forEach(btn => {
  btn.addEventListener('click', () => {
    const exampleKey = btn.getAttribute('data-example');
    if (exampleKey && EXAMPLE_PLANS[exampleKey]) {
      planInput.value = EXAMPLE_PLANS[exampleKey];
      selectedExampleId = exampleKey;
      planInput.dispatchEvent(new Event('input'));
      reviewForm.scrollIntoView({ behavior: 'smooth' });
    }
  });
});

// Error alert dismissal
btnDismissError?.addEventListener('click', () => {
  errorAlert.hidden = true;
});

// Load sample fallback button
btnLoadSample?.addEventListener('click', () => {
  errorAlert.hidden = true;
  selectedExampleId = 'career-change';
  planInput.value = EXAMPLE_PLANS['career-change'];
  planInput.dispatchEvent(new Event('input'));
  modeSelect.value = 'demo';
  submitReview();
});

// Form submission
reviewForm.addEventListener('submit', e => {
  e.preventDefault();
  submitReview();
});

function resetUI() {
  errorAlert.hidden = true;
  judgeSection.hidden = true;
  streamStatusCard.hidden = false;
  progressFill.style.width = '5%';
  streamStatusMsg.textContent = 'Initializing multi-agent session...';

  // Reset all persona cards
  const personaCards = document.querySelectorAll('.persona-card');
  personaCards.forEach(card => {
    const statusBadge = card.querySelector('.persona-status-badge');
    const emptyState = card.querySelector('.card-empty-state');
    const content = card.querySelector('.persona-content');

    if (statusBadge) {
      statusBadge.className = 'persona-status-badge status-active';
      statusBadge.textContent = 'Analyzing...';
    }
    if (emptyState) emptyState.hidden = false;
    if (content) {
      content.hidden = true;
      content.innerHTML = '';
    }
  });
}

function setSubmitting(isSubmitting) {
  submitBtn.disabled = isSubmitting;
  btnSpinner.hidden = !isSubmitting;
  btnText.textContent = isSubmitting ? 'ANALYZING...' : 'DEPLOY RED TEAM';
}

async function submitReview() {
  const plan = planInput.value.trim();
  if (!plan) {
    planInput.focus();
    return;
  }

  // Cancel prior request if still active
  if (currentAbortController) {
    currentAbortController.abort();
  }
  currentAbortController = new AbortController();

  resetUI();
  setSubmitting(true);

  let personasCompleted = 0;

  try {
    const response = await fetch('/api/review', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        plan,
        mode: modeSelect.value,
        exampleId: selectedExampleId,
      }),
      signal: currentAbortController.signal,
    });

    if (!response.ok) {
      const errorJson = await response.json().catch(() => ({}));
      throw new Error(errorJson?.error?.message || `HTTP ${response.status}`);
    }

    // Read NDJSON stream
    const reader = response.body?.getReader();
    if (!reader) throw new Error('Streaming response body not supported');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const event = JSON.parse(line.trim());
          handleStreamEvent(event, () => {
            personasCompleted++;
            const pct = Math.min(85, 10 + personasCompleted * 15);
            progressFill.style.width = `${pct}%`;
          });
        } catch (err) {
          console.error('Failed to parse NDJSON line:', line, err);
        }
      }
    }

    progressFill.style.width = '100%';
    setTimeout(() => {
      streamStatusCard.hidden = true;
    }, 1500);
  } catch (err) {
    if (err.name === 'AbortError') return;
    showError('Execution Error', err.message);
    streamStatusCard.hidden = true;
  } finally {
    setSubmitting(false);
    selectedExampleId = null;
  }
}

/**
 * Handles individual NDJSON stream events.
 * @param {any} event
 * @param {() => void} onPersonaDone
 */
function handleStreamEvent(event, onPersonaDone) {
  switch (event.event) {
    case 'mode_selected':
      streamModeBadge.textContent = `${event.mode.toUpperCase()} MODE`;
      streamStatusMsg.textContent = `Running ${event.mode} mode attack...`;
      break;

    case 'persona_done':
      renderPersonaSuccess(event.persona, event.data);
      streamStatusMsg.textContent = `Completed critique: ${formatPersonaName(event.persona)}`;
      onPersonaDone();
      break;

    case 'persona_failed':
      renderPersonaFailure(event.persona, event.error);
      streamStatusMsg.textContent = `Notice: ${formatPersonaName(event.persona)} critique was skipped`;
      onPersonaDone();
      break;

    case 'degraded':
      streamModeBadge.textContent = `${event.to.toUpperCase()} MODE (DEGRADED)`;
      streamStatusMsg.textContent = `Auto-degraded: ${event.reason}`;
      break;

    case 'judge_done':
      renderJudgeVerdict(event.data);
      streamStatusMsg.textContent = 'Hardened analysis complete!';
      progressFill.style.width = '100%';
      break;

    case 'error':
      showError(
        event.code === 'busy' ? 'High Traffic / Quota Congested' : 'Review Error',
        event.message,
        event.sampleAvailable
      );
      break;

    default:
      console.log('Unhandled event:', event);
  }
}

/**
 * Renders a successful persona critique into its card.
 * @param {string} personaKey
 * @param {any} data
 */
function renderPersonaSuccess(personaKey, data) {
  const card = document.getElementById(`card-${personaKey}`);
  if (!card) return;

  const statusBadge = card.querySelector('.persona-status-badge');
  const emptyState = card.querySelector('.card-empty-state');
  const content = card.querySelector('.persona-content');

  if (statusBadge) {
    statusBadge.className = 'persona-status-badge status-done';
    statusBadge.textContent = 'Complete';
  }

  if (emptyState) emptyState.hidden = true;

  if (content && data) {
    content.hidden = false;

    let pointsHtml = '';
    if (Array.isArray(data.points)) {
      pointsHtml = data.points
        .map(
          pt => `
        <li class="point-item">
          <div class="point-header">
            <span class="point-claim">${escapeHtml(pt.claim)}</span>
            <span class="severity-badge severity-${pt.severity}">Lvl ${pt.severity}</span>
          </div>
          <div class="point-fix"><strong>Mitigation:</strong> ${escapeHtml(pt.suggestedFix)}</div>
        </li>
      `
        )
        .join('');
    }

    content.innerHTML = `
      <h4 class="persona-headline">"${escapeHtml(data.headline)}"</h4>
      <ul class="points-list">${pointsHtml}</ul>
      <div class="persona-verdict"><strong>Verdict:</strong> ${escapeHtml(data.verdict)}</div>
    `;
  }
}

/**
 * Renders a failed persona state.
 * @param {string} personaKey
 * @param {string} errorMsg
 */
function renderPersonaFailure(personaKey, errorMsg) {
  const card = document.getElementById(`card-${personaKey}`);
  if (!card) return;

  const statusBadge = card.querySelector('.persona-status-badge');
  const emptyState = card.querySelector('.card-empty-state');

  if (statusBadge) {
    statusBadge.className = 'persona-status-badge status-failed';
    statusBadge.textContent = 'Unavailable';
  }

  if (emptyState) {
    emptyState.hidden = false;
    emptyState.textContent = `Model quota or response timeout: ${errorMsg}`;
  }
}

/**
 * Renders the Judge's hardened verdict and animates scores.
 * @param {any} data
 */
function renderJudgeVerdict(data) {
  if (!data) return;

  judgeSection.hidden = false;

  // Animate before and after scores
  animateScore('score-before-val', 0, data.survivalScoreBefore, 1000);
  animateScore('score-after-val', 0, data.survivalScoreAfter, 1200);

  const delta = data.survivalScoreAfter - data.survivalScoreBefore;
  const deltaBadge = document.getElementById('score-delta-badge');
  if (deltaBadge) {
    deltaBadge.textContent = `${delta >= 0 ? '+' : ''}${delta}% Boost`;
  }

  // Rationale
  const rationaleEl = document.getElementById('judge-rationale');
  if (rationaleEl) rationaleEl.textContent = data.rationale || '';

  // Top Risks
  const risksList = document.getElementById('judge-top-risks');
  if (risksList && Array.isArray(data.topRisks)) {
    risksList.innerHTML = data.topRisks
      .map(risk => `<li>${escapeHtml(risk)}</li>`)
      .join('');
  }

  // Hardened Plan
  const planEl = document.getElementById('judge-hardened-plan');
  if (planEl) planEl.textContent = data.hardenedPlan || '';

  // Action Items
  const actionsList = document.getElementById('judge-action-items');
  if (actionsList && Array.isArray(data.actionItems)) {
    actionsList.innerHTML = data.actionItems
      .map(
        item => `
      <li>
        <span>${escapeHtml(item.task)}</span>
        <span class="action-due">Due in ${item.dueInDays} days</span>
      </li>
    `
      )
      .join('');
  }

  // Unresolved Questions
  const questionsContainer = document.getElementById('judge-questions-container');
  const questionsList = document.getElementById('judge-unresolved-questions');
  if (data.unresolvedQuestions?.length > 0 && questionsContainer && questionsList) {
    questionsContainer.hidden = false;
    questionsList.innerHTML = data.unresolvedQuestions
      .map(q => `<li>${escapeHtml(q)}</li>`)
      .join('');
  }

  // Scroll to judge section
  judgeSection.scrollIntoView({ behavior: 'smooth' });
}

/**
 * Animates a numeric score up to its target percentage.
 * @param {string} elementId
 * @param {number} start
 * @param {number} end
 * @param {number} durationMs
 */
function animateScore(elementId, start, end, durationMs) {
  const el = document.getElementById(elementId);
  if (!el) return;

  const startTime = performance.now();
  function update(now) {
    const elapsed = now - startTime;
    const progress = Math.min(1, elapsed / durationMs);
    // Ease-out expo
    const current = Math.round(start + (end - start) * (1 - Math.pow(2, -10 * progress)));
    el.textContent = `${current}%`;
    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      el.textContent = `${end}%`;
    }
  }
  requestAnimationFrame(update);
}

function showError(title, message, sampleAvailable = false) {
  errorTitle.textContent = title;
  errorBody.textContent = message;
  btnLoadSample.hidden = !sampleAvailable;
  errorAlert.hidden = false;
  errorAlert.scrollIntoView({ behavior: 'smooth' });
}

function formatPersonaName(name) {
  const map = {
    pessimist: 'The Pessimist',
    accountant: 'The Accountant',
    skepticalParent: 'Skeptical Parent',
    futureYou: 'Future You',
    optimist: 'The Optimist',
  };
  return map[name] || name;
}

function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Initial status check
checkSystemStatus();
