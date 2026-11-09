const SHOWN_KEY = 'install-instructions-shown';

export function isStandalone() {
  return navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
}

export function isIPhone() {
  return /iPhone|iPad|iPod/.test(navigator.userAgent);
}

export function isAndroid() {
  return /Android/.test(navigator.userAgent);
}

export function installTitle() {
  return isAndroid() ? 'Legg til på startsiden' : 'Legg til på Hjem-skjerm';
}

/** Sant første gang appen åpnes i en nettleserfane, så veiledningen ikke maser ved hver omlasting. */
export function shouldOfferInstall() {
  if (isStandalone()) return false;
  try {
    if (sessionStorage.getItem(SHOWN_KEY)) return false;
    sessionStorage.setItem(SHOWN_KEY, '1');
  } catch {
    // Uten sessionStorage vises veiledningen bare på nytt ved omlasting.
  }
  return true;
}
