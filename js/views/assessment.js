import {
  compareResult,
  formatResult,
  latestAssessment,
  loadDraft,
  newDraft,
  saveAssessment,
  saveDraft,
  testName,
} from '../assessment.js';
import { GET_READY_SECONDS, REST_SECONDS, TESTS } from '../data/assessment-tests.js';
import { getAll } from '../db.js';
import { beep, beepDone, keepScreenAwake, unlockSound } from '../device.js';
import { formatClock } from '../format.js';
import { programChanges } from '../program.js';
import { navigate, setLeaveGuard } from '../router.js';
import { startCountdown, startStopwatch } from '../timer.js';
import { confirmDialog, h, icon, segmented, stepper, subpage } from '../ui.js';

const techniqueItems = (lines) => lines.map((line) => h('li', {}, line));

const confirmLeave = () =>
  confirmDialog({
    title: 'Ta en pause fra kartleggingen?',
    body: 'Resultatene så langt er lagret, og du kan fortsette senere.',
    confirmText: 'Avslutt for nå',
    cancelText: 'Fortsett testen',
  });

export async function assessmentView({ onCleanup }) {
  const [savedDraft, assessments] = await Promise.all([loadDraft(), getAll('assessments')]);
  const previous = latestAssessment(assessments);
  let draft = savedDraft;
  let stopTimer = null;

  const body = h('div', {});
  const page = subpage('Kartlegging', body);
  const title = page.querySelector('h1');
  page.addEventListener('click', unlockSound);

  const clearTimer = () => {
    stopTimer?.();
    stopTimer = null;
  };
  const releaseScreen = keepScreenAwake();
  onCleanup(() => {
    clearTimer();
    releaseScreen();
  });

  function show(heading, ...nodes) {
    clearTimer();
    title.textContent = heading;
    body.replaceChildren(...nodes.flat().filter(Boolean));
    window.scrollTo(0, 0);
  }

  function resume() {
    setLeaveGuard(confirmLeave);
    if (draft.index >= TESTS.length) summaryScreen();
    else testScreen(draft.index);
  }

  function restart() {
    draft = newDraft();
    saveDraft(draft);
    resume();
  }

  function introScreen() {
    const startButton = h('button', { class: 'button button-wide', type: 'button', onclick: restart }, 'Start kartleggingen');
    const actions = draft
      ? [
          h('p', { class: 'card-text' }, `Du har en påbegynt kartlegging. ${draft.index} av ${TESTS.length} tester er gjort.`),
          h(
            'div',
            { class: 'stack' },
            h('button', { class: 'button button-wide', type: 'button', onclick: resume }, 'Fortsett'),
            h('button', { class: 'button button-outline button-wide', type: 'button', onclick: restart }, 'Start på nytt'),
          ),
        ]
      : startButton;

    show(
      'Kartlegging',
      h('p', { class: 'muted intro' }, 'Seks korte tester som programmet ditt bygges på. Regn med rundt 20 minutter.'),
      h(
        'ul',
        { class: 'technique card' },
        h('li', {}, 'Varm opp et par minutter med hoppetau først.'),
        h('li', {}, 'Gi alt, men stopp når teknikken svikter.'),
        h('li', {}, 'Du får to minutter pause mellom testene.'),
      ),
      actions,
    );
  }

  // Tid og knapper for testene som bruker klokke. Antallet føres i feltet under.
  function clockPanel(test, field) {
    const isHold = test.kind === 'hold';
    const idleClock = formatClock(isHold ? 0 : test.seconds);
    const idleLabel = isHold ? 'Start tiden' : `Start ${test.seconds} sek`;
    const clock = h('div', { class: 'clock', role: 'timer' }, idleClock);
    const hint = h('p', { class: 'muted clock-hint' }, 'Du får fem sekunder på å gjøre deg klar.');
    const button = h('button', { class: 'button button-wide', type: 'button' });

    function idle(label, message) {
      button.textContent = label;
      hint.textContent = message;
      button.onclick = getReady;
    }

    function cancel() {
      clearTimer();
      clock.textContent = idleClock;
      idle(idleLabel, 'Du får fem sekunder på å gjøre deg klar.');
    }

    function getReady() {
      clearTimer();
      button.textContent = 'Avbryt';
      button.onclick = cancel;
      hint.textContent = 'Gjør deg klar';
      stopTimer = startCountdown({
        seconds: GET_READY_SECONDS,
        onTick: (left) => {
          clock.textContent = String(left);
          if (left > 0 && left <= 3) beep();
        },
        onDone: () => {
          beepDone();
          if (isHold) runStopwatch();
          else runFixedTime();
        },
      });
    }

    function runStopwatch() {
      hint.textContent = 'Hold så lenge du klarer';
      const stop = startStopwatch({
        onTick: (seconds) => {
          clock.textContent = formatClock(seconds);
        },
      });
      stopTimer = stop;
      button.textContent = 'Stopp';
      button.onclick = () => {
        const seconds = stop();
        stopTimer = null;
        clock.textContent = formatClock(seconds);
        field.setValue(seconds);
        idle('Prøv igjen', 'Juster tiden under hvis du trenger det.');
      };
    }

    function runFixedTime() {
      hint.textContent = 'Så mange du klarer';
      button.textContent = 'Avbryt';
      button.onclick = cancel;
      stopTimer = startCountdown({
        seconds: test.seconds,
        onTick: (left) => {
          clock.textContent = formatClock(left);
        },
        onDone: () => {
          beepDone();
          stopTimer = null;
          idle('Start på nytt', 'Ferdig! Skriv inn antall reps under.');
        },
      });
    }

    idle(idleLabel, 'Du får fem sekunder på å gjøre deg klar.');
    return [clock, hint, button];
  }

  function testScreen(index, { editing = false } = {}) {
    const test = TESTS[index];
    const techniqueOf = () => test.variants?.find((variant) => variant.id === draft.coreVariant)?.technique ?? test.technique;
    const isLast = index === TESTS.length - 1;
    let value = draft.results[test.id] ?? null;

    const nextButton = h(
      'button',
      { class: 'button button-wide', type: 'button' },
      editing ? 'Lagre endring' : isLast ? 'Se resultatene' : 'Neste',
    );
    nextButton.disabled = value === null;

    const field = stepper({
      label: test.kind === 'hold' ? 'Tid i sekunder' : 'Antall reps',
      value,
      onChange: (next) => {
        value = next;
        nextButton.disabled = value === null;
      },
    });

    nextButton.addEventListener('click', async () => {
      nextButton.disabled = true;
      draft.results[test.id] = value;
      if (!editing) draft.index = index + 1;
      await saveDraft(draft);
      if (editing || index + 1 >= TESTS.length) summaryScreen();
      else restScreen(index + 1);
    });

    const technique = h('ul', { class: 'technique card' }, techniqueItems(techniqueOf()));
    const variantPicker = test.variants
      ? segmented({
          label: 'Velg øvelse',
          options: test.variants.map((variant) => ({ value: variant.id, label: variant.name })),
          value: draft.coreVariant,
          onChange: (variant) => {
            draft.coreVariant = variant;
            saveDraft(draft);
            technique.replaceChildren(...techniqueItems(techniqueOf()));
          },
        })
      : null;

    show(
      test.name,
      h('p', { class: 'muted intro' }, `Test ${index + 1} av ${TESTS.length} · ${test.prompt}`),
      variantPicker,
      technique,
      h(
        'section',
        { class: 'card measure' },
        test.kind === 'reps' ? null : clockPanel(test, field),
        h('label', { class: 'field-label' }, test.kind === 'hold' ? 'Tid i sekunder' : 'Antall reps'),
        field,
      ),
      nextButton,
    );
  }

  function restScreen(nextIndex) {
    const clock = h('div', { class: 'clock', role: 'timer' }, formatClock(REST_SECONDS));
    const goToNext = () => testScreen(nextIndex);

    show(
      'Pause',
      h('p', { class: 'muted intro' }, `Neste: ${TESTS[nextIndex].name}`),
      h('section', { class: 'card measure' }, clock, h('p', { class: 'muted clock-hint' }, 'Rist løs armene og pust rolig.')),
      h('button', { class: 'button button-outline button-wide', type: 'button', onclick: goToNext }, 'Hopp over pausen'),
    );

    stopTimer = startCountdown({
      seconds: REST_SECONDS,
      onTick: (left) => {
        clock.textContent = formatClock(left);
      },
      onDone: () => {
        beepDone();
        goToNext();
      },
    });
  }

  function summaryScreen() {
    const rows = TESTS.map((test, index) => {
      const value = draft.results[test.id];
      return h(
        'li',
        {},
        h(
          'button',
          { class: 'list-row', type: 'button', onclick: () => testScreen(index, { editing: true }) },
          h('span', { class: 'list-row-label' }, testName(test, draft.coreVariant)),
          h('span', { class: 'result-change muted' }, compareResult(test, value, draft.coreVariant, previous)),
          h('span', { class: 'result-value' }, formatResult(test, value)),
          icon('forward'),
        ),
      );
    });

    const error = h('p', { class: 'status status-error', role: 'status' });
    const saveButton = h('button', { class: 'button button-wide', type: 'button' }, 'Lagre kartleggingen');
    saveButton.addEventListener('click', async () => {
      saveButton.disabled = true;
      try {
        const stateRows = await getAll('exerciseState');
        const saved = await saveAssessment(draft);
        setLeaveGuard(null);
        if (previous) {
          const exerciseState = Object.fromEntries(stateRows.map((row) => [row.exerciseId, row]));
          programUpdatedScreen(programChanges(previous, exerciseState, saved));
        } else {
          navigate('/', { replace: true });
        }
      } catch {
        saveButton.disabled = false;
        error.textContent = 'Kunne ikke lagre. Prøv igjen.';
      }
    });

    show(
      'Resultater',
      h('p', { class: 'muted intro' }, 'Trykk på en rad for å rette den.'),
      h('ul', { class: 'list summary-list' }, rows),
      saveButton,
      error,
    );
  }

  function programUpdatedScreen(changes) {
    show(
      'Programmet er oppdatert',
      h('p', { class: 'muted intro' }, 'Settmålene er regnet ut på nytt fra den nye testen, og tidligere justeringer er nullstilt.'),
      changes.length
        ? h(
            'ul',
            { class: 'list summary-list' },
            changes.map((change) =>
              h(
                'li',
                { class: 'done-row' },
                h('span', { class: 'list-row-label' }, change.ladderName, h('span', { class: 'next-target muted' }, `${change.from} → ${change.to}`)),
              ),
            ),
          )
        : h('p', { class: 'card' }, 'Du fortsetter på de samme variantene.'),
      h('button', { class: 'button button-wide', type: 'button', onclick: () => navigate('/', { replace: true }) }, 'Til hjemskjermen'),
    );
  }

  introScreen();
  return page;
}
