import { latestAssessment } from './assessment.js';
import { FOCI, LADDERS } from './data/exercises.js';
import { getAll, getSettings } from './db.js';

export const LENGTHS = {
  short: { label: 'Kort', exerciseCounts: [2], sets: 2, warmupSeconds: 120 },
  medium: { label: 'Middels', exerciseCounts: [3], sets: 3, warmupSeconds: 180 },
  long: { label: 'Lang', exerciseCounts: [5, 4], sets: 3, warmupSeconds: 240 },
};

export const PERCENT_RANGE = { min: 40, max: 80, step: 5 };

const LONG_SESSION_LIMIT_SECONDS = 31 * 60;
const SECONDS_PER_REP = 3.5;
const CHANGEOVER_SECONDS = 20;
const LIMITS = { reps: { min: 3, max: 30 }, hold: { min: 10, max: 90 } };

// Hollow er tyngre enn planke. Stigen regner i planketid, så begge testene kan brukes.
const HOLLOW_TO_PLANK = 1.5;

const ladderById = new Map(LADDERS.map((ladder) => [ladder.id, ladder]));

export function nextFocusId(lastFocusId) {
  const index = FOCI.findIndex((focus) => focus.id === lastFocusId);
  return FOCI[(index + 1) % FOCI.length].id;
}

/** Fokus fra siste økt med minst ett logget sett, slik at hoppede dager ikke forskyver rotasjonen. */
export function lastFocusId(sessions) {
  const counted = sessions.filter((session) => session.status !== 'active' && session.loggedSets > 0);
  return counted.reduce((latest, session) => (!latest || session.startedAt > latest.startedAt ? session : latest), null)?.focus ?? null;
}

export function anchorValue(ladder, assessment) {
  const value = assessment.results[ladder.anchor] ?? 0;
  return ladder.anchor === 'core' && assessment.coreVariant === 'hollow' ? value * HOLLOW_TO_PLANK : value;
}

export function defaultStep(ladder, assessment) {
  const anchor = anchorValue(ladder, assessment);
  return ladder.steps.filter((step) => step.minMax <= anchor).at(-1);
}

export function currentStep(ladder, assessment, state) {
  return ladder.steps.find((step) => step.id === state?.stepId) ?? defaultStep(ladder, assessment);
}

/** Variantene som endrer seg når programmet bygges på nytt fra en ny test. */
export function programChanges(previous, exerciseState, next) {
  return LADDERS.flatMap((ladder) => {
    const from = currentStep(ladder, previous, exerciseState[ladder.id]);
    const to = defaultStep(ladder, next);
    return from === to ? [] : [{ ladderName: ladder.name, from: from.name, to: to.name }];
  });
}

export const stepKind = (ladder, step) => step.kind ?? ladder.kind;

function targetLimits(ladder, step) {
  const { min, max } = LIMITS[stepKind(ladder, step)];
  return { min: step.min ?? min, max };
}

export function stepTarget(ladder, step, assessment, percentOfMax, adjustment = 0) {
  const raw = step.fixed !== undefined ? (step.fixed * percentOfMax) / 60 : (anchorValue(ladder, assessment) * percentOfMax * step.factor) / 100;
  const rounded = stepKind(ladder, step) === 'hold' ? Math.round(raw / 5) * 5 : Math.round(raw);
  const { min, max } = targetLimits(ladder, step);
  return Math.min(max, Math.max(min, rounded + adjustment));
}

export function formatTarget({ kind, target, perSide }) {
  const amount = kind === 'hold' ? `${target} sek` : `${target} reps`;
  return perSide ? `${kind === 'hold' ? amount : target} per side` : amount;
}

function workSeconds({ kind, target, perSide }) {
  const once = kind === 'hold' ? target : target * SECONDS_PER_REP;
  return perSide ? once * 2 : once;
}

export function estimateSeconds(plan) {
  const exercises = plan.exercises.reduce(
    (sum, exercise) => sum + exercise.sets * (workSeconds(exercise) + exercise.restSeconds) + CHANGEOVER_SECONDS,
    0,
  );
  return plan.warmupSeconds + exercises;
}

function planWithCount({ focus, length, assessment, percentOfMax, exerciseState, count }) {
  const exercises = focus.ladders.slice(0, count).map((ladderId) => {
    const ladder = ladderById.get(ladderId);
    const state = exerciseState[ladderId];
    const step = currentStep(ladder, assessment, state);
    const limits = targetLimits(ladder, step);
    return {
      ladderId,
      stepId: step.id,
      name: step.name,
      note: step.note,
      kind: stepKind(ladder, step),
      perSide: Boolean(step.perSide),
      target: stepTarget(ladder, step, assessment, percentOfMax, state?.adjustment ?? 0),
      minTarget: limits.min,
      maxTarget: limits.max,
      sets: LENGTHS[length].sets,
      restSeconds: focus.restSeconds,
    };
  });
  return { focus: focus.id, focusName: focus.name, length, warmupSeconds: LENGTHS[length].warmupSeconds, exercises };
}

export function buildPlan({ assessment, percentOfMax, exerciseState = {}, previousFocus = null, length }) {
  const focusId = nextFocusId(previousFocus);
  const focus = FOCI.find((item) => item.id === focusId);
  const counts = LENGTHS[length].exerciseCounts;
  const plans = counts.map((count) => planWithCount({ focus, length, assessment, percentOfMax, exerciseState, count }));
  return plans.find((plan) => estimateSeconds(plan) <= LONG_SESSION_LIMIT_SECONDS) ?? plans.at(-1);
}

export async function loadProgramContext() {
  const [assessments, settings, stateRows, sessions] = await Promise.all([
    getAll('assessments'),
    getSettings(),
    getAll('exerciseState'),
    getAll('sessions'),
  ]);
  return {
    assessment: latestAssessment(assessments),
    settings,
    exerciseState: Object.fromEntries(stateRows.map((row) => [row.exerciseId, row])),
    previousFocus: lastFocusId(sessions),
    sessions,
  };
}
