# 00 — Build Plan: Ajaia Docs

> The master plan. Read this first, then the detailed docs:
> [01 Architecture](01-ARCHITECTURE-OVERVIEW.md) · [02 Frontend](02-FRONTEND.md) · [03 Backend](03-BACKEND.md) · [04 Database](04-DATABASE.md) · [05 Deployment & Env](05-DEPLOYMENT-AND-ENV.md)

**Timebox:** about 230 min left on the portal timer. **The portal auto-submits the Submission box when time runs out**, so we paste a draft early and update it.
**Strategy:** a narrow, deep slice. Deploy a skeleton early to de-risk infra. Hard cut lines between P0, P1 and P2.

---

## 1. Product slice (what a reviewer will experience)

1. Open the live URL → log in with one click as **Alice** (demo buttons).
2. The dashboard shows **Owned by me** and **Shared with me** with clear badges.
3. **New document** → type with a toolbar (B / I / U / S, H1–H3, bullets, numbers, quote) → **autosaves** ("All changes saved").
4. **Rename** inline → refresh the page → everything persists, formatting included.
5. **Import file**: upload `.txt` / `.md` / `.docx` (≤ 5 MB) → it becomes a new editable document.
6. **Share** → enter `bob@ajaia.test` with *Can view* or *Can edit*.
7. Switch to **Bob** → the doc appears under **Shared with me · Shared by Alice**. As a viewer it is read-only. As an editor he can edit.
8. If two editors save over each other, the second one sees a **conflict banner** instead of silently losing work.

---

## 2. Scope and priorities

### P0: Must ship (the core requirements)
| # | Capability | Requirement it covers |
|---|---|---|
| P0-1 | Email/password login with **seeded demo users** + quick-login buttons | Sharing (simulated users) |
| P0-2 | Dashboard with **Owned by me / Shared with me** and ownership badges | Sharing: visible distinction |
| P0-3 | Create, open and **rename** documents | Creation & editing |
| P0-4 | TipTap editor: **bold, italic, underline, H1–H3, bullet and numbered lists** (+ strike, quote, undo/redo) | Rich-text formatting |
| P0-5 | **Autosave** with save status. Reopen preserves the formatting (JSONB). | Save & reopen, persistence |
| P0-6 | **Import .txt / .md / .docx → new document** (types stated in UI + README) | File upload |
| P0-7 | Share by email with **viewer/editor role**, list collaborators, revoke | Sharing: grant access |
| P0-8 | Server-side access enforcement (policy module; 404/403) | Access logic |
| P0-9 | Postgres on Neon, migrations, idempotent seed | Persistence |
| P0-10 | Zod validation, consistent error JSON, UI error states | Validation & error handling |
| P0-11 | **Automated tests**: policy unit + sharing/documents/import integration | Meaningful automated test |
| P0-12 | **Live deployment** on Render (static + web service) | Working deployment |
| P0-13 | README, ARCHITECTURE.md, AI_WORKFLOW.md, SUBMISSION.md, VIDEO_URL.txt | Deliverables |

### P1: Should ship (cheap, high signal)
| # | Capability | Est. |
|---|---|---|
| P1-1 | Optimistic-concurrency **409 conflict banner** (Reload / Overwrite) | 15 min |
| P1-2 | **Cold-start "waking server" banner** (Render free tier) | 5 min |
| P1-3 | Delete document (owner, confirm dialog) | 5 min |
| P1-4 | Word count footer and "last edited" time | 5 min |
| P1-5 | GitHub Actions CI (typecheck + test) | 5 min |

### P2: Stretch (only if P0 and P1 are done and deployed)
| # | Capability | Est. |
|---|---|---|
| P2-1 | **Export to Markdown** (download) + **Print/Save as PDF** (print stylesheet) | 15 min |
| P2-2 | "Updated by someone else" polling indicator (every 20 s) | 15 min |
| P2-3 | Self-serve registration | 15 min |

> Viewer/editor roles are already in P0, which covers the "role-based sharing permissions" stretch item at almost no extra cost.

### Intentionally deprioritized (with reasons, for the video and the docs)
| Cut | Why |
|---|---|
| Real-time co-editing (Yjs/CRDT, cursors, presence) | A large infra and complexity cost (WebSockets, and the free tier sleeps). Optimistic concurrency prevents data loss for this scope. |
| Comments / suggestion mode | A whole second data model (anchors), so it can't be done with depth in the timebox |
| Version history | Valuable, but less important than reliable save, share and import |
| OAuth / SSO, password reset, email verification | Seeded users satisfy the brief. Real auth providers add setup reviewers would have to do. |
| Images, tables, embeds, attachments storage | Needs object storage (S3 etc.). Text-first is the right MVP for productivity docs. |
| Pagination / print-accurate layout, mobile-first editing | Polish, not core |
| Folders, search, trash, public links | Organizational features come after the core loop is solid |

---

## 3. Timeline (minutes from "go")

