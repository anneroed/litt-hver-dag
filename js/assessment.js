import { get, setSetting, writeChanges } from './db.js';
import { addDays, dayNumber, formatClock, localDateString } from './format.js';

const DRAFT_KEY = 'assessmentDraft';
const REMINDER_AFTER_DAYS = 28;
const OVERDUE_AFTER_DAYS = 42;
const SNOOZE_DAYS = 7;

export const newDraft = () => ({ index: 0, results: {}, coreVariant: 'plank' });
export const loadDraft = async () => (await get('settings', DRAFT_KEY))?.value ?? null;
export const saveDraft = (draft) => setSetting(DRAFT_KEY, draft);

/** Lagrer testen og nullstiller øvelsesstatus, ellers ville gamle justeringer kommet oppå de nye tallene. */
export function saveAssessment({ results, coreVariant }, now = new Date()) {
  const assessment = {
    id: crypto.randomUUID(),
    date: localDateString(now),
    createdAt: now.toISOString(),
    results,
    coreVariant,
  };
  return writeChanges({
    puts: { assessments: [assessment] },
    deletes: { settings: [DRAFT_KEY] },
    clears: ['exerciseState'],
  }).then(() => assessment);
}

/** Hva som skjer med programmet hvis kartleggingen slettes. next er testen programmet da bygger på. */
export function assessmentDeletion(assessments, id) {
  const latest = latestAssessment(assessments);
  if (latest.id !== id) return { affectsProgram: false, next: latest };
  return { affectsProgram: true, next: latestAssessment(assessments.filter((row) => row.id !== id)) };
}

/** Justeringene bygger på den gjeldende testen, så de nullstilles hvis det er den som slettes. */
export function deleteAssessment(assessments, id) {
  const { affectsProgram } = assessmentDeletion(assessments, id);
  return writeChanges({ deletes: { assessments: [id] }, clears: affectsProgram ? ['exerciseState'] : [] });
}

/** Påminnelse om ny test etter 4–6 uker, eller null når det ikke er aktuelt. */
export function reassessmentReminder(assessment, today, snoozedUntil) {
  if (!assessment || (snoozedUntil && today < snoozedUntil)) return null;
  const days = dayNumber(today) - dayNumber(assessment.date);
  if (days < REMINDER_AFTER_DAYS) return null;
  return { weeks: Math.floor(days / 7), overdue: days >= OVERDUE_AFTER_DAYS };
}

export const snoozeReminder = (today) => setSetting('assessmentSnoozedUntil', addDays(today, SNOOZE_DAYS));

export function latestAssessment(assessments) {
  return assessments.reduce((latest, row) => (!latest || row.createdAt > latest.createdAt ? row : latest), null);
}

export function testName(test, coreVariant) {
  return test.variants?.find((variant) => variant.id === coreVariant)?.name ?? test.name;
}

export function formatResult(test, value) {
  return test.kind === 'hold' ? formatClock(value) : `${value} reps`;
}

/** Endring fra forrige kartlegging, eller tom tekst når resultatene ikke kan sammenlignes. */
export function compareResult(test, value, coreVariant, previous) {
  const before = previous?.results[test.id];
  if (before === undefined) return '';
  if (test.id === 'core' && previous.coreVariant !== coreVariant) return '';
  const difference = value - before;
  if (difference === 0) return 'Likt';
  return `${difference > 0 ? '+' : '−'}${Math.abs(difference)}${test.kind === 'hold' ? ' sek' : ''}`;
}
