import { reassessmentReminder, snoozeReminder } from '../assessment.js';
import { put } from '../db.js';
import { localDateString } from '../format.js';
import { isStandalone } from '../install.js';
import { buildPlan, estimateSeconds, formatTarget, LENGTHS, loadProgramContext } from '../program.js';
import { acceptSuggestion, declineSuggestion, suggestionText } from '../progression.js';
import { navigate } from '../router.js';
import { closeStaleSessions, currentStreak, findActiveSession, startSession, trainedOn } from '../session.js';
import { h, icon, segmented } from '../ui.js';

function shortcut(iconName, label, path) {
  return h(
    'li',
    {},
    h(
      'button',
      { class: 'list-row', type: 'button', onclick: () => navigate(path) },
      icon(iconName),
      h('span', { class: 'list-row-label' }, label),
      icon('forward'),
    ),
  );
}

function todayLabel() {
  const text = new Intl.DateTimeFormat('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function messageCard(heading, text, button) {
  return h('section', { class: 'card' }, h('p', { class: 'label' }, 'Dagens økt'), h('h2', {}, heading), h('p', { class: 'muted' }, text), button);
}

const wideButton = (label, onclick, variant = '') =>
  h('button', { class: `button button-wide ${variant}`, type: 'button', onclick }, label);

function planRow(name, detail) {
  return h('li', {}, h('span', {}, name), h('span', { class: 'muted plan-detail' }, detail));
}

function planCard(context) {
  const { assessment, settings, exerciseState, previousFocus } = context;
  const heading = h('h2', {});
  const estimate = h('p', { class: 'muted' });
  const rows = h('ul', { class: 'plan-list' });
  let plan = null;

  function showPlan(length) {
    plan = buildPlan({ assessment, percentOfMax: settings.percentOfMax, exerciseState, previousFocus, length });
    heading.textContent = plan.focusName;
    estimate.textContent = `Cirka ${Math.round(estimateSeconds(plan) / 60)} minutter`;
    rows.replaceChildren(
      planRow('Hoppetau', `${plan.warmupSeconds / 60} min`),
      ...plan.exercises.map((exercise) => planRow(exercise.name, `${exercise.sets} × ${formatTarget(exercise)}`)),
    );
  }

  showPlan(settings.defaultLength);

  const start = wideButton('Start økt', async () => {
    start.disabled = true;
    await startSession(plan);
    navigate('/okt');
  });

  return h(
    'section',
    { class: 'card' },
    h('p', { class: 'label' }, 'Dagens økt'),
    heading,
    estimate,
    h(
      'div',
      { class: 'length-picker' },
      segmented({
        label: 'Øktlengde',
        options: Object.entries(LENGTHS).map(([value, { label }]) => ({ value, label })),
        value: settings.defaultLength,
        onChange: showPlan,
      }),
    ),
    rows,
    start,
  );
}

function trainedTodayCard(context) {
  const nextFocus = buildPlan({
    assessment: context.assessment,
    percentOfMax: context.settings.percentOfMax,
    exerciseState: context.exerciseState,
    previousFocus: context.previousFocus,
    length: context.settings.defaultLength,
  }).focusName;

  const card = messageCard(
    'Du har trent i dag',
    `Bra jobba! Neste økt er ${nextFocus}.`,
    wideButton('Ta en økt til', () => card.replaceWith(planCard(context)), 'button-outline'),
  );
  return card;
}

function todayCard(context) {
  if (!context.assessment) {
    return messageCard('Start med en kartlegging', 'Seks korte tester som programmet bygges på.', wideButton('Start kartlegging', () => navigate('/kartlegging')));
  }

  const active = findActiveSession(context.sessions);
  if (active) {
    return messageCard('Økten er i gang', `${active.plan.focusName} · ${active.loggedSets} sett logget`, wideButton('Fortsett økten', () => navigate('/okt')));
  }

  return trainedOn(context.sessions, localDateString(new Date())) ? trainedTodayCard(context) : planCard(context);
}

function suggestionCards(context) {
  if (findActiveSession(context.sessions)) return [];

  const apply = async (nextState) => {
    await put('exerciseState', nextState);
    navigate('/', { replace: true });
  };

  return Object.values(context.exerciseState)
    .filter((state) => state.suggestion)
    .map((state) =>
      h(
        'section',
        { class: 'card' },
        h('p', { class: 'label' }, 'Forslag'),
        h('p', {}, suggestionText(state)),
        h(
          'div',
          { class: 'button-row' },
          h('button', { class: 'button button-small', type: 'button', onclick: () => apply(acceptSuggestion(state)) }, 'Bytt'),
          h('button', { class: 'button button-outline button-small', type: 'button', onclick: () => apply(declineSuggestion(state)) }, 'Behold'),
        ),
      ),
    );
}

function reminderCard(context, today) {
  if (findActiveSession(context.sessions)) return null;
  const reminder = reassessmentReminder(context.assessment, today, context.settings.assessmentSnoozedUntil);
  if (!reminder) return null;

  const text = reminder.overdue
    ? `Det er ${reminder.weeks} uker siden sist. Programmet bygger på gamle tall, så en ny test gjør øktene mer treffsikre.`
    : `Det er ${reminder.weeks} uker siden sist. Vil du teste deg på nytt og oppdatere programmet?`;

  return h(
    'section',
    { class: 'card' },
    h('p', { class: 'label' }, 'Ny kartlegging'),
    h('p', {}, text),
    h(
      'div',
      { class: 'button-row' },
      h('button', { class: 'button button-small', type: 'button', onclick: () => navigate('/kartlegging') }, 'Ta testen'),
      h(
        'button',
        {
          class: 'button button-outline button-small',
          type: 'button',
          onclick: async () => {
            await snoozeReminder(today);
            navigate('/', { replace: true });
          },
        },
        'Senere',
      ),
    ),
  );
}

function streakCard(sessions, today) {
  const streak = currentStreak(sessions, today);
  return h(
    'section',
    { class: 'card' },
    h(
      'div',
      { class: 'streak' },
      h('span', { class: 'streak-number' }, String(streak)),
      h('span', { class: 'muted' }, streak === 1 ? 'dag på rad' : 'dager på rad'),
    ),
    streak > 0 && !trainedOn(sessions, today) ? h('p', { class: 'muted streak-hint' }, 'Tren i dag for å holde streaken.') : null,
  );
}

export async function homeView() {
  const today = localDateString(new Date());
  await closeStaleSessions(today);
  const context = await loadProgramContext();

  return h(
    'div',
    { class: 'screen' },
    h(
      'main',
      { class: 'content' },
      h('p', { class: 'eyebrow' }, todayLabel()),
      h('h1', {}, 'Litt hver dag'),
      todayCard(context),
      reminderCard(context, today),
      suggestionCards(context),
      streakCard(context.sessions, today),

      h(
        'ul',
        { class: 'list' },
        shortcut('chart', 'Historikk og fremgang', '/historikk'),
        shortcut('library', 'Øvelsesbibliotek', '/bibliotek'),
        shortcut('test', 'Ny kartlegging', '/kartlegging'),
        shortcut('settings', 'Innstillinger', '/innstillinger'),
        isStandalone() ? null : shortcut('add', 'Legg til på Hjem-skjerm', '/installer'),
      ),
    ),
  );
}
