# Architecture Note

## What I prioritized and why

The brief rewards **depth in a few areas over shallow coverage**, so I chose the core loop of a document product and made it reliable:

> **write → save safely → bring in existing files → share with the right permissions**

Every requirement is covered end to end (UI, API, database, tests). The time saved by cutting breadth went into the details that make an editor trustworthy: autosave that never silently loses work, server-enforced permissions, and validated content.

| Priority | Decision | Reason |
|---|---|---|
| 1 | **Correct saving** (debounced autosave and optimistic concurrency) | Losing someone's writing is the worst failure an editor can have |
| 2 | **Server-side access control** in one pure policy module | Sharing has to be enforced by the API, not just hidden in the UI |
| 3 | **One editor schema shared by client and server** | The API validates every save and converts every import with the same schema the editor uses, so stored documents are always renderable |
| 4 | **Zero-setup local run and a free, durable deployment** | Reviewers should be able to test in minutes and pay nothing |
| 5 | Polish where it affects comprehension | Ownership edge tabs, view-only mode, the cold-start banner, empty and error states |

## System

```
React SPA (Render Static Site) ──HTTPS + Bearer JWT──► Express API (Render Web Service) ──TLS──► PostgreSQL (Neon)
       TipTap editor                                   Zod · policy · Drizzle                    users · documents · document_shares
```

- **Monorepo** (npm workspaces): `apps/web`, `apps/api`, `packages/shared`.
- **`packages/shared`** holds the Zod schemas (one definition validates forms in the browser and requests on the server), the API types, and the **TipTap extension list**. That list is the document schema.

## Key decisions

1. **Documents are stored as ProseMirror JSON in `JSONB`.** Formatting is preserved exactly. On every save the server runs `schema.nodeFromJSON(content).check()`, so malformed or injected node types get a 400. A derived `content_text` column powers list previews, so the dashboard never downloads document bodies.
2. **Optimistic concurrency instead of real-time co-editing.** Each save sends `baseVersion`, and the update is `WHERE id = $1 AND version = $2`. A stale save returns **409**, and the editor offers *Load their version* or *Keep mine*. This prevents silent overwrites between shared editors at a fraction of the cost of CRDTs and WebSockets, which the free tier can't keep alive anyway.
3. **Authorization lives in one pure module.** `resolveRole()` and `can(role, action)` define owner, editor and viewer against read, edit, rename, share and delete. The owner is a column (`documents.owner_id`), not a share row, so states like "the owner revoked themselves" can't exist. No access returns **404** so private documents aren't revealed. A lower role returns **403**.
4. **Import pipeline:** multer (memory, 5 MB) → type check by extension plus magic bytes → `.txt` escaped into paragraphs, `.md` through `marked`, `.docx` through `mammoth` (underline mapped explicitly) → `sanitize-html` restricted to the schema's tags → `generateJSON` with the shared schema → a new document. A leading H1 becomes the title.
5. **Bearer token instead of cookies.** The static site and the API are on different `onrender.com` subdomains, and `onrender.com` is on the Public Suffix List, so cookies would be third-party and blocked by Safari and Chrome. The tradeoff (XSS can read `localStorage`) is reduced because no HTML is ever rendered from user input, plus helmet and security headers. With a shared custom domain I'd switch to `HttpOnly; SameSite=Lax` cookies.
6. **One codebase, two database drivers.** Neon (node-postgres) in production. **PGlite** (Postgres compiled to WASM) for local dev and tests. The same Drizzle schema and SQL migrations run in all three, so tests exercise real Postgres behaviour without Docker.
7. **Free-tier realities handled in the product.** Migrations and seeding run at boot (idempotent, because free instances have no pre-deploy hook). The client shows a wake-up banner, retries the session check instead of signing users out during a cold start, and lazy-loads the editor bundle.

## Testing strategy

21 tests run against the real Express app and in-memory Postgres (`npm test`, about 20 s):
- **Policy unit tests**: the full role × action matrix.
- **Sharing lifecycle**: no access gives 404 → grant viewer → can read but writes get 403 → upgrade to editor → can save → revoke → 404 again. Owned and shared scopes stay distinct.
- **Documents**: create, rename, save, reopen with JSON preserved exactly. Concurrent stale save gives 409. Title, content and schema validation. Owner-only delete.
- **Import**: Markdown and plain text structure, a `.docx` built in memory (heading, bold, underline), and rejections for unsupported, corrupted, empty and oversized files.

The UI flows were checked manually in the browser (see AI_WORKFLOW.md). CI runs typecheck, tests and builds on every push.

## Intentionally deprioritized

| Cut | Why |
|---|---|
| Real-time co-editing, cursors, presence | Needs CRDT plus a WebSocket infrastructure. Versioned saves prevent data loss within this scope. |
| Comments and suggestion mode | A second data model (anchored ranges). Couldn't be done with depth in the timebox. |
| Version history | Valuable. The `version` column is the foundation for it. |
| OAuth, sign-up, password reset | Seeded accounts meet the brief and keep reviewer setup at zero |
| Images, tables, attachments | Need object storage. Text-first is the right MVP for team docs. |
| Folders, search, trash | Organization features come after the core loop |

## What I'd build next (2–4 hours)
1. **Version history**: snapshot on save (throttled), list and restore. This builds directly on `version`.
2. **Live "updated by Bob" indicator**: poll or SSE on `version`, so conflicts are rare rather than just handled.
3. **Comments** on selections, using a TipTap mark plus a `comments` table.
4. **Cookie sessions on a custom domain**, and a Playwright end-to-end test of the sharing flow.
