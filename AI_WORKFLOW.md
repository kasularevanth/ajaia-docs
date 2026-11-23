# AI-Native Workflow Note

## Tools used
- **Claude Code (Claude Opus 5.5)** in the Claude desktop app: the main pair-programmer for planning, scaffolding, implementation, tests and docs.
- **Claude's browser automation**: the built-in browser for testing the running app locally, and Chrome for reading the assignment and driving the Render dashboard.
- Standard tooling for verification: TypeScript (strict), Vitest + Supertest, Vite and tsup production builds, GitHub Actions.

## How I used it
I used AI as a fast implementer working from **plans I reviewed first**, not as an oracle. Before any code, I had it write planning docs (`docs/00–05`: scope cuts, the API contract, the schema, the env vars, a minute-by-minute timeline), and I approved the stack and scope. Implementation then went module by module, with a verification gate after each: typecheck, tests, or a browser check.

## Where AI materially sped things up
- **Boilerplate with real structure.** Monorepo wiring, the Drizzle schema and migration, Express middleware, Zod contracts shared by client and server, and Radix-based UI pieces took minutes instead of hours.
- **Tests I would have under-invested in.** The sharing-lifecycle integration test, the in-memory `.docx` fixture built with JSZip, and the permission-matrix test. All 21 passed on the first full run against real Postgres (PGlite).
- **Deployment plumbing.** The Render Blueprint, the free-tier tradeoffs (Neon vs Render Postgres expiry, no persistent disk, cold starts, `npm ci --include=dev` because Render sets `NODE_ENV=production`), and the env var inventory.

## What I changed or rejected
| AI output | What I did | Why |
|---|---|---|
| Latest majors for everything (TypeScript 7, React Router 8, Vite 8) | **Pinned to established majors** (TS 5.9, RR 7, Vite 7) | Fewer unknown breaking changes under a hard deadline |
| Autosave fired on *any* editor update | **Rejected after browser testing**: opening an imported doc showed a false "someone else saved" conflict. Root cause: TipTap's trailing-paragraph normalization counted as an edit, and React StrictMode's double mount sent two saves at the same version. Fixed by saving only on real document changes, never saving for viewers, and treating a 409 whose content already matches the server as "saved". | A false alarm in conflict UX destroys trust in it |
| Session restore signed the user out on *any* `/me` failure | Changed so only a real **401** ends the session. Network errors and 5xx retry with backoff. | Found when the API restarted mid-test. On Render's free tier every cold start would have logged reviewers out. |
| A generic typed query helper for Drizzle | Replaced with two explicit query builders | Didn't typecheck with Drizzle's types. Explicit code was clearer anyway. |
| Dashboard row layout | Fixed horizontal overflow (grid `min-width`) and title repeated in the preview | Caught from screenshots, not tests |
| Suggestions to store HTML, use cookies, or use SQLite or Render Postgres | Rejected in favour of ProseMirror JSON, bearer tokens, and Neon | XSS surface, cross-site cookie blocking on `onrender.com`, no persistent disk, 30-day DB expiry |
| A bundle-splitting change to shrink the main chunk | Measured it: no size change (tree-shaking already worked). Kept the cleaner `@ajaia/shared/editor` subpath and stopped there. | Don't optimize without measuring |

## How I verified correctness, UX and reliability
1. **Types as the first gate.** Strict TypeScript across all three workspaces, with one shared contract package so client/server drift is a compile error.
2. **Behavioural tests on the real stack.** Supertest drives the real Express app against real Postgres (PGlite, real migrations). Tests assert *security* properties (404 for no access, 403 for viewers, 409 for stale saves, 400 for schema-invalid content), not just happy paths.
3. **Manual walkthroughs in a real browser as three users.** Alice creates, formats and shares. Carol sees "Shared with me" with view-only enforced in the UI. Imports via drag-and-drop. Persistence checked by reloading. These walkthroughs found the three UX bugs above, none of which the unit tests would have caught.
4. **Production parity.** Production builds run locally before deploy. CI repeats typecheck, tests and build on every push. The deployed app was smoke-tested end to end after the Render deploy.
5. **Security review of AI code paths.** I checked that every document route goes through the policy module, that upload limits and type checks happen on the server (not just the client), that secrets stay in gitignored `.env` files or the Render dashboard, and that only public values (the API URL) are committed.
