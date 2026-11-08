import assert from 'node:assert/strict';
import test from 'node:test';
import { TESTS } from '../js/data/assessment-tests.js';
import { FOCI, LADDERS } from '../js/data/exercises.js';
import {
  anchorValue,
  buildPlan,
  currentStep,
  defaultStep,
  estimateSeconds,
  formatTarget,
  lastFocusId,
  LENGTHS,
  nextFocusId,
  stepTarget,
} from '../js/program.js';

const ladder = (id) => LADDERS.find((item) => item.id === id);
const assessment = (results = {}, coreVariant = 'plank') => ({
  coreVariant,
  results: { pullups: 8, pushups: 20, deadHang: 45, core: 60, squats: 40, kneeRaises: 10, ...results },
});

const allFocusGroups = (focus) => new Set(focus.ladders.map((id) => ladder(id).group));

test('alle øvelser har gyldige data', () => {
  const testIds = new Set(TESTS.map((item) => item.id));
  const stepIds = LADDERS.flatMap((item) => item.steps.map((step) => step.id));
  assert.equal(new Set(stepIds).size, stepIds.length, 'trinn-id-er må være unike');
  for (const item of LADDERS) {
    assert.ok(testIds.has(item.anchor), item.id);
    assert.ok(item.steps.length >= 2, `${item.id} må ha en stige`);
    assert.equal(item.steps[0].minMax, 0, `${item.id} må ha et trinn som alle kan starte på`);
    item.steps.forEach((step, index) => {
      assert.ok(step.note, step.id);
      assert.ok((step.factor === undefined) !== (step.fixed === undefined), `${step.id} må ha factor eller fixed`);
      if (index > 0) assert.ok(step.minMax > item.steps[index - 1].minMax, `${step.id} må være sortert`);
    });
  }
});

test('hvert fokus peker på fem øvelser som finnes', () => {
  for (const focus of FOCI) {
    assert.equal(focus.ladders.length, 5, focus.id);
    assert.equal(new Set(focus.ladders).size, 5, focus.id);
    for (const id of focus.ladders) assert.ok(ladder(id), id);
  }
});

test('bare øvelser med stang, hoppetau, gulv og stol til dips', () => {
  const banned = /strikk|manual|kettlebell|ribbe|vektstang|\bbenk\b|\bkasse\b/i;
  for (const item of LADDERS) {
    for (const step of item.steps) {
      assert.doesNotMatch(`${step.name} ${step.note}`, banned, step.id);
      if (/\bstol/i.test(`${step.name} ${step.note}`)) assert.equal(item.id, 'dip', `${step.id} bruker stol`);
    }
  }
});

test('to fokus på rad deler aldri muskelgruppe, heller ikke over hele rotasjonen', () => {
  FOCI.forEach((focus, index) => {
    const next = FOCI[(index + 1) % FOCI.length];
    const shared = [...allFocusGroups(focus)].filter((group) => allFocusGroups(next).has(group));
    assert.deepEqual(shared, [], `${focus.id} → ${next.id}`);
  });
});

test('rotasjonen går i ring og starter med trekk', () => {
  assert.equal(nextFocusId(null), 'pull');
  assert.deepEqual(FOCI.map((focus) => nextFocusId(focus.id)), ['push', 'legs', 'core', 'mix', 'pull']);
});

test('rotasjonen bruker siste økt med loggede sett', () => {
  assert.equal(lastFocusId([]), null);
  assert.equal(
    lastFocusId([
      { focus: 'pull', status: 'done', loggedSets: 6, startedAt: '2026-11-01T10:00:00Z' },
      { focus: 'push', status: 'aborted', loggedSets: 1, startedAt: '2026-11-02T10:00:00Z' },
      { focus: 'legs', status: 'aborted', loggedSets: 0, startedAt: '2026-11-03T10:00:00Z' },
      { focus: 'core', status: 'active', loggedSets: 2, startedAt: '2026-11-04T10:00:00Z' },
    ]),
    'push',
  );
});

test('standardtrinn følger testresultatet', () => {
  assert.equal(defaultStep(ladder('pullup'), assessment({ pullups: 0 })).id, 'negative-pullup');
  assert.equal(defaultStep(ladder('pullup'), assessment({ pullups: 5 })).id, 'negative-pullup');
  assert.equal(defaultStep(ladder('pullup'), assessment({ pullups: 6 })).id, 'pullup');
  assert.equal(defaultStep(ladder('pullup'), assessment({ pullups: 25 })).id, 'archer-pullup');
  assert.equal(defaultStep(ladder('hanging-core'), assessment({ kneeRaises: 0 })).id, 'lying-knee-raise');
});

