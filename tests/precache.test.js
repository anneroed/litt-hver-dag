import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

function filesIn(directory) {
  return readdirSync(join(root, directory), { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name !== '.DS_Store')
    .map((entry) => relative(root, join(entry.parentPath, entry.name)));
}

test('service workeren forhåndslagrer nøyaktig filene appen trenger offline', () => {
  const source = readFileSync(join(root, 'sw.js'), 'utf8');
  const list = source.match(/const PRECACHE = \[([\s\S]*?)\];/)[1];
  const precached = [...list.matchAll(/'([^']+)'/g)].map((match) => match[1]).filter((url) => url !== './');

  const expected = ['index.html', 'manifest.json', ...filesIn('css'), ...filesIn('js'), ...filesIn('icons')];
  assert.deepEqual([...precached].sort(), expected.sort());
});
