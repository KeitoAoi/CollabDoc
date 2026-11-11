# Architecture & product decisions

## Product goal

Deliver a credible end-to-end document lifecycle with **creation → formatting → saving/reopening → import → ownership/sharing**. The core product decision was to make these flows work reliably without a login/setup ceremony or a large dependency tree.

## Implementation

```text
Browser (static HTML/CSS/JavaScript)
   |  fetch JSON + per-browser demo-user cookie
   v
Node.js HTTP API (src/server.js)
   |  input validation + permissions on each operation
   v
SQLite (src/db.js, native node:sqlite)
   |  users, documents, document_shares
   v
Persistent database file in data/collabdoc.sqlite
```

- **Document content:** JSON tree containing paragraphs, headings, bullet/number lists, text and bold/italic/underline marks. Text nodes become DOM text nodes, so the application never has to inject saved rich text as raw HTML. The server independently validates node types and mark types on writes.
- **Persistence:** SQLite with foreign keys, WAL mode, an index on ownership and shares, and timestamps. SQLite is ideal for a single-node demo with no provisioning. A multi-instance deployment should move to a managed shared database.
- **Sharing:** `document_shares` has a composite `(document_id, user_id)` primary key. Access is granted by explicit share or owner ID. All reads, writes, and membership changes are checked **on the server**. Owner-only operations: share, revoke and delete. Editor operations: read, edit content and rename.
- **Demo identity:** A top-right switcher selects a seeded account; the API maps the chosen cookie to a seeded user. This proves the authorization decision path, but is **not real authentication**; a public production service needs verified sign-in and a server-trusted session.
- **Autosave:** A 750 ms debounce PATCHes structured content. The editor exposes saved/unsaved/failure states. A numeric document version enforces optimistic concurrency: on stale data, the server rejects writes with HTTP 409 instead of silently overwriting a different saved version. User resolution is manual (reload).
- **Import:** The browser reads `.txt`/`.md`, POSTs the file contents as JSON, and the server independently checks extension, size and content before creating a document. Plain text is split into paragraphs; Markdown handles common headings, lists, and bold/italic. No remote storage is required because imports become regular editable documents.

## Deliberate scope cuts

1. **No simultaneous real-time co-editing.** Presence, cursor sharing, network reconnection and CRDT/OT conflict resolution are substantial additional systems. Sequential edits and explicit 409 conflict handling demonstrate shared access more reliably in this timebox.
2. **No production auth/invitations.** Seeded demo identities let a reviewer demonstrate both sides of a share in seconds. The switcher makes the security limitation explicit.
3. **No DOCX, comments, search indexing, or version history.** Common text/Markdown import and in-memory filtering cover the core requirement with less operational risk.
4. **No editor framework dependency.** The native `contenteditable` surface and a small JSON serializer allow an immediately runnable project with no package downloads. This trades off selection/paste fidelity and advanced editing behavior; TipTap/ProseMirror would be the first upgrade for a larger writing product.

## API summary

| Method | Route | Purpose |
|---|---|---|
| GET / POST | `/api/session` | Current demo identity / change identity |
| GET / POST | `/api/documents` | List owned/shared / create |
| GET / PATCH / DELETE | `/api/documents/:id` | Open / save / delete |
| POST | `/api/documents/:id/share` | Owner grants editor access |
| DELETE | `/api/documents/:id/share/:userId` | Owner revokes access |
| POST | `/api/import` | Create an editable document from `.txt`/`.md` |

## Validation, tests, reliability

- HTTP 400 for malformed input, 403 for disallowed access, 404 for missing documents, 409 for stale write, 413 for oversized request.
- The DB share key stops duplicate grants; delete cascades to shares. User IDs are checked against the seeded table.
- The server uses prepared SQL statements for user input and caps request size. Rich document structures are allowlisted and size-limited.
- `npm test` runs **seven automated tests** including real HTTP flows against an in-memory DB (permissions, revocation, persistence/open, conflicts), Markdown import and invalid content.
- Deployment must provide a persistent SQLite volume; an ephemeral filesystem would fail the persistence goal after restart.

## With another 2–4 hours

First, replace the native editing commands with TipTap/ProseMirror for richer formatting and more predictable paste/selection behavior. Second, improve 409 conflict UX with a reload/compare dialog. Third, add viewer/editor roles and stronger UI/error states. Full real-time CRDT editing (e.g. Yjs) and secure authentication are subsequent work and may require more than 2–4 hours to deliver robustly.
