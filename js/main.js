import { getAll, getAllByIndex } from './db.js';
import { shouldOfferInstall } from './install.js';
import { startRouter } from './router.js';
import { homeView } from './views/home.js';
import { installView } from './views/install.js';
import { libraryView } from './views/library.js';
import { assessmentView } from './views/assessment.js';
import { historyView } from './views/history.js';
import { sessionView } from './views/session.js';
import { settingsView } from './views/settings.js';

const routes = new Map([
  ['/', { view: homeView }],
  ['/historikk', { view: historyView, parent: '/' }],
  ['/kartlegging', { view: assessmentView, parent: '/' }],
  ['/innstillinger', { view: settingsView, parent: '/' }],
  ['/okt', { view: sessionView, parent: '/' }],
  ['/installer', { view: installView, parent: '/' }],
  ['/bibliotek', { view: libraryView, parent: '/' }],
]);

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.register('sw.js');
  const banner = document.getElementById('update-banner');
  let updating = false;

  const offerUpdate = () => {
    if (registration.waiting && navigator.serviceWorker.controller) banner.hidden = false;
  };

  offerUpdate();
  registration.addEventListener('updatefound', () => {
    const worker = registration.installing;
    worker?.addEventListener('statechange', () => {
      if (worker.state === 'installed') offerUpdate();
    });
  });

  document.getElementById('update-button').addEventListener('click', () => {
    updating = true;
    registration.waiting?.postMessage('SKIP_WAITING');
  });

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (updating) location.reload();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') registration.update().catch(() => {});
  });
}

// Første oppstart: veiledning i nettleserfane, ellers rett til kartleggingen.
async function chooseStartScreen() {
  if (shouldOfferInstall()) return '/installer';
  if (location.hash.length > 2) return null;
  const [assessments, activeSessions] = await Promise.all([
    getAll('assessments'),
    getAllByIndex('sessions', 'status', 'active'),
  ]).catch(() => [[{}], []]);
  return assessments.length === 0 && activeSessions.length === 0 ? '/kartlegging' : null;
}

const startScreen = await chooseStartScreen();
if (startScreen) history.replaceState(null, '', `#${startScreen}`);
startRouter(routes, document.getElementById('app'));
registerServiceWorker().catch((error) => console.warn('Service worker ble ikke registrert', error));
navigator.storage?.persist?.().catch(() => {});
