import assert from 'node:assert/strict';
import test from 'node:test';
import { niceAxis } from '../js/chart.js';
import { dayNumber, formatDateShort, parseLocalDate } from '../js/format.js';
import { chartOptionGroups, chartSeries, defaultChartOption, longestStreak, monthCells, sessionsOnDay, trainedDates } from '../js/history.js';

const session = (id, date, status = 'done', loggedSets = 2, focus = 'pull') => ({ id, date, status, loggedSets, focus, startedAt: `${date}T10:00:00.000Z` });
const set = (sessionId, date, stepId, value, setNumber = 1, extra = {}) => ({
  id: `${sessionId}-${stepId}-${setNumber}`,
  sessionId,
  date,
  stepId,
  variant: stepId,
  kind: 'reps',
  perSide: false,
  value,
  setNumber,
  rating: 'ok',
  loggedAt: `${date}T10:0${setNumber}:00.000Z`,
  ...extra,
});

test('lengste streak', () => {
  assert.equal(longestStreak([]), 0);
  assert.equal(longestStreak([session('a', '2026-11-01')]), 1);
  assert.equal(
    longestStreak(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-05', '2026-11-05', '2026-11-06'].map((date, index) => session(String(index), date))),
    3,
  );
});

test('økter som ikke teller, er ikke med i lengste streak', () => {
  assert.equal(longestStreak([session('a', '2026-11-01'), session('b', '2026-11-02', 'aborted', 0), session('c', '2026-11-03', 'active')]), 1);
});

test('måneden starter på riktig ukedag med mandag først', () => {
  const november = monthCells(2026, 10);
  assert.equal(november.blanks, 6);
  assert.equal(november.dates.length, 30);
  assert.equal(november.dates[0], '2026-11-01');
  assert.equal(november.dates.at(-1), '2026-11-30');
  assert.equal(monthCells(2026, 5).blanks, 0);
});

test('februar i skuddår', () => {
  assert.equal(monthCells(2028, 1).dates.length, 29);
  assert.equal(monthCells(2026, 1).dates.length, 28);
});

test('trente dager tar med avbrutte økter med sett', () => {
  assert.deepEqual([...trainedDates([session('a', '2026-11-01'), session('b', '2026-11-02', 'aborted', 1), session('c', '2026-11-03', 'aborted', 0)])], ['2026-11-01', '2026-11-02']);
});

test('dagsvisning grupperer sett per variant i logget rekkefølge', () => {
  const sessions = [session('a', '2026-11-08'), session('other', '2026-11-07')];
  const sets = [set('a', '2026-11-08', 'tempo', 3, 2), set('a', '2026-11-08', 'tempo', 4, 1), set('other', '2026-11-07', 'tempo', 9)];
  const [day] = sessionsOnDay(sessions, sets, '2026-11-08');
  assert.equal(day.focusName, 'Trekk');
  assert.deepEqual(day.exercises.map((item) => [item.stepId, item.values, item.rating]), [['tempo', [4, 3], 'ok']]);
});

test('økter uten sett viser ikke feil', () => {
  assert.deepEqual(sessionsOnDay([session('a', '2026-11-08')], [], '2026-11-08')[0].exercises, []);
  assert.deepEqual(sessionsOnDay([], [], '2026-11-08'), []);
});

test('grafen viser beste sett og totalt per dag', () => {
  const sets = [set('a', '2026-11-02', 'pullup', 5, 1), set('a', '2026-11-02', 'pullup', 4, 2), set('b', '2026-11-01', 'pullup', 3, 1)];
  assert.deepEqual(chartSeries('step:pullup', sets, []).points, [
    { date: '2026-11-01', value: 3, total: 3 },
    { date: '2026-11-02', value: 5, total: 9 },
  ]);
});

test('to økter samme dag slås sammen', () => {
  const sets = [set('a', '2026-11-02', 'pullup', 5), set('b', '2026-11-02', 'pullup', 7)];
  assert.deepEqual(chartSeries('step:pullup', sets, []).points, [{ date: '2026-11-02', value: 7, total: 12 }]);
});

test('varianter blandes ikke', () => {
  const sets = [set('a', '2026-11-01', 'pullup', 5), set('a', '2026-11-01', 'tempo', 2)];
  assert.deepEqual(chartSeries('step:tempo', sets, []).points.map((point) => point.value), [2]);
});

const assessment = (id, date, results, coreVariant = 'plank') => ({ id, date, createdAt: `${date}T10:00:00.000Z`, results, coreVariant });

test('kartlegginger har egne grafer, og planke og hollow holdes adskilt', () => {
  const rows = [assessment('a', '2026-10-01', { pullups: 4, core: 60 }, 'plank'), assessment('b', '2026-11-01', { pullups: 6, core: 30 }, 'hollow')];
  assert.deepEqual(chartSeries('test:pullups', [], rows).points.map((point) => point.value), [4, 6]);
  assert.deepEqual(chartSeries('test:core:plank', [], rows).points.map((point) => point.value), [60]);
  assert.deepEqual(chartSeries('test:core:hollow', [], rows).points.map((point) => point.value), [30]);
  assert.equal(chartSeries('test:core:hollow', [], rows).kind, 'hold');
  assert.equal(chartSeries('test:squats', [], [assessment('c', '2026-11-01', { squats: 40 })]).kind, 'reps');
});

test('siste kartlegging samme dag vinner', () => {
  const rows = [
    { ...assessment('a', '2026-11-01', { pullups: 4 }), createdAt: '2026-11-01T08:00:00.000Z' },
    { ...assessment('b', '2026-11-01', { pullups: 6 }), createdAt: '2026-11-01T09:00:00.000Z' },
  ];
  assert.deepEqual(chartSeries('test:pullups', [], rows).points, [{ date: '2026-11-01', value: 6 }]);
});

test('velgeren viser bare data som finnes', () => {
  const groups = chartOptionGroups([set('a', '2026-11-01', 'pullup', 5)], [assessment('a', '2026-11-01', { pullups: 4, core: 60 })]);
  assert.deepEqual(groups.map((group) => group.label), ['Trekk', 'Kartlegging']);
  assert.deepEqual(groups[0].options, [{ id: 'step:pullup', label: 'Pull-ups' }]);
  assert.deepEqual(groups[1].options.map((option) => option.id), ['test:pullups', 'test:core:plank']);
  assert.deepEqual(chartOptionGroups([], []), []);
});

test('standardvalget er sist loggede variant', () => {
  const sets = [set('a', '2026-11-01', 'pullup', 5), set('b', '2026-11-02', 'tempo', 2)];
  assert.equal(defaultChartOption(sets, []), 'step:tempo');
  assert.equal(defaultChartOption([], [{ options: [{ id: 'test:pullups' }] }]), 'test:pullups');
  assert.equal(defaultChartOption([], []), null);
});

test('aksen starter på 0 og har runde verdier', () => {
  assert.deepEqual(niceAxis(0), { max: 1, ticks: [0, 1] });
  assert.deepEqual(niceAxis(3).ticks, [0, 1, 2, 3]);
  assert.deepEqual(niceAxis(7).ticks, [0, 2, 4, 6, 8]);
  assert.deepEqual(niceAxis(45).ticks, [0, 20, 40, 60]);
  assert.equal(niceAxis(90).max, 100);
  for (let value = 0; value <= 1000; value++) {
    const axis = niceAxis(value);
    assert.ok(axis.max >= value, String(value));
    assert.ok(axis.ticks.length <= 5, String(value));
    assert.ok(axis.ticks.every(Number.isInteger), String(value));
  }
});

test('dato tolkes lokalt og x-aksen teller hele dager over sommertid', () => {
  assert.equal(parseLocalDate('2026-11-08').getDate(), 8);
  assert.match(formatDateShort('2026-11-08'), /^8\. nov/);
  assert.equal(dayNumber('2026-10-26') - dayNumber('2026-10-24'), 2);
});
