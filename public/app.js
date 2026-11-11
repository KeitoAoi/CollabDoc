// Client UI is deliberately dependency-free. Content is stored as an allowlisted JSON tree,
// never as persisted HTML. The browser's native editing commands are an intentional MVP trade-off.
const $ = (selector, root = document) => root.querySelector(selector);
const app = $('#app');
const icons = {
  doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h7"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4m-5 5 5-5 5 5M4 16v4h16v-4"/></svg>',
  share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.8 10.7 6.4-4.4m-6.4 7 6.4 4.4"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m15 18-6-6 6-6"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="m4 12 5 5L20 6"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 7h16M10 7V4h4v3m-8 0 1 13h10l1-13"/></svg',
  arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5 12h14m-6-6 6 6-6 6"/></svg',
  users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M17 6a3 3 0 0 1 0 6m1 3a5 5 0 0 1 3 5"/></svg'
};
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dateLabel = iso => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: new Date(iso).getFullYear() === new Date().getFullYear() ? undefined : 'numeric' }).format(new Date(iso));
const state = { session: null, document: null, saveTimer: null, saving: false, dirty: false, failure: false, currentTab: 'owned', search: '' };
let toastTimer;
function toast(message, isError = false) {
  const root = $('#toast');
  root.textContent = message;
  root.className = `visible ${isError ? 'error' : ''}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => root.className = '', 3200);
}
async function request(path, options = {}) {
  const response = await fetch(path, { credentials: 'same-origin', ...options, headers: { ...(options.body ? { 'content-type': 'application/json' } : {}), ...(options.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) { const err = new Error(data.error || `HTTP ${response.status}`); err.status = response.status; throw err; }
  return data;
}
const post = (url, data) => request(url, { method: 'POST', body: JSON.stringify(data) });
const patch = (url, data) => request(url, { method: 'PATCH', body: JSON.stringify(data) });
const del = url => request(url, { method: 'DELETE' });
function navigate(path) { history.pushState({}, '', path); void renderRoute(); }
function header() {
  const current = state.session?.currentUser;
  return `<header class="topbar">
    <button class="brand" id="brand" aria-label="Go to documents"><span class="brand-mark">${icons.doc}</span><span>collab<span class="brand-accent">doc</span></span></button>
    <span class="topbar-divider"></span><span class="topbar-sub">Workspace</span>
    <div class="topbar-right"><span class="demo-label">DEMO MODE</span>
      <div class="switch-wrap"><label class="sr-only" for="userSelect">Switch demo user</label>
        <span class="avatar small">${escapeHtml(current?.avatar || 'AM')}</span>
        <select id="userSelect" class="user-select" aria-label="Active demo user">${(state.session?.users || []).map(u => `<option value="${escapeHtml(u.id)}" ${u.id === current?.id ? 'selected' : ''}>${escapeHtml(u.name)}</option>`).join('')}</select>
        <span class="chevron">⌄</span>
      </div>
    </div>
  </header>`;
}
function shell(content, section = 'Documents') {
  return `${header()}<div class="layout">
    <aside class="sidebar">
      <div class="sidebar-caption">YOUR WORKSPACE</div>
      <button class="side-item active" id="sideHome">${icons.doc}<span>Documents</span></button>
      <div class="sidebar-bottom"><div class="tiny-badge">✦</div><div><strong>Made for focused work</strong><p>Write, save and share in one simple space.</p></div></div>
    </aside>
    <main class="main-content">${content}</main>
  </div>`;
}
function bindChrome() {
  $('#brand')?.addEventListener('click', () => void goHome());
  $('#sideHome')?.addEventListener('click', () => void goHome());
  $('#userSelect')?.addEventListener('change', async e => {
    const select = e.currentTarget;
    try {
      if (state.document && state.dirty && !await saveNow()) { select.value = state.session.currentUser.id; return; }
      await post('/api/session', { userId: select.value });
      state.document = null;
      state.session = await request('/api/session');
      history.pushState({}, '', '/');
      state.currentTab = 'owned';
      await renderRoute();
      toast(`Switched to ${state.session.currentUser.name}`);
    } catch (err) { select.value = state.session.currentUser.id; toast(err.message, true); }
  });
}
async function goHome() { if (state.document && state.dirty && !await saveNow()) return; state.document = null; navigate('/'); }
function emptyState(shared) {
  return `<div class="empty-state"><div class="empty-icon">${shared ? icons.users : icons.doc}</div>
    <h3>${shared ? 'Nothing shared with you yet' : 'Your next idea starts here'}</h3>
    <p>${shared ? 'Switch to another demo user and share a document to see it here.' : 'Create your first document or import an existing file.'}</p>
    ${shared ? '' : '<button class="btn primary" id="emptyCreate">+ New document</button>'}
  </div>`;
}
function docCard(doc) {
  return `<button class="doc-card" data-open="${escapeHtml(doc.id)}" aria-label="Open ${escapeHtml(doc.title)}">
    <div class="card-icon">${icons.doc}</div>
    <div class="card-text"><div class="card-title">${escapeHtml(doc.title)}</div><div class="card-meta">${doc.role === 'owner' ? 'You own this' : `Shared by ${escapeHtml(doc.ownerName)}`}<span class="meta-dot">·</span>${dateLabel(doc.updatedAt)}</div></div>
    <span class="card-arrow">${icons.arrow}</span>
  </button>`;
}
function drawDocList(data) {
  const list = (state.currentTab === 'owned' ? data.owned : data.shared).filter(d => d.title.toLowerCase().includes(state.search.toLowerCase()));
  const wrap = $('#documentList');
  if (!wrap) return;
  wrap.innerHTML = list.length ? `<div class="doc-grid">${list.map(docCard).join('')}</div>` : state.search ? '<div class="search-empty">No documents match your search.</div>' : emptyState(state.currentTab === 'shared');
  $$('[data-open]', wrap).forEach(b => b.addEventListener('click', () => navigate(`/documents/${b.dataset.open}`)));
  $('#emptyCreate')?.addEventListener('click', createNew);
}
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
async function renderDashboard() {
  state.document = null;
  app.innerHTML = shell(`<div class="dash-wrap">
    <div class="eyebrow">YOUR SPACE TO CREATE</div>
    <div class="dashboard-head"><div><h1>Good to see you<span class="heading-period">.</span></h1><p class="lead">Everything you're working on, in one place.</p></div>
      <div class="head-actions"><button class="btn secondary" id="importBtn">${icons.upload} Import file</button><button class="btn primary" id="newBtn">${icons.plus} New document</button></div>
    </div>
    <div class="panel"><div class="panel-head"><div class="tab-group"><button class="tab ${state.currentTab === 'owned' ? 'selected' : ''}" data-tab="owned">My documents <span id="ownedCount" class="count">…</span></button><button class="tab ${state.currentTab === 'shared' ? 'selected' : ''}" data-tab="shared">Shared with me <span id="sharedCount" class="count">…</span></button></div>
      <div class="search-box">${icons.search}<label class="sr-only" for="searchDocs">Search documents</label><input type="search" id="searchDocs" placeholder="Search documents" value="${escapeHtml(state.search)}" /></div>
    </div><div id="documentList"><div class="loading">Loading your documents…</div></div></div>
    <p class="footer-note"><span>●</span> Your documents are saved automatically. Switch demo users to test sharing.</p>
    <input type="file" id="fileInput" accept=".txt,.md,text/plain,text/markdown" hidden />
  </div>`);
  bindChrome();
  $('#newBtn').addEventListener('click', createNew);
  $('#importBtn').addEventListener('click', () => $('#fileInput').click());
  $('#fileInput').addEventListener('change', handleImport);
  $('#searchDocs').addEventListener('input', e => { state.search = e.target.value; if (state.list) drawDocList(state.list); });
  try {
    const data = await request('/api/documents');
    state.list = data;
    $('#ownedCount').textContent = data.owned.length;
    $('#sharedCount').textContent = data.shared.length;
    $$('[data-tab]').forEach(tab => tab.addEventListener('click', () => {
      state.currentTab = tab.dataset.tab;
      $$('[data-tab]').forEach(el => el.classList.toggle('selected', el.dataset.tab === state.currentTab));
      drawDocList(data);
    }));
    drawDocList(data);
  } catch (err) { $('#documentList').innerHTML = `<div class="alert error-alert">${escapeHtml(err.message)}</div>`; }
}
async function createNew() {
  try { const data = await post('/api/documents', { title: 'Untitled document' }); navigate(`/documents/${data.document.id}`); }
  catch (err) { toast(err.message, true); }
}
async function handleImport(e) {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  if (!/\.(txt|md)$/i.test(file.name)) return toast('Use a .txt or .md file', true);
  if (file.size > 2 * 1024 * 1024) return toast('Maximum file size is 2 MB', true);
  try {
    const content = await file.text();
    const data = await post('/api/import', { filename: file.name, content });
    toast('File imported successfully');
    navigate(`/documents/${data.document.id}`);
  } catch (err) { toast(err.message, true); }
}

// Structured document JSON <=> contenteditable DOM. No unsanitized persisted HTML.
function renderInline(parent, nodes) {
  for (const entry of nodes || []) {
    let inner = document.createTextNode(entry.text || '');
    for (const mark of entry.marks || []) {
      const span = document.createElement(mark === 'bold' ? 'strong' : mark === 'italic' ? 'em' : 'u');
      span.append(inner); inner = span;
    }
    parent.append(inner);
  }
}
function renderContent(content) {
  const editor = $('#editor');
  editor.replaceChildren();
  for (const block of content.content || []) {
    let tag = 'p';
    if (block.type === 'heading') tag = `h${block.level}`;
    if (block.type === 'bulletList') tag = 'ul';
    if (block.type === 'orderedList') tag = 'ol';
    const element = document.createElement(tag);
    if (block.type === 'bulletList' || block.type === 'orderedList') {
      for (const item of block.content || []) { const li = document.createElement('li'); renderInline(li, item.content); element.append(li); }
    } else renderInline(element, block.content);
    editor.append(element);
  }
  if (!editor.childNodes.length) editor.append(document.createElement('p'));
}
function inlineContent(root, existingMarks = []) {
  const result = [];
  const push = (text, marks) => {
    if (!text) return;
    const last = result[result.length - 1];
    if (last && JSON.stringify(last.marks || []) === JSON.stringify(marks)) { last.text += text; return; }
    result.push({ type: 'text', text, ...(marks.length ? { marks } : {}) });
  };
  const walk = (node, marks) => {
    if (node.nodeType === Node.TEXT_NODE) { push(node.nodeValue || '', marks); return; }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const tag = node.tagName.toLowerCase();
    const next = new Set(marks);
    if (['strong', 'b'].includes(tag)) next.add('bold');
    if (['em', 'i'].includes(tag)) next.add('italic');
    if (tag === 'u') next.add('underline');
    if (tag === 'span') {
      const style = node.style;
      if (style.fontWeight === 'bold' || Number.parseInt(style.fontWeight) >= 600) next.add('bold');
      if (style.fontStyle === 'italic') next.add('italic');
      if (style.textDecoration.includes('underline')) next.add('underline');
    }
    if (tag === 'br') { push('\n', [...next].sort()); return; }
    for (const child of node.childNodes) walk(child, [...next].sort());
  };
  for (const node of root.childNodes) walk(node, existingMarks);
  return result;
}
function collectContent() {
  const root = $('#editor');
  const blocks = [];
  let stray = [];
  const flush = () => { if (stray.length) { blocks.push({ type: 'paragraph', content: inlineContent({ childNodes: stray }) }); stray = []; } };
  for (const node of root.childNodes) {
    if (node.nodeType !== Node.ELEMENT_NODE) { stray.push(node); continue; }
    const tag = node.tagName.toLowerCase();
    if (['p', 'div', 'h1', 'h2', 'ul', 'ol'].includes(tag)) {
      flush();
      if (tag === 'ul' || tag === 'ol') {
        const items = [...node.children].filter(n => n.tagName.toLowerCase() === 'li').map(li => ({ type: 'listItem', content: inlineContent(li) }));
        blocks.push({ type: tag === 'ul' ? 'bulletList' : 'orderedList', content: items });
      } else if (tag === 'h1' || tag === 'h2') blocks.push({ type: 'heading', level: tag === 'h1' ? 1 : 2, content: inlineContent(node) });
      else blocks.push({ type: 'paragraph', content: inlineContent(node) });
    } else stray.push(node);
  }
  flush();
  return { type: 'doc', content: blocks.length ? blocks : [{ type: 'paragraph', content: [] }] };
}
function setSaveStatus(label, kind = '') {
  const el = $('#saveStatus');
  if (!el) return;
  el.className = `save-status ${kind}`;
  el.innerHTML = (kind === 'saved' ? icons.check : kind === 'error' ? '!' : '<span class="status-dot"></span>') + `<span>${escapeHtml(label)}</span>`;
}
function onChanged() {
  state.dirty = true;
  state.failure = false;
  setSaveStatus('Unsaved changes');
  clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(() => void saveNow(), 750);
}
async function saveNow() {
  clearTimeout(state.saveTimer);
  if (!state.document) return true;
  if (state.saving) return true; // In-flight save will schedule another if needed.
  if (!state.dirty) return !state.failure;
  const doc = state.document;
  const title = $('#docTitle')?.value.trim() || 'Untitled document';
  const content = collectContent();
  const snapshot = JSON.stringify({ title, content });
  state.saving = true;
  state.dirty = false;
  setSaveStatus('Saving…');
  try {
    const result = await patch(`/api/documents/${doc.id}`, { title, content, expectedVersion: doc.version });
    doc.version = result.document.version;
    doc.title = result.document.title;
    doc.content = result.document.content;
    if (!state.document || state.document.id !== doc.id) return true;
    if (snapshot !== JSON.stringify({ title: $('#docTitle')?.value.trim() || 'Untitled document', content: collectContent() })) state.dirty = true;
    state.failure = false;
    setSaveStatus(state.dirty ? 'Unsaved changes' : 'All changes saved', state.dirty ? '' : 'saved');
    return true;
  } catch (err) {
    state.dirty = true;
    state.failure = true;
    setSaveStatus(err.status === 409 ? 'Conflict — reload to resolve' : 'Save failed — click to retry', 'error');
    toast(err.message, true);
    return false;
  } finally {
    state.saving = false;
    if (state.dirty && !state.failure) { clearTimeout(state.saveTimer); state.saveTimer = setTimeout(() => void saveNow(), 350); }
  }
}
function toolbar() {
  const items = [
    ['bold', '<b>B</b>', 'Bold (Ctrl+B)'],
    ['italic', '<i>I</i>', 'Italic (Ctrl+I)'],
    ['underline', '<u>U</u>', 'Underline (Ctrl+U)'],
    ['sep', '', ''],
    ['paragraph', 'Normal', 'Normal text'],
    ['h1', 'H1', 'Heading 1'], ['h2', 'H2', 'Heading 2'],
    ['sep', '', ''],
    ['bullet', '☷', 'Bullet list'], ['number', '1.', 'Numbered list']
  ];
  return items.map(([action, label, hint]) => action === 'sep' ? '<span class="toolbar-sep"></span>' : `<button type="button" data-format="${action}" class="format-btn ${action === 'paragraph' ? 'wide' : ''}" title="${hint}" aria-label="${hint}">${label}</button>`).join('');
}
async function renderEditor(id) {
  state.document = null;
  app.innerHTML = shell('<div class="loading page-loading">Opening document…</div>');
  bindChrome();
  try {
    const { document: doc } = await request(`/api/documents/${id}`);
    state.document = doc;
    state.dirty = false; state.failure = false; state.saving = false;
    app.innerHTML = shell(`<div class="editor-wrap">
      <div class="editor-topline"><button class="back-link" id="backBtn">${icons.back} All documents</button><span class="doc-role ${doc.role === 'owner' ? 'owner-role' : ''}">${doc.role === 'owner' ? 'Owner' : 'Shared with you'}</span></div>
      <div class="editor-heading"><div class="title-stack"><label for="docTitle" class="sr-only">Document title</label><input id="docTitle" maxlength="120" value="${escapeHtml(doc.title)}" spellcheck="false" />
        <div class="doc-subtitle">${doc.role === 'owner' ? 'Only you can manage sharing' : `Shared by ${escapeHtml(doc.ownerName)}`} <span>·</span> Edited ${dateLabel(doc.updatedAt)}</div></div>
        <div class="editor-actions"><button class="btn tertiary" id="deleteBtn" title="Delete document" ${doc.role !== 'owner' ? 'hidden' : ''}>${icons.trash}</button><button class="btn secondary share-button" id="shareBtn">${icons.share} ${doc.role === 'owner' ? 'Share' : 'People'}</button></div>
      </div>
      <div class="editor-frame"><div class="toolbar" role="toolbar" aria-label="Text formatting">${toolbar()}</div>
        <div class="page-scroll"><div class="paper"><div class="editing-area" id="editor" contenteditable="true" role="textbox" aria-label="Document editor" aria-multiline="true" spellcheck="true" data-placeholder="Start writing something amazing…"></div></div></div>
        <div class="editor-footer"><span id="saveStatus" class="save-status saved">${icons.check}<span>All changes saved</span></span><span id="wordCount">0 words</span></div>
      </div>
      <dialog id="shareDialog" class="share-dialog" aria-labelledby="shareTitle"><div class="dialog-head"><div><div class="dialog-eyebrow">COLLABORATION</div><h2 id="shareTitle">Share document</h2></div><button type="button" class="close-btn" id="closeShare" aria-label="Close dialog">×</button></div>
        <p class="dialog-info">Give another demo user access to read and edit this document.</p><div id="shareContents"></div>
      </dialog>
    </div>`);
    bindChrome();
    renderContent(doc.content);
    updateWordCount();
    $('#docTitle').addEventListener('input', onChanged);
    $('#docTitle').addEventListener('blur', () => { if (!$('#docTitle').value.trim()) { $('#docTitle').value = 'Untitled document'; onChanged(); } });
    $('#editor').addEventListener('input', () => { onChanged(); updateWordCount(); });
    $('#editor').addEventListener('blur', () => { if (state.dirty) void saveNow(); });
    $('#backBtn').addEventListener('click', () => void goHome());
    $('#shareBtn').addEventListener('click', openShare);
    $('#closeShare').addEventListener('click', () => $('#shareDialog').close());
    $('#deleteBtn')?.addEventListener('click', async () => {
      if (!confirm(`Delete “${doc.title}”? This cannot be undone.`)) return;
      try { await del(`/api/documents/${doc.id}`); state.document = null; toast('Document deleted'); navigate('/'); }
      catch (err) { toast(err.message, true); }
    });
    $('#saveStatus').addEventListener('click', () => { if (state.failure) void saveNow(); });
    $$('.format-btn').forEach(btn => {
      btn.addEventListener('mousedown', e => e.preventDefault());
      btn.addEventListener('click', () => {
        $('#editor').focus();
        const type = btn.dataset.format;
        if (['bold', 'italic', 'underline'].includes(type)) document.execCommand(type);
        if (type === 'paragraph') document.execCommand('formatBlock', false, 'p');
        if (type === 'h1') document.execCommand('formatBlock', false, 'h1');
        if (type === 'h2') document.execCommand('formatBlock', false, 'h2');
        if (type === 'bullet') document.execCommand('insertUnorderedList');
        if (type === 'number') document.execCommand('insertOrderedList');
        onChanged(); updateWordCount();
      });
    });
  } catch (err) {
    state.document = null;
    $('.main-content').innerHTML = `<div class="not-found"><h2>Cannot open document</h2><p>${escapeHtml(err.message)}</p><button class="btn primary" id="goBackError">Back to documents</button></div>`;
    $('#goBackError').addEventListener('click', () => navigate('/'));
  }
}
function updateWordCount() {
  const value = $('#editor')?.innerText?.trim() || '';
  const words = value ? value.split(/\s+/).length : 0;
  const target = $('#wordCount'); if (target) target.textContent = `${words} ${words === 1 ? 'word' : 'words'}`;
}
function openShare() {
  const doc = state.document;
  if (!doc) return;
  const owner = doc.role === 'owner';
  const members = doc.shares || [];
  const available = state.session.users.filter(u => u.id !== doc.ownerId && !members.some(m => m.id === u.id));
  $('#shareContents').innerHTML = `
    ${owner ? `<form id="inviteForm" class="invite-form"><label class="form-label" for="inviteUser">Invite a teammate</label><div class="invite-row"><select id="inviteUser" ${available.length ? '' : 'disabled'}>${available.map(u => `<option value="${escapeHtml(u.id)}">${escapeHtml(u.name)}</option>`).join('')}</select><button class="btn primary" ${available.length ? '' : 'disabled'} type="submit">Grant access</button></div></form>` : ''}
    <div class="form-label people-label">People with access</div><div class="member-row"><div class="avatar">${escapeHtml(state.session.users.find(u => u.id === doc.ownerId)?.avatar || 'OW')}</div><div class="member-info"><strong>${escapeHtml(doc.ownerName)}</strong><span>Document owner</span></div><span class="role-text">Owner</span></div>
    ${members.map(u => `<div class="member-row"><div class="avatar alt">${escapeHtml(u.avatar)}</div><div class="member-info"><strong>${escapeHtml(u.name)}</strong><span>${escapeHtml(u.email)}</span></div>${owner ? `<button class="remove-share" data-revoke="${escapeHtml(u.id)}" title="Remove access">Remove</button>` : '<span class="role-text">Editor</span>'}</div>`).join('')}
    <div class="dialog-note">${owner ? 'People you invite can edit this document. Only you can manage access.' : 'You can edit this document. Only its owner can manage access.'}</div>`;
  $('#shareDialog').showModal();
  $('#inviteForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const userId = $('#inviteUser').value;
    try { const result = await post(`/api/documents/${doc.id}/share`, { userId }); doc.shares = result.shares; $('#shareDialog').close(); openShare(); toast('Access granted'); }
    catch (err) { toast(err.message, true); }
  });
  $$('[data-revoke]').forEach(button => button.addEventListener('click', async () => {
    try { const result = await del(`/api/documents/${doc.id}/share/${button.dataset.revoke}`); doc.shares = result.shares; $('#shareDialog').close(); openShare(); toast('Access removed'); }
    catch (err) { toast(err.message, true); }
  }));
}
async function renderRoute() {
  clearTimeout(state.saveTimer);
  const match = location.pathname.match(/^\/documents\/([a-f0-9-]{36})$/i);
  if (!state.session) {
    try { state.session = await request('/api/session'); }
    catch (err) { app.innerHTML = `<div class="boot">Unable to connect: ${escapeHtml(err.message)}</div>`; return; }
  }
  if (match) await renderEditor(match[1]);
  else await renderDashboard();
}
window.addEventListener('popstate', () => void renderRoute());
window.addEventListener('beforeunload', e => { if (state.dirty) { e.preventDefault(); e.returnValue = ''; } });
void renderRoute();
