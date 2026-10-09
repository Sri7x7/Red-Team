// @ts-check
/**
 * @file src/services/safetyGuard.js
 * @description Fast server-side safety check for self-harm and crisis indicators.
 * Runs before validation-independent work, caching, demo matching, or model calls.
 *
 * NOTE ON LIMITATIONS:
 * This is a lightweight, deterministic keyword/regex heuristic designed as an immediate
 * protective safety net without API latency. It is NOT a clinical screening tool, cannot
 * perceive complex psychological context or nuanced metaphors, and has both false positives
 * and false negatives. If triggered, the review is aborted immediately and kind, supportive
 * crisis contact resources are returned without logging the user's plan or matched phrase.
 */

export const CRISIS_SUPPORT_MESSAGE =
  'It sounds like you may be going through a difficult time. Please know that you do not have to carry this alone. If you are experiencing distress, thoughts of self-harm, or need someone to talk to, please consider reaching out to someone you trust or a confidential support service. In India, free and confidential tele-mental health support is available 24/7 via Tele-MANAS at 14416 (or 1800-891-4416). If you are outside India, please contact your local emergency services or a crisis helpline (such as 988 in the US/Canada or 111 in the UK). Support is available, and there are people who care and want to help.';

/**
 * Documented crisis keywords and phrases across English, Hindi, and Kannada.
 * Native scripts and Romanized transliterations are both covered.
 */
const CRISIS_PATTERNS = [
  // English
  /\b(suicide|suicidal)\b/i,
  /\bcommit\s+suicide\b/i,
  /\bkill\s+myself\b/i,
  /\bkilling\s+myself\b/i,
  /\bend\s+my\s+life\b/i,
  /\bending\s+my\s+life\b/i,
  /\bwant\s+to\s+die\b/i,
  /\bwish\s+(i\s+was|i\s+were)\s+dead\b/i,
  /\bhang(?:ing)?\s+myself\b/i,
  /\bslit(?:ting)?\s+my\s+wrists?\b/i,
  /\b(overdose|overdosing)\b/i,
  /\bself[-\s]?harm\b/i,
  /\bcut\s+myself\b/i,
  /\bcutting\s+myself\b/i,
  /\btak(?:e|ing)\s+my\s+own\s+life\b/i,
  /\bjump(?:ing)?\s+off\s+a\s+(bridge|building|cliff|roof)\b/i,

  // Hindi (Devanagari)
  /आत्महत्या/,
  /खुदकुशी/,
  /जान\s*दे\s*(दूंगा|दूंगी|देना|दूँ)/,
  /मरना\s*चाहता\s*(हूँ|हूं)/,
  /मरना\s*चाहती\s*(हूँ|हूं)/,
  /खुद\s*को\s*(मारना|मारने|खत्म)/,
  /जिंदगी\s*खत्म/,
  /ज़िंदगी\s*खत्म/,
  /अपनी\s*जान\s*(लेना|ले\s*लूंगा|ले\s*लूंगी)/,

  // Hindi (Romanized)
  /\b(aatmhatya|aatmahatya|atmarahatya)\b/i,
  /\bkhudkushi\b/i,
  /\b(marna\s+chahta\s+hoon|marna\s+chahta\s+hu|marna\s+chahti\s+hoon|marna\s+chahti\s+hu)\b/i,
  /\b(jaan\s+de\s+doonga|jaan\s+de\s+dungi|jaan\s+de\s+doongi|jaan\s+dena)\b/i,
  /\b(khud\s+ko\s+marna|khud\s+ko\s+maar\s+dunga|khud\s+ko\s+khatam)\b/i,
  /\b(zindagi\s+khatam|zindagi\s+khtm)\b/i,
  /\bapni\s+jaan\s+lena\b/i,

  // Kannada (Kannada Script)
  /ಆತ್ಮಹತ್ಯೆ/,
  /ಸಾಯಬೇಕು/,
  /ಸಾಯಲು\s*ಬಯಸುತ್ತೇನೆ/,
  /ಸಾಯೋದು/,
  /ಜೀವ\s*ಕಳೆದುಕೊಳ್ಳುವುದು/,
  /ಜೀವ\s*ತಗೋತೀನಿ/,
  /ಜೀವ\s*ಬಿಡಬೇಕು/,
  /ನನ್ನನ್ನು\s*ನಾನು\s*ಕೊಲ್ಲುವುದು/,

  // Kannada (Romanized)
  /\b(aathmahatye|aatmahatye|athmahathe)\b/i,
  /\b(saayabeku|sayabeku|sayodu|saayodu)\b/i,
  /\b(jeeva\s+tagothini|jeeva\s+thagothini|jeeva\s+bidabeku)\b/i,
  /\bnanna\s+jeeva\s+kaledukolluve\b/i,
  /\b(nannannu\s+naane\s+kolle|nannanu\s+naanu\s+kollabeku)\b/i,
];

/**
 * Checks if a plan contains self-harm or crisis patterns.
 * Never logs the plan or the matched keyword to protect user privacy.
 *
 * @param {string} plan - Untrusted plan text
 * @returns {{ isTriggered: boolean, message?: string }}
 */
export function checkPlanSafety(plan) {
  if (typeof plan !== 'string' || !plan.trim()) {
    return { isTriggered: false };
  }

  const normalized = plan.trim();

  for (const pattern of CRISIS_PATTERNS) {
    if (pattern.test(normalized)) {
      return {
        isTriggered: true,
        message: CRISIS_SUPPORT_MESSAGE,
      };
    }
  }

  return { isTriggered: false };
}
