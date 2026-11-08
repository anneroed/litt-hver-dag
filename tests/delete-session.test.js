import assert from 'node:assert/strict';
import test from 'node:test';
import { applyRating, revertSessionRatings } from '../js/progression.js';

const exercise = { ladderId: 'pullup', stepId: 'pullup', kind: 'reps', target: 5, minTarget: 3, maxTarget: 30 };
const session = (ratingId, nextTarget) => ({
  ratings: { pullup: ratingId },
  nextTargets: { pullup: nextTarget },
  plan: { exercises: [exercise] },
});

test('en lett økt tas tilbake', () => {
  const state = applyRating(undefined, exercise, 'easy');
  const [reverted] = revertSessionRatings(session('easy', 6), { pullup: state });
  assert.equal(reverted.adjustment, 0);
  assert.equal(reverted.ratingRun, null);
});

test('en tung holdøkt tas tilbake', () => {
  const hold = { ...exercise, kind: 'hold', target: 30, minTarget: 10, maxTarget: 90 };
  const state = applyRating({ adjustment: 5 }, hold, 'hard');
  const [reverted] = revertSessionRatings({ ratings: { pullup: 'hard' }, nextTargets: { pullup: 25 }, plan: { exercises: [hold] } }, { pullup: state });
  assert.equal(reverted.adjustment, 5);
});

test('senere økter beholder sin del av justeringen', () => {
  const [reverted] = revertSessionRatings(session('easy', 6), { pullup: { exerciseId: 'pullup', stepId: 'pullup', adjustment: 3, ratingRun: null, suggestion: null } });
  assert.equal(reverted.adjustment, 2);
});

test('justering som stoppet på grensen tas ikke tilbake', () => {
  const [reverted] = revertSessionRatings(session('hard', 5), { pullup: { exerciseId: 'pullup', stepId: 'pullup', adjustment: -2, ratingRun: null, suggestion: null } });
  assert.equal(reverted.adjustment, -2);
});

test('forslag fra samme retning fjernes, motsatt retning står', () => {
  const heavier = { direction: 'heavier', stepId: 'tempo-pullup' };
  const state = { exerciseId: 'pullup', stepId: 'pullup', adjustment: 2, ratingRun: null, suggestion: heavier };
  assert.equal(revertSessionRatings(session('easy', 6), { pullup: state })[0].suggestion, null);
  assert.deepEqual(revertSessionRatings(session('hard', 4), { pullup: state })[0].suggestion, heavier);
});

test('byttet variant røres ikke', () => {
  const state = { exerciseId: 'pullup', stepId: 'tempo-pullup', adjustment: 0, ratingRun: null, suggestion: null };
  assert.deepEqual(revertSessionRatings(session('easy', 6), { pullup: state }), []);
});

test('uten status, vurdering eller plan er det ingenting å ta tilbake', () => {
  assert.deepEqual(revertSessionRatings(session('easy', 6), {}), []);
  assert.deepEqual(revertSessionRatings({ ratings: {}, plan: {} }, { pullup: { stepId: 'pullup', adjustment: 1 } }), []);
  assert.deepEqual(revertSessionRatings({ ratings: { pullup: 'easy' }, plan: {} }, { pullup: { stepId: 'pullup', adjustment: 1 } }), []);
  assert.deepEqual(revertSessionRatings({ ratings: { pullup: 'easy' }, plan: { exercises: [exercise] } }, { pullup: { stepId: 'pullup', adjustment: 1 } }), []);
});
