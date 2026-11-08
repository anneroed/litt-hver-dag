export function formatClock(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function localDateString(date) {
  const pad = (number) => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Tolker 'ÅÅÅÅ-MM-DD' som lokal dato. new Date(tekst) ville tolket den som UTC. */
export function parseLocalDate(dateString) {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** Dagnummer som ikke påvirkes av sommertid. Differansen mellom to er antall hele dager. */
export function dayNumber(dateString) {
  const [year, month, day] = dateString.split('-').map(Number);
  return Date.UTC(year, month - 1, day) / 86_400_000;
}

export function formatDateShort(dateString) {
  return new Intl.DateTimeFormat('nb-NO', { day: 'numeric', month: 'short' }).format(parseLocalDate(dateString));
}

/** Regner på kalenderdager, så sommertid ikke gir dager med 23 eller 25 timer. */
export function addDays(dateString, days) {
  const [year, month, day] = dateString.split('-').map(Number);
  return localDateString(new Date(year, month - 1, day + days));
}

export function formatDateLong(date) {
  return new Intl.DateTimeFormat('nb-NO', { dateStyle: 'long' }).format(new Date(date));
}

/** Gjør tekst fra et tallfelt om til et heltall 0–999, eller null hvis feltet er tomt. */
export function parseCount(text) {
  const digits = String(text).replace(/\D/g, '').slice(0, 3);
  return digits === '' ? null : Number(digits);
}
