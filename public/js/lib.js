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

/**
 * Parses a hardened plan into structured phase cards if phase headings are present.
 * Returns null if no phase headings are found, allowing fallback to pre-wrap rendering.
 * @param {string} text
 * @returns {Array<{ phaseNumber: number, title: string, content: string }> | null}
 */
export function parseHardenedPlanPhases(text) {
  if (typeof text !== 'string' || !text.trim()) {
    return null;
  }

  // Matches lines like: "Phase 1: ...", "PHASE 2 - ...", "### Phase 3", etc.
  const regex = /(?:^|\n)(?:[#*_\s]*)(?:Phase|PHASE)\s+(\d+)(?:[:\-–—\s]*)([^\n]*)/g;
  const matches = [...text.matchAll(regex)];

  if (matches.length === 0) {
    return null;
  }

  const phases = [];
  for (let i = 0; i < matches.length; i++) {
    const currentMatch = matches[i];
    const phaseNum = parseInt(currentMatch[1], 10);
    const subTitle = currentMatch[2]?.trim() || '';
    const title = subTitle ? `Phase ${phaseNum}: ${subTitle}` : `Phase ${phaseNum}`;

    const startIndex = (currentMatch.index || 0) + currentMatch[0].length;
    const nextIndex = i + 1 < matches.length ? (matches[i + 1].index || text.length) : text.length;
    const content = text.slice(startIndex, nextIndex).trim();

    phases.push({
      phaseNumber: phaseNum,
      title,
      content,
    });
  }

  return phases.length > 0 ? phases : null;
}

/**
 * Computes progress state, step indicator, and plain-language summary for the running progress strip.
 * @param {Object} eventsState
 * @param {boolean} [eventsState.planSent]
 * @param {number} [eventsState.personasDone]
 * @param {number} [eventsState.totalPersonas]
 * @param {boolean} [eventsState.judgeStarted]
 * @param {boolean} [eventsState.judgeDone]
 * @param {string | null} [eventsState.degradedFrom]
 * @param {string | null} [eventsState.degradedTo]
 * @returns {{ stepIndex: number, stepLabel: string, percent: number, isDone: boolean, summaryText: string, degradedNotice: string | null }}
 */
export function computeProgress(eventsState = {}) {
  const planSent = Boolean(eventsState.planSent);
  const personasDone = Math.max(0, Number(eventsState.personasDone) || 0);
  const totalPersonas = Math.max(1, Number(eventsState.totalPersonas) || 5);
  const judgeStarted = Boolean(eventsState.judgeStarted);
  const judgeDone = Boolean(eventsState.judgeDone);

  let stepIndex = 0;
  let stepLabel = 'Idle';
  let percent = 0;
  let isDone = false;
  let summaryText = 'Ready to review';

  if (judgeDone) {
    stepIndex = 4;
    stepLabel = 'Done';
    percent = 100;
    isDone = true;
    summaryText = 'Review complete. Hardened plan ready.';
  } else if (judgeStarted) {
    stepIndex = 3;
    stepLabel = 'Judge synthesizing';
    percent = 85;
    isDone = false;
    summaryText = 'Executive Judge synthesizing council findings...';
  } else if (personasDone > 0) {
    stepIndex = 2;
    stepLabel = `Personas (${personasDone} of ${totalPersonas} done)`;
    percent = Math.min(80, Math.round(20 + (personasDone / totalPersonas) * 60));
    isDone = false;
    summaryText = `Council evaluating (${personasDone} of ${totalPersonas} complete)`;
  } else if (planSent) {
    stepIndex = 1;
    stepLabel = 'Plan sent';
    percent = 15;
    isDone = false;
    summaryText = 'Plan submitted to autonomous council';
  }

  let degradedNotice = null;
  if (eventsState.degradedFrom && eventsState.degradedTo) {
    degradedNotice = `High traffic: seamlessly transitioned from ${eventsState.degradedFrom} to ${eventsState.degradedTo} mode`;
  }

  return {
    stepIndex,
    stepLabel,
    percent,
    isDone,
    summaryText,
    degradedNotice,
  };
}

/**
 * Builds a clean, formatted plaintext summary of the Judge synthesis and persona critiques for clipboard copying.
 * @param {any} judge
 * @param {Record<string, any> | Array<any>} [personas]
 * @returns {string}
 */
export function buildSummaryText(judge, personas = {}) {
  if (!judge) return '';

  const lines = [];
  lines.push('# RED TEAM MY LIFE — EXECUTIVE SYNTHESIS\n');

  const before = judge.survivalScoreBefore ?? 0;
  const after = judge.survivalScoreAfter ?? 0;
  const delta = after - before;
  lines.push(`## SURVIVAL SCORE: ${before}/100 → ${after}/100 (${delta >= 0 ? '+' : ''}${delta}%)\n`);

  if (judge.rationale) {
    lines.push(`### Rationale\n${judge.rationale}\n`);
  }

  if (Array.isArray(judge.topRisks) && judge.topRisks.length > 0) {
    lines.push('### Top Existential Risks');
    judge.topRisks.forEach((r, idx) => lines.push(`${idx + 1}. ${r}`));
    lines.push('');
  }

  if (judge.hardenedPlan) {
    lines.push(`### Hardened Roadmap\n${judge.hardenedPlan}\n`);
  }

  if (Array.isArray(judge.actionItems) && judge.actionItems.length > 0) {
    lines.push('### Action Milestones');
    judge.actionItems.forEach(item => {
      const due = item.dueInDays ? `(Due in ${item.dueInDays} days)` : '';
      lines.push(`- [ ] ${item.task} ${due}`.trim());
    });
    lines.push('');
  }

  if (Array.isArray(judge.keyTensions) && judge.keyTensions.length > 0) {
    lines.push('### Key Ideological Tensions');
    judge.keyTensions.forEach(t => {
      lines.push(`- **${t.topic}**: ${t.summary}`);
    });
    lines.push('');
  }

  if (Array.isArray(judge.unresolvedQuestions) && judge.unresolvedQuestions.length > 0) {
    lines.push('### Unresolved Questions');
    judge.unresolvedQuestions.forEach(q => lines.push(`- ${q}`));
    lines.push('');
  }

  // Persona summaries
  const personaList = Array.isArray(personas)
    ? personas
    : Object.entries(personas).map(([id, data]) => ({ id, ...data }));

  if (personaList.length > 0) {
    lines.push('## COUNCIL CRITIQUES\n');
    for (const p of personaList) {
      const name = p.displayName || p.id || 'Persona';
      lines.push(`### ${name}`);
      if (p.headline) lines.push(`"${p.headline}"\n`);
      if (Array.isArray(p.points)) {
        p.points.forEach(pt => {
          lines.push(`- Risk: ${pt.claim}`);
          if (pt.suggestedFix) lines.push(`  Fix: ${pt.suggestedFix}`);
        });
      }
      if (p.verdict) lines.push(`Verdict: ${p.verdict}`);
      lines.push('');
    }
  }

  return lines.join('\n').trim();
}
