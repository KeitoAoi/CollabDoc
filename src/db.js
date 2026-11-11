import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

export const DEMO_USERS = [
  { id: 'ava', name: 'Ava Morgan', email: 'ava@collabdoc.demo', avatar: 'AM' },
  { id: 'sam', name: 'Sam Rivera', email: 'sam@collabdoc.demo', avatar: 'SR' },
  { id: 'jordan', name: 'Jordan Lee', email: 'jordan@collabdoc.demo', avatar: 'JL' }
];
export function createStore(dbPath = process.env.DB_PATH || './data/collabdoc.sqlite') {
  if (dbPath !== ':memory:') mkdirSync(dirname(resolve(dbPath)), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, avatar TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, content TEXT NOT NULL,
      owner_id TEXT NOT NULL REFERENCES users(id), version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS document_shares (
      document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id), permission TEXT NOT NULL DEFAULT 'editor',
      PRIMARY KEY (document_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_doc_owner ON documents(owner_id);
    CREATE INDEX IF NOT EXISTS idx_shares_user ON document_shares(user_id);
  `);
  const insertUser = db.prepare('INSERT OR IGNORE INTO users (id,name,email,avatar) VALUES (?,?,?,?)');
  for (const user of DEMO_USERS) insertUser.run(user.id, user.name, user.email, user.avatar);

  const getUser = id => db.prepare('SELECT id,name,email,avatar FROM users WHERE id=?').get(id);
  const readRaw = id => db.prepare(`SELECT d.*, u.name AS owner_name FROM documents d JOIN users u ON u.id=d.owner_id WHERE d.id=?`).get(id);
  const access = (id, userId) => {
    const doc = readRaw(id);
    if (!doc) return { error: 'not_found' };
    const isOwner = doc.owner_id === userId;
    const share = isOwner ? null : db.prepare('SELECT permission FROM document_shares WHERE document_id=? AND user_id=?').get(id, userId);
    if (!isOwner && !share) return { error: 'forbidden' };
    return { doc, role: isOwner ? 'owner' : share.permission };
  };
  const shares = id => db.prepare(`SELECT u.id,u.name,u.email,u.avatar,s.permission FROM document_shares s JOIN users u ON u.id=s.user_id WHERE s.document_id=? ORDER BY u.name`).all(id);
  const decode = (doc, role) => ({
    id: doc.id, title: doc.title, content: JSON.parse(doc.content), ownerId: doc.owner_id,
    ownerName: doc.owner_name, role, version: doc.version,
    createdAt: doc.created_at, updatedAt: doc.updated_at,
    shares: shares(doc.id)
  });
  return {
    close: () => db.close(),
    getUser,
    list(userId) {
      const owned = db.prepare(`SELECT d.*, u.name AS owner_name FROM documents d JOIN users u ON u.id=d.owner_id WHERE d.owner_id=? ORDER BY d.updated_at DESC`).all(userId);
      const shared = db.prepare(`SELECT d.*, u.name AS owner_name FROM documents d JOIN users u ON u.id=d.owner_id JOIN document_shares s ON d.id=s.document_id WHERE s.user_id=? ORDER BY d.updated_at DESC`).all(userId);
      const listItem = (d, role) => ({ id: d.id, title: d.title, ownerId: d.owner_id, ownerName: d.owner_name, role, updatedAt: d.updated_at, version: d.version });
      return { owned: owned.map(d => listItem(d, 'owner')), shared: shared.map(d => listItem(d, 'editor')) };
    },
    get(id, userId) {
      const result = access(id, userId);
      if (result.error) return result;
      return { document: decode(result.doc, result.role) };
    },
    create(userId, title, content) {
      const id = randomUUID();
      const now = new Date().toISOString();
      db.prepare('INSERT INTO documents (id,title,content,owner_id,created_at,updated_at) VALUES (?,?,?,?,?,?)').run(id, title, JSON.stringify(content), userId, now, now);
      return this.get(id, userId).document;
    },
    update(id, userId, { title, content, expectedVersion }) {
      const result = access(id, userId);
      if (result.error) return result;
      const current = result.doc;
      if (expectedVersion !== current.version) return { error: 'conflict', currentVersion: current.version };
      const now = new Date().toISOString();
      const updated = db.prepare(`UPDATE documents SET title=?,content=?,updated_at=?,version=version+1 WHERE id=? AND version=?`)
        .run(title ?? current.title, content === undefined ? current.content : JSON.stringify(content), now, id, expectedVersion);
      if (updated.changes !== 1) return { error: 'conflict' };
      return this.get(id, userId);
    },
    remove(id, userId) {
      const result = access(id, userId);
      if (result.error) return result;
      if (result.role !== 'owner') return { error: 'forbidden' };
      db.prepare('DELETE FROM documents WHERE id=?').run(id);
      return { ok: true };
    },
    share(id, ownerId, targetId) {
      const result = access(id, ownerId);
      if (result.error) return result;
      if (result.role !== 'owner') return { error: 'forbidden' };
      if (!getUser(targetId) || targetId === ownerId) return { error: 'invalid_user' };
      db.prepare('INSERT OR IGNORE INTO document_shares (document_id,user_id,permission) VALUES (?,?,?)').run(id, targetId, 'editor');
      return { shares: shares(id) };
    },
    revoke(id, ownerId, targetId) {
      const result = access(id, ownerId);
      if (result.error) return result;
      if (result.role !== 'owner') return { error: 'forbidden' };
      db.prepare('DELETE FROM document_shares WHERE document_id=? AND user_id=?').run(id, targetId);
      return { shares: shares(id) };
    }
  };
}