| Phase | Time | Work | Exit criteria |
|---|---|---|---|
| **0. Plan** | 0–15 | These docs. You review them. **In parallel: you create the Neon, GitHub and Render accounts** (05 §5 A–C). | Plan approved |
| **1. Scaffold** | 15–30 | npm workspaces, `apps/api`, `apps/web` (Vite), `packages/shared`, tsconfig, scripts, `.env.example`, `.gitignore`, `render.yaml` | `npm run dev` boots both |
| **2. DB + skeleton deploy** | 30–50 | Drizzle schema, migration, pg/PGlite switch, seed, `/api/health`. **First push → Render Blueprint deploy** | Health is green on Render with Neon |
| **3. API core** | 50–90 | env, errors, auth (login/me), policy, documents CRUD + versioned save, sharing endpoints | curl flow works |
| **4. Import** | 90–105 | multer + txt/md/docx converters → sanitize → `generateJSON` | `.md`/`.docx` become documents |
| **5. API tests** | 105–120 | policy, sharing lifecycle, documents, import (Vitest + Supertest + PGlite) | `npm test` green |
| **6. Web shell** | 120–145 | api client, AuthProvider, Login (quick-login), Dashboard (tabs, badges, new, import) | Login → list → create works |
| **7. Editor + Share** | 145–185 | EditorPage, Toolbar, TitleInput, useAutosave, SaveStatus, conflict banner, viewer mode, ShareDialog | Full flow works locally |
| **8. Deploy + smoke** | 185–200 | Push, verify prod end to end (Alice → share → Bob/Carol), fix CORS/env | Live URL works |
| **9. Docs** | 200–212 | README, ARCHITECTURE.md, AI_WORKFLOW.md, SUBMISSION.md, screenshots | Deliverables complete |
| **10. Video + submit** | 212–230 | **You** record Loom (3–5 min, script provided), upload the Drive folder, paste SUBMISSION.md + video link into the portal | Submitted |

**Safety rails**
- At **T+60**, if the skeleton deploy isn't green, we fix infra before writing more features.
- At **T+185**, feature freeze. Whatever works is what we ship. P2 only happens if ahead of schedule.
- At **T+150**, paste a draft SUBMISSION into the portal (auto-submit protection).

---

## 4. Who does what

| Me (Claude Code) | You |
|---|---|
| All code, tests, configs, `render.yaml`, docs drafts | Create **Neon / GitHub / Render** accounts (free) |
| Local verification (tests, run the app, browser checks) | Paste secrets (Neon URL) **only into the Render dashboard**, never in chat |
| `git init` + commits locally | `git push` to your GitHub repo |
| Prod smoke test in the browser once deployed | Click **Apply** on the Render Blueprint and set the 3 `sync:false` env vars |
| Video script + SUBMISSION.md text | Record the video, create the Drive folder, submit on the portal |
| Draft AI_WORKFLOW.md | Review and edit it so it reflects *your* judgment calls honestly |

---

## 5. Quality gates (Definition of Done)

- [ ] `npm run typecheck` and `npm test` pass
- [ ] Fresh clone: `npm install && npm run dev` works with **no DB setup** (PGlite)
- [ ] Prod: health is green. Alice/Bob/Carol login works. Create, edit, refresh and persist work. Import of all 3 types works. Share, view-only and edit work. Revoke removes access.
- [ ] Viewer cannot edit (UI read-only **and** API returns 403)
- [ ] A non-shared user gets a 404 page for another user's doc URL
- [ ] Unsupported upload shows a clear message (UI + 415)
- [ ] No secrets committed (`.env` gitignored; only `.env.example`)
- [ ] README states supported file types, demo credentials, the cold-start note, and local run steps

---

## 6. Risk register

| Risk | Likelihood | Mitigation |
|---|---|---|
| Render config, CORS or env mistakes late in the timebox | Med | **Deploy the skeleton at T+50**. Env-driven CORS allow-list. Troubleshooting table in 05. |
| TipTap server-side `generateJSON` issues in Node | Low-Med | Fallback: the import endpoint returns sanitized HTML and the client converts it with `editor.commands.setContent(html)` before the first save |
| PGlite and pg behaving differently | Low | Same SQL migrations. Avoid triggers and exotic types. |
| Free-tier cold start during review | High | Wake banner, README note, optional UptimeRobot ping |
| Time overrun | Med | Strict P0/P1/P2 cut lines, a feature freeze at T+185, and the portal draft at T+150 |

---

## 7. Video outline (3–5 min; full script delivered at Phase 9)
1. **0:00–0:30**: problem, and what I chose to build (and not build)
2. **0:30–2:30**: live demo: quick-login Alice → create → format → rename → refresh → import .docx → share with Bob (view) → switch to Bob → read-only → upgrade to edit → conflict banner (optional)
3. **2:30–3:30**: architecture: monorepo, shared schema, JSONB + versioning, policy module, Render + Neon, PGlite tests
4. **3:30–4:15**: deprioritized items and what's next with 2–4 more hours
5. **4:15–5:00**: how AI was used: what it sped up, what I rejected, how I verified

---

## 8. Decisions I need from you before building
1. **Approve the stack** (React + TipTap / Express + Drizzle / Neon Postgres / Render static + web).
2. **Repo location**: build in this folder (`Downloads/AJAIA`) as the repo root? *(Recommended.)*
3. **Neon vs Render Postgres**: Neon recommended (no 30-day expiry).
4. Start the **Neon / GitHub / Render signups now** in parallel.
