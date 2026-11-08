import assert from 'node:assert/strict';
import test from 'node:test';
import { assessmentDeletion } from '../js/assessment.js';

const old = { id: 'old', createdAt: '2026-09-01T10:00:00.000Z' };
const middle = { id: 'middle', createdAt: '2026-10-01T10:00:00.000Z' };
const latest = { id: 'latest', createdAt: '2026-11-01T10:00:00.000Z' };

test('sletter du den gjeldende, tar den nest siste over', () => {
  assert.deepEqual(assessmentDeletion([old, middle, latest], 'latest'), { affectsProgram: true, next: middle });
});

test('eldre kartlegginger påvirker ikke programmet', () => {
  assert.deepEqual(assessmentDeletion([old, middle, latest], 'old'), { affectsProgram: false, next: latest });
});

test('sletter du den eneste, finnes det ingen å bygge på', () => {
  assert.deepEqual(assessmentDeletion([latest], 'latest'), { affectsProgram: true, next: null });
});
