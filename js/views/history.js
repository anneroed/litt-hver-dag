import { assessmentDeletion, deleteAssessment, formatResult, latestAssessment, testName } from '../assessment.js';
import { lineChart } from '../chart.js';
import { TESTS } from '../data/assessment-tests.js';
import { getAll } from '../db.js';
import { formatDateLong, formatDateShort, localDateString, parseLocalDate } from '../format.js';
import {
  chartOptionGroups,
  chartSeries,
  defaultChartOption,
  longestStreak,
  monthCells,
  sessionsOnDay,
  trainedDates,
} from '../history.js';
import { formatTarget } from '../program.js';
import { navigate } from '../router.js';
import { countsAsTraining, currentStreak, deleteSession, ratingLabel } from '../session.js';
import { confirmDialog, h, icon, subpage } from '../ui.js';

const WEEKDAYS = ['Ma', 'Ti', 'On', 'To', 'Fr', 'Lø', 'Sø'];
const MIN_POINTS_FOR_TREND = 2;

function statTile(value, label) {
  return h('div', { class: 'stat-tile' }, h('span', { class: 'streak-number' }, String(value)), h('span', { class: 'muted stat-label' }, label));
}

function monthTitle(year, month) {
  const text = new Intl.DateTimeFormat('nb-NO', { month: 'long', year: 'numeric' }).format(new Date(year, month, 1));
  return text.charAt(0).toUpperCase() + text.slice(1);
}

async function confirmDelete(session, focusName) {
  const confirmed = await confirmDialog({
    title: 'Slette økten?',
    body: `${focusName}, ${formatDateLong(parseLocalDate(session.date))}, med ${session.loggedSets} sett. Justeringer fra økten tas også tilbake. Dette kan ikke angres.`,
    confirmText: 'Slett økten',
    cancelText: 'Behold økten',
    danger: true,
  });
  if (!confirmed) return;
  await deleteSession(session);
  navigate('/historikk', { replace: true });
}

function daySection(date, sessions, sets) {
  const daySessions = sessionsOnDay(sessions, sets, date);
  const heading = h('h2', {}, formatDateLong(parseLocalDate(date)));
  if (daySessions.length === 0) {
    return h('section', { class: 'card day-detail' }, heading, h('p', { class: 'muted' }, 'Ingen økt denne dagen.'));
  }

  return h(
    'section',
    { class: 'card day-detail' },
    heading,
    daySessions.map((session) =>
      h(
        'div',
        { class: 'day-session' },
        h('p', { class: 'label' }, session.status === 'aborted' ? `${session.focusName} · avbrutt` : session.focusName),
        session.exercises.length === 0
          ? h('p', { class: 'muted' }, 'Ingen sett er lagret for denne økten.')
          : h(
              'ul',
              { class: 'plan-list' },
              session.exercises.map((exercise) =>
                h(
                  'li',
                  {},
                  h('span', {}, exercise.variant),
                  h(
                    'span',
                    { class: 'muted plan-detail' },
                    [exercise.values.map((value) => (exercise.kind === 'hold' ? `${value} sek` : value)).join(', '), ratingLabel(exercise.rating)].filter(Boolean).join(' · '),
                  ),
                ),
              ),
            ),
        h(
          'button',
          {
            class: 'delete-session',
            type: 'button',
            onclick: () => confirmDelete(sessions.find((item) => item.id === session.id), session.focusName),
          },
          'Slett økt',
        ),
      ),
    ),
  );
}

function chartTable(points, formatValue) {
  const hasTotals = points.some((point) => point.total !== undefined);
  return h(
    'details',
    { class: 'chart-table' },
    h('summary', {}, 'Vis som tabell'),
    h(
      'table',
      {},
      h('thead', {}, h('tr', {}, h('th', {}, 'Dato'), h('th', {}, 'Beste'), hasTotals ? h('th', {}, 'Totalt') : null)),
      h(
        'tbody',
        {},
        [...points]
          .reverse()
          .map((point) => h('tr', {}, h('td', {}, formatDateShort(point.date)), h('td', {}, formatValue(point.value)), hasTotals ? h('td', {}, String(point.total)) : null)),
      ),
    ),
  );
}

function chartBlock(optionId, label, sets, assessments) {
  const { points, kind, perSide } = chartSeries(optionId, sets, assessments);
  const formatValue = (value) => formatTarget({ kind, target: value, perSide });
  const width = Math.min(window.innerWidth, 560) - 82;
  const first = points[0];
  const last = points.at(-1);
  const description = `${label}: fra ${formatValue(first.value)} ${formatDateShort(first.date)} til ${formatValue(last.value)} ${formatDateShort(last.date)}.`;

  return [
    lineChart({ points, width, description, unit: kind === 'hold' ? 'sek' : 'reps', formatValue }),
    points.length < MIN_POINTS_FOR_TREND ? h('p', { class: 'muted chart-hint' }, 'Grafen viser utvikling når du har minst to dager med data.') : null,
    chartTable(points, formatValue),
  ];
}

function chartSection(sets, assessments) {
  const groups = chartOptionGroups(sets, assessments);
  const initial = defaultChartOption(sets, groups);
  if (!initial) {
    return h('section', { class: 'card' }, h('h2', {}, 'Fremgang'), h('p', { class: 'muted' }, 'Grafene dukker opp når du har logget noen sett.'));
  }

  const labelOf = (id) => groups.flatMap((group) => group.options).find((option) => option.id === id).label;
  const body = h('div', {}, chartBlock(initial, labelOf(initial), sets, assessments));
  const select = h(
    'select',
    { class: 'select', 'aria-label': 'Velg øvelse' },
    groups.map((group) => h('optgroup', { label: group.label }, group.options.map((option) => h('option', { value: option.id }, option.label)))),
  );
  select.value = initial;
  select.addEventListener('change', () => body.replaceChildren(...chartBlock(select.value, labelOf(select.value), sets, assessments).filter(Boolean)));

  return h('section', { class: 'card' }, h('h2', {}, 'Fremgang'), h('p', { class: 'muted card-text' }, 'Beste sett per dag'), select, body);
}

