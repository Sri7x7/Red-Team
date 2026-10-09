// @ts-check
/**
 * @file public/js/cards.js
 * @description Renders the 5 persona cards, thinking shimmer states, segmented 1-5 bars, and failures.
 */

import { h, clearElement } from './dom.js';
import { createIcon } from './icons.js';
import { getSeverityText } from './lib.js';

/**
 * Creates the initial 5-card grid with all cards in a "thinking" skeleton shimmer state.
 * @param {Array<any>} personas
 * @returns {{ gridEl: HTMLElement, cardMap: Map<string, HTMLElement> }}
 */
export function createPersonaGrid(personas) {
  const cardMap = new Map();
  const gridEl = h('div', {
    className: 'persona-grid',
    role: 'region',
    'aria-label': 'Council Member Critiques',
  });

  for (const meta of personas) {
    const cardEl = h(
      'article',
      {
        id: `card-${meta.id}`,
        className: `persona-card persona-${meta.id} is-thinking`,
        dataset: { persona: meta.id },
        tabIndex: 0,
        'aria-label': `${meta.displayName} is analyzing...`,
      },
      // Header skeleton
      h(
        'div',
        { className: 'card-header' },
        h('div', { className: 'persona-icon-badge skeleton-icon' }, createIcon(meta.icon, 'persona-icon')),
        h(
          'div',
          { className: 'persona-identity' },
          h('h3', { className: 'persona-name' }, meta.displayName),
          h('p', { className: 'persona-role' }, meta.role)
        )
      ),
      // Body skeleton
      h(
        'div',
        { className: 'skeleton-body', 'aria-hidden': 'true' },
        h('div', { className: 'skeleton-line skeleton-headline' }),
        h('div', { className: 'skeleton-line skeleton-point' }),
        h('div', { className: 'skeleton-line skeleton-fix' }),
        h('div', { className: 'skeleton-line skeleton-verdict' })
      ),
      h('div', { className: 'visually-hidden' }, `${meta.displayName} is analyzing your plan...`)
    );

    cardMap.set(meta.id, cardEl);
    gridEl.appendChild(cardEl);
  }

  return { gridEl, cardMap };
}

/**
 * Creates a segmented 1-to-5 rating bar with dual visual segments and screen-reader label.
 * @param {number} severity
 * @param {boolean} isOptimist
 * @param {string} scoreLabel
 * @returns {HTMLElement}
 */
function createSegmentedBar(severity, isOptimist, scoreLabel) {
  const val = Math.min(5, Math.max(1, Math.round(Number(severity) || 3)));
  const textLabel = getSeverityText(val, isOptimist);

  const segments = [];
  for (let i = 1; i <= 5; i++) {
    segments.push(
      h('span', {
        className: `bar-segment ${i <= val ? 'segment-filled' : 'segment-empty'}`,
        'aria-hidden': 'true',
      })
    );
  }

  return h(
    'div',
    {
      className: 'rating-badge',
      role: 'meter',
      'aria-label': textLabel,
      'aria-valuenow': String(val),
      'aria-valuemin': '1',
      'aria-valuemax': '5',
      'aria-valuetext': textLabel,
    },
    h('div', { className: 'segmented-bar' }, ...segments),
    h('span', { className: 'rating-text' }, textLabel)
  );
}

/**
 * Fills in a persona card when its persona_done event arrives.
 * @param {HTMLElement} cardEl
 * @param {any} data
 * @param {any} meta
 */
export function updatePersonaCard(cardEl, data, meta) {
  clearElement(cardEl);
  cardEl.classList.remove('is-thinking');
  cardEl.classList.add('is-done');
  cardEl.setAttribute('aria-label', `${meta.displayName} review completed`);

  const isOptimist = meta.id === 'optimist';

  // Card Header
  const header = h(
    'div',
    { className: 'card-header' },
    h('div', { className: 'persona-icon-badge' }, createIcon(meta.icon, 'persona-icon')),
    h(
      'div',
      { className: 'persona-identity' },
      h('h3', { className: 'persona-name' }, meta.displayName),
      h('p', { className: 'persona-role' }, meta.role)
    )
  );

  // Headline
  const headline = h('blockquote', { className: 'persona-headline' }, data.headline);

  // Points list
  const pointsList = h('div', { className: 'persona-points', role: 'list' });
  if (Array.isArray(data.points)) {
    data.points.forEach((pt, idx) => {
      const pointItem = h(
        'div',
        { className: 'point-item', role: 'listitem' },
        h(
          'div',
          { className: 'point-header' },
          h('span', { className: 'point-item-tag' }, `${meta.itemLabel} #${idx + 1}`),
          createSegmentedBar(pt.severity, isOptimist, meta.scoreLabel)
        ),
        h('p', { className: 'point-claim' }, pt.claim),
        h(
          'div',
          { className: 'point-fix' },
          h('strong', { className: 'fix-label' }, `${meta.fixLabel}: `),
          h('span', { className: 'fix-text' }, pt.suggestedFix)
        )
      );
      pointsList.appendChild(pointItem);
    });
  }

  // Verdict footer
  const verdict = h(
    'div',
    { className: 'persona-verdict' },
    h('strong', { className: 'verdict-label' }, 'Verdict: '),
    h('span', { className: 'verdict-text' }, data.verdict)
  );

  cardEl.append(header, headline, pointsList, verdict);
}

/**
 * Updates a persona card to a calm, informative "unavailable" state when it fails.
 * @param {HTMLElement} cardEl
 * @param {any} meta
 * @param {string} [error]
 */
export function markPersonaFailed(cardEl, meta, error) {
  clearElement(cardEl);
  cardEl.classList.remove('is-thinking');
  cardEl.classList.add('is-failed');
  cardEl.setAttribute('aria-label', `${meta.displayName} is unavailable`);

  const header = h(
    'div',
    { className: 'card-header' },
    h('div', { className: 'persona-icon-badge is-muted' }, createIcon(meta.icon, 'persona-icon')),
    h(
      'div',
      { className: 'persona-identity' },
      h('h3', { className: 'persona-name' }, meta.displayName),
      h('p', { className: 'persona-role' }, meta.role)
    )
  );

  const notice = h(
    'div',
    { className: 'persona-failed-notice' },
    h('p', { className: 'notice-title' }, 'This persona is unavailable for this review.'),
    h('p', { className: 'notice-desc' }, 'The remaining council perspectives and Executive Judge synthesis continue uninterrupted.')
  );

  cardEl.append(header, notice);
}
