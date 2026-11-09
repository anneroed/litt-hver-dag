import { installTitle, isAndroid, isIPhone } from '../install.js';
import { goBack } from '../router.js';
import { h, icon, subpage } from '../ui.js';

const FULL_SCREEN = 'Da åpnes appen i full skjerm og virker uten nett.';

function androidInstructions() {
  return [
    h('p', { class: 'muted intro' }, FULL_SCREEN),
    h(
      'ol',
      { class: 'steps' },
      h('li', {}, 'Trykk på ', h('strong', {}, '⋮'), ' øverst til høyre i Chrome.'),
      h('li', {}, 'Velg ', h('strong', {}, 'Legg til på startsiden'), ' eller ', h('strong', {}, 'Installer app'), '.'),
      h('li', {}, 'Bekreft, og åpne appen fra det nye ikonet.'),
    ),
  ];
}

function iPhoneInstructions() {
  return [
    isIPhone()
      ? h('p', { class: 'muted intro' }, FULL_SCREEN)
      : h('p', { class: 'muted intro' }, 'Åpne denne adressen i Safari på iPhone og gjør dette:'),
    h(
      'ol',
      { class: 'steps' },
      h('li', {}, 'Trykk på Del-knappen ', icon('share'), ' i Safari. Ser du den ikke, trykk først på ••• nederst.'),
      h('li', {}, 'Bla ned og velg ', h('strong', {}, 'Legg til på Hjem-skjerm'), '.'),
      h('li', {}, 'Trykk ', h('strong', {}, 'Legg til'), ', og åpne appen fra det nye ikonet.'),
    ),
    h(
      'p',
      { class: 'card note' },
      'Treningsdata i nettleseren følger ikke med til appen på Hjem-skjermen. Tren derfor alltid fra ikonet.',
    ),
  ];
}

export function installView() {
  return subpage(
    installTitle(),
    isAndroid() ? androidInstructions() : iPhoneInstructions(),
    h('button', { class: 'button button-outline button-wide', type: 'button', onclick: () => goBack() }, 'Fortsett i nettleseren'),
  );
}
