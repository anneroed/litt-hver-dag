import { KEY_PATHS, STORES, readAllStores, replaceAllStores } from './db.js';
import { formatDateLong, localDateString } from './format.js';

// Interne nøkler beholder det opprinnelige navnet, så eldre sikkerhetskopier fortsatt kan importeres.
const APP_ID = 'litt-hver-dag';
const SCHEMA_VERSION = 1;

const DAMAGED = 'Sikkerhetskopien er ufullstendig eller skadet.';

export class BackupError extends Error {}

export function createBackup(data, now = new Date()) {
  return { app: APP_ID, schemaVersion: SCHEMA_VERSION, exportedAt: now.toISOString(), data };
}

/** Tolker og kontrollerer en sikkerhetskopi. Kaster BackupError med en melding som kan vises direkte. */
export function parseBackup(text) {
  let backup;
  try {
    backup = JSON.parse(text);
  } catch {
    throw new BackupError('Filen kan ikke leses som JSON.');
  }

  if (backup?.app !== APP_ID || !Number.isInteger(backup.schemaVersion) || backup.schemaVersion < 1) {
    throw new BackupError('Dette er ikke en sikkerhetskopi fra Hverdagsrep.');
  }
  if (backup.schemaVersion > SCHEMA_VERSION) {
    throw new BackupError('Sikkerhetskopien er laget av en nyere versjon av appen. Oppdater appen først.');
  }
  if (Number.isNaN(Date.parse(backup.exportedAt))) throw new BackupError(DAMAGED);

  const data = {};
  for (const store of STORES) {
    const rows = backup.data?.[store];
    const key = KEY_PATHS[store];
    const valid = Array.isArray(rows) && rows.every((row) => typeof row?.[key] === 'string' && row[key] !== '');
    if (!valid) throw new BackupError(DAMAGED);
    data[store] = rows;
  }
  return { exportedAt: backup.exportedAt, data };
}

export const fileNameFor = (date) => `hverdagsrep-backup-${localDateString(date)}.json`;

const count = (number, singular, plural) => `${number} ${number === 1 ? singular : plural}`;

export function describeContents({ exportedAt, data }) {
  const contents = [
    count(data.assessments.length, 'kartlegging', 'kartlegginger'),
    count(data.sessions.length, 'økt', 'økter'),
    count(data.sets.length, 'sett', 'sett'),
  ].join(', ');
  return `Filen er fra ${formatDateLong(exportedAt)} og inneholder ${contents}.`;
}

export async function createBackupFile() {
  const now = new Date();
  const json = JSON.stringify(createBackup(await readAllStores(), now), null, 2);
  return new File([json], fileNameFor(now), { type: 'application/json' });
}

/**
 * Lagrer filen via delearket på telefon og som nedlasting ellers.
 * Må kalles direkte fra et trykk: Safari avviser deling etter asynkront arbeid.
 * Gir false hvis brukeren lukket delearket uten å lagre.
 */
export async function saveFile(file) {
  const useShareSheet = window.matchMedia('(pointer: coarse)').matches && navigator.canShare?.({ files: [file] });
  if (useShareSheet) {
    try {
      await navigator.share({ files: [file] });
      return true;
    } catch (error) {
      if (error.name === 'AbortError') return false;
      throw error;
    }
  }

  const url = URL.createObjectURL(file);
  const link = Object.assign(document.createElement('a'), { href: url, download: file.name });
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return true;
}

export const restoreBackup = ({ data }) => replaceAllStores(data);
