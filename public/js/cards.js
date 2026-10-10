// @ts-check
/**
 * @file public/js/cards.js
 * @description Renders the 5 persona cards, thinking shimmer skeletons, segmented 1–5 bars,
 * "Show all N points" toggle, and failure unavailable states.
 */

import { h, clearElement } from './dom.js';
import { createIcon } from './icons.js';
import { getSeverityText } from './lib.js';

/** Number of points shown by default before "Show all" toggle. */
const DEFAULT_VISIBLE_POINTS = 2;

/**
 * Creates the initial 5-card grid with all cards in skeleton "thinking" state.
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
        'aria-label': `${meta.displayName} is analyzing…`,
      },
      // Header
      h(
        'div',
        { className: 'card-header' },
        h('div', { className: 'persona-icon-badge skeleton-icon' },
          createIcon(meta.icon, 'persona-icon')
        ),
        h(
          'div',
          { className: 'persona-identity' },
          h('h3', { className: 'persona-name' }, meta.displayName),
          h('p', { className: 'persona-role' }, meta.role)
        )
      ),
      // Skeleton shimmer body
      h(
        'div',
        { className: 'skeleton-body', 'aria-hidden': 'true' },
        h('div', { className: 'skeleton-line skel-headline' }),
        h('div', { className: 'skeleton-line skel-point' }),
        h('div', { className: 'skeleton-line skel-point skel-short' }),
        h('div', { className: 'skeleton-line skel-verdict' })
      ),
      h('p', { className: 'visually-hidden' }, `${meta.displayName} is analyzing your plan…`)
    );

    cardMap.set(meta.id, cardEl);
    gridEl.appendChild(cardEl);
  }

  return { gridEl, cardMap };
}

/**
 * Creates a segmented 1–5 rating bar with accessible meter role and a text label.
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
 * Fills in a persona card once its persona_done event arrives.
 * Shows the top 2 points by default; remaining are togglable via an aria-expanded button.
 * @param {HTMLElement} cardEl
 * @param {any} data
 * @param {any} meta
 */
export function updatePersonaCard(cardEl, data, meta) {
  clearElement(cardEl);
  cardEl.classList.remove('is-thinking');
  cardEl.classList.add('is-done');
  cardEl.setAttribute('aria-label', `${meta.displayName} review complete`);

  const isOptimist = meta.id === 'optimist';
  const points = Array.isArray(data.points) ? data.points : [];
  const visiblePoints = points.slice(0, DEFAULT_VISIBLE_POINTS);
  const hiddenPoints = points.slice(DEFAULT_VISIBLE_POINTS);

  // ── Card Header ──────────────────────────────
  const header = h(
    'div',
    { className: 'card-header' },
    h('div', { className: 'persona-icon-badge' },
      createIcon(meta.icon, 'persona-icon')
    ),
    h(
      'div',
      { className: 'persona-identity' },
      h('h3', { className: 'persona-name' }, meta.displayName),
      h('p', { className: 'persona-role' }, meta.role)
    )
  );

  // ── Headline ─────────────────────────────────
  const headline = h('blockquote', { className: 'persona-headline' }, data.headline || '');

  // ── Points list ──────────────────────────────
  const pointsList = h('div', { className: 'persona-points', role: 'list' });

  /**
   * @param {{ severity: number, claim: string, suggestedFix: string }} pt
   * @param {number} idx
   * @returns {HTMLElement}
   */
  function buildPointItem(pt, idx) {
    return h(
      'div',
      { className: 'point-item', role: 'listitem' },
      h(
        'div',
        { className: 'point-header' },
        h('span', { className: 'point-item-tag' }, `${meta.itemLabel || 'Point'} #${idx + 1}`),
        createSegmentedBar(pt.severity, isOptimist, meta.scoreLabel || 'Severity')
      ),
      h('p', { className: 'point-claim' }, pt.claim),
      h(
        'div',
        { className: 'point-fix' },
        h('strong', { className: 'fix-label' }, `${meta.fixLabel || 'Fix'}: `),
        h('span', { className: 'fix-text' }, pt.suggestedFix)
      )
    );
  }

  visiblePoints.forEach((pt, idx) => pointsList.appendChild(buildPointItem(pt, idx)));

  // ── Hidden points + Toggle ────────────────────
  if (hiddenPoints.length > 0) {
    const hiddenContainer = h('div', { className: 'points-hidden-group', hidden: true });
    hiddenPoints.forEach((pt, idx) =>
      hiddenContainer.appendChild(buildPointItem(pt, DEFAULT_VISIBLE_POINTS + idx))
    );

    const toggleBtn = h(
      'button',
      {
        type: 'button',
        className: 'btn-toggle-points',
        'aria-expanded': 'false',
        'aria-controls': `hidden-points-${meta.id}`,
        onClick: () => {
          const expanded = toggleBtn.getAttribute('aria-expanded') === 'true';
          const next = !expanded;
          toggleBtn.setAttribute('aria-expanded', String(next));
          hiddenContainer.hidden = !next;
          clearElement(toggleBtn);
          toggleBtn.append(
            createIcon(next ? 'check' : 'arrow-right', 'btn-icon'),
            h('span', {}, next
              ? `Show fewer`
              : `Show all ${points.length} points`)
          );
        },
      },
      createIcon('arrow-right', 'btn-icon'),
      h('span', {}, `Show all ${points.length} points`)
    );

    hiddenContainer.id = `hidden-points-${meta.id}`;
    pointsList.append(toggleBtn, hiddenContainer);
  }

  // ── Verdict ──────────────────────────────────
  const verdict = h(
    'div',
    { className: 'persona-verdict' },
    h('strong', { className: 'verdict-label' }, 'Verdict: '),
    h('span', { className: 'verdict-text' }, data.verdict || '')
  );

  cardEl.append(header, headline, pointsList, verdict);
}

/**
 * Updates a persona card to a calm "unavailable" state on failure.
 * @param {HTMLElement} cardEl
 * @param {any} meta
 * @param {string} [_error]
 */
export function markPersonaFailed(cardEl, meta, _error) {
  clearElement(cardEl);
  cardEl.classList.remove('is-thinking');
  cardEl.classList.add('is-failed');
  cardEl.setAttribute('aria-label', `${meta.displayName} is unavailable for this review`);

  cardEl.append(
    h(
      'div',
      { className: 'card-header' },
      h('div', { className: 'persona-icon-badge is-muted' },
        createIcon(meta.icon, 'persona-icon')
      ),
      h(
        'div',
        { className: 'persona-identity' },
        h('h3', { className: 'persona-name' }, meta.displayName),
        h('p', { className: 'persona-role' }, meta.role)
      )
    ),
    h(
      'div',
      { className: 'persona-failed-notice' },
      h('p', { className: 'notice-title' }, 'Unavailable for this review'),
      h(
        'p',
        { className: 'notice-desc' },
        'The remaining council perspectives and Executive Judge synthesis continue uninterrupted.'
      )
    )
  );
}
