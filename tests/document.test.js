import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyDocument, importTextFile, validDocument } from '../src/document.js';

test('Markdown import preserves headings, lists and emphasis in structured JSON', () => {
  const result = importTextFile('Planning.md', '# Weekly planning\n- **Review** priorities\n- Build MVP\n\nA *small* note');
  assert.equal(result.title, 'Planning');
  assert.equal(result.content.content[0].type, 'heading');
  assert.equal(result.content.content[1].type, 'bulletList');
  assert.deepEqual(result.content.content[1].content[0].content[0].marks, ['bold']);
  assert.deepEqual(result.content.content.at(-1).content[1].marks, ['italic']);
  assert.equal(validDocument(result.content), true);
});

test('Document validation rejects unrecognized nodes and malicious markup-as-nodes', () => {
  assert.equal(validDocument(emptyDocument()), true);
  assert.equal(validDocument({ type: 'doc', content: [{ type: 'script', content: [] }] }), false);
  assert.equal(validDocument({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x', marks: ['onclick'] }] }] }), false);
});

test('Import rejects unsupported files and over-limit files', () => {
  assert.throws(() => importTextFile('notes.docx', 'hello'), /Only/);
  assert.throws(() => importTextFile('big.txt', 'x'.repeat(2 * 1024 * 1024 + 1)), /2 MB/);
});
