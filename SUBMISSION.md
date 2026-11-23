# Submission: Ajaia Docs (Full Stack Product Engineer)

**Candidate:** Revanth Kasula

## Links
| | |
|---|---|
| **Live product** | https://ajaia-docs-web-9lts.onrender.com |
| **API health** | https://ajaia-docs-api-h888.onrender.com/api/health |
| **Google Drive folder** | https://drive.google.com/drive/folders/1XPE0JxW1sqtKXJILhS_FSp-pdypvX8u_?usp=sharing |
| **Source code** | https://github.com/kasularevanth/ajaia-docs (also in the Drive folder as a zip) |
| **Walkthrough video** | See `VIDEO_URL.txt` |

> The API is on Render's free tier and sleeps when idle. **The first request can take up to ~1 minute.** The app shows a "Starting the server" banner, and after that it is fast.

## Test accounts (password `demo1234` for all; one-click buttons on the login page)
| User | Email | Seeded state |
|---|---|---|
| Alice Chen | alice@ajaia.test | Owns "Q4 Product Brief" (Bob = editor). Has view access to Bob's "Team Retro Notes". |
| Bob Rivera | bob@ajaia.test | Owns "Team Retro Notes". Can edit Alice's brief. |
| Carol Singh | carol@ajaia.test | Empty. Use her to test granting access. |

## What's included in this folder
| Item | Path |
|---|---|
| Source code (monorepo: web, api, shared) | `apps/`, `packages/` |
| Setup and run instructions | `README.md` |
| Architecture note | `ARCHITECTURE.md` |
| AI workflow note | `AI_WORKFLOW.md` |
| This file | `SUBMISSION.md` |
| Walkthrough video URL | `VIDEO_URL.txt` |
| Screenshots | `docs/screenshots/` |
| Planning and design docs written before coding (plan, frontend, backend, database, deployment and env) | `docs/00–05*.md` |
| Automated tests (21: policy, sharing lifecycle, documents, import) | `apps/api/test/` |
| Deployment as code (Render Blueprint) and CI | `render.yaml`, `.github/workflows/ci.yml` |

## What's working (end to end, deployed)
- **Documents:** create, rename (inline or from the list), rich-text editing (bold, italic, underline, strike, H1–H3, bulleted and numbered lists, quotes, undo/redo), autosave with status, reopen with formatting preserved, delete (owner only).
- **File import:** `.txt`, `.md`, `.docx` (≤ 5 MB) become new editable documents, via button or drag-and-drop. Supported types are stated in the UI and README. Unsupported, corrupt, empty and oversized files get clear errors.
- **Sharing:** owner shares by email as *Can view* or *Can edit*, changes roles, revokes. Collaborators can remove a doc from their list. **Owned vs shared is visually distinct** (edge tabs, badges, owner name and role).
- **Access control on the server:** no access gives 404, a viewer writing gets 403, enforced by one tested policy module.
- **Persistence:** PostgreSQL (Neon). Documents stored as ProseMirror JSON. Refresh-safe.
- **Reliability:** optimistic versioning (409 conflict banner instead of silent overwrite), offline retry with backoff, unsaved-changes guard, cold-start banner.
- **Quality:** Zod validation on both sides, a consistent error contract, 21 automated tests against real Postgres, CI, one-command local setup with no DB install.
- **Stretch:** role-based permissions (viewer/editor) and **export to Markdown / print to PDF**.

## What's incomplete or intentionally cut
- No real-time co-editing or presence. Concurrent edits are *detected* (409 plus a resolution banner), not merged.
- No comments, suggestion mode or version history.
- No self-serve sign-up or password reset (seeded accounts by design).
- `.docx` images and tables are dropped on import. No image or attachment storage.
- Auth uses a bearer token in `localStorage`, a deliberate tradeoff because frontend and API are on different `onrender.com` sites. It would become an HttpOnly cookie on a shared custom domain.

## What I'd build next with 2–4 more hours
1. Version history (snapshots and restore), built on the existing `version` column.
2. A live "updated by someone else" indicator (poll or SSE), so conflicts are prevented rather than resolved.
3. Comments on text selections.
4. A Playwright end-to-end test of the share flow, and cookie sessions on a custom domain.

## Run locally
```bash
git clone https://github.com/kasularevanth/ajaia-docs.git && cd ajaia-docs
npm install
cp apps/api/.env.example apps/api/.env && cp apps/web/.env.example apps/web/.env
npm run dev        # web http://localhost:5173 · api http://localhost:4000
npm test           # 21 tests, in-memory Postgres, no Docker
```
