// @ts-check
/**
 * @file public/js/judge.js
 * @description Renders the Executive Judge synthesis panel: before/after SVG gauge rings,
 * hardened plan with phase cards (parseHardenedPlanPhases), action item checklist with
 * Google Calendar links, key tensions, unresolved questions, and copy/print/new-review actions.
 */

import { h, clearElement } from './dom.js';
import { createIcon } from './icons.js';
import { createCalendarLink } from './calendar.js';
import { parseHardenedPlanPhases, buildSummaryText } from './lib.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

// ──────────────────────────────────────────────
// Judge Skeleton
// ──────────────────────────────────────────────

/**
 * Creates the "Judge is synthesizing" loading skeleton.
 * @returns {HTMLElement}
 */
export function createJudgeSkeleton() {
  return h(
    'section',
    {
      className: 'judge-card is-synthesizing',
      'aria-busy': 'true',
      'aria-label': 'Executive Judge is synthesizing',
    },
    h(
      'div',
      { className: 'synthesizing-header' },
      h('div', { className: 'pulse-dot', 'aria-hidden': 'true' }),
      h('h3', { className: 'synthesizing-title' }, 'Executive Judge synthesizing council debate…'),
      h('p', { className: 'synthesizing-desc' },
        'Reconciling trade-offs, calculating survival probability delta, and drafting your hardened revised roadmap.'
      )
    ),
    h(
      'div',
      { className: 'skeleton-gauges', 'aria-hidden': 'true' },
      h('div', { className: 'skeleton-gauge-ring' }),
      h('div', { className: 'skeleton-gauge-ring' })
    )
  );
}

// ──────────────────────────────────────────────
// SVG Gauge Ring
// ──────────────────────────────────────────────

/**
 * Creates an SVG gauge ring for survival score.
 * @param {number} score  – 0 to 100
 * @param {string} label  – accessible label
 * @param {string} color  – literal CSS color string
 * @returns {HTMLElement}
 */
function createGaugeRing(score, label, color) {
  const val = Math.min(100, Math.max(0, Math.round(Number(score) || 0)));
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - val / 100);

  const svg = /** @type {SVGSVGElement} */ (document.createElementNS(SVG_NS, 'svg'));
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('width', '100');
  svg.setAttribute('height', '100');
  svg.setAttribute('class', 'gauge-svg');
  svg.setAttribute('role', 'meter');
  svg.setAttribute('aria-label', `${label}: ${val}%`);
  svg.setAttribute('aria-valuenow', String(val));
  svg.setAttribute('aria-valuemin', '0');
  svg.setAttribute('aria-valuemax', '100');

  const track = document.createElementNS(SVG_NS, 'circle');
  track.setAttribute('cx', '50'); track.setAttribute('cy', '50');
  track.setAttribute('r', String(radius)); track.setAttribute('class', 'gauge-track');

  const ring = document.createElementNS(SVG_NS, 'circle');
  ring.setAttribute('cx', '50'); ring.setAttribute('cy', '50');
  ring.setAttribute('r', String(radius)); ring.setAttribute('class', 'gauge-bar');
  ring.setAttribute('stroke', color);
  ring.setAttribute('stroke-dasharray', String(circumference));
  ring.setAttribute('stroke-dashoffset', String(offset));
  ring.setAttribute('transform', 'rotate(-90 50 50)');

  const numText = document.createElementNS(SVG_NS, 'text');
  numText.setAttribute('x', '50'); numText.setAttribute('y', '55');
  numText.setAttribute('class', 'gauge-number'); numText.setAttribute('text-anchor', 'middle');
  numText.textContent = `${val}%`;

  svg.append(track, ring, numText);

  return h(
    'div',
    { className: 'gauge-widget' },
    /** @type {HTMLElement} */ (/** @type {any} */ (svg)),
    h('span', { className: 'gauge-title' }, label)
  );
}

// ──────────────────────────────────────────────
// Clipboard Helper
// ──────────────────────────────────────────────

/**
 * @param {string} text
 * @returns {Promise<boolean>}
 */
async function copyToClipboard(text) {
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try { await navigator.clipboard.writeText(text); return true; } catch { /* fall through */ }
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.className = 'visually-hidden';
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { ok = false; }
  document.body.removeChild(ta);
  return ok;
}

// ──────────────────────────────────────────────
// Phase Cards
// ──────────────────────────────────────────────

/**
 * Renders hardened plan as phase cards (if parseable) or pre-wrap fallback.
 * @param {string} hardenedPlan
 * @returns {HTMLElement}
 */
