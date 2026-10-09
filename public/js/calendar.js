// @ts-check
/**
 * @file public/js/calendar.js
 * @description Google Calendar action button link generator.
 */

import { buildCalendarUrl } from './lib.js';
import { createIcon } from './icons.js';
import { h } from './dom.js';

/**
 * Creates an accessible, secure link to schedule an action item in Google Calendar.
 * @param {string} task
 * @param {number} dueInDays
 * @returns {HTMLElement}
 */
export function createCalendarLink(task, dueInDays) {
  const url = buildCalendarUrl(task, dueInDays);
  return h(
    'a',
    {
      href: url,
      target: '_blank',
      rel: 'noopener noreferrer',
      className: 'btn-calendar',
      'aria-label': `Add milestone to Google Calendar: "${task}" (due in ${dueInDays} days)`,
    },
    createIcon('calendar', 'btn-icon'),
    h('span', { className: 'btn-calendar-label' }, 'Add to Calendar')
  );
}
