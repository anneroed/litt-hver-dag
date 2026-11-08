import assert from 'node:assert/strict';
import test from 'node:test';
import {
  countsAsTraining,
  createSession,
  createSetRecord,
  findActiveSession,
  positionAfterRating,
  positionAfterRest,
  positionAfterSet,
  ratingLabel,
  RATINGS,
  trainedOn,
} from '../js/session.js';

const exercise = (ladderId, sets = 2) => ({
  ladderId,
  stepId: `${ladderId}-step`,
  name: `Øvelse ${ladderId}`,
  kind: 'reps',
  perSide: false,
  target: 5,
  sets,
  restSeconds: 90,
});
const plan = { focus: 'pull', length: 'short', warmupSeconds: 120, exercises: [exercise('a'), exercise('b')] };

test('en økt starter på oppvarming og er aktiv', () => {
  const session = createSession(plan, new Date(2026, 10, 8, 18, 0));
  assert.equal(session.status, 'active');
  assert.equal(session.date, '2026-11-08');
  assert.equal(session.focus, 'pull');
  assert.equal(session.loggedSets, 0);
  assert.deepEqual(session.position, { phase: 'warmup', exerciseIndex: 0, setIndex: 0 });
});

test('hele økten går i riktig rekkefølge', () => {
  let position = { phase: 'work', exerciseIndex: 0, setIndex: 0 };

  position = positionAfterSet(plan, position, 1000);
  assert.deepEqual(position, { phase: 'rest', exerciseIndex: 0, setIndex: 1, restEndAt: 91_000 });

  position = positionAfterRest(position);
  assert.deepEqual(position, { phase: 'work', exerciseIndex: 0, setIndex: 1 });

  position = positionAfterSet(plan, position, 1000);
  assert.equal(position.phase, 'rating');

  position = positionAfterRating(plan, position, 2000);
  assert.deepEqual(position, { phase: 'rest', exerciseIndex: 1, setIndex: 0, restEndAt: 92_000 });

  position = positionAfterRest(position);
  position = positionAfterSet(plan, position, 0);
  position = positionAfterRest(position);
  position = positionAfterSet(plan, position, 0);
  assert.equal(position.phase, 'rating');
  assert.equal(positionAfterRating(plan, position, 0).phase, 'done');
});

test('settet får dato fra økten, også over midnatt', () => {
  const session = createSession(plan, new Date(2026, 10, 8, 23, 59));
  session.position = { phase: 'work', exerciseIndex: 1, setIndex: 1 };
  const row = createSetRecord(session, 4, new Date(2026, 10, 9, 0, 5));
  assert.equal(row.date, '2026-11-08');
  assert.equal(row.sessionId, session.id);
  assert.equal(row.exerciseId, 'b');
  assert.equal(row.stepId, 'b-step');
  assert.equal(row.variant, 'Øvelse b');
  assert.equal(row.setNumber, 2);
  assert.equal(row.target, 5);
  assert.equal(row.value, 4);
  assert.equal(row.rating, null);
});

test('dager teller når minst ett sett er logget', () => {
  assert.equal(countsAsTraining({ status: 'done', loggedSets: 4 }), true);
  assert.equal(countsAsTraining({ status: 'aborted', loggedSets: 1 }), true);
  assert.equal(countsAsTraining({ status: 'aborted', loggedSets: 0 }), false);
  assert.equal(countsAsTraining({ status: 'active', loggedSets: 3 }), false);
});

test('trent i dag ser bare på riktig dato', () => {
  const sessions = [{ date: '2026-11-07', status: 'done', loggedSets: 4 }];
  assert.equal(trainedOn(sessions, '2026-11-07'), true);
  assert.equal(trainedOn(sessions, '2026-11-08'), false);
});

test('aktiv økt finnes', () => {
  assert.equal(findActiveSession([{ id: 'a', status: 'done' }]), null);
  assert.equal(findActiveSession([{ id: 'a', status: 'done' }, { id: 'b', status: 'active' }]).id, 'b');
});

test('vurderingene er lett, passe og tungt', () => {
  assert.deepEqual(RATINGS.map((rating) => rating.label), ['Lett', 'Passe', 'Tungt']);
  assert.equal(ratingLabel('hard'), 'Tungt');
  assert.equal(ratingLabel(undefined), '');
});
