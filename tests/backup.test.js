import assert from 'node:assert/strict';
import test from 'node:test';
import { BackupError, createBackup, describeContents, fileNameFor, parseBackup } from '../js/backup.js';

const data = () => ({
  settings: [{ key: 'percentOfMax', value: 65 }],
  assessments: [{ id: 'a1', date: '2026-11-08' }],
  sessions: [{ id: 's1' }, { id: 's2' }],
  sets: [{ id: 't1' }],
  exerciseState: [{ exerciseId: 'pullup' }],
});

const backupText = (changes = {}) =>
  JSON.stringify({ ...createBackup(data(), new Date('2026-11-08T12:00:00Z')), ...changes });

const rejects = (text, message) =>
  assert.throws(
    () => parseBackup(text),
    (error) => error instanceof BackupError && error.message.includes(message),
  );

test('en sikkerhetskopi kan leses tilbake uendret', () => {
  assert.deepEqual(parseBackup(backupText()), { exportedAt: '2026-11-08T12:00:00.000Z', data: data() });
});

test('ukjente tabeller i filen blir ikke med', () => {
  const parsed = parseBackup(backupText({ data: { ...data(), secret: [{ id: 'x' }] } }));
  assert.equal(parsed.data.secret, undefined);
});

test('avviser fil som ikke er JSON', () => rejects('ikke json', 'JSON'));
test('avviser JSON fra noe annet', () => rejects('{"foo":1}', 'ikke en sikkerhetskopi'));
test('avviser JSON-verdien null', () => rejects('null', 'ikke en sikkerhetskopi'));
test('avviser nyere versjon', () => rejects(backupText({ schemaVersion: 2 }), 'nyere versjon'));
test('avviser ugyldig dato', () => rejects(backupText({ exportedAt: 'i går' }), 'skadet'));

test('avviser manglende tabell', () => {
  const { sets, ...withoutSets } = data();
  rejects(backupText({ data: withoutSets }), 'skadet');
});

test('avviser rad uten nøkkel', () => rejects(backupText({ data: { ...data(), sets: [{ reps: 5 }] } }), 'skadet'));
test('avviser rad med tom nøkkel', () => rejects(backupText({ data: { ...data(), sets: [{ id: '' }] } }), 'skadet'));

test('filnavnet bruker lokal dato', () => {
  assert.equal(fileNameFor(new Date(2026, 0, 5, 23, 30)), 'litt-hver-dag-backup-2026-01-05.json');
});

test('beskrivelsen bøyer antall riktig', () => {
  const text = describeContents(parseBackup(backupText()));
  assert.match(text, /1 kartlegging, 2 økter, 1 sett\.$/);
});
