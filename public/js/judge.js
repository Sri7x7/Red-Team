// @ts-check
/**
 * @file public/js/judge.js
 * @description Renders the Executive Judge synthesis panel, before/after survival gauges,
 * hardened plan, action items with Google Calendar links, copy and print actions.
 */

import { h, clearElement } from './dom.js';
import { createIcon } from './icons.js';
import { createCalendarLink } from './calendar.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Creates the "Judge is synthesizing" loading state element.
 * @returns {HTMLElement}
 */
export function createJudgeSkeleton() {
  return h(
    'section',
    {
      id: 'judge-container',
      className: 'judge-card is-synthesizing',
      'aria-busy': 'true',
      'aria-label': 'Executive Judge synthesis in progress',
    },
    h(
      'div',
      { className: 'synthesizing-header' },
      h('div', { className: 'pulse-dot', 'aria-hidden': 'true' }),
      h('h3', { className: 'synthesizing-title' }, 'Executive Judge is synthesizing Council debate...'),
      h('p', { className: 'synthesizing-desc' }, 'Reconciling trade-offs, calculating survival probability delta, and drafting your hardened revised roadmap.')
    ),
    h(
      'div',
      { className: 'skeleton-gauges', 'aria-hidden': 'true' },
      h('div', { className: 'skeleton-gauge-ring' }),
      h('div', { className: 'skeleton-gauge-ring' })
    )
  );
}

/**
 * Creates an SVG gauge ring visualizing survival probability score.
 * @param {number} score - 1 to 100
 * @param {string} label - Accessible title
 * @param {string} colorVar - CSS color variable
 * @returns {HTMLElement}
 */
function createGaugeRing(score, label, colorVar) {
  const val = Math.min(100, Math.max(0, Math.round(Number(score) || 0)));
  const radius = 42;
  const circumference = 2 * Math.PI * radius; // ~263.89
  const offset = circumference * (1 - val / 100);

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('width', '110');
  svg.setAttribute('height', '110');
  svg.setAttribute('class', 'gauge-svg');
  svg.setAttribute('role', 'meter');
  svg.setAttribute('aria-label', `${label}: ${val}%`);
  svg.setAttribute('aria-valuenow', String(val));
  svg.setAttribute('aria-valuemin', '0');
  svg.setAttribute('aria-valuemax', '100');

  // Background track
  const track = document.createElementNS(SVG_NS, 'circle');
  track.setAttribute('cx', '50');
  track.setAttribute('cy', '50');
  track.setAttribute('r', String(radius));
  track.setAttribute('class', 'gauge-track');

  // Value ring
  const ring = document.createElementNS(SVG_NS, 'circle');
  ring.setAttribute('cx', '50');
  ring.setAttribute('cy', '50');
  ring.setAttribute('r', String(radius));
  ring.setAttribute('class', 'gauge-bar');
  ring.setAttribute('stroke', colorVar);
  ring.setAttribute('stroke-dasharray', String(circumference));
  ring.setAttribute('stroke-dashoffset', String(offset));
  ring.setAttribute('transform', 'rotate(-90 50 50)');

  // Text label
  const text = document.createElementNS(SVG_NS, 'text');
  text.setAttribute('x', '50');
  text.setAttribute('y', '56');
  text.setAttribute('class', 'gauge-number');
  text.setAttribute('text-anchor', 'middle');
  text.textContent = `${val}%`;

  svg.append(track, ring, text);

  return h(
    'div',
    { className: 'gauge-widget' },
    svg,
    h('span', { className: 'gauge-title' }, label)
  );
}

/**
 * Copies text to user clipboard with a textarea fallback.
 * @param {string} text
 * @returns {Promise<boolean>}
 */
async function copyToClipboard(text) {
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback below
    }
  }

  // Graceful DOM fallback
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.className = 'visually-hidden';
  document.body.appendChild(textarea);
  textarea.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  document.body.removeChild(textarea);
  return ok;
}

/**
 * Renders the full synthesized Executive Judge panel.
 * @param {HTMLElement} containerEl
 * @param {any} data - JudgeOutput
 * @param {(msg: string) => void} onAnnounce - ARIA live region announcement callback
 */
