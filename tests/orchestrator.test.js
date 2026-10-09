import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { runReview } from '../src/orchestrator.js';
import * as geminiClient from '../src/services/geminiClient.js';
import * as modelPool from '../src/services/modelPool.js';
import * as cache from '../src/services/cache.js';
import config from '../config.js';

const mockPersona = {
  headline: 'Test Headline',
  points: [{ claim: 'Risk claim', severity: 4, suggestedFix: 'Fix' }],
  verdict: 'Test verdict',
};

const mockJudge = {
  survivalScoreBefore: 30,
  survivalScoreAfter: 80,
  rationale: 'Mitigations applied',
  topRisks: ['Risk A', 'Risk B', 'Risk C'],
  hardenedPlan: 'Hardened strategy',
  actionItems: [{ task: 'Action 1', dueInDays: 14 }],
  unresolvedQuestions: ['Question 1'],
  missingPersonas: [],
  modeUsed: 'live',
};

describe('orchestrator.js execution paths', () => {
  beforeEach(() => {
    modelPool.resetModelPool();
    cache.clear();
  });

  it('runs demo mode successfully with pre-saved example benchmark data and correct event ordering', async () => {
    const events = [];
    const mockRes = {
      writableEnded: false,
      destroyed: false,
      write: str => events.push(JSON.parse(str.trim())),
    };

    await runReview({
      plan: 'Irrelevant custom text',
      mode: 'demo',
      exampleId: 'career-change',
      res: mockRes,
    });

    const eventTypes = events.map(e => e.event);
    assert.equal(eventTypes[0], 'mode_selected');
    assert.equal(eventTypes[eventTypes.length - 1], 'judge_done');
    assert.ok(eventTypes.includes('persona_done'));

    const judgeDone = events.find(e => e.event === 'judge_done');
    assert.equal(judgeDone.data.survivalScoreBefore, 22);
    assert.equal(judgeDone.data.survivalScoreAfter, 78);
  });

  it('executes live mode where all 5 personas succeed and calls Judge', async () => {
    const events = [];
    const mockRes = {
      writableEnded: false,
      destroyed: false,
      write: str => events.push(JSON.parse(str.trim())),
    };

    geminiClient.setMockClient({
      models: {
        generateContent: async req => {
          if (req.model.includes('flash') && !req.model.includes('lite')) {
            return { text: JSON.stringify(mockJudge) };
          }
          return { text: JSON.stringify(mockPersona) };
        },
      },
    });

    await runReview({
      plan: 'Live plan to stress test',
      mode: 'live',
      res: mockRes,
    });

    const doneCount = events.filter(e => e.event === 'persona_done').length;
    assert.equal(doneCount, 5);
    assert.ok(events.some(e => e.event === 'judge_done'));
  });

  it('retries once when a persona fails and succeeds on fallback model', async () => {
    const events = [];
    const mockRes = {
      writableEnded: false,
      destroyed: false,
      write: str => events.push(JSON.parse(str.trim())),
    };

    let callCount = 0;
    geminiClient.setMockClient({
      models: {
        generateContent: async req => {
          if (req.model.includes('flash') && !req.model.includes('lite')) {
            return { text: JSON.stringify(mockJudge) };
          }
          callCount++;
          if (callCount === 1) {
            throw new Error('Temporary failure');
          }
          return { text: JSON.stringify(mockPersona) };
        },
      },
    });

    await runReview({
      plan: 'Live plan with single retry',
      mode: 'live',
      res: mockRes,
    });

    const doneCount = events.filter(e => e.event === 'persona_done').length;
    assert.equal(doneCount, 5);
    assert.ok(events.some(e => e.event === 'judge_done'));
  });

  it('proceeds to Judge when 3 of 5 personas succeed, reporting missing personas', async () => {
    const events = [];
    const mockRes = {
      writableEnded: false,
      destroyed: false,
      write: str => events.push(JSON.parse(str.trim())),
    };

    geminiClient.setMockClient({
      models: {
        generateContent: async req => {
          const sys = req.config?.systemInstruction || '';
          if (req.model.includes('flash') && !req.model.includes('lite')) {
            return { text: JSON.stringify({ ...mockJudge, missingPersonas: ['pessimist', 'accountant'] }) };
          }
          if (sys.includes('Pessimist') || sys.includes('Accountant')) {
            throw new Error('Persistent failure');
          }
          return { text: JSON.stringify(mockPersona) };
        },
      },
    });

    await runReview({
      plan: '3 of 5 succeed plan',
      mode: 'live',
      res: mockRes,
    });

    const failedCount = events.filter(e => e.event === 'persona_failed').length;
    assert.equal(failedCount, 2);
    const judgeDone = events.find(e => e.event === 'judge_done');
    assert.ok(judgeDone);
    assert.equal(judgeDone.data.missingPersonas.length, 2);
  });

  it('degrades to quick mode when fewer than 3 personas succeed in live mode', async () => {
    const events = [];
    const mockRes = {
      writableEnded: false,
      destroyed: false,
      write: str => events.push(JSON.parse(str.trim())),
    };

    geminiClient.setMockClient({
      models: {
        generateContent: async req => {
          const sys = req.config?.systemInstruction || '';
          if (sys.includes('Red Team council')) {
            return {
              text: JSON.stringify({
                pessimist: mockPersona,
                accountant: mockPersona,
                skepticalParent: mockPersona,
                futureYou: mockPersona,
                optimist: mockPersona,
              }),
            };
          }
          if (req.model.includes('flash') && !req.model.includes('lite')) {
            return { text: JSON.stringify(mockJudge) };
          }
          throw new Error('All live persona calls fail');
        },
      },
    });

    await runReview({
      plan: 'Plan triggering live to quick degradation',
      mode: 'live',
      res: mockRes,
    });

    assert.ok(events.some(e => e.event === 'degraded' && e.to === 'quick'));
    assert.ok(events.some(e => e.event === 'judge_done'));
  });

  it('returns code demo_only for custom plan when DEMO_MODE=true', async () => {
    const events = [];
    const mockRes = {
      writableEnded: false,
      destroyed: false,
      write: str => events.push(JSON.parse(str.trim())),
    };

    const origDemo = process.env.DEMO_MODE;
    process.env.DEMO_MODE = 'true';

    try {
      await runReview({
        plan: 'Unique unbenchmarked custom plan text',
        mode: 'auto',
        res: mockRes,
      });

      const errEvent = events.find(e => e.event === 'error');
      assert.ok(errEvent);
      assert.equal(errEvent.code, 'demo_only');
      assert.equal(errEvent.sampleAvailable, true);
    } finally {
      process.env.DEMO_MODE = origDemo || 'false';
    }
  });

  it('degrades to error code busy when quick mode fails for custom plan, NEVER serving cached example', async () => {
    const events = [];
    const mockRes = {
      writableEnded: false,
      destroyed: false,
      write: str => events.push(JSON.parse(str.trim())),
    };

    geminiClient.setMockClient({
      models: {
        generateContent: async () => {
          throw new Error('503 Service Unavailable');
        },
      },
    });

    const customPlan = 'My completely unique life plan that matches zero benchmarks.';

    await runReview({
      plan: customPlan,
      mode: 'quick',
      res: mockRes,
    });

    const lastEvent = events[events.length - 1];
    assert.equal(lastEvent.event, 'error');
    assert.equal(lastEvent.code, 'busy');
    assert.equal(lastEvent.sampleAvailable, true);
    assert.equal(events.some(e => e.event === 'judge_done'), false);
  });
});