test('selvvalgt trinn går foran standardtrinnet', () => {
  assert.equal(currentStep(ladder('pullup'), assessment(), { stepId: 'tempo-pullup' }).id, 'tempo-pullup');
  assert.equal(currentStep(ladder('pullup'), assessment(), { stepId: 'finnes-ikke' }).id, 'pullup');
});

test('settmål er en andel av testmaks', () => {
  const pullup = ladder('pullup').steps[1];
  assert.equal(stepTarget(ladder('pullup'), pullup, assessment({ pullups: 10 }), 50), 5);
  assert.equal(stepTarget(ladder('pullup'), pullup, assessment({ pullups: 10 }), 70), 7);
});

test('settmål justeres og holdes innenfor grensene', () => {
  const squat = ladder('squat').steps[1];
  assert.equal(stepTarget(ladder('squat'), squat, assessment({ squats: 30 }), 60, 2), 20);
  assert.equal(stepTarget(ladder('squat'), squat, assessment({ squats: 200 }), 60), 30);
  const pullup = ladder('pullup').steps[1];
  assert.equal(stepTarget(ladder('pullup'), pullup, assessment({ pullups: 1 }), 50), 3);
});

test('holdetid rundes til nærmeste fem sekunder', () => {
  const hang = ladder('dead-hang').steps[0];
  assert.equal(stepTarget(ladder('dead-hang'), hang, assessment({ deadHang: 47 }), 60), 30);
  assert.equal(stepTarget(ladder('dead-hang'), hang, assessment({ deadHang: 0 }), 60), 10);
});

test('hollow-test gir høyere ankertall enn planketest', () => {
  assert.equal(anchorValue(ladder('plank-hold'), assessment({ core: 40 }, 'hollow')), 60);
  assert.equal(anchorValue(ladder('plank-hold'), assessment({ core: 40 }, 'plank')), 40);
});

test('resultatet 0 på alle tester gir en gjennomførbar økt', () => {
  const zero = assessment({ pullups: 0, pushups: 0, deadHang: 0, core: 0, squats: 0, kneeRaises: 0 });
  for (const focus of [null, ...FOCI.map((item) => item.id)]) {
    const plan = buildPlan({ assessment: zero, percentOfMax: 60, previousFocus: focus, length: 'medium' });
    for (const exercise of plan.exercises) {
      assert.ok(Number.isFinite(exercise.target) && exercise.target > 0, exercise.stepId);
    }
  }
});

test('øktlengden styrer antall øvelser og sett', () => {
  const plan = (length) => buildPlan({ assessment: assessment(), percentOfMax: 60, length });
  assert.deepEqual([plan('short').exercises.length, plan('short').exercises[0].sets, plan('short').warmupSeconds], [2, 2, 120]);
  assert.deepEqual([plan('medium').exercises.length, plan('medium').exercises[0].sets, plan('medium').warmupSeconds], [3, 3, 180]);
  assert.ok([4, 5].includes(plan('long').exercises.length));
});

test('anslått tid passer øktlengden for svake, middels og sterke utøvere', () => {
  const levels = [
    assessment({ pullups: 0, pushups: 3, deadHang: 15, core: 20, squats: 15, kneeRaises: 0 }),
    assessment(),
    assessment({ pullups: 20, pushups: 50, deadHang: 120, core: 180, squats: 60, kneeRaises: 25 }),
  ];
  const ranges = { short: [6, 13], medium: [14, 25], long: [22, 34] };
  for (const level of levels) {
    for (const previousFocus of [null, ...FOCI.map((focus) => focus.id)]) {
      for (const percentOfMax of [50, 60, 70]) {
        for (const [length, [low, high]] of Object.entries(ranges)) {
          const plan = buildPlan({ assessment: level, percentOfMax, previousFocus, length });
          const minutes = estimateSeconds(plan) / 60;
          assert.ok(minutes >= low && minutes <= high, `${length} ${plan.focus} ${percentOfMax}%: ${minutes.toFixed(1)} min`);
        }
      }
    }
  }
});

test('alle tre lengder er definert', () => assert.deepEqual(Object.keys(LENGTHS), ['short', 'medium', 'long']));

test('settmål vises med riktig enhet', () => {
  assert.equal(formatTarget({ kind: 'reps', target: 8, perSide: false }), '8 reps');
  assert.equal(formatTarget({ kind: 'reps', target: 8, perSide: true }), '8 per side');
  assert.equal(formatTarget({ kind: 'hold', target: 30, perSide: false }), '30 sek');
  assert.equal(formatTarget({ kind: 'hold', target: 30, perSide: true }), '30 sek per side');
});
