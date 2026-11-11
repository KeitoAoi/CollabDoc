# CollabDoc — submission handoff

> **Preparation status: SOURCE CODE READY; FINAL SUBMISSION INCOMPLETE.** Fill the placeholders below *after* publishing and recording. Do not hand in placeholder URLs as working links.

## Links

- **Google Drive folder:** `TO_ADD`
- **Live product:** `TO_ADD`
- **Walkthrough video:** `TO_ADD` (also place the URL in `WALKTHROUGH_URL.txt`)

## Files included

- `src/` — native Node.js HTTP API, SQLite persistence and document import/validation.
- `public/` — browser application (dashboard, rich-text editor, sharing, responsive styling).
- `tests/` — seven automated tests.
- `README.md` — local setup, run, demo accounts, deployment advice, known limits.
- `ARCHITECTURE.md` — data model, API, quality and scope trade-offs.
- `AI_WORKFLOW.md` — transparent AI-use and verification note.
- `Dockerfile` — container deployment entry point.
- `.env.example`, `.gitignore`, `package.json` — project configuration.
- `WALKTHROUGH_URL.txt` — link placeholder.
- `WALKTHROUGH_SCRIPT.md` — suggested 4-minute video script.

## Run locally

1. Install **Node.js 22.13 or newer**.
2. Open this source folder in a terminal.
3. Run `npm start` (no dependency installation).
4. Browse to `http://localhost:3000`.
5. Run `npm test` to verify server behavior.

## Reviewer demo accounts

- **Ava Morgan** — `ava@collabdoc.demo`
- **Sam Rivera** — `sam@collabdoc.demo`
- **Jordan Lee** — `jordan@collabdoc.demo`

Use the top-right **demo user switcher**; no password is required. To test sharing, create as Ava, share with Sam, switch to Sam, open the **Shared with me** tab, edit, and switch back to Ava.

## Working / tested

- Create, rename, edit and delete documents.
- Autosave content and reopen documents from SQLite.
- Format bold, italic, underline, headings, numbered/bulleted lists via native browser commands.
- Import `.txt` or `.md` documents (max 2 MB).
- Seeded owner/editor permissions and separate owned/shared listings.
- Server-side checks, input validation, duplicate-share prevention, stale-save 409 handling.
- Seven passing automated tests and local server HTTP response.

## Partial / incomplete

- **A public live URL is not yet provisioned.** Hosting account/volume setup is required.
- **The human-recorded walkthrough has not been created.** Record 3–5 minutes and replace placeholder.
- End-to-end browser click-through needs a final manual verification on the deployed URL.
- No simultaneous real-time co-editing, real authentication, comments, history or DOCX parser.
- Contenteditable uses legacy browser formatting commands, not a ProseMirror-grade editor.

## Next 2–4 hours

Complete deployment and browser smoke testing; record video; then improve the rich-text editor and conflicting-save recovery. Only after those are solid, consider granular viewer/editor permissions and full real-time collaboration.