function assessmentDeleteText(assessments, row) {
  const { affectsProgram, next } = assessmentDeletion(assessments, row.id);
  let consequence = 'Programmet påvirkes ikke.';
  if (affectsProgram) {
    consequence = next
      ? `Programmet bygges da på kartleggingen fra ${formatDateLong(next.createdAt)}, og justeringer nullstilles.`
      : 'Du må gjøre en ny kartlegging for å få et program. Øktene dine beholdes.';
  }
  return `Kartleggingen fra ${formatDateLong(row.createdAt)} slettes. ${consequence} Dette kan ikke angres.`;
}

function assessmentsSection(assessments) {
  if (assessments.length === 0) return null;
  const current = latestAssessment(assessments);

  async function confirmDeleteAssessment(row) {
    const confirmed = await confirmDialog({
      title: 'Slette kartleggingen?',
      body: assessmentDeleteText(assessments, row),
      confirmText: 'Slett kartleggingen',
      cancelText: 'Behold kartleggingen',
      danger: true,
    });
    if (!confirmed) return;
    await deleteAssessment(assessments, row.id);
    navigate('/historikk', { replace: true });
  }

  const newestFirst = [...assessments].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return h(
    'section',
    { class: 'library-group assessments' },
    h('h2', {}, 'Kartlegginger'),
    newestFirst.map((row) =>
      h(
        'details',
        { class: 'ladder' },
        h(
          'summary',
          {},
          h('span', { class: 'list-row-label' }, formatDateLong(row.createdAt)),
          row === current ? h('span', { class: 'muted ladder-current' }, 'Gjeldende') : null,
        ),
        h(
          'div',
          { class: 'assessment-body' },
          h(
            'ul',
            { class: 'plan-list' },
            TESTS.filter((test) => row.results[test.id] !== undefined).map((test) =>
              h('li', {}, h('span', {}, testName(test, row.coreVariant)), h('span', { class: 'muted plan-detail' }, formatResult(test, row.results[test.id]))),
            ),
          ),
          h('button', { class: 'delete-assessment', type: 'button', onclick: () => confirmDeleteAssessment(row) }, 'Slett kartlegging'),
        ),
      ),
    ),
  );
}

export async function historyView() {
  const [sessions, sets, assessments] = await Promise.all([getAll('sessions'), getAll('sets'), getAll('assessments')]);
  const today = localDateString(new Date());
  const trained = trainedDates(sessions);

  const now = new Date();
  let viewYear = now.getFullYear();
  let viewMonth = now.getMonth();
  let selected = [...trained].filter((date) => date <= today).sort().at(-1) ?? today;

  const calendarSlot = h('div', {});
  const daySlot = h('div', {});

  function moveMonth(change) {
    const target = new Date(viewYear, viewMonth + change, 1);
    viewYear = target.getFullYear();
    viewMonth = target.getMonth();
    renderCalendar();
  }

  function selectDay(date) {
    selected = date;
    renderCalendar();
    daySlot.replaceChildren(daySection(selected, sessions, sets));
  }

  function renderCalendar() {
    const { blanks, dates } = monthCells(viewYear, viewMonth);
    const isCurrentMonth = viewYear === now.getFullYear() && viewMonth === now.getMonth();
    const trainedCount = dates.filter((date) => trained.has(date)).length;

    const nextButton = h('button', { class: 'month-button', type: 'button', 'aria-label': 'Neste måned', onclick: () => moveMonth(1) }, icon('forward'));
    nextButton.disabled = isCurrentMonth;

    const cells = dates.map((date) => {
      const isTrained = trained.has(date);
      const classes = ['day', isTrained ? 'day-trained' : '', date === today ? 'day-today' : '', date === selected ? 'day-selected' : ''].filter(Boolean);
      const label = `${formatDateLong(parseLocalDate(date))}${isTrained ? ', trent' : ''}`;
      const button = h('button', { class: classes.join(' '), type: 'button', 'aria-label': label, onclick: () => selectDay(date) }, String(parseLocalDate(date).getDate()));
      button.disabled = date > today;
      return button;
    });

    calendarSlot.replaceChildren(
      h(
        'section',
        { class: 'card' },
        h(
          'div',
          { class: 'month-header' },
          h('button', { class: 'month-button', type: 'button', 'aria-label': 'Forrige måned', onclick: () => moveMonth(-1) }, icon('back')),
          h('h2', {}, monthTitle(viewYear, viewMonth)),
          nextButton,
        ),
        h('div', { class: 'calendar' }, WEEKDAYS.map((day) => h('span', { class: 'weekday' }, day)), Array.from({ length: blanks }, () => h('span', {})), cells),
        h('p', { class: 'muted month-summary' }, `${trainedCount} ${trainedCount === 1 ? 'dag' : 'dager'} trent denne måneden`),
      ),
    );
  }

  renderCalendar();
  daySlot.replaceChildren(daySection(selected, sessions, sets));

  return subpage(
    'Historikk og fremgang',
    h(
      'section',
      { class: 'stat-row' },
      statTile(currentStreak(sessions, today), 'Dager på rad'),
      statTile(longestStreak(sessions), 'Lengste streak'),
      statTile(sessions.filter(countsAsTraining).length, 'Økter totalt'),
    ),
    calendarSlot,
    daySlot,
    chartSection(sets, assessments),
    assessmentsSection(assessments),
  );
}
