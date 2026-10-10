// @ts-check
/**
 * @file public/js/progress.js
 * @description Component for rendering the 4-step running progress strip,
 * active mode badge, and plain-language degradation announcements.
 */

import { h, clearElement } from './dom.js';
import { computeProgress } from './lib.js';

const STEP_LABELS = [
  'Plan sent',
  'Council debating',
  'Judge synthesizing',
  'Review done',
];

/**
 * Creates the progress strip container element.
 * @returns {HTMLElement}
 */
export function createProgressStrip() {
  return h(
    'section',
    {
      id: 'progress-strip',
      className: 'progress-strip',
      role: 'region',
      'aria-label': 'Review Progress',
      hidden: true,
    }
  );
}

/**
 * Updates the progress strip DOM based on events state.
 * @param {HTMLElement} stripEl
 * @param {Object} state
 * @param {boolean} [state.planSent]
 * @param {number} [state.personasDone]
 * @param {number} [state.totalPersonas]
 * @param {boolean} [state.judgeStarted]
 * @param {boolean} [state.judgeDone]
 * @param {string | null} [state.mode]
 * @param {string | null} [state.degradedFrom]
 * @param {string | null} [state.degradedTo]
 */
export function updateProgressStrip(stripEl, state) {
  const prog = computeProgress(state);
  clearElement(stripEl);

  if (prog.stepIndex === 0) {
    stripEl.hidden = true;
    return;
  }
  stripEl.hidden = false;

  // Header row: Status label + Active Mode Badge
  const modeLabel = state.mode
    ? (state.mode === 'live' ? 'Live Parallel Council' : state.mode === 'quick' ? 'Quick Mode' : 'Benchmark Demo')
    : 'Quota-Aware Council';

  const headerRow = h(
    'div',
    { className: 'progress-header-row' },
    h(
      'div',
      { className: 'progress-label-wrap' },
      h('span', { className: 'progress-pulse-dot', 'aria-hidden': 'true' }),
      h('span', { className: 'progress-status-text' }, prog.summaryText)
    ),
    h(
      'span',
      { className: 'badge-mode' },
      modeLabel
    )
  );

  // 4-step indicators
  const stepsList = h('ol', { className: 'progress-steps-list', role: 'list' });
  const stepDefinitions = [
    { num: 1, label: 'Plan sent' },
    {
      num: 2,
      label: `Personas (${Math.min(5, state.personasDone || 0)} of ${state.totalPersonas || 5} done)`,
    },
    { num: 3, label: 'Judge synthesizing' },
    { num: 4, label: 'Done' },
  ];

  stepDefinitions.forEach((s) => {
    let stepClass = 'step-upcoming';
    if (prog.stepIndex > s.num) {
      stepClass = 'step-completed';
    } else if (prog.stepIndex === s.num) {
      stepClass = 'step-active';
    }

    const stepItem = h(
      'li',
      { className: `progress-step-item ${stepClass}` },
      h('span', { className: 'step-number', 'aria-hidden': 'true' }, String(s.num)),
      h('span', { className: 'step-text' }, s.label)
    );
    stepsList.appendChild(stepItem);
  });

  // Visual Progress bar
  const progressBarWrap = h(
    'div',
    {
      className: 'progress-bar-wrap',
      role: 'progressbar',
      'aria-valuenow': String(prog.percent),
      'aria-valuemin': '0',
      'aria-valuemax': '100',
      'aria-valuetext': prog.stepLabel,
    },
    h('div', {
      className: 'progress-bar-fill',
      dataset: { percent: String(prog.percent) },
    })
  );

  // Apply width cleanly via setProperty
  const barFill = progressBarWrap.querySelector('.progress-bar-fill');
  if (barFill && barFill instanceof HTMLElement) {
    barFill.style.setProperty('--progress-width', `${prog.percent}%`);
  }

  stripEl.append(headerRow, stepsList, progressBarWrap);

  // Plain-language degradation notice if occurred
  if (prog.degradedNotice) {
    const noticeEl = h(
      'div',
      { className: 'progress-degraded-notice', role: 'status' },
      h('strong', {}, 'Notice: '),
      prog.degradedNotice
    );
    stripEl.appendChild(noticeEl);
  }
}
