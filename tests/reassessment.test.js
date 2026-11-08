import assert from 'node:assert/strict';
import test from 'node:test';
import { reassessmentReminder } from '../js/assessment.js';
import { addDays } from '../js/format.js';
import { buildPlan, programChanges } from '../js/program.js';

const today = '2026-11-08';
const takenDaysAgo = (days) => ({ date: addDays(today, -days) });

test('ingen påminnelse uten kartlegging', () => assert.equal(reassessmentReminder(null, today), null));
test('ingen påminnelse før fire uker', () => assert.equal(reassessmentReminder(takenDaysAgo(27), today), null));

test('påminnelse fra fire uker', () => {
  assert.deepEqual(reassessmentReminder(takenDaysAgo(28), today), { weeks: 4, overdue: false });
  assert.deepEqual(reassessmentReminder(takenDaysAgo(41), today), { weeks: 5, overdue: false });
});

test('tydeligere påminnelse fra seks uker', () => {
  assert.deepEqual(reassessmentReminder(takenDaysAgo(42), today), { weeks: 6, overdue: true });
  assert.deepEqual(reassessmentReminder(takenDaysAgo(100), today), { weeks: 14, overdue: true });
});

test('utsettelse skjuler påminnelsen til datoen er nådd', () => {
  assert.equal(reassessmentReminder(takenDaysAgo(30), today, addDays(today, 1)), null);
  assert.deepEqual(reassessmentReminder(takenDaysAgo(30), today, today), { weeks: 4, overdue: false });
  assert.deepEqual(reassessmentReminder(takenDaysAgo(30), today, addDays(today, -1)), { weeks: 4, overdue: false });
});

test('uker regnes riktig over sommertid', () => {
  assert.deepEqual(reassessmentReminder({ date: '2026-03-01' }, '2026-03-29'), { weeks: 4, overdue: false });
  assert.deepEqual(reassessmentReminder({ date: '2026-10-01' }, '2026-10-29'), { weeks: 4, overdue: false });
});

const assessment = (results = {}) => ({
  coreVariant: 'plank',
  results: { pullups: 8, pushups: 20, deadHang: 45, core: 60, squats: 40, kneeRaises: 10, ...results },
});

test('samme resultater gir ingen endringer', () => assert.deepEqual(programChanges(assessment(), {}, assessment()), []));

test('bedre test gir tyngre variant', () => {
  const changes = programChanges(assessment({ pullups: 5 }), {}, assessment({ pullups: 5, pushups: 20 }));
  assert.deepEqual(changes, []);
  const pullup = programChanges(assessment({ pullups: 5 }), {}, assessment({ pullups: 6 })).find((change) => change.ladderName === 'Pull-ups');
  assert.deepEqual(pullup, { ladderName: 'Pull-ups', from: 'Negative pull-ups', to: 'Pull-ups' });
});

test('selvvalgt trinn sammenlignes med det nye programmet', () => {
  const changes = programChanges(assessment(), { pullup: { stepId: 'tempo-pullup' } }, assessment());
  assert.deepEqual(changes, [{ ladderName: 'Pull-ups', from: 'Tempo-pull-ups', to: 'Pull-ups' }]);
});

test('uten øvelsesstatus bygger programmet bare på den nye testen', () => {
  const plan = buildPlan({ assessment: assessment({ pullups: 12 }), percentOfMax: 60, exerciseState: {}, length: 'short' });
  assert.deepEqual([plan.exercises[0].name, plan.exercises[0].target], ['Tempo-pull-ups', 4]);
});
