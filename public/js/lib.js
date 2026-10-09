// @ts-check
/**
 * @file public/js/lib.js
 * @description Pure utility helpers for NDJSON stream parsing, severity labeling,
 * calendar URL construction, and form formatting.
 */

/**
 * Parses accumulated NDJSON text chunks into parsed event objects.
 * Handles line splits across chunk boundaries and buffers incomplete trailing lines.
 * @param {string} buffer
 * @returns {{ events: Array<any>, remainingBuffer: string }}
 */
export function parseNdjsonChunk(buffer) {
  if (typeof buffer !== 'string' || buffer.length === 0) {
    return { events: [], remainingBuffer: '' };
  }

  const lines = buffer.split('\n');
  // If the buffer did not end with a newline, the last segment is incomplete
  const remainingBuffer = lines.pop() || '';
  const events = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      events.push(JSON.parse(trimmed));
    } catch {
      // Ignore malformed or incomplete lines
    }
  }

  return { events, remainingBuffer };
}

/**
 * Converts a 1-5 severity/impact rating into an accessible, informative text label.
 * @param {number} score
 * @param {boolean} [isOptimist=false]
 * @returns {string}
 */
export function getSeverityText(score, isOptimist = false) {
  const val = Number(score);
  const num = Math.min(5, Math.max(1, Math.round(Number.isNaN(val) ? 3 : val)));
  if (isOptimist) {
    const impactLabels = {
      1: 'Minor',
      2: 'Moderate',
      3: 'Notable',
      4: 'High',
      5: 'Major Catalyst',
    };
    return `Impact ${num} of 5 - ${impactLabels[num] || 'High'}`;
  }

  const severityLabels = {
    1: 'Minimal',
    2: 'Low',
    3: 'Moderate',
    4: 'High',
    5: 'Critical',
  };
  return `Severity ${num} of 5 - ${severityLabels[num] || 'Moderate'}`;
}

/**
 * Formats a Date object to YYYYMMDD string for Google Calendar all-day events.
 * @param {Date} date
 * @returns {string}
 */
function formatDateToYMD(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

/**
 * Constructs an all-day Google Calendar template URL for a given action item task and due timeframe.
 * @param {string} task
 * @param {number} dueInDays
 * @param {Date} [baseDate]
 * @returns {string}
 */
export function buildCalendarUrl(task, dueInDays, baseDate = new Date()) {
  const days = Math.max(1, Math.round(Number(dueInDays) || 7));
  const startTime = new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000);
  const endTime = new Date(startTime.getTime() + 24 * 60 * 60 * 1000);

  const startStr = formatDateToYMD(startTime);
  const endStr = formatDateToYMD(endTime);

  const title = String(task || 'Red Team Action Item').trim();
  const details = `Action milestone hardened by Red Team My Life council review. Due in ${days} days.`;

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${startStr}/${endStr}`,
    details,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Formats current character count vs maximum allowed plan length.
 * @param {number} current
 * @param {number} max
 * @returns {string}
 */
export function formatCharCounter(current, max) {
  const cur = Math.max(0, Number(current) || 0);
  const limit = Math.max(1, Number(max) || 2000);
  return `${cur} / ${limit}`;
}
