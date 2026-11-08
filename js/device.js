let audio = null;

/** Må kalles fra et trykk, ellers får ikke iOS lov til å spille lyd senere. */
export function unlockSound() {
  const AudioContextClass = window.AudioContext ?? window.webkitAudioContext;
  if (!AudioContextClass) return;
  audio ??= new AudioContextClass();
  audio.resume().catch(() => {});
}

export function beep({ frequency = 880, duration = 0.15 } = {}) {
  if (!audio) return;
  audio.resume().catch(() => {});
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  const start = audio.currentTime;
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0.25, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  oscillator.connect(gain).connect(audio.destination);
  oscillator.start(start);
  oscillator.stop(start + duration);
}

export const beepDone = () => beep({ frequency: 1175, duration: 0.45 });

/** Hindrer at skjermen slukker under timere. Gir tilbake en funksjon som slipper den igjen. */
export function keepScreenAwake() {
  let active = true;
  let lock = null;

  const request = async () => {
    if (!active || document.visibilityState !== 'visible' || !navigator.wakeLock) return;
    try {
      lock = await navigator.wakeLock.request('screen');
      if (!active) lock.release().catch(() => {});
    } catch {
      // Uten skjermlås virker appen som før, skjermen kan bare slukke.
    }
  };

  document.addEventListener('visibilitychange', request);
  request();

  return () => {
    active = false;
    document.removeEventListener('visibilitychange', request);
    lock?.release().catch(() => {});
  };
}
