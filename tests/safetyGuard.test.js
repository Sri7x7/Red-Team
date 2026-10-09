import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { checkPlanSafety, CRISIS_SUPPORT_MESSAGE } from '../src/services/safetyGuard.js';

describe('safetyGuard.js', () => {
  it('passes normal business and life plans without triggering', () => {
    const plans = [
      'I want to open a specialty coffee shop in Bangalore.',
      'Quitting my software engineering job to build an open-source library.',
      'Moving to Goa to start a boutique homestay.',
      'Buying an EV car on a 5-year loan.',
    ];

    for (const plan of plans) {
      const res = checkPlanSafety(plan);
      assert.equal(res.isTriggered, false);
      assert.equal(res.message, undefined);
    }
  });

  it('detects English self-harm and crisis phrases', () => {
    const crisisPlans = [
      'I feel completely hopeless and want to commit suicide next week.',
      'I am planning to kill myself if my startup fails.',
      'Thinking of ending my life because I have no money left.',
      'I want to die and have nothing to live for.',
      'Considering an overdose of sleeping pills.',
      'Struggling with self-harm and cutting myself daily.',
      'Thinking about jumping off a bridge if things do not improve.',
    ];

    for (const plan of crisisPlans) {
      const res = checkPlanSafety(plan);
      assert.equal(res.isTriggered, true, `Failed to detect crisis in: "${plan}"`);
      assert.equal(res.message, CRISIS_SUPPORT_MESSAGE);
      assert.ok(res.message.includes('Tele-MANAS'));
      assert.ok(res.message.includes('14416'));
    }
  });

  it('detects Hindi crisis phrases in Devanagari and Romanized text', () => {
    const hindiPlans = [
      'मैं बहुत परेशान हूँ और आत्महत्या करने की सोच रहा हूँ।',
      'खुदकुशी ही एकमात्र रास्ता बचा है।',
      'अगर बिज़नेस नहीं चला तो मैं अपनी जान दे दूंगा।',
      'ab to bas marna chahta hoon main.',
      'agar yeh fail hua toh jaan de doonga.',
      'kuch bacha nahi hai bas khudkushi karni hai.',
      'meri zindagi khatam ho chuki hai.',
    ];

    for (const plan of hindiPlans) {
      const res = checkPlanSafety(plan);
      assert.equal(res.isTriggered, true, `Failed to detect Hindi crisis in: "${plan}"`);
      assert.equal(res.message, CRISIS_SUPPORT_MESSAGE);
    }
  });

  it('detects Kannada crisis phrases in Kannada script and Romanized text', () => {
    const kannadaPlans = [
      'ನನಗೆ ಬದುಕಲು ಇಷ್ಟವಿಲ್ಲ, ಆತ್ಮಹತ್ಯೆ ಮಾಡಿಕೊಳ್ಳಬೇಕು.',
      'ಜೀವನದಲ್ಲಿ ಎಲ್ಲವೂ ಮುಗಿದಿದೆ, ಸಾಯಬೇಕು ಅನಿಸುತ್ತಿದೆ.',
      'ನನ್ನ ಜೀವ ತಗೋತೀನಿ ಈ ಸಾಲ ತೀರಿಸಲು ಆಗದಿದ್ದರೆ.',
      'nanage saayabeku anistide tumba kashta ide.',
      'aathmahatye maadkolodu ondhe daari.',
      'nanna jeeva tagothini bega.',
    ];

    for (const plan of kannadaPlans) {
      const res = checkPlanSafety(plan);
      assert.equal(res.isTriggered, true, `Failed to detect Kannada crisis in: "${plan}"`);
      assert.equal(res.message, CRISIS_SUPPORT_MESSAGE);
    }
  });

  it('handles empty, null, or whitespace-only inputs safely', () => {
    // @ts-ignore
    assert.equal(checkPlanSafety(null).isTriggered, false);
    // @ts-ignore
    assert.equal(checkPlanSafety(undefined).isTriggered, false);
    assert.equal(checkPlanSafety('   ').isTriggered, false);
  });
});
