# CollabDoc

A lightweight collaborative document editor built for the Ajaia take-home exercise. **Zero third-party runtime dependencies.** It uses Node.js, the built-in SQLite module, and a browser-native rich-text editing surface.

**Status:** Runnable and tested locally. A live hosting URL and walkthrough recording must be added by the submitter; neither is fabricated in this package.

## Features

- Create, rename, delete, edit, save, and reopen documents.
- Browser rich text: **bold**, *italic*, underline, H1/H2, bullets, numbered lists.
- Autosave after 750 ms of inactivity, save status, retry on failure.
- Persistent structured JSON document content in SQLite, not raw HTML.
- Import `.txt` or `.md` as editable documents. Max **2 MB**. Markdown import supports headings (`#`, `##`), simple emphasis, ordered and unordered lists. Advanced Markdown (tables, code blocks, links, images) is not implemented.
- Share an owned document with another seeded user as an **editor**, revoke access, and distinguish **My documents** vs **Shared with me**.
- Server-side access checks for reading, changing, deleting, sharing, and revoking.
- Optimistic concurrency via `version`: stale writes return HTTP 409 rather than silently overwriting another saved version.
- Responsive dashboard, search, document editor, demo user switching.
- Meaningful backend/API tests with the built-in Node test runner.

## Quick start

**Requirement: Node.js 22.13+** (the built-in `node:sqlite` module is used; Node 22 emits an experimental warning). No npm install, Postgres, Docker, or paid service required.

```bash
# Unzip the source and enter its directory
cd collabdoc

npm start
```

Open **http://localhost:3000**.

Optional:

```bash
npm run dev       # watch source files and restart server
npm test          # 5 tests for import, validation, permissions, concurrency
npm run check     # syntax checks
```

The app automatically creates `data/collabdoc.sqlite` and seeds demo accounts on the first start. Data remains across refreshes and server restarts. To reset locally, stop the server and delete `data/collabdoc.sqlite` (and any `-wal`/`-shm` files).

## Demo accounts

Use the **user switcher in the upper-right corner**. No passwords are needed.

| Demo user | Email | Initial ownership |
|---|---|---|
| Ava Morgan | ava@collabdoc.demo | Creates her own documents |
| Sam Rivera | sam@collabdoc.demo | Can receive shares |
| Jordan Lee | jordan@collabdoc.demo | Can receive shares |

### Walk through sharing

1. As **Ava**, create a document, rename it, format some content, and wait for **All changes saved**.
2. Refresh to confirm the content persists.
3. Click **Share**, select **Sam**, and choose **Grant access**.
4. Use the user switcher to become **Sam**. Select **Shared with me**.
5. Open Ava's document, edit it, and wait for autosave.
6. Switch back to Ava, open the document, and verify Sam's edit is present.
7. As Ava, revoke Sam's access in the Share dialog and confirm the document disappears from Sam's Shared list.
8. Import a `.txt` or `.md` file from the dashboard and edit the result.

Note: This demonstrates **sequential shared editing**, *not* simultaneous real-time editing.

## Configuration

The app reads these optional environment variables:

```text
PORT=3000
DB_PATH=./data/collabdoc.sqlite
NODE_ENV=development
```

Copy values from `.env.example` into your hosting provider's environment settings; this zero-dependency app doesn't automatically load `.env` files. For manual shell export, use `export PORT=3000` etc. If you use Docker, the Dockerfile declares production defaults.

## Tests

Run `npm test`. The test suite uses a fresh **in-memory SQLite** database and a real HTTP server. It checks that owners can grant and revoke document access, unrelated users get 403, editors can update, stale writes get 409, imported documents can be reopened, and invalid document structures are rejected.

## Deployment

**A deployable `Dockerfile` is included.** Use a Node-capable host with a **persistent disk or volume** mounted at `/app/data` (or set `DB_PATH` to a persistent file location). Example using local Docker:

```bash
docker build -t collabdoc .
docker run -p 3000:3000 -v collabdoc_data:/app/data collabdoc
```

For a public deployment, deploy this container to a container host supporting durable volumes, map port 3000, configure the volume, and record the HTTPS URL in `SUBMISSION.md`. **Do not use an ephemeral filesystem for production SQLite data.** Without a persistent volume, documents may disappear during redeploy or instance restart.

This environment cannot deploy on your behalf because it has no access to your hosting account. **There is no live URL included in this package.** Reviewers should not have to pay to use a deployment once it has been published; hosting costs, if any, are the submitter's responsibility.

## Known limits

- Auth is **deliberately mocked**. The demo user switcher sets a cookie; a person who can access the app can switch identities. It is **not suitable for private production documents** and should be protected or replaced by real sign-in before opening the app to untrusted users.
- Rich text uses the browser-native `contenteditable` API and legacy formatting commands for the MVP. Common browser text formatting is supported, but complex nested formatting, paste fidelity, undo history across reloads, mobile selection behavior, and multi-user cursor synchronization are not guaranteed.
- Two editors opening one document at once receive a **409 conflict**, rather than last-write-wins overwrites. There is no automatic merge or conflict resolution UI; reload before editing again.
- Markdown import supports a clearly documented subset, not full Markdown fidelity. Only `.txt` and `.md` are accepted.
- No comments, version history, DOCX import, export, email invitations, or password-based user accounts.

## Key source files

```text
src/server.js         HTTP server, routing, validation and responses
src/db.js             SQLite schema, users, document CRUD and permissions
src/document.js       Structured document validation and file import
public/app.js         Dashboard, editor, autosave and sharing flows
public/styles.css     Responsive styling
public/index.html     Browser shell
tests/*.test.js       API and import/validation tests
ARCHITECTURE.md       Technical choices and trade-offs
AI_WORKFLOW.md        AI assistance and verification note
SUBMISSION.md         Reviewer handoff checklist
WALKTHROUGH_URL.txt   Recording link to be supplied by submitter
```
