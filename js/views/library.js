import { LADDERS, LIBRARY_GROUPS } from '../data/exercises.js';
import { put } from '../db.js';
import { currentStep, formatTarget, loadProgramContext, stepKind, stepTarget } from '../program.js';
import { h, subpage } from '../ui.js';

export async function libraryView() {
  const { assessment, settings, exerciseState } = await loadProgramContext();

  function targetText(ladder, step) {
    const adjustment = exerciseState[ladder.id]?.stepId === step.id ? exerciseState[ladder.id].adjustment ?? 0 : 0;
    const target = stepTarget(ladder, step, assessment, settings.percentOfMax, adjustment);
    return `Settmål: ${formatTarget({ kind: stepKind(ladder, step), target, perSide: step.perSide })}`;
  }

  function ladderSection(ladder, open = false) {
    const active = assessment ? currentStep(ladder, assessment, exerciseState[ladder.id]) : null;

    const stepRows = ladder.steps.map((step) => {
      const isActive = step === active;
      return h(
        'li',
        { class: isActive ? 'ladder-step ladder-step-active' : 'ladder-step' },
        h(
          'div',
          { class: 'ladder-step-text' },
          h('strong', {}, step.name),
          h('p', { class: 'muted ladder-note' }, step.note),
          assessment ? h('p', { class: 'ladder-target' }, targetText(ladder, step)) : null,
        ),
        !assessment
          ? null
          : isActive
            ? h('span', { class: 'ladder-badge' }, 'I bruk')
            : h(
                'button',
                {
                  class: 'button button-outline button-small',
                  type: 'button',
                  onclick: async () => {
                    const state = { exerciseId: ladder.id, stepId: step.id, adjustment: 0 };
                    await put('exerciseState', state);
                    exerciseState[ladder.id] = state;
                    section.replaceWith(ladderSection(ladder, true));
                  },
                },
                'Bruk',
              ),
      );
    });

    const section = h(
      'details',
      { class: 'ladder' },
      h(
        'summary',
        {},
        h('span', { class: 'list-row-label' }, ladder.name),
        active ? h('span', { class: 'muted ladder-current' }, active.name) : null,
      ),
      h('p', { class: 'muted ladder-direction' }, 'Lettest øverst, tyngst nederst'),
      h('ol', { class: 'ladder-steps' }, stepRows),
    );
    section.open = open;
    return section;
  }

  return subpage(
    'Øvelsesbibliotek',
    h(
      'p',
      { class: 'muted intro' },
      assessment ? 'Velg hvilket trinn du vil bruke. Programmet følger valget ditt.' : 'Gjør kartleggingen for å se settmålene dine.',
    ),
    LIBRARY_GROUPS.map((group) =>
      h(
        'section',
        { class: 'library-group' },
        h('h2', {}, group.name),
        LADDERS.filter((ladder) => ladder.group === group.id).map((ladder) => ladderSection(ladder)),
      ),
    ),
  );
}
