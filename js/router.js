// Hash-ruter med egen historikk. Standalone-modus på iPhone har ingen nettleserknapper,
// så hver skjerm kjenner sin forelder og kan alltid finne veien tilbake.

let routes = new Map();
let outlet = null;
let renderedPath = null;
let historyIndex = 0;
let leaveGuard = null;
let guardOpen = false;
let cleanup = null;
let renderToken = 0;

const currentPath = () => location.hash.slice(1) || '/';
const urlFor = (path) => `#${path}`;

async function render(path) {
  const token = ++renderToken;
  const route = routes.get(path) ?? routes.get('/');
  const target = routes.has(path) ? path : '/';

  cleanup?.();
  cleanup = null;
  leaveGuard = null;

  let viewCleanup = null;
  const node = await route.view({
    onCleanup: (fn) => {
      viewCleanup = fn;
    },
  });
  if (token !== renderToken) {
    viewCleanup?.();
    return;
  }

  cleanup = viewCleanup;
  renderedPath = target;
  document.body.dataset.route = target;
  outlet.replaceChildren(node);
  window.scrollTo(0, 0);
}

// Spør en aktiv vakt om det er greit å forlate skjermen.
async function mayLeave() {
  if (!leaveGuard) return true;
  if (guardOpen) return false;
  guardOpen = true;
  try {
    if (!(await leaveGuard())) return false;
    leaveGuard = null;
    return true;
  } finally {
    guardOpen = false;
  }
}

async function onPopState(event) {
  // Sveip tilbake: historikken har allerede flyttet seg, så legg skjermen tilbake før vi spør.
  if (leaveGuard) {
    history.pushState({ index: historyIndex }, '', urlFor(renderedPath));
    if (await mayLeave()) history.back();
    return;
  }
  historyIndex = event.state?.index ?? 0;
  render(currentPath());
}

export function startRouter(routeTable, element) {
  routes = routeTable;
  outlet = element;
  historyIndex = history.state?.index ?? 0;
  history.replaceState({ index: historyIndex }, '', urlFor(currentPath()));
  window.addEventListener('popstate', onPopState);
  return render(currentPath());
}

export async function navigate(path, { replace = false } = {}) {
  if (!(await mayLeave())) return;
  if (replace) {
    history.replaceState({ index: historyIndex }, '', urlFor(path));
  } else {
    historyIndex += 1;
    history.pushState({ index: historyIndex }, '', urlFor(path));
  }
  render(path);
}

export async function goBack() {
  if (!(await mayLeave())) return;
  if (historyIndex > 0) {
    history.back();
  } else {
    const parent = routes.get(renderedPath)?.parent ?? '/';
    history.replaceState({ index: 0 }, '', urlFor(parent));
    render(parent);
  }
}

/** Må settes etter at skjermen er tegnet; nullstilles automatisk ved neste skjermbytte. */
export function setLeaveGuard(guard) {
  leaveGuard = guard;
}
