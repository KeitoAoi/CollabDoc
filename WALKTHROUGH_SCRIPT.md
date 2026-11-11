# Four-minute walkthrough recording outline

**0:00–0:30 — Introduction**

“This is CollabDoc, a focused document editor. The goal was to demonstrate the complete document lifecycle—create, format, save, import and share—without recreating all of Google Docs.”

**0:30–1:30 — Editing & persistence**

Create a document as Ava, rename to "Product roadmap", type content and demonstrate bold, italic, an H1 heading and a list. Point to “All changes saved”. Refresh the page and show the same formatting.

**1:30–2:00 — File import**

Return to dashboard; import a `.md` file with a heading and list. Open the imported document and edit it. Mention `.txt`/`.md` and the 2 MB limit.

**2:00–3:00 — Ownership and sharing**

As Ava, share the roadmap with Sam. Switch to Sam using the top-right selector, open “Shared with me”, edit the file, and switch back to Ava. Show the edit. Demonstrate revoke if time permits.

**3:00–3:40 — Engineering**

Show `src/db.js`, `src/server.js` and `src/document.js`: server-checked ownership, SQLite persistence, structured JSON, and optimistic version 409 conflict behavior. Mention the seven automated tests.

**3:40–4:10 — Priorities and AI**

Explain that real-time simultaneous editing, enterprise auth, comments and DOCX import were deprioritized. ChatGPT accelerated scaffolding, test design and documentation; an AI-generated double-response bug was found and corrected through tests. State that the next upgrade is TipTap and improved conflict resolution.
