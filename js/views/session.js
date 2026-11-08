import { GET_READY_SECONDS } from '../data/assessment-tests.js';
import { getAllByIndex } from '../db.js';
import { beep, beepDone, keepScreenAwake, unlockSound } from '../device.js';
import { formatClock } from '../format.js';
import { formatTarget } from '../program.js';
import { navigate, setLeaveGuard } from '../router.js';
import {
  abortSession,
  loadActiveSession,
  logSet,
  positionAfterRest,
  rateExercise,
  ratingLabel,
  RATINGS,
  saveSession,
} from '../session.js';
import { remainingSeconds, startCountdown, startStopwatch } from '../timer.js';
import { confirmDialog, h, stepper, subpage } from '../ui.js';

const formatValue = (kind, value) => (kind === 'hold' ? `${value} sek` : String(value));

function valueLabel({ kind, perSide }) {
  if (kind === 'hold') return perSide ? 'Sekunder per side' : 'Sekunder';
  return perSide ? 'Reps per side' : 'Antall reps';
}

export async function sessionView({ onCleanup }) {
  const session = await loadActiveSession();
  if (!session) {
    navigate('/', { replace: true });
    return h('div', {});
  }

  const { plan } = session;
  const sets = (await getAllByIndex('sets', 'sessionId', session.id)).sort((a, b) => a.setNumber - b.setNumber);
  let stopTimer = null;

  const body = h('div', {});
  const page = subpage('Økt', body);
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

  setLeaveGuard(async () => {
    const confirmed = await confirmDialog({
      title: 'Avbryte økten?',
      body: 'Settene du har logget, blir lagret.',
      confirmText: 'Avbryt økten',
      cancelText: 'Fortsett økten',
      danger: true,
    });
    if (confirmed) await abortSession(session);
    return confirmed;
  });

  function show(heading, ...nodes) {
    clearTimer();
    title.textContent = heading;
    body.replaceChildren(...nodes.flat().filter(Boolean));
    window.scrollTo(0, 0);
  }

  function renderPosition() {
    const screens = { warmup: warmupScreen, work: workScreen, rating: ratingScreen, rest: restScreen, done: doneScreen };
    screens[session.position.phase]();
  }

  async function moveTo(position) {
    session.position = position;
    await saveSession(session);
    renderPosition();
  }

  const startWork = () => moveTo(positionAfterRest(session.position));

  function warmupScreen() {
    const clock = h('div', { class: 'clock', role: 'timer' }, formatClock(plan.warmupSeconds));
    const button = h('button', { class: 'button button-wide', type: 'button' }, 'Start hoppetau');

    show(
      'Hoppetau',
      h('p', { class: 'muted intro' }, `Oppvarming · ${plan.focusName}`),
      h('section', { class: 'card measure' }, clock, h('p', { class: 'muted clock-hint' }, 'Hopp lett på fremre del av foten, med rolige armer.'), button),
      h('button', { class: 'button button-outline button-wide', type: 'button', onclick: startWork }, 'Hopp over oppvarmingen'),
    );

    button.onclick = () => {
      button.textContent = 'Ferdig';
      button.onclick = startWork;
      stopTimer = startCountdown({
        seconds: plan.warmupSeconds,
        onTick: (left) => {
          clock.textContent = formatClock(left);
        },
        onDone: () => {
          beepDone();
          startWork();
        },
      });
    };
  }

  function holdPanel(exercise, field) {
    const idleHint = exercise.perSide ? 'Ta én side om gangen.' : 'Du får fem sekunder på å gjøre deg klar.';
    const idleLabel = exercise.perSide ? 'Start første side' : 'Start tiden';
    const clock = h('div', { class: 'clock', role: 'timer' }, formatClock(0));
    const hint = h('p', { class: 'muted clock-hint' });
    const button = h('button', { class: 'button button-outline button-wide', type: 'button' });
    let firstSide = null;

    function idle(label, message) {
      button.textContent = label;
      hint.textContent = message;
      button.onclick = getReady;
    }

    function getReady() {
      clearTimer();
      hint.textContent = 'Gjør deg klar';
      button.textContent = 'Avbryt';
      button.onclick = () => {
        clearTimer();
        clock.textContent = formatClock(0);
        idle(idleLabel, idleHint);
      };
      stopTimer = startCountdown({
        seconds: GET_READY_SECONDS,
        onTick: (left) => {
          clock.textContent = String(left);
          if (left > 0 && left <= 3) beep();
        },
        onDone: () => {
          beepDone();
          runStopwatch();
        },
      });
    }

    function runStopwatch() {
      hint.textContent = 'Hold';
      const stop = startStopwatch({
        onTick: (seconds) => {
          clock.textContent = formatClock(seconds);
          if (seconds === exercise.target) {
            beepDone();
            hint.textContent = 'Målet er nådd';
          }
        },
      });
      stopTimer = stop;
      button.textContent = 'Stopp';
      button.onclick = () => {
        const seconds = stop();
        stopTimer = null;
        clock.textContent = formatClock(seconds);
        finishRun(seconds);
      };
    }

    function finishRun(seconds) {
      if (exercise.perSide && firstSide === null) {
        firstSide = seconds;
        field.setValue(seconds);
        idle('Start andre side', 'Bytt side.');
        return;
      }
      field.setValue(exercise.perSide ? Math.min(firstSide, seconds) : seconds);
      firstSide = null;
      idle('Start på nytt', exercise.perSide ? 'Den korteste tiden er ført inn.' : 'Juster tiden under hvis du trenger det.');
    }

    idle(idleLabel, idleHint);
    return [clock, hint, button];
  }

  function workScreen() {
    const { exerciseIndex, setIndex } = session.position;
    const exercise = plan.exercises[exerciseIndex];
    const loggedValues = sets.filter((row) => row.exerciseId === exercise.ladderId).map((row) => formatValue(row.kind, row.value));
    let value = exercise.target;

    const logButton = h('button', { class: 'button button-wide', type: 'button' }, 'Logg settet');
    const label = valueLabel(exercise);
    const field = stepper({
      label,
      value,
      onChange: (next) => {
        value = next;
        logButton.disabled = value === null;
      },
    });

    logButton.addEventListener('click', async () => {
      logButton.disabled = true;
      sets.push(await logSet(session, value));
      renderPosition();
    });

    show(
      exercise.name,
      h('p', { class: 'muted intro' }, `Øvelse ${exerciseIndex + 1} av ${plan.exercises.length} · Sett ${setIndex + 1} av ${exercise.sets}`),
      h('p', { class: 'exercise-note muted' }, exercise.note),
      h(
        'section',
        { class: 'card measure' },
        h('p', { class: 'set-target' }, `Mål: ${formatTarget(exercise)}`),
        exercise.kind === 'hold' ? holdPanel(exercise, field) : null,
        h('p', { class: 'field-label' }, label),
        field,
        loggedValues.length ? h('p', { class: 'muted logged-values' }, `Logget: ${loggedValues.join(', ')}`) : null,
      ),
      logButton,
    );
  }

  function ratingScreen() {
    const exercise = plan.exercises[session.position.exerciseIndex];

    const choose = async (ratingId) => {
      for (const button of body.querySelectorAll('button')) button.disabled = true;
      const rated = await rateExercise(session, ratingId);
      for (const row of rated) {
        const index = sets.findIndex((item) => item.id === row.id);
        sets[index] = row;
      }
      renderPosition();
    };

    show(
      exercise.name,
      h('p', { class: 'muted intro' }, 'Hvordan var det?'),
      h(
        'ul',
        { class: 'list' },
        RATINGS.map((rating) =>
          h(
            'li',
            {},
            h(
              'button',
              { class: 'list-row', type: 'button', onclick: () => choose(rating.id) },
              h('span', { class: 'list-row-label' }, h('strong', {}, rating.label)),
              h('span', { class: 'muted result-change' }, rating.hint),
            ),
          ),
        ),
      ),
    );
  }

  function restScreen() {
    const { exerciseIndex, setIndex, restEndAt } = session.position;
    const next = plan.exercises[exerciseIndex];
    const left = remainingSeconds(restEndAt, Date.now());
    if (left === 0) {
      startWork();
      return;
    }

    const clock = h('div', { class: 'clock', role: 'timer' }, formatClock(left));
    show(
      'Pause',
      h('p', { class: 'muted intro' }, `Neste: ${next.name}, sett ${setIndex + 1} av ${next.sets}`),
      h('section', { class: 'card measure' }, clock, h('p', { class: 'muted clock-hint' }, `Mål: ${formatTarget(next)}`)),
      h('button', { class: 'button button-outline button-wide', type: 'button', onclick: startWork }, 'Start neste sett'),
    );

    stopTimer = startCountdown({
      seconds: left,
      onTick: (seconds) => {
        clock.textContent = formatClock(seconds);
      },
      onDone: () => {
        beepDone();
        startWork();
      },
    });
  }

  function doneScreen() {
    setLeaveGuard(null);
    releaseScreen();
    const minutes = Math.max(1, Math.round((Date.parse(session.finishedAt) - Date.parse(session.startedAt)) / 60000));

    show(
      'Bra jobba!',
      h('p', { class: 'muted intro' }, `${plan.focusName} · ${session.loggedSets} sett · ${minutes} min`),
      h(
        'ul',
        { class: 'list summary-list' },
        plan.exercises.map((exercise) => {
          const values = sets.filter((row) => row.exerciseId === exercise.ladderId).map((row) => formatValue(row.kind, row.value));
          const nextTarget = session.nextTargets?.[exercise.ladderId];
          return h(
            'li',
            { class: 'done-row' },
            h(
              'span',
              { class: 'list-row-label' },
              exercise.name,
              nextTarget !== undefined && nextTarget !== exercise.target
                ? h('span', { class: 'next-target muted' }, `Neste gang: ${formatTarget({ ...exercise, target: nextTarget })}`)
                : null,
            ),
            h('span', { class: 'muted result-change' }, `${values.join(', ')} · ${ratingLabel(session.ratings[exercise.ladderId])}`),
          );
        }),
      ),
      h('button', { class: 'button button-wide', type: 'button', onclick: () => navigate('/', { replace: true }) }, 'Til hjemskjermen'),
    );
  }

  renderPosition();
  return page;
}