function renderHardenedPlan(hardenedPlan) {
  const phases = parseHardenedPlanPhases(hardenedPlan);
  if (phases && phases.length > 0) {
    const container = h('div', { className: 'phase-cards-list' });
    phases.forEach((phase) => {
      container.appendChild(
        h(
          'div',
          { className: 'phase-card' },
          h('h5', { className: 'phase-card-title' }, phase.title),
          h('pre', { className: 'phase-card-content' }, phase.content)
        )
      );
    });
    return container;
  }
  // Fallback: pre-wrap plain text
  return h('pre', { className: 'hardened-plan-content' }, hardenedPlan);
}

// ──────────────────────────────────────────────
// Full Judge Panel
// ──────────────────────────────────────────────

/**
 * Renders the full Executive Judge synthesis panel.
 * @param {HTMLElement} containerEl
 * @param {any} data  – JudgeOutput
 * @param {(msg: string) => void} onAnnounce
 * @param {{ onNewReview?: () => void }} [actions]
 */
export function renderJudgePanel(containerEl, data, onAnnounce, actions = {}) {
  clearElement(containerEl);
  containerEl.removeAttribute('aria-busy');

  const delta = (data.survivalScoreAfter || 0) - (data.survivalScoreBefore || 0);
  const deltaSign = delta >= 0 ? '+' : '';
  const deltaPositive = delta >= 0;

  // ── Top Verdict Card ─────────────────────────
  const gaugesRow = h(
    'div',
    { className: 'judge-gauges-row' },
    createGaugeRing(data.survivalScoreBefore, 'Raw Plan Survival', 'var(--color-pessimist)'),
    h(
      'div',
      { className: `gauge-delta-badge ${deltaPositive ? 'delta-positive' : 'delta-negative'}` },
      h('span', { className: 'delta-label' }, 'Council Boost'),
      h('span', { className: 'delta-value' }, `${deltaSign}${delta}%`)
    ),
    createGaugeRing(data.survivalScoreAfter, 'Hardened Plan Survival', 'var(--color-optimist)')
  );

  const verdictCard = h(
    'div',
    { className: 'judge-verdict-card' },
    h(
      'div',
      { className: 'judge-verdict-header' },
      h(
        'div',
        { className: 'judge-title-area' },
        h('h3', { id: 'judge-verdict-heading', className: 'judge-main-heading' },
          'Executive Judge Synthesis'
        ),
        h('p', { className: 'judge-subtitle' },
          'Conservative adversarial synthesis and hardened execution roadmap'
        )
      ),
      gaugesRow
    ),
    // Rationale
    h(
      'div',
      { className: 'judge-section judge-rationale-sec' },
      h('h4', { className: 'section-heading' }, 'Executive Rationale'),
      h('p', { className: 'judge-rationale-text' }, data.rationale || '')
    ),
    // Top 3 Fatal Risks
    h(
      'div',
      { className: 'judge-section judge-risks-sec' },
      h('h4', { className: 'section-heading' }, 'Top 3 Fatal Risks'),
      h(
        'ol',
        { className: 'judge-risks-list' },
        ...(data.topRisks || []).map(
          (/** @type {string} */ risk) => h('li', { className: 'risk-item' }, risk)
        )
      )
    )
  );

  // ── Hardened Plan ─────────────────────────────
  const copyPlanBtn = h(
    'button',
    {
      type: 'button',
      className: 'btn-secondary btn-copy',
      'aria-label': 'Copy hardened plan to clipboard',
      onClick: async () => {
        const ok = await copyToClipboard(data.hardenedPlan || '');
        clearElement(copyPlanBtn);
        copyPlanBtn.append(createIcon('check', 'btn-icon'), h('span', {}, ok ? 'Copied!' : 'Failed'));
        onAnnounce(ok ? 'Hardened plan copied to clipboard.' : 'Copy failed. Please copy manually.');
        setTimeout(() => {
          clearElement(copyPlanBtn);
          copyPlanBtn.append(createIcon('copy', 'btn-icon'), h('span', {}, 'Copy Hardened Plan'));
        }, 2500);
      },
    },
    createIcon('copy', 'btn-icon'),
    h('span', {}, 'Copy Hardened Plan')
  );

  const hardenedSec = h(
    'div',
    { className: 'judge-section judge-hardened-sec' },
    h(
      'div',
      { className: 'section-header-split' },
      h('h4', { className: 'section-heading' }, 'Hardened Execution Roadmap'),
      copyPlanBtn
    ),
    renderHardenedPlan(data.hardenedPlan || '')
  );

  // ── Action Items ──────────────────────────────
  const actionItemsSec = h(
    'div',
    { className: 'judge-section judge-actions-sec' },
    h('h4', { className: 'section-heading' }, 'Immediate Action Items'),
    h(
      'div',
      { className: 'actions-checklist' },
      ...(data.actionItems || []).map((/** @type {any} */ action) =>
        h(
          'div',
          { className: 'action-card' },
          h('div', { className: 'action-check-icon', 'aria-hidden': 'true' },
            createIcon('check', 'check-icon')
          ),
          h(
            'div',
            { className: 'action-body' },
            h('div', { className: 'action-task' }, action.task || ''),
            h(
              'div',
              { className: 'action-meta' },
              h('span', { className: 'badge-due' }, `Due in ${action.dueInDays || '?'} days`),
              createCalendarLink(action.task, action.dueInDays)
            )
          )
        )
      )
    )
  );

  // ── Key Tensions ──────────────────────────────
  let keyTensionsSec = null;
  if (Array.isArray(data.keyTensions) && data.keyTensions.length > 0) {
    keyTensionsSec = h(
      'div',
      { className: 'judge-section judge-tensions-sec' },
      h('h4', { className: 'section-heading' }, 'Key Persona Disagreements Resolved'),
      h(
        'div',
        { className: 'tensions-list' },
        ...data.keyTensions.map((/** @type {any} */ kt) =>
          h(
            'div',
            { className: 'tension-card' },
            h('strong', { className: 'tension-topic' }, kt.topic || ''),
            h('p', { className: 'tension-summary' }, kt.summary || '')
          )
        )
      )
    );
  }

  // ── Unresolved Questions ──────────────────────
  let unresolvedSec = null;
  if (Array.isArray(data.unresolvedQuestions) && data.unresolvedQuestions.length > 0) {
    unresolvedSec = h(
      'div',
      { className: 'judge-section judge-questions-sec' },
      h('h4', { className: 'section-heading' }, 'Critical Unresolved Questions'),
      h(
        'ul',
        { className: 'questions-list' },
        ...data.unresolvedQuestions.map(
          (/** @type {string} */ q) => h('li', { className: 'question-item' }, q)
        )
      )
    );
  }

  // ── Missing Personas notice ───────────────────
  let missingSec = null;
  if (Array.isArray(data.missingPersonas) && data.missingPersonas.length > 0) {
    missingSec = h(
      'div',
      { className: 'missing-personas-alert', role: 'note' },
      h('strong', {}, 'Note: '),
      `Synthesized without inputs from: ${data.missingPersonas.join(', ')}.`
    );
  }

  // ── Global Export Actions Bar ─────────────────
  const copySummaryBtn = h(
    'button',
    {
      type: 'button',
      className: 'btn-secondary',
      'aria-label': 'Copy full review summary as text',
      onClick: async () => {
        const summaryText = buildSummaryText(data);
        const ok = await copyToClipboard(summaryText);
        clearElement(copySummaryBtn);
        copySummaryBtn.append(createIcon('check', 'btn-icon'), h('span', {}, ok ? 'Summary copied!' : 'Failed'));
        onAnnounce(ok ? 'Full review summary copied to clipboard.' : 'Copy failed.');
        setTimeout(() => {
          clearElement(copySummaryBtn);
          copySummaryBtn.append(createIcon('copy', 'btn-icon'), h('span', {}, 'Copy Full Summary'));
        }, 2500);
      },
    },
    createIcon('copy', 'btn-icon'),
    h('span', {}, 'Copy Full Summary')
  );

  const printBtn = h(
    'button',
    {
      type: 'button',
      className: 'btn-secondary btn-print',
      'aria-label': 'Print council review report',
      onClick: () => window.print(),
    },
    createIcon('print', 'btn-icon'),
    h('span', {}, 'Print Review')
  );

  const newReviewBtn = h(
    'button',
    {
      type: 'button',
      className: 'btn-secondary',
      'aria-label': 'Start a new review — clears the current results',
      onClick: () => { if (actions.onNewReview) actions.onNewReview(); },
    },
    createIcon('refresh', 'btn-icon'),
    h('span', {}, 'New Review')
  );

  const actionsBar = h(
    'div',
    { className: 'export-actions-bar' },
    copySummaryBtn,
    copyPlanBtn.cloneNode(true), // second copy button in bar (wired separately)
    printBtn,
    newReviewBtn
  );

  // Re-wire the cloned copy plan button in actions bar
  const barCopyPlanBtn = actionsBar.children[1];
  if (barCopyPlanBtn) {
    barCopyPlanBtn.addEventListener('click', async () => {
      const ok = await copyToClipboard(data.hardenedPlan || '');
      onAnnounce(ok ? 'Hardened plan copied to clipboard.' : 'Copy failed.');
    });
  }

  containerEl.append(
    verdictCard,
    missingSec,
    hardenedSec,
    actionItemsSec,
    keyTensionsSec,
    unresolvedSec,
    actionsBar
  );
}
