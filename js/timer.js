// Timerne regner fra klokkeslett. iOS pauser JavaScript når skjermen låses,
// så en teller som bare trekker fra ett sekund om gangen ville gått for sakte.

const TICK_MS = 200;

export const remainingSeconds = (endAt, now) => Math.max(0, Math.ceil((endAt - now) / 1000));
export const elapsedSeconds = (startAt, now) => Math.max(0, Math.floor((now - startAt) / 1000));

/** Kaller onTick når hele sekunder endrer seg. Gir tilbake en funksjon som stopper. */
export function startCountdown({ seconds, onTick, onDone }) {
  const endAt = Date.now() + seconds * 1000;
  let last = null;
  let interval = null;
  const stop = () => clearInterval(interval);

  const tick = () => {
    const left = remainingSeconds(endAt, Date.now());
    if (left !== last) {
      last = left;
      onTick(left);
    }
    if (left === 0) {
      stop();
      onDone();
    }
  };

  interval = setInterval(tick, TICK_MS);
  tick();
  return stop;
}

/** Stoppefunksjonen gir tilbake antall sekunder som har gått. */
export function startStopwatch({ onTick }) {
  const startAt = Date.now();
  let last = null;

  const tick = () => {
    const elapsed = elapsedSeconds(startAt, Date.now());
    if (elapsed !== last) {
      last = elapsed;
      onTick(elapsed);
    }
  };

  const interval = setInterval(tick, TICK_MS);
  tick();
  return () => {
    clearInterval(interval);
    return elapsedSeconds(startAt, Date.now());
  };
}
