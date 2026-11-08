import assert from 'node:assert/strict';
import test from 'node:test';
import { addDays } from '../js/format.js';
import { acceptSuggestion, applyRating, declineSuggestion, suggestionText } from '../js/progression.js';
import { currentStreak } from '../js/session.js';

const pullups = { ladderId: 'pullup', stepId: 'pullup', kind: 'reps', target: 5, minTarget: 3, maxTarget: 30 };
const hold = { ladderId: 'dead-hang', stepId: 'dead-hang', kind: 'hold', target: 30, minTarget: 10, maxTarget: 90 };

test('lett øker, passe står stille, tungt senker', () => {
  assert.equal(applyRating(undefined, pullups, 'easy').adjustment, 1);
  assert.equal(applyRating(undefined, pullups, 'ok').adjustment, 0);
  assert.equal(applyRating(undefined, pullups, 'hard').adjustment, -1);
});

test('holdøvelser justeres med fem sekunder', () => {
  assert.equal(applyRating(undefined, hold, 'easy').adjustment, 5);
  assert.equal(applyRating(undefined, hold, 'hard').adjustment, -5);
});

test('justeringen bygger på forrige justering', () => {
  assert.equal(applyRating({ adjustment: 2 }, pullups, 'easy').adjustment, 3);
  assert.equal(applyRating({ adjustment: 2 }, pullups, 'hard').adjustment, 1);
});

test('justeringen samler seg ikke opp utenfor grensene', () => {
  assert.equal(applyRating({ adjustment: -2 }, { ...pullups, target: 3 }, 'hard').adjustment, -2);
  assert.equal(applyRating({ adjustment: 4 }, { ...pullups, target: 30 }, 'easy').adjustment, 4);
});

test('utført trinn huskes', () => {
  const state = applyRating(undefined, pullups, 'ok');
  assert.equal(state.exerciseId, 'pullup');
  assert.equal(state.stepId, 'pullup');
});

test('én vurdering gir ikke forslag', () => {
  assert.equal(applyRating(undefined, pullups, 'easy').suggestion, null);
});

test('to ganger lett foreslår tyngre trinn', () => {
  const state = applyRating(applyRating(undefined, pullups, 'easy'), pullups, 'easy');
  assert.deepEqual(state.suggestion, { direction: 'heavier', stepId: 'tempo-pullup' });
  assert.equal(state.ratingRun, null);
});

test('to ganger tungt foreslår lettere trinn', () => {
  const state = applyRating(applyRating(undefined, pullups, 'hard'), pullups, 'hard');
  assert.deepEqual(state.suggestion, { direction: 'lighter', stepId: 'negative-pullup' });
});

test('avbrutt rekke gir ikke forslag', () => {
  for (const middle of ['ok', 'hard']) {
    const state = applyRating(applyRating(applyRating(undefined, pullups, 'easy'), pullups, middle), pullups, 'easy');
    assert.equal(state.suggestion, null, middle);
  }
});

test('ingen forslag utenfor stigen', () => {
  const top = { ...pullups, stepId: 'archer-pullup' };
  assert.equal(applyRating(applyRating(undefined, top, 'easy'), top, 'easy').suggestion, null);
  const bottom = { ...pullups, stepId: 'negative-pullup' };
  assert.equal(applyRating(applyRating(undefined, bottom, 'hard'), bottom, 'hard').suggestion, null);
});

test('ubesvart forslag står til vurderingen peker en annen vei', () => {
  const suggestion = { direction: 'heavier', stepId: 'tempo-pullup' };
  assert.deepEqual(applyRating({ adjustment: 2, suggestion }, pullups, 'easy').suggestion, suggestion);
  assert.equal(applyRating({ adjustment: 2, suggestion }, pullups, 'ok').suggestion, null);
  assert.equal(applyRating({ adjustment: 2, suggestion }, pullups, 'hard').suggestion, null);
});

test('å godta bytter trinn og nullstiller justeringen', () => {
  const state = { exerciseId: 'pullup', stepId: 'pullup', adjustment: 3, ratingRun: null, suggestion: { direction: 'heavier', stepId: 'tempo-pullup' } };
  assert.deepEqual(acceptSuggestion(state), { exerciseId: 'pullup', stepId: 'tempo-pullup', adjustment: 0, ratingRun: null, suggestion: null });
});

test('å beholde fjerner bare forslaget', () => {
  const state = { exerciseId: 'pullup', stepId: 'pullup', adjustment: 3, ratingRun: null, suggestion: { direction: 'heavier', stepId: 'tempo-pullup' } };
  assert.deepEqual(declineSuggestion(state), { ...state, suggestion: null });
});

test('forslagsteksten er forståelig', () => {
  assert.equal(
    suggestionText({ exerciseId: 'pullup', stepId: 'pullup', suggestion: { direction: 'heavier', stepId: 'tempo-pullup' } }),
    'Pull-ups har vært lett to ganger på rad. Vil du prøve Tempo-pull-ups?',
  );
  assert.equal(
    suggestionText({ exerciseId: 'pullup', stepId: 'pullup', suggestion: { direction: 'lighter', stepId: 'negative-pullup' } }),
    'Pull-ups har vært tungt to ganger på rad. Vil du gå ned til Negative pull-ups?',
  );
});

const trained = (...dates) => dates.map((date) => ({ date, status: 'done', loggedSets: 4 }));

test('uten trening er streaken 0', () => assert.equal(currentStreak([], '2026-11-08'), 0));
test('trent i dag gir 1', () => assert.equal(currentStreak(trained('2026-11-08'), '2026-11-08'), 1));

test('dager på rad telles bakover fra i dag', () => {
  assert.equal(currentStreak(trained('2026-11-08', '2026-11-07', '2026-11-06'), '2026-11-08'), 3);
});

test('streaken lever til dagen er over', () => {
  assert.equal(currentStreak(trained('2026-11-07', '2026-11-06'), '2026-11-08'), 2);
});

test('en hoppet dag bryter streaken', () => {
  assert.equal(currentStreak(trained('2026-11-06', '2026-11-05'), '2026-11-08'), 0);
  assert.equal(currentStreak(trained('2026-11-08', '2026-11-06', '2026-11-05'), '2026-11-08'), 1);
});

test('to økter samme dag teller én dag', () => {
  assert.equal(currentStreak(trained('2026-11-08', '2026-11-08'), '2026-11-08'), 1);
});

test('kort og avbrutt økt med sett teller fullt, tom og aktiv økt teller ikke', () => {
  assert.equal(currentStreak([{ date: '2026-11-08', status: 'aborted', loggedSets: 1 }], '2026-11-08'), 1);
  assert.equal(currentStreak([{ date: '2026-11-08', status: 'active', loggedSets: 3 }], '2026-11-08'), 0);
  assert.equal(currentStreak([{ date: '2026-11-08', status: 'aborted', loggedSets: 0 }], '2026-11-08'), 0);
});

test('streaken går over månedsskifte, årsskifte og sommertid', () => {
  assert.equal(currentStreak(trained('2026-11-01', '2026-10-31', '2026-10-30'), '2026-11-01'), 3);
  assert.equal(currentStreak(trained('2027-01-01', '2026-12-31'), '2027-01-01'), 2);
  assert.equal(currentStreak(trained('2026-10-26', '2026-10-25', '2026-10-24'), '2026-10-26'), 3);
  assert.equal(currentStreak(trained('2026-03-30', '2026-03-29', '2026-03-28'), '2026-03-30'), 3);
});

test('addDays regner kalenderdager', () => {
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
});
