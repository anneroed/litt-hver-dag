import { latestAssessment } from './assessment.js';
import { get, getAll, getAllByIndex, put, putMany, remove, writeChanges } from './db.js';
import { addDays, localDateString } from './format.js';
import { applyRating, revertSessionRatings } from './progression.js';

export const RATINGS = [
  { id: 'easy', label: 'Lett', hint: 'Jeg kunne tatt flere' },
  { id: 'ok', label: 'Passe', hint: 'Akkurat passe' },
  { id: 'hard', label: 'Tungt', hint: 'Klarte så vidt' },
];

export const ratingLabel = (id) => RATINGS.find((rating) => rating.id === id)?.label ?? '';

// Tilstandsmaskinen: oppvarming → sett → pause → sett … → vurdering → pause → neste øvelse.

export function createSession(plan, now = new Date()) {
  return {
    id: crypto.randomUUID(),
    date: localDateString(now),
    startedAt: now.toISOString(),
    status: 'active',
    focus: plan.focus,
    length: plan.length,
    plan,
    loggedSets: 0,
    ratings: {},
    position: { phase: 'warmup', exerciseIndex: 0, setIndex: 0 },
  };
}

export function positionAfterSet(plan, { exerciseIndex, setIndex }, nowMs) {
  const exercise = plan.exercises[exerciseIndex];
  if (setIndex + 1 < exercise.sets) {
    return { phase: 'rest', exerciseIndex, setIndex: setIndex + 1, restEndAt: nowMs + exercise.restSeconds * 1000 };
  }
  return { phase: 'rating', exerciseIndex, setIndex };
}

export function positionAfterRating(plan, { exerciseIndex }, nowMs) {
  const next = exerciseIndex + 1;
  if (next >= plan.exercises.length) return { phase: 'done', exerciseIndex, setIndex: 0 };
  return { phase: 'rest', exerciseIndex: next, setIndex: 0, restEndAt: nowMs + plan.exercises[exerciseIndex].restSeconds * 1000 };
}

export const positionAfterRest = ({ exerciseIndex, setIndex }) => ({ phase: 'work', exerciseIndex, setIndex });

export function createSetRecord(session, value, now = new Date()) {
  const { exerciseIndex, setIndex } = session.position;
  const exercise = session.plan.exercises[exerciseIndex];
  return {
    id: crypto.randomUUID(),
    sessionId: session.id,
    date: session.date,
    loggedAt: now.toISOString(),
    exerciseId: exercise.ladderId,
    stepId: exercise.stepId,
    variant: exercise.name,
    kind: exercise.kind,
    perSide: exercise.perSide,
    setNumber: setIndex + 1,
    target: exercise.target,
    value,
    rating: null,
  };
}

/** En dag teller når en økt er fullført eller avbrutt med minst ett logget sett. */
export const countsAsTraining = (session) => session.status !== 'active' && session.loggedSets > 0;

export const trainedOn = (sessions, date) => sessions.some((session) => session.date === date && countsAsTraining(session));

/** Dager på rad. Streaken ryker først når en hel dag er hoppet over, ikke mens det fortsatt er tid i dag. */
export function currentStreak(sessions, today) {
  const trainedDays = new Set(sessions.filter(countsAsTraining).map((session) => session.date));
  let day = trainedDays.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (trainedDays.has(day)) {
    streak += 1;
    day = addDays(day, -1);
  }
  return streak;
}

export const findActiveSession = (sessions) => sessions.find((session) => session.status === 'active') ?? null;

export const saveSession = (session) => put('sessions', session);

export async function startSession(plan) {
  const session = createSession(plan);
  await saveSession(session);
  return session;
}

export async function loadActiveSession() {
  return findActiveSession(await getAll('sessions'));
}

export async function logSet(session, value) {
  const row = createSetRecord(session, value);
  session.loggedSets += 1;
  session.position = positionAfterSet(session.plan, session.position, Date.now());
  await putMany({ sets: [row], sessions: [session] });
  return row;
}

/** Skriver vurderingen på alle settene i øvelsen og justerer neste økt. Gir tilbake de oppdaterte settene. */
export async function rateExercise(session, ratingId) {
  const exercise = session.plan.exercises[session.position.exerciseIndex];
  const [allSets, previousState] = await Promise.all([
    getAllByIndex('sets', 'sessionId', session.id),
    get('exerciseState', exercise.ladderId),
  ]);
  const rated = allSets.filter((row) => row.exerciseId === exercise.ladderId).map((row) => ({ ...row, rating: ratingId }));
  const exerciseState = applyRating(previousState, exercise, ratingId);
  session.ratings[exercise.ladderId] = ratingId;
  session.nextTargets = {
    ...session.nextTargets,
    [exercise.ladderId]: exercise.target + exerciseState.adjustment - (previousState?.adjustment ?? 0),
  };
  session.position = positionAfterRating(session.plan, session.position, Date.now());
  if (session.position.phase === 'done') {
    session.status = 'done';
    session.finishedAt = new Date().toISOString();
  }
  await putMany({ sets: rated, sessions: [session], exerciseState: [exerciseState] });
  return rated;
}

/** Økter uten loggede sett fjernes, ellers blir de liggende som tomme rader i historikken. */
export async function abortSession(session) {
  if (session.loggedSets === 0) {
    await remove('sessions', session.id);
    return;
  }
  session.status = 'aborted';
  session.finishedAt = new Date().toISOString();
  await saveSession(session);
}

/**
 * Sletter en økt med alle sett og tar tilbake justeringene den ga.
 * Er det tatt en ny kartlegging etter økten, er justeringene allerede nullstilt.
 */
export async function deleteSession(session) {
  const [sets, stateRows, assessments] = await Promise.all([
    getAllByIndex('sets', 'sessionId', session.id),
    getAll('exerciseState'),
    getAll('assessments'),
  ]);
  const newestTest = latestAssessment(assessments);
  const exerciseState = Object.fromEntries(stateRows.map((row) => [row.exerciseId, row]));
  const reverted = newestTest?.createdAt > session.startedAt ? [] : revertSessionRatings(session, exerciseState);

  await writeChanges({
    deletes: { sessions: [session.id], sets: sets.map((row) => row.id) },
    puts: { exerciseState: reverted },
  });
}

/** Avslutter økter som ble startet en tidligere dag og aldri gjort ferdig. */
export async function closeStaleSessions(today) {
  const stale = (await getAll('sessions')).filter((session) => session.status === 'active' && session.date !== today);
  await Promise.all(stale.map(abortSession));
}
