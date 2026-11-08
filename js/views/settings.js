import { BackupError, createBackupFile, describeContents, parseBackup, restoreBackup, saveFile } from '../backup.js';
import { LADDERS } from '../data/exercises.js';
import { setSetting } from '../db.js';
import { formatDateLong } from '../format.js';
import { currentStep, formatTarget, LENGTHS, loadProgramContext, PERCENT_RANGE, stepKind, stepTarget } from '../program.js';
import { confirmDialog, h, segmented, subpage } from '../ui.js';

const lastExportText = (iso) => (iso ? `Sist eksportert ${formatDateLong(iso)}.` : 'Ikke eksportert ennå.');

export async function settingsView() {
  const { assessment, settings, exerciseState } = await loadProgramContext();

  // Filen lages på forhånd, fordi Safari krever at deling starter direkte fra trykket.
  let file = await createBackupFile();

  async function saveSetting(key, value) {
    await setSetting(key, value);
    file = await createBackupFile();
  }

  function exampleText(percent) {
    if (!assessment) return 'Gjør kartleggingen for å se hva det betyr for settmålene dine.';
    const [ladder] = LADDERS;
    const state = exerciseState[ladder.id];
    const step = currentStep(ladder, assessment, state);
    const target = stepTarget(ladder, step, assessment, percent, state?.adjustment ?? 0);
    return `Eksempel: ${step.name}, ${formatTarget({ kind: stepKind(ladder, step), target, perSide: step.perSide })}`;
  }

  const percentValue = h('strong', { class: 'setting-value' }, `${settings.percentOfMax} %`);
  const percentExample = h('p', { class: 'muted setting-example' }, exampleText(settings.percentOfMax));
  const percentInput = h('input', {
    class: 'range',
    type: 'range',
    min: String(PERCENT_RANGE.min),
    max: String(PERCENT_RANGE.max),
    step: String(PERCENT_RANGE.step),
    'aria-label': 'Andel av testmaks i prosent',
  });
  percentInput.value = String(settings.percentOfMax);
  percentInput.addEventListener('input', () => {
    percentValue.textContent = `${percentInput.value} %`;
    percentExample.textContent = exampleText(Number(percentInput.value));
  });
  percentInput.addEventListener('change', () => saveSetting('percentOfMax', Number(percentInput.value)));

  const lastExport = h('p', { class: 'muted' }, lastExportText(settings.lastExportAt));
  const status = h('p', { class: 'status', role: 'status' });
  const showStatus = (message, isError = false) => {
    status.textContent = message;
    status.classList.toggle('status-error', isError);
  };

  const fileInput = h('input', { type: 'file', accept: '.json,application/json', class: 'visually-hidden', tabindex: '-1' });
  const exportButton = h('button', { class: 'button button-wide', type: 'button' }, 'Eksporter data');
  const importButton = h('button', { class: 'button button-outline button-wide', type: 'button', onclick: () => fileInput.click() }, 'Importer fra fil');

  exportButton.addEventListener('click', async () => {
    exportButton.disabled = true;
    try {
      if (!(await saveFile(file))) return;
      const now = new Date().toISOString();
      await saveSetting('lastExportAt', now);
      lastExport.textContent = lastExportText(now);
      showStatus('Sikkerhetskopien er laget.');
    } catch {
      showStatus('Eksporten mislyktes. Prøv igjen.', true);
    } finally {
      exportButton.disabled = false;
    }
  });

  fileInput.addEventListener('change', async () => {
    const [selected] = fileInput.files;
    fileInput.value = '';
    if (!selected) return;
    try {
      const backup = parseBackup(await selected.text());
      const confirmed = await confirmDialog({
        title: 'Erstatte alle data?',
        body: `${describeContents(backup)} Alt som ligger i appen nå, blir erstattet.`,
        confirmText: 'Erstatt data',
        cancelText: 'Ikke importer',
        danger: true,
      });
      if (!confirmed) return;

      await restoreBackup(backup);
      file = await createBackupFile();
      const restored = (await loadProgramContext()).settings;
      percentInput.value = String(restored.percentOfMax);
      percentValue.textContent = `${restored.percentOfMax} %`;
      lastExport.textContent = lastExportText(restored.lastExportAt);
      lengthSlot.replaceChildren(lengthPicker(restored.defaultLength));
      showStatus('Dataene er importert.');
    } catch (error) {
      showStatus(error instanceof BackupError ? error.message : 'Importen mislyktes. Dataene er ikke endret.', true);
    }
  });

  const lengthPicker = (value) =>
    segmented({
      label: 'Standard øktlengde',
      options: Object.entries(LENGTHS).map(([id, { label }]) => ({ value: id, label })),
      value,
      onChange: (length) => saveSetting('defaultLength', length),
    });
  const lengthSlot = h('div', { class: 'setting-control' }, lengthPicker(settings.defaultLength));

  return subpage(
    'Innstillinger',
    h(
      'section',
      { class: 'card' },
      h('h2', {}, 'Standard øktlengde'),
      h('p', { class: 'muted card-text' }, 'Du kan alltid velge en annen lengde på hjemskjermen.'),
      lengthSlot,
    ),
    h(
      'section',
      { class: 'card' },
      h('div', { class: 'setting-heading' }, h('h2', {}, 'Andel av testmaks'), percentValue),
      h('p', { class: 'muted card-text' }, 'Styrer hvor store settmålene er i forhold til testresultatene.'),
      percentInput,
      percentExample,
    ),
    h(
      'section',
      { class: 'card' },
      h('h2', {}, 'Sikkerhetskopi'),
      h('p', { class: 'muted card-text' }, 'Dataene dine finnes bare på denne enheten. Lagre en kopi i Filer innimellom.'),
      lastExport,
      h('div', { class: 'stack' }, exportButton, importButton),
      status,
      fileInput,
    ),
  );
}
