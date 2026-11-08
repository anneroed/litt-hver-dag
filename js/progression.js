import { LADDERS } from './data/exercises.js';

const STEP_SIZE = { reps: 1, hold: 5 };
const RATING_DIRECTION = { easy: 1, ok: 0, hard: -1 };
const REPEATS_BEFORE_SUGGESTION = 2;

const ladderOf = (ladderId) => LADDERS.find((ladder) => ladder.id === ladderId);

function suggestedStep(exercise, ratingId) {
  const { steps } = ladderOf(exercise.ladderId);
  const index = steps.findIndex((step) => step.id === exercise.stepId);
  const step = steps[index + RATING_DIRECTION[ratingId]];
  return step && index >= 0 ? { direction: ratingId === 'easy' ? 'heavier' : 'lighter', stepId: step.id } : null;
}

function nextRun(run, ratingId) {
  if (ratingId === 'ok') return null;
  return { rating: ratingId, count: run?.rating === ratingId ? run.count + 1 : 1 };
}

/** Beregner ny status for øvelsen etter en vurdering. Målet holdes innenfor trinnets grenser. */
export function applyRating(state, exercise, ratingId) {
  const change = STEP_SIZE[exercise.kind] * RATING_DIRECTION[ratingId];
  const nextTarget = Math.min(exercise.maxTarget, Math.max(exercise.minTarget, exercise.target + change));
  const run = nextRun(state?.ratingRun, ratingId);
  const direction = ratingId === 'easy' ? 'heavier' : 'lighter';

  let suggestion = ratingId !== 'ok' && state?.suggestion?.direction === direction ? state.suggestion : null;
  let ratingRun = run;
  if (run?.count >= REPEATS_BEFORE_SUGGESTION) {
    suggestion = suggestedStep(exercise, ratingId) ?? suggestion;
    ratingRun = null;
  }

  return {
    exerciseId: exercise.ladderId,
    stepId: exercise.stepId,
    adjustment: (state?.adjustment ?? 0) + nextTarget - exercise.target,
    ratingRun,
    suggestion,
  };
}

/** Øvelsesstatus etter at vurderingene i en slettet økt er tatt tilbake. Gir bare radene som endres. */
export function revertSessionRatings(session, exerciseState) {
  return Object.entries(session.ratings).flatMap(([ladderId, ratingId]) => {
    const exercise = session.plan.exercises?.find((item) => item.ladderId === ladderId);
    const state = exerciseState[ladderId];
    const nextTarget = session.nextTargets?.[ladderId];
    // Har du byttet variant siden, er justeringen allerede nullstilt.
    if (!exercise || !state || state.stepId !== exercise.stepId || nextTarget === undefined) return [];

    const direction = ratingId === 'easy' ? 'heavier' : 'lighter';
    return [
      {
        ...state,
        adjustment: state.adjustment - (nextTarget - exercise.target),
        ratingRun: state.ratingRun?.rating === ratingId ? null : state.ratingRun,
        suggestion: state.suggestion?.direction === direction ? null : state.suggestion,
      },
    ];
  });
}

export const acceptSuggestion = (state) => ({
  exerciseId: state.exerciseId,
  stepId: state.suggestion.stepId,
  adjustment: 0,
  ratingRun: null,
  suggestion: null,
});

export const declineSuggestion = (state) => ({ ...state, suggestion: null });

export function suggestionText(state) {
  const { steps } = ladderOf(state.exerciseId);
  const nameOf = (stepId) => steps.find((step) => step.id === stepId).name;
  const current = nameOf(state.stepId);
  const next = nameOf(state.suggestion.stepId);
  return state.suggestion.direction === 'heavier'
    ? `${current} har vært lett to ganger på rad. Vil du prøve ${next}?`
    : `${current} har vært tungt to ganger på rad. Vil du gå ned til ${next}?`;
}
