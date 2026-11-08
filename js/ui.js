import { parseCount } from './format.js';
import { goBack } from './router.js';

export function h(tag, props = {}, ...children) {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(props)) {
    if (name.startsWith('on')) element.addEventListener(name.slice(2), value);
    else if (name === 'class') element.className = value;
    else element.setAttribute(name, value);
  }
  element.append(...children.flat(Infinity).filter((child) => child !== null && child !== undefined));
  return element;
}

const ICONS = {
  back: 'M15 5l-7 7 7 7',
  forward: 'M9 5l7 7-7 7',
  chart: 'M4 20h16M7 16v-5M12 16V6M17 16v-8',
  test: 'M9 4h6M10 4v5l-5 9a1.5 1.5 0 0 0 1.3 2h11.4a1.5 1.5 0 0 0 1.3-2l-5-9V4M8 15h8',
  settings: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4',
  library: 'M5 4.5h4v15H5zM10 4.5h4v15h-4zM16 5l3.5-.8 3 14.8-3.5.8z',
  share: 'M12 15V4M8 7.5l4-4 4 4M8 11H5.5v9.5h13V11H16',
  add: 'M12 8v8M8 12h8M6 3.5h12A2.5 2.5 0 0 1 20.5 6v12a2.5 2.5 0 0 1-2.5 2.5H6A2.5 2.5 0 0 1 3.5 18V6A2.5 2.5 0 0 1 6 3.5z',
};

export function icon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'icon');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', ICONS[name]);
  svg.append(path);
  return svg;
}

/** Underside med fast tilbakeknapp øverst. */
export function subpage(title, ...children) {
  return h(
    'div',
    { class: 'screen' },
    h(
      'header',
      { class: 'topbar' },
      h('button', { class: 'back-button', type: 'button', onclick: () => goBack() }, icon('back'), 'Tilbake'),
    ),
    h('main', { class: 'content' }, h('h1', {}, title), children),
  );
}

/** Tallfelt med store minus- og plussknapper. Elementet har setValue(tall). */
export function stepper({ label, value = null, onChange }) {
  let current = value;
  const input = h('input', {
    class: 'stepper-input',
    type: 'text',
    inputmode: 'numeric',
    pattern: '[0-9]*',
    autocomplete: 'off',
    'aria-label': label,
  });
  input.value = current ?? '';

  const setValue = (next) => {
    current = next;
    input.value = current ?? '';
    onChange(current);
  };

  input.addEventListener('input', () => setValue(parseCount(input.value)));

  const stepButton = (text, name, change) =>
    h('button', { class: 'stepper-button', type: 'button', 'aria-label': name, onclick: () => setValue(change(current ?? 0)) }, text);

  return Object.assign(
    h(
      'div',
      { class: 'stepper' },
      stepButton('−', 'Færre', (number) => Math.max(0, number - 1)),
      input,
      stepButton('+', 'Flere', (number) => Math.min(999, number + 1)),
    ),
    { setValue },
  );
}

/** Rad med knapper der ett valg er aktivt. */
export function segmented({ label, options, value, onChange }) {
  const buttons = options.map((option) => {
    const button = h('button', { class: 'segment', type: 'button' }, option.label);
    const select = () => {
      for (const [index, other] of buttons.entries()) {
        other.setAttribute('aria-pressed', String(options[index].value === option.value));
      }
      onChange(option.value);
    };
    button.addEventListener('click', select);
    button.setAttribute('aria-pressed', String(option.value === value));
    return button;
  });
  return h('div', { class: 'segmented', role: 'group', 'aria-label': label }, buttons);
}

/** Viser en bekreftelsesdialog. Gir true hvis brukeren velger confirmText. */
export function confirmDialog({ title, body, confirmText, cancelText, danger = false }) {
  return new Promise((resolve) => {
    const dialog = h(
      'dialog',
      { class: 'dialog' },
      h('h2', {}, title),
      h('p', {}, body),
      h(
        'div',
        { class: 'dialog-actions' },
        h('button', { class: 'button', type: 'button', onclick: () => dialog.close('cancel') }, cancelText),
        h(
          'button',
          {
            class: danger ? 'button button-quiet-danger' : 'button button-secondary',
            type: 'button',
            onclick: () => dialog.close('confirm'),
          },
          confirmText,
        ),
      ),
    );
    dialog.addEventListener('close', () => {
      dialog.remove();
      resolve(dialog.returnValue === 'confirm');
    });
    document.body.append(dialog);
    dialog.showModal();
  });
}
