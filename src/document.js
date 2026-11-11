/** A deliberately tiny, structured rich-text format. No persisted HTML. */
export const emptyDocument = () => ({ type: 'doc', content: [{ type: 'paragraph', content: [] }] });
export const ALLOWED_BLOCKS = new Set(['paragraph', 'heading', 'bulletList', 'orderedList', 'listItem']);
export const ALLOWED_MARKS = new Set(['bold', 'italic', 'underline']);

function validInline(node, depth = 0) {
  if (depth > 12 || !node || typeof node !== 'object' || Array.isArray(node)) return false;
  if (node.type !== 'text' || typeof node.text !== 'string' || node.text.length > 2_097_152) return false;
  return node.marks === undefined || (Array.isArray(node.marks) && node.marks.length <= 3 && node.marks.every(m => ALLOWED_MARKS.has(m)));
}
function validBlock(block, depth = 0) {
  if (depth > 12 || !block || typeof block !== 'object' || Array.isArray(block) || !ALLOWED_BLOCKS.has(block.type)) return false;
  if (!Array.isArray(block.content) || block.content.length > 2000) return false;
  if (block.type === 'heading' && ![1, 2].includes(block.level)) return false;
  if (block.type === 'bulletList' || block.type === 'orderedList') return block.content.every(n => n && n.type === 'listItem' && validBlock(n, depth + 1));
  if (block.type === 'listItem') return block.content.every(n => validInline(n, depth + 1));
  return block.content.every(n => validInline(n, depth + 1));
}
export function validDocument(doc) {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc) || doc.type !== 'doc' || !Array.isArray(doc.content) || doc.content.length > 2000) return false;
  try { if (JSON.stringify(doc).length > 3_000_000) return false; } catch { return false; }
  return doc.content.every(b => validBlock(b));
}

const textNode = (text, marks = []) => ({ type: 'text', text, ...(marks.length ? { marks } : {}) });
function inlineFromMarkdown(text) {
  // Intentionally supports common emphasis only; not a full Markdown specification.
  const nodes = [];
  const pattern = /(\*\*([^*]+)\*\*|__([^_]+)__|\*([^*]+)\*|_([^_]+)_)/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const at = match.index ?? 0;
    if (at > last) nodes.push(textNode(text.slice(last, at)));
    nodes.push(textNode(match[2] || match[3] || match[4] || match[5], [match[2] || match[3] ? 'bold' : 'italic']));
    last = at + match[0].length;
  }
  if (last < text.length) nodes.push(textNode(text.slice(last)));
  return nodes;
}
export function importTextFile(filename, source) {
  if (typeof filename !== 'string' || typeof source !== 'string') throw new Error('Invalid file');
  const extension = filename.toLowerCase().split('.').pop();
  if (!['txt', 'md'].includes(extension)) throw new Error('Only .txt and .md files are supported');
  if (Buffer.byteLength(source, 'utf8') > 2 * 1024 * 1024) throw new Error('File must be 2 MB or smaller');
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const content = [];
  let list = null;
  const flush = () => { if (list) content.push(list); list = null; };
  for (const raw of lines) {
    if (content.length > 1800) throw new Error('File has too many blocks');
    if (extension === 'md') {
      const heading = raw.match(/^(#{1,2})\s+(.+)$/);
      if (heading) { flush(); content.push({ type: 'heading', level: heading[1].length, content: inlineFromMarkdown(heading[2]) }); continue; }
      const bulleted = raw.match(/^\s*[-*+]\s+(.+)$/);
      const numbered = raw.match(/^\s*\d+[.)]\s+(.+)$/);
      if (bulleted || numbered) {
        const kind = bulleted ? 'bulletList' : 'orderedList';
        if (list?.type !== kind) { flush(); list = { type: kind, content: [] }; }
        list.content.push({ type: 'listItem', content: inlineFromMarkdown((bulleted || numbered)[1]) });
        continue;
      }
    }
    flush();
    content.push({ type: 'paragraph', content: extension === 'md' ? inlineFromMarkdown(raw) : (raw ? [textNode(raw)] : []) });
  }
  flush();
  return { title: filename.replace(/\.(txt|md)$/i, '').slice(0, 120) || 'Imported document', content: { type: 'doc', content: content.length ? content : [{ type: 'paragraph', content: [] }] } };
}
