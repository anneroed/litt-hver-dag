import { dayNumber, formatDateShort } from './format.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const HEIGHT = 210;
const MARGIN = { top: 26, right: 14, bottom: 26, left: 34 };
const MAX_POINTS_WITH_MARKERS = 40;

function svg(tag, attributes = {}, text) {
  const element = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  if (text !== undefined) element.textContent = text;
  return element;
}

/** Y-akse fra 0 med runde verdier og høyst fire intervaller. */
export function niceAxis(maxValue) {
  const target = Math.max(maxValue, 1);
  const magnitude = 10 ** Math.floor(Math.log10(target));
  const step = [magnitude / 10, magnitude / 5, magnitude / 2, magnitude, magnitude * 2, magnitude * 5]
    .filter((candidate) => candidate >= 1 && Number.isInteger(candidate))
    .find((candidate) => Math.ceil(target / candidate) <= 4);
  const max = Math.ceil(target / step) * step;
  return { max, ticks: Array.from({ length: max / step + 1 }, (_, index) => index * step) };
}

/** Linjegraf for én serie. points: [{ date, value, total? }], med tidsriktig x-akse. */
export function lineChart({ points, width, description, unit, formatValue }) {
  const axis = niceAxis(Math.max(...points.map((point) => point.value)));
  const plotWidth = width - MARGIN.left - MARGIN.right;
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const firstDay = dayNumber(points[0].date);
  const daySpan = dayNumber(points.at(-1).date) - firstDay;

  const xOf = (point) => MARGIN.left + (daySpan === 0 ? plotWidth / 2 : ((dayNumber(point.date) - firstDay) / daySpan) * plotWidth);
  const yOf = (value) => MARGIN.top + plotHeight - (value / axis.max) * plotHeight;

  const root = svg('svg', { viewBox: `0 0 ${width} ${HEIGHT}`, class: 'chart-svg', role: 'img', 'aria-label': description, tabindex: '0' });

  root.append(svg('text', { x: 0, y: 12, class: 'chart-text' }, unit));
  for (const tick of axis.ticks) {
    root.append(svg('line', { x1: MARGIN.left, x2: width - MARGIN.right, y1: yOf(tick), y2: yOf(tick), class: 'chart-grid' }));
    root.append(svg('text', { x: MARGIN.left - 8, y: yOf(tick) + 4, class: 'chart-text', 'text-anchor': 'end' }, String(tick)));
  }

  const labelY = HEIGHT - 6;
  if (daySpan === 0) {
    root.append(svg('text', { x: xOf(points[0]), y: labelY, class: 'chart-text', 'text-anchor': 'middle' }, formatDateShort(points[0].date)));
  } else {
    root.append(svg('text', { x: MARGIN.left, y: labelY, class: 'chart-text' }, formatDateShort(points[0].date)));
    root.append(svg('text', { x: width - MARGIN.right, y: labelY, class: 'chart-text', 'text-anchor': 'end' }, formatDateShort(points.at(-1).date)));
  }

  const crosshair = svg('line', { y1: MARGIN.top, y2: MARGIN.top + plotHeight, class: 'chart-crosshair', visibility: 'hidden' });
  root.append(crosshair);

  if (points.length > 1) {
    root.append(svg('path', { d: points.map((point, index) => `${index ? 'L' : 'M'}${xOf(point).toFixed(1)} ${yOf(point.value).toFixed(1)}`).join(' '), class: 'chart-line' }));
  }
  if (points.length <= MAX_POINTS_WITH_MARKERS) {
    for (const point of points) root.append(svg('circle', { cx: xOf(point), cy: yOf(point.value), r: 4, class: 'chart-dot' }));
  }

  const last = points.at(-1);
  const lastLabelNearEdge = xOf(last) > width - MARGIN.right - 30;
  const endLabel = svg(
    'text',
    { x: xOf(last), y: yOf(last.value) - 10, class: 'chart-end-label', 'text-anchor': lastLabelNearEdge ? 'end' : 'middle' },
    String(last.value),
  );
  root.append(endLabel);

  const activeDot = svg('circle', { r: 6, class: 'chart-dot', visibility: 'hidden' });
  root.append(activeDot);

  const tooltip = document.createElement('div');
  tooltip.className = 'chart-tooltip';
  tooltip.hidden = true;

  const container = document.createElement('div');
  container.className = 'chart';
  container.append(root, tooltip);

  let activeIndex = null;

  function show(index) {
    activeIndex = index;
    const point = points[index];
    const x = xOf(point);
    const y = yOf(point.value);
    crosshair.setAttribute('x1', x);
    crosshair.setAttribute('x2', x);
    crosshair.setAttribute('visibility', 'visible');
    activeDot.setAttribute('cx', x);
    activeDot.setAttribute('cy', y);
    activeDot.setAttribute('visibility', 'visible');
    endLabel.setAttribute('visibility', 'hidden');

    const total = point.total !== undefined && point.total !== point.value ? ` · totalt ${point.total}` : '';
    tooltip.textContent = `${formatDateShort(point.date)}: ${formatValue(point.value)}${total}`;
    tooltip.hidden = false;
    const available = container.clientWidth;
    const scaled = (x / width) * available;
    const half = tooltip.offsetWidth / 2;
    tooltip.style.left = `${Math.min(available - half, Math.max(half, scaled))}px`;
  }

  function hide() {
    activeIndex = null;
    crosshair.setAttribute('visibility', 'hidden');
    activeDot.setAttribute('visibility', 'hidden');
    endLabel.setAttribute('visibility', 'visible');
    tooltip.hidden = true;
  }

  function nearestIndex(clientX) {
    const box = root.getBoundingClientRect();
    const x = ((clientX - box.left) / box.width) * width;
    return points.reduce((best, point, index) => (Math.abs(xOf(point) - x) < Math.abs(xOf(points[best]) - x) ? index : best), 0);
  }

  root.addEventListener('pointerdown', (event) => show(nearestIndex(event.clientX)));
  root.addEventListener('pointermove', (event) => show(nearestIndex(event.clientX)));
  root.addEventListener('pointerleave', (event) => {
    if (event.pointerType === 'mouse') hide();
  });
  root.addEventListener('focus', () => show(points.length - 1));
  root.addEventListener('blur', hide);
  root.addEventListener('keydown', (event) => {
    const change = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
    if (!change) return;
    event.preventDefault();
    show(Math.min(points.length - 1, Math.max(0, (activeIndex ?? points.length - 1) + change)));
  });

  return container;
}
