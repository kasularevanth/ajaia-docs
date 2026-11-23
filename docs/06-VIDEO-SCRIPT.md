# 06 — Walkthrough Video Script (target 4:30)

Before recording: open https://ajaia-docs-api.onrender.com/api/health once so the server is awake. Have a small `.docx` or `.md` file ready on your desktop.

## 0:00–0:30 · What and why
"This is Ajaia Docs, a lightweight collaborative editor. I didn't try to clone Google Docs. I picked the core loop of write, save safely, import, and share with the right permissions, and went deep on it: every requirement works end to end and is enforced on the server and covered by tests."

## 0:30–2:45 · Live demo
1. **Login page.** "Seeded accounts with one-click sign-in, so reviewers can test sharing in seconds." Sign in as **Alice**.
2. **Dashboard.** "Owned by me has an ink tab, Shared with me has a highlighter tab with who shared it and my role."
3. **New document.** Type a heading and a paragraph. Use bold, underline, a bulleted list and a numbered list. Point at **Saved**. Rename inline. **Refresh**: everything persists.
4. **Import.** Drag your `.docx`/`.md` onto the dashboard. "Supported types are .txt, .md and .docx, stated in the UI. Headings, bold, underline and lists survive."
5. **Share.** Open the doc → Share → add Carol as **Can view**.
6. **Switch to Carol.** The doc is under *Shared with me*. Open it: *View only*, no toolbar. "The API also returns 403 if a viewer tries to write. It isn't just hidden in the UI."
7. *(Optional)* Back as Alice, change Carol to **Can edit**, then show she can type.
8. *(Optional)* The ⋯ menu → Download as Markdown / Print to PDF.

## 2:45–3:45 · Key implementation decisions
- "Monorepo with a **shared package**: the same Zod schemas and the same TipTap schema are used by the browser and the API. The server validates every save against the editor schema, and converts imports with it."
- "Documents are stored as **ProseMirror JSON in Postgres JSONB**, so formatting is preserved exactly."
- "**Optimistic concurrency**: each save carries a version. If two editors collide, the second gets a conflict banner instead of silently overwriting. That was a deliberate alternative to real-time CRDTs within 4 hours."
- "Permissions live in **one pure policy module**. No access gives 404 so private docs aren't revealed, a lower role gives 403."
- "**Render** static site and web service via a Blueprint, **Neon** Postgres (Render's free DB expires in 30 days). Locally and in tests it uses **PGlite**, real Postgres in WASM, so there's no DB setup and the tests hit real SQL."

## 3:45–4:15 · Deprioritized and next
"I cut real-time co-editing, comments, version history and sign-up. With 2–4 more hours: version history on top of the existing version column, a live 'updated by Bob' indicator, and comments."

## 4:15–4:45 · How AI helped
"I used Claude Code as a pair-programmer working from a plan I reviewed first. It sped up scaffolding, tests and deploy config. I rejected or fixed several outputs. Browser testing caught a false conflict banner caused by the editor's normalization triggering a save, and a session-logout bug on server restarts that would have hit every Render cold start. Everything is gated by strict types, 21 tests against real Postgres, and manual walkthroughs as three users."
