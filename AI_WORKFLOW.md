# AI-native workflow note

**AI tool used:** OpenAI ChatGPT (GPT-6) for coding assistance, architecture review, and documentation drafting. The code in this package was produced with AI assistance, not claimed to be entirely handwritten.

## Where AI accelerated work

- Turned the assignment into a narrow set of verifiable MVP flows and a data/API design.
- Drafted the Node.js API, schema, file import parser, browser editor, and responsive CSS quickly.
- Suggested permission-focused HTTP integration tests rather than superficial snapshot tests.
- Helped organize reviewer-friendly setup docs and document known trade-offs.

## What was changed or rejected

- **Rejected** building live collaboration/presence/WebSockets/CRDTs in the first version; the assignment's end-to-end sharing flow is better served by durable sequential edits.
- **Rejected** storing arbitrary user HTML as a persisted document because of injection risk. Instead the saved content is an allowlisted JSON tree, and text renders using DOM text nodes.
- **Avoided** a framework plus server/database dependencies that require network installation. Used Node's built-in SQLite so a reviewer can run with `npm start` without paying or configuring a database.
- **Fixed a real AI-generated bug** during test execution: the HTTP error helper initially sent an error response and fell through to a second response. The helper was changed to return a truthy handled status, and the tests were rerun successfully.

## Verification carried out

- `npm run check`: all JavaScript entry points pass syntax checks.
- `npm test`: seven automated tests pass. Tests include ownership, granting/revoking access, unrelated-user 403, shared editing, stale-save 409 and Markdown import.
- The HTTP server was started and its root endpoint returned a successful HTTP 200 response locally.

## Verification not claimed

A browser automation environment prevented navigation to local URLs, so a full click-through of the browser UX and screenshots **was not completed in this environment**. A live deployment and human-recorded walkthrough likewise remain the submitter's responsibility. These should be done before submitting the take-home.
