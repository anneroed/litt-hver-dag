export const GET_READY_SECONDS = 5;
export const REST_SECONDS = 120;

// kind: 'reps' = maks reps, 'hold' = maks tid, 'timedReps' = maks reps innen fast tid.
export const TESTS = [
  {
    id: 'pullups',
    name: 'Pull-ups',
    kind: 'reps',
    prompt: 'Maks strikte reps',
    technique: [
      'Start i helt strake armer, uten sving.',
      'Dra deg opp til haken er over stangen.',
      'Senk deg kontrollert helt ned før neste rep.',
      'Stopp når du ikke klarer en ren rep. 0 er et gyldig resultat.',
    ],
  },
  {
    id: 'pushups',
    name: 'Push-ups',
    kind: 'reps',
    prompt: 'Maks reps',
    technique: [
      'Hendene rett under skuldrene, kroppen i en rett linje.',
      'Senk deg til brystet nesten berører gulvet.',
      'Press helt opp uten at hoftene henger.',
      'Stopp når kroppen ikke lenger er rett.',
    ],
  },
  {
    id: 'deadHang',
    name: 'Dead hang',
    kind: 'hold',
    prompt: 'Maks tid',
    technique: [
      'Heng i strake armer med skulderbredt grep.',
      'Hold skuldrene litt bort fra ørene.',
      'Pust rolig. Tiden stopper når du slipper.',
    ],
  },
  {
    id: 'core',
    name: 'Planke eller hollow hold',
    kind: 'hold',
    prompt: 'Maks tid. Velg den du vil teste.',
    variants: [
      {
        id: 'plank',
        name: 'Planke',
        technique: [
          'Albuene under skuldrene, tærne i gulvet.',
          'Rett linje fra hode til hæl. Stram mage og sete.',
          'Stopp når hoftene synker.',
        ],
      },
      {
        id: 'hollow',
        name: 'Hollow hold',
        technique: [
          'Ligg på ryggen med armene over hodet og strake bein.',
          'Løft skuldre og bein, og press korsryggen i gulvet.',
          'Stopp når korsryggen løfter seg.',
        ],
      },
    ],
  },
  {
    id: 'squats',
    name: 'Knebøy',
    kind: 'timedReps',
    seconds: 60,
    prompt: 'Maks reps på 60 sekunder',
    technique: [
      'Føttene i skulderbredde, tærne litt utover.',
      'Sett deg ned til lårene er minst parallelle med gulvet.',
      'Reis deg helt opp i hver rep, og tell underveis.',
    ],
  },
  {
    id: 'kneeRaises',
    name: 'Hanging knee raises',
    kind: 'reps',
    prompt: 'Maks reps',
    technique: [
      'Heng i strake armer uten sving.',
      'Løft knærne til minst hoftehøyde, og rull bekkenet litt opp.',
      'Senk beina kontrollert før neste rep.',
    ],
  },
];
