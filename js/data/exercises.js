// Progresjonsstiger, sortert fra lett til tung.
// anchor: testen settmålet regnes fra. minMax: testresultatet som gjør trinnet til standardvalg.
// factor: settmål = testmaks × andel × factor. fixed: fast settmål ved 60 % for trinn uten brukbart testresultat.
// min: laveste settmål for trinnet. kind på trinnet overstyrer stigens kind.

export const LADDERS = [
  // Trekk
  {
    id: 'pullup', name: 'Pull-ups', group: 'pull', anchor: 'pullups', kind: 'reps',
    steps: [
      { id: 'negative-pullup', name: 'Negative pull-ups', minMax: 0, fixed: 3, note: 'Hopp opp til toppen og senk deg sakte over 5 sekunder.' },
      { id: 'pullup', name: 'Pull-ups', minMax: 6, factor: 1, note: 'Fra strake armer til haken over stangen, uten sving.' },
      { id: 'tempo-pullup', name: 'Tempo-pull-ups', minMax: 10, factor: 0.6, note: 'Bruk 3 sekunder på vei ned i hver rep.' },
      { id: 'pause-pullup', name: 'Pause-pull-ups', minMax: 13, factor: 0.5, note: 'Hold 2 sekunder med haken over stangen.' },
      { id: 'archer-pullup', name: 'Archer pull-ups', minMax: 20, factor: 0.3, perSide: true, note: 'Dra deg mot én hånd mens den andre armen er nesten strak.' },
    ],
  },
  {
    id: 'chinup', name: 'Chin-ups', group: 'pull', anchor: 'pullups', kind: 'reps',
    steps: [
      { id: 'negative-chinup', name: 'Negative chin-ups', minMax: 0, fixed: 3, note: 'Underhåndsgrep. Senk deg sakte over 5 sekunder.' },
      { id: 'chinup', name: 'Chin-ups', minMax: 4, factor: 1.1, note: 'Underhåndsgrep, fra strake armer til haken over stangen.' },
      { id: 'tempo-chinup', name: 'Tempo-chin-ups', minMax: 12, factor: 0.65, note: 'Bruk 3 sekunder på vei ned i hver rep.' },
    ],
  },
  {
    id: 'flexed-hang', name: 'Hold med bøyde armer', group: 'pull', anchor: 'pullups', kind: 'hold',
    steps: [
      { id: 'hang-90', name: 'Heng med 90° i armene', minMax: 0, fixed: 10, note: 'Hopp opp og hold albuene i rett vinkel.' },
      { id: 'top-hold', name: 'Hold i toppen', minMax: 3, factor: 3.5, note: 'Haken over stangen og skuldrene ned.' },
      { id: 'l-top-hold', name: 'Hold i toppen med løftede knær', minMax: 10, factor: 2, note: 'Hold i toppen med knærne løftet til hoftehøyde.' },
    ],
  },
  {
    id: 'scap-pull', name: 'Skulderløft i heng', group: 'pull', anchor: 'pullups', kind: 'reps',
    steps: [
      { id: 'scap-pull', name: 'Skulderløft i heng', minMax: 0, fixed: 8, note: 'Strake armer. Trekk skuldrene ned og slipp dem rolig opp.' },
      { id: 'scap-pause', name: 'Skulderløft med pause', minMax: 5, fixed: 8, note: 'Hold 2 sekunder med skuldrene trukket ned.' },
    ],
  },
  {
    id: 'dead-hang', name: 'Heng', group: 'pull', anchor: 'deadHang', kind: 'hold',
    steps: [
      { id: 'dead-hang', name: 'Dead hang', minMax: 0, factor: 1, note: 'Heng i strake armer og pust rolig.' },
      { id: 'active-hang', name: 'Aktivt heng', minMax: 40, factor: 0.7, note: 'Skuldrene trukket ned, armene strake.' },
      { id: 'shift-hang', name: 'Skiftende heng', minMax: 70, factor: 0.5, note: 'Flytt vekten rolig fra arm til arm.' },
    ],
  },

  // Press
  {
    id: 'pushup', name: 'Push-ups', group: 'push', anchor: 'pushups', kind: 'reps',
    steps: [
      { id: 'knee-pushup', name: 'Push-ups på knær', minMax: 0, factor: 1.5, min: 6, note: 'Rett linje fra knær til hode.' },
      { id: 'negative-pushup', name: 'Negative push-ups', minMax: 3, fixed: 5, note: 'Senk deg over 4 sekunder. Sett knærne ned for å komme opp.' },
      { id: 'pushup', name: 'Push-ups', minMax: 8, factor: 1, note: 'Kroppen rett, brystet nesten ned til gulvet.' },
      { id: 'tempo-pushup', name: 'Tempo-push-ups', minMax: 16, factor: 0.7, note: 'Bruk 3 sekunder på vei ned i hver rep.' },
      { id: 'diamond-pushup', name: 'Diamant-push-ups', minMax: 22, factor: 0.55, note: 'Hendene samlet under brystet, albuene inntil kroppen.' },
      { id: 'archer-pushup', name: 'Archer push-ups', minMax: 30, factor: 0.25, perSide: true, note: 'Senk deg mot én hånd mens den andre armen er nesten strak.' },
    ],
  },
  {
    id: 'dip', name: 'Dips', group: 'push', anchor: 'pushups', kind: 'reps',
    steps: [
      { id: 'bench-dip-bent', name: 'Stoldips med bøyde bein', minMax: 0, factor: 0.7, min: 5, note: 'Hendene på en stødig stol, føttene i gulvet. Senk til 90° i albuene.' },
      { id: 'bench-dip-straight', name: 'Stoldips med strake bein', minMax: 15, factor: 0.6, note: 'Som over, men med strake bein og hælene i gulvet.' },
      { id: 'chair-dip', name: 'Dips mellom to stoler', minMax: 28, factor: 0.35, note: 'Bruk to stødige stoler som ikke kan skli eller vippe.' },
    ],
  },
  {
    id: 'pike', name: 'Pike', group: 'push', anchor: 'pushups', kind: 'reps',
    steps: [
      { id: 'pike-hold', name: 'Pike-hold', minMax: 0, kind: 'hold', fixed: 20, note: 'Hoftene høyt og vekten mot hendene.' },
      { id: 'pike-pushup', name: 'Pike push-ups', minMax: 10, factor: 0.5, note: 'Hoftene høyt. Senk hodet mot gulvet foran hendene.' },
      { id: 'tempo-pike', name: 'Tempo-pike push-ups', minMax: 22, factor: 0.3, note: 'Bruk 3 sekunder på vei ned i hver rep.' },
    ],
  },
  {
    id: 'plank-press', name: 'Skulderstabilitet', group: 'push', anchor: 'pushups', kind: 'reps',
    steps: [
      { id: 'knee-taps', name: 'Skulderklapp på knær', minMax: 0, fixed: 8, perSide: true, note: 'Klapp motsatt skulder uten å vri hoftene.' },
      { id: 'shoulder-taps', name: 'Skulderklapp fra planke', minMax: 6, factor: 0.6, perSide: true, note: 'Strake armer og stille hofter.' },
      { id: 'up-down', name: 'Planke opp og ned', minMax: 15, factor: 0.5, note: 'Fra albuer til strake armer, én arm om gangen.' },
    ],
  },
  {
    id: 'low-hold', name: 'Lavt hold', group: 'push', anchor: 'pushups', kind: 'hold',
    steps: [
      { id: 'low-hold-knee', name: 'Lavt hold på knær', minMax: 0, fixed: 15, note: 'Hold deg i bunnen av en push-up på knær.' },
      { id: 'low-hold', name: 'Lavt hold', minMax: 8, factor: 1.5, note: 'Hold deg i bunnen av en push-up med rett kropp.' },
      { id: 'lean-hold', name: 'Planke med fremlent vekt', minMax: 25, factor: 0.9, note: 'Strake armer, skuldrene foran hendene.' },
    ],
  },

  // Bein
  {
    id: 'squat', name: 'Knebøy', group: 'legs', anchor: 'squats', kind: 'reps',
    steps: [
      { id: 'half-squat', name: 'Halv knebøy', minMax: 0, factor: 1, min: 8, note: 'Så dypt du klarer med hele foten i gulvet.' },
      { id: 'squat', name: 'Knebøy', minMax: 15, factor: 1, note: 'Lårene minst parallelle med gulvet.' },
      { id: 'pause-squat', name: 'Pause-knebøy', minMax: 35, factor: 0.5, note: 'Hold 2 sekunder i bunnen av hver rep.' },
      { id: 'jump-squat', name: 'Hoppknebøy', minMax: 50, factor: 0.35, note: 'Hopp eksplosivt og land mykt.' },
    ],
  },
  {
    id: 'lunge', name: 'Utfall', group: 'legs', anchor: 'squats', kind: 'reps',
    steps: [
      { id: 'reverse-lunge', name: 'Utfall bakover', minMax: 0, factor: 0.4, min: 5, perSide: true, note: 'Ta et langt steg bakover og senk kneet mot gulvet.' },
      { id: 'walking-lunge', name: 'Gående utfall', minMax: 25, factor: 0.4, perSide: true, note: 'Gå fremover med kontrollerte, lange steg.' },
      { id: 'jump-lunge', name: 'Hoppende utfall', minMax: 50, factor: 0.25, perSide: true, note: 'Bytt bein i luften og land mykt.' },
    ],
  },
  {
    id: 'single-leg', name: 'Ett bein', group: 'legs', anchor: 'squats', kind: 'reps',
    steps: [
      { id: 'cossack', name: 'Cossack squats', minMax: 0, factor: 0.25, min: 4, perSide: true, note: 'Bred stilling. Sett deg ned på ett bein mens det andre er strakt.' },
      { id: 'shrimp', name: 'Shrimp squats', minMax: 40, factor: 0.15, perSide: true, note: 'Hold bakre fot og senk kneet mot gulvet.' },
      { id: 'pistol', name: 'Pistol squats', minMax: 55, factor: 0.12, perSide: true, note: 'Helt ned på ett bein med det andre strakt foran deg.' },
    ],
  },
  {
    id: 'bridge', name: 'Seteløft', group: 'legs', anchor: 'squats', kind: 'reps',
    steps: [
      { id: 'bridge', name: 'Seteløft', minMax: 0, factor: 0.6, min: 10, note: 'Ligg på ryggen og press hoftene opp med hælene.' },
      { id: 'pause-bridge', name: 'Seteløft med pause', minMax: 20, factor: 0.5, note: 'Hold 2 sekunder på toppen.' },
      { id: 'single-bridge', name: 'Seteløft på ett bein', minMax: 35, factor: 0.3, perSide: true, note: 'Det andre beinet strakt i luften, hoftene i vater.' },
    ],
  },
  {
    id: 'calf', name: 'Tåhev', group: 'legs', anchor: 'squats', kind: 'reps',
    steps: [
      { id: 'calf-raise', name: 'Tåhev', minMax: 0, factor: 0.7, min: 12, note: 'Rolig opp på tærne og kontrollert ned.' },
      { id: 'single-calf', name: 'Tåhev på ett bein', minMax: 30, factor: 0.35, perSide: true, note: 'Rolig opp på tærne på ett bein.' },
    ],
  },

  // Kjerne
  {
    id: 'hanging-core', name: 'Beinløft', group: 'core', anchor: 'kneeRaises', kind: 'reps',
    steps: [
      { id: 'lying-knee-raise', name: 'Liggende kneløft', minMax: 0, fixed: 10, note: 'Ligg på ryggen og trekk knærne mot brystet.' },
      { id: 'knee-raise', name: 'Hanging knee raises', minMax: 4, factor: 1, note: 'Løft knærne til hoftehøyde uten sving.' },
      { id: 'leg-raise', name: 'Hanging leg raises', minMax: 12, factor: 0.5, note: 'Løft strake bein til hoftehøyde.' },
      { id: 'toes-to-bar', name: 'Toes-to-bar', minMax: 20, factor: 0.3, note: 'Løft strake bein helt opp til stangen.' },
    ],
  },
  {
    id: 'plank-hold', name: 'Planke og hollow', group: 'core', anchor: 'core', kind: 'hold',
    steps: [
      { id: 'plank', name: 'Planke', minMax: 0, factor: 1, note: 'Rett linje fra hode til hæl. Stram mage og sete.' },
      { id: 'hollow-tuck', name: 'Hollow hold med bøyde knær', minMax: 45, factor: 0.8, note: 'Korsryggen i gulvet, knærne over hoftene.' },
      { id: 'hollow', name: 'Hollow hold', minMax: 60, factor: 0.67, note: 'Armer og bein strake, korsryggen i gulvet.' },
    ],
  },
  {
    id: 'side-plank', name: 'Sideplanke', group: 'core', anchor: 'core', kind: 'hold',
    steps: [
      { id: 'side-plank-knee', name: 'Sideplanke på knær', minMax: 0, factor: 0.5, perSide: true, note: 'Rett linje fra knær til skuldre.' },
      { id: 'side-plank', name: 'Sideplanke', minMax: 40, factor: 0.5, perSide: true, note: 'Rett linje fra føtter til skuldre.' },
      { id: 'side-plank-lift', name: 'Sideplanke med beinløft', minMax: 90, factor: 0.35, perSide: true, note: 'Løft det øverste beinet og hold.' },
    ],
  },
  {
    id: 'dynamic-core', name: 'Dynamisk kjerne', group: 'core', anchor: 'core', kind: 'reps',
    steps: [
      { id: 'dead-bug', name: 'Dead bug', minMax: 0, fixed: 8, perSide: true, note: 'Korsryggen i gulvet. Strekk ut motsatt arm og bein.' },
      { id: 'mountain-climber', name: 'Mountain climbers', minMax: 30, fixed: 15, perSide: true, note: 'Strake armer. Dra knærne vekselvis mot brystet.' },
      { id: 'v-up', name: 'V-ups', minMax: 60, factor: 0.2, note: 'Løft strake armer og bein slik at de møtes over hoftene.' },
    ],
  },
  {
    id: 'back', name: 'Rygg', group: 'core', anchor: 'core', kind: 'hold',
    steps: [
      { id: 'superman', name: 'Superman-hold', minMax: 0, fixed: 20, note: 'Ligg på magen og løft armer og bein litt fra gulvet.' },
      { id: 'swimmer', name: 'Svømmetak på magen', minMax: 30, kind: 'reps', fixed: 12, perSide: true, note: 'Løft motsatt arm og bein vekselvis.' },
    ],
  },
];

// Miks er bare press og bein, siden den kommer rett etter kjerne og rett før trekk.
export const FOCI = [
  { id: 'pull', name: 'Trekk', restSeconds: 90, ladders: ['pullup', 'flexed-hang', 'chinup', 'scap-pull', 'dead-hang'] },
  { id: 'push', name: 'Press', restSeconds: 75, ladders: ['pushup', 'dip', 'pike', 'plank-press', 'low-hold'] },
  { id: 'legs', name: 'Bein', restSeconds: 60, ladders: ['squat', 'lunge', 'single-leg', 'bridge', 'calf'] },
  { id: 'core', name: 'Kjerne', restSeconds: 60, ladders: ['hanging-core', 'plank-hold', 'side-plank', 'dynamic-core', 'back'] },
  { id: 'mix', name: 'Miks', restSeconds: 60, ladders: ['pushup', 'squat', 'dip', 'lunge', 'pike'] },
];

export const LIBRARY_GROUPS = [
  { id: 'pull', name: 'Trekk' },
  { id: 'push', name: 'Press' },
  { id: 'legs', name: 'Bein' },
  { id: 'core', name: 'Kjerne' },
];
