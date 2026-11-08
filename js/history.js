import { TESTS } from './data/assessment-tests.js';
import { FOCI, LADDERS, LIBRARY_GROUPS } from './data/exercises.js';
import { addDays } from './format.js';
import { countsAsTraining } from './session.js';

export function longestStreak(sessions) {
  const days = [...new Set(sessions.filter(countsAsTraining).map((session) => session.date))].sort();
  let longest = 0;
  let run = 0;
  days.forEach((day, index) => {
    run = index > 0 && addDays(days[index - 1], 1) === day ? run + 1 : 1;
    longest = Math.max(longest, run);
  });
  return longest;
}

/** Datoene i en måned, og hvor mange tomme ruter som trengs før den første når uken starter på mandag. */
export function monthCells(year, month) {
  const blanks = (new Date(year, month, 1).getDay() + 6) % 7;
  const dayCount = new Date(year, month + 1, 0).getDate();
  const first = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  return { blanks, dates: Array.from({ length: dayCount }, (_, index) => addDays(first, index)) };
}

export const trainedDates = (sessions) => new Set(sessions.filter(countsAsTraining).map((session) => session.date));

/** Øktene på en dag med settene gruppert per variant. */
export function sessionsOnDay(sessions, sets, date) {
  return sessions
    .filter((session) => session.date === date && countsAsTraining(session))
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
    .map((session) => {
      const rows = sets.filter((row) => row.sessionId === session.id).sort((a, b) => a.loggedAt.localeCompare(b.loggedAt));
      const exercises = new Map();
      for (const row of rows) {
        if (!exercises.has(row.stepId)) {
          exercises.set(row.stepId, { stepId: row.stepId, variant: row.variant, kind: row.kind, perSide: row.perSide, values: [], rating: row.rating });
        }
        exercises.get(row.stepId).values.push(row.value);
      }
      return {
        id: session.id,
        focusName: FOCI.find((focus) => focus.id === session.focus)?.name ?? '',
        status: session.status,
        exercises: [...exercises.values()],
      };
    });
}

function stepSeries(sets, stepId) {
  const byDate = new Map();
  for (const row of sets.filter((item) => item.stepId === stepId)) {
    const day = byDate.get(row.date) ?? { date: row.date, value: 0, total: 0 };
    day.value = Math.max(day.value, row.value);
    day.total += row.value;
    byDate.set(row.date, day);
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function testSeries(assessments, testId, variant) {
  const byDate = new Map();
  const matching = assessments
    .filter((row) => row.results[testId] !== undefined && (!variant || row.coreVariant === variant))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  for (const row of matching) byDate.set(row.date, { date: row.date, value: row.results[testId] });
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function testOptions(assessments) {
  const options = [];
  for (const test of TESTS) {
    if (test.variants) {
      for (const variant of test.variants) {
        if (assessments.some((row) => row.coreVariant === variant.id && row.results[test.id] !== undefined)) {
          options.push({ id: `test:${test.id}:${variant.id}`, label: variant.name });
        }
      }
    } else if (assessments.some((row) => row.results[test.id] !== undefined)) {
      options.push({ id: `test:${test.id}`, label: test.name });
    }
  }
  return options;
}

/** Valgene i grafvelgeren. Hver variant får egen graf, siden reps på ulike varianter ikke kan sammenlignes. */
export function chartOptionGroups(sets, assessments) {
  const logged = new Set(sets.map((row) => row.stepId));
  const groups = LIBRARY_GROUPS.map((group) => ({
    label: group.name,
    options: LADDERS.filter((ladder) => ladder.group === group.id)
      .flatMap((ladder) => ladder.steps)
      .filter((step) => logged.has(step.id))
      .map((step) => ({ id: `step:${step.id}`, label: step.name })),
  }));
  groups.push({ label: 'Kartlegging', options: testOptions(assessments) });
  return groups.filter((group) => group.options.length > 0);
}

export function defaultChartOption(sets, groups) {
  const latest = sets.reduce((newest, row) => (!newest || row.loggedAt > newest.loggedAt ? row : newest), null);
  return latest ? `step:${latest.stepId}` : (groups[0]?.options[0].id ?? null);
}

export function chartSeries(optionId, sets, assessments) {
  const [source, id, variant] = optionId.split(':');
  if (source === 'step') {
    const example = sets.find((row) => row.stepId === id);
    return { points: stepSeries(sets, id), kind: example.kind, perSide: Boolean(example.perSide) };
  }
  return { points: testSeries(assessments, id, variant), kind: TESTS.find((test) => test.id === id).kind === 'hold' ? 'hold' : 'reps', perSide: false };
}
