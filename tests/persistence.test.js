import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStore } from '../src/db.js';
import { emptyDocument } from '../src/document.js';

test('SQLite data survives closing and reopening the database file', () => {
  const folder = mkdtempSync(join(tmpdir(), 'collabdoc-test-'));
  const path = join(folder, 'test.sqlite');
  try {
    let store = createStore(path);
    const doc = store.create('ava', 'Persisted document', emptyDocument());
    store.share(doc.id, 'ava', 'sam');
    store.close();
    store = createStore(path);
    assert.equal(store.get(doc.id, 'ava').document.title, 'Persisted document');
    assert.equal(store.get(doc.id, 'sam').document.role, 'editor');
    store.close();
  } finally { rmSync(folder, { recursive: true, force: true }); }
});