export function renderJudgePanel(containerEl, data, onAnnounce) {
  clearElement(containerEl);
  containerEl.classList.remove('is-synthesizing');
  containerEl.classList.add('is-rendered');
  containerEl.removeAttribute('aria-busy');

  const delta = (data.survivalScoreAfter || 0) - (data.survivalScoreBefore || 0);
  const deltaSign = delta >= 0 ? '+' : '';

  // 1. Header with Title & Gauges
  const gaugesRow = h(
    'div',
    { className: 'judge-gauges-row' },
    createGaugeRing(data.survivalScoreBefore, 'Raw Plan Survival', 'var(--color-pessimist)'),
    h(
      'div',
      { className: 'gauge-delta-badge' },
      h('span', { className: 'delta-label' }, 'Council Boost'),
      h('span', { className: 'delta-value' }, `${deltaSign}${delta}%`)
    ),
    createGaugeRing(data.survivalScoreAfter, 'Hardened Plan Survival', 'var(--color-optimist)')
  );

  const judgeHeader = h(
    'div',
    { className: 'judge-header' },
    h(
      'div',
      { className: 'judge-title-area' },
      h('h3', { id: 'judge-verdict-heading', className: 'judge-main-heading' }, 'Executive Judge Synthesis'),
      h('p', { className: 'judge-subtitle' }, 'Conservative adversarial synthesis and hardened execution roadmap')
    ),
    gaugesRow
  );

  // 2. Executive Rationale
  const rationaleSec = h(
    'div',
    { className: 'judge-section judge-rationale-sec' },
    h('h4', { className: 'section-heading' }, 'Executive Rationale'),
    h('p', { className: 'judge-rationale-text' }, data.rationale)
  );

  // 3. Top Fatal Risks
  const topRisksSec = h(
    'div',
    { className: 'judge-section judge-risks-sec' },
    h('h4', { className: 'section-heading' }, 'Top 3 Fatal Risks Identified'),
    h(
      'ol',
      { className: 'judge-risks-list' },
      ...(data.topRisks || []).map(risk => h('li', { className: 'risk-item' }, risk))
    )
  );

  // 4. Key Persona Tensions
  let keyTensionsSec = null;
  if (Array.isArray(data.keyTensions) && data.keyTensions.length > 0) {
    keyTensionsSec = h(
      'div',
      { className: 'judge-section judge-tensions-sec' },
      h('h4', { className: 'section-heading' }, 'Key Persona Disagreements Resolved'),
      h(
        'div',
        { className: 'tensions-list' },
        ...data.keyTensions.map(kt =>
          h(
            'div',
            { className: 'tension-card' },
            h('strong', { className: 'tension-topic' }, kt.topic),
            h('p', { className: 'tension-summary' }, kt.summary)
          )
        )
      )
    );
  }

  // 5. Hardened Revised Plan
  const copyBtn = h(
    'button',
    {
      type: 'button',
      className: 'btn-secondary btn-copy',
      'aria-label': 'Copy hardened plan text to clipboard',
      onClick: async () => {
        const ok = await copyToClipboard(data.hardenedPlan);
        if (ok) {
          clearElement(copyBtn);
          copyBtn.append(createIcon('check', 'btn-icon'), h('span', {}, 'Copied!'));
          onAnnounce('Hardened plan successfully copied to clipboard.');
          setTimeout(() => {
            clearElement(copyBtn);
            copyBtn.append(createIcon('copy', 'btn-icon'), h('span', {}, 'Copy Hardened Plan'));
          }, 2500);
        }
      },
    },
    createIcon('copy', 'btn-icon'),
    h('span', {}, 'Copy Hardened Plan')
  );

  const printBtn = h(
    'button',
    {
      type: 'button',
      className: 'btn-secondary btn-print',
      'aria-label': 'Print Council review report',
      onClick: () => {
        window.print();
      },
    },
    createIcon('print', 'btn-icon'),
    h('span', {}, 'Print Review')
  );

  const planActions = h('div', { className: 'hardened-actions' }, copyBtn, printBtn);

  const hardenedSec = h(
    'div',
    { className: 'judge-section judge-hardened-sec' },
    h(
      'div',
      { className: 'section-header-split' },
      h('h4', { className: 'section-heading' }, 'Hardened Execution Roadmap'),
      planActions
    ),
    h('pre', { className: 'hardened-plan-content' }, data.hardenedPlan)
  );

  // 6. Action Items with Google Calendar links
  const actionItemsSec = h(
    'div',
    { className: 'judge-section judge-actions-sec' },
    h('h4', { className: 'section-heading' }, 'Immediate Concrete Action Items'),
    h(
      'div',
      { className: 'actions-grid' },
      ...(data.actionItems || []).map(action =>
        h(
          'div',
          { className: 'action-card' },
          h('div', { className: 'action-task' }, action.task),
          h(
            'div',
            { className: 'action-meta' },
            h('span', { className: 'action-due' }, `Due in ${action.dueInDays} days`),
            createCalendarLink(action.task, action.dueInDays)
          )
        )
      )
    )
  );

  // 7. Unresolved Questions
  let unresolvedSec = null;
  if (Array.isArray(data.unresolvedQuestions) && data.unresolvedQuestions.length > 0) {
    unresolvedSec = h(
      'div',
      { className: 'judge-section judge-questions-sec' },
      h('h4', { className: 'section-heading' }, 'Critical Unresolved Questions'),
      h(
        'ul',
        { className: 'questions-list' },
        ...data.unresolvedQuestions.map(q => h('li', { className: 'question-item' }, q))
      )
    );
  }

  // 8. Missing Personas notice if any
  let missingSec = null;
  if (Array.isArray(data.missingPersonas) && data.missingPersonas.length > 0) {
    missingSec = h(
      'div',
      { className: 'missing-personas-alert', role: 'note' },
      h('strong', {}, 'Note: '),
      `Synthesized without inputs from: ${data.missingPersonas.join(', ')}.`
    );
  }

  containerEl.append(
    judgeHeader,
    missingSec,
    rationaleSec,
    topRisksSec,
    keyTensionsSec,
    hardenedSec,
    actionItemsSec,
    unresolvedSec
  );
}
