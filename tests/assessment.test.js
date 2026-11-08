import assert from 'node:assert/strict';
import test from 'node:test';
import { compareResult, formatResult, latestAssessment, testName } from '../js/assessment.js';
import { TESTS } from '../js/data/assessment-tests.js';
import { formatClock, localDateString, parseCount } from '../js/format.js';
import { elapsedSeconds, remainingSeconds } from '../js/timer.js';

const byId = (id) => TESTS.find((item) => item.id === id);

test('kartleggingen dekker de seks testene, alle med teknikk', () => {
  assert.deepEqual(TESTS.map((item) => item.id), ['pullups', 'pushups', 'deadHang', 'core', 'squats', 'kneeRaises']);
  for (const item of TESTS) {
    const techniques = item.variants ? item.variants.map((variant) => variant.technique) : [item.technique];
    for (const technique of techniques) assert.ok(technique.length >= 3, item.id);
  }
});

test('klokken viser minutter og sekunder', () => {
  assert.equal(formatClock(0), '0:00');
  assert.equal(formatClock(65), '1:05');
  assert.equal(formatClock(600), '10:00');
});

test('tallfeltet godtar bare heltall opp til tre siffer', () => {
  assert.equal(parseCount(''), null);
  assert.equal(parseCount('abc'), null);
  assert.equal(parseCount('0'), 0);
  assert.equal(parseCount('12a'), 12);
  assert.equal(parseCount('-5'), 5);
  assert.equal(parseCount('12345'), 123);
});

test('lokal dato bruker enhetens dato også sent på kvelden', () => {
  assert.equal(localDateString(new Date(2026, 10, 8, 23, 59)), '2026-11-08');
});

test('nedtelling stemmer selv om skjermen har vært låst', () => {
  assert.equal(remainingSeconds(60_000, 0), 60);
  assert.equal(remainingSeconds(60_000, 59_001), 1);
  assert.equal(remainingSeconds(60_000, 500_000), 0);
  assert.equal(elapsedSeconds(1_000, 46_500), 45);
  assert.equal(elapsedSeconds(1_000, 0), 0);
});

test('siste kartlegging velges etter tidspunkt', () => {
  assert.equal(latestAssessment([]), null);
  const rows = [
    { id: 'a', createdAt: '2026-09-01T10:00:00.000Z' },
    { id: 'c', createdAt: '2026-11-01T10:00:00.000Z' },
    { id: 'b', createdAt: '2026-10-01T10:00:00.000Z' },
  ];
  assert.equal(latestAssessment(rows).id, 'c');
});

test('resultater vises med riktig enhet', () => {
  assert.equal(formatResult(byId('pullups'), 8), '8 reps');
  assert.equal(formatResult(byId('squats'), 40), '40 reps');
  assert.equal(formatResult(byId('deadHang'), 75), '1:15');
});

test('valgt kjerneøvelse brukes som navn', () => {
  assert.equal(testName(byId('core'), 'hollow'), 'Hollow hold');
  assert.equal(testName(byId('pullups'), 'hollow'), 'Pull-ups');
});

test('endring fra forrige kartlegging', () => {
  const previous = { coreVariant: 'plank', results: { pullups: 5, deadHang: 30, core: 60 } };
  assert.equal(compareResult(byId('pullups'), 7, 'plank', previous), '+2');
  assert.equal(compareResult(byId('pullups'), 4, 'plank', previous), '−1');
  assert.equal(compareResult(byId('pullups'), 5, 'plank', previous), 'Likt');
  assert.equal(compareResult(byId('deadHang'), 40, 'plank', previous), '+10 sek');
});

test('ingen sammenligning uten grunnlag', () => {
  const previous = { coreVariant: 'plank', results: { core: 60 } };
  assert.equal(compareResult(byId('pullups'), 7, 'plank', null), '');
  assert.equal(compareResult(byId('pullups'), 7, 'plank', previous), '');
  assert.equal(compareResult(byId('core'), 70, 'hollow', previous), '');
});
