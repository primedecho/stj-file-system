# STJ File System — Project Overview

*A plain-language guide to what this project is, how it works, and how to talk about it in a review or interview.*

---

## What is this?

This is a **browser-based file explorer** — think of the folder tree in Dropbox’s web app, or File Explorer on Windows, but simplified. You can create folders and subfolders, add files (by name only), delete things, and search for files while you type.

It is **not** a real file storage system. There is no upload, no download, no file contents. A “file” is just a row in a database: a name attached to a folder. That matches the exercise brief exactly.

The app has two parts:

- A **React frontend** — the tree UI, search box, create/delete buttons.
- A **FastAPI backend** — REST API, validation, database logic.

They talk over HTTP. In local development they run separately; in Docker the frontend is built to static files and nginx forwards API calls to the backend.

---

## Tech stack — what and why

### Backend: Python + FastAPI

**FastAPI** was chosen because it is modern, fast to build with, and gives you automatic OpenAPI docs at `/docs`. For an interview exercise where someone will curl endpoints and click through Swagger, that is a real advantage — reviewers can explore the API without reading source code.

**SQLAlchemy 2.0** handles the database. It is the standard ORM in Python, supports both SQLite and Postgres with the same models, and cascade deletes are declarative (`ondelete="CASCADE"`) rather than hand-written cleanup logic.

**Pydantic v2** validates every request and shapes every response. Invalid input (empty folder name, etc.) returns a structured 422 before it ever hits business logic.

**pydantic-settings** loads config from environment variables and a `.env` file. That keeps secrets and environment-specific values out of code — important for Docker vs local dev.

**SQLite** is the default database. The brief explicitly allows “InMemory or File DB.” SQLite means zero setup: no database server to install, one file on disk, works on any machine. For a take-home assignment that is the right default.

**Uvicorn** serves the ASGI app. In dev you run it with `--reload` so code changes apply instantly.

### Frontend: React + TypeScript + Vite

The brief says *“The default React framework is acceptable”* and does not require design or mobile support. **React 19 + TypeScript + Vite** is the current standard starter stack: type safety, fast dev server, simple production build.

**Tailwind CSS** was added for basic layout and spacing. It is not required by the spec; it just makes the tree readable without writing a lot of custom CSS. You can honestly say styling was kept minimal and functional.

There is no Redux or heavy state library. A single custom hook (`useFileSystem`) loads folders/files from the API and refreshes after mutations. For this scope, that is enough.

### DevOps: Docker + Docker Compose + nginx

Docker is optional in the brief but counts as a plus. The setup runs **two containers**:

1. **Backend** — Python app, port 8000.
2. **Frontend** — multi-stage build: Node builds the React app, then nginx serves the static files on port 5173 (mapped from container port 80).

nginx also **proxies** `/folders`, `/files`, `/search`, and `/health` to the backend. That way the browser always calls same-origin URLs (`http://localhost:5173/folders/...`) and you avoid CORS headaches in production-like Docker mode.

### Testing: pytest

Eleven automated tests cover health, CRUD, search limits, duplicate names, cascade delete, and validation errors. They run against an in-memory SQLite database so they do not touch your dev data.

---

## How the data model works

Two tables:

**Folders** — `id`, `name`, `parent_id` (nullable).  
`parent_id` pointing to another folder’s `id` gives you nesting. `null` means a root-level folder.

**Files** — `id`, `name`, `folder_id`.  
Every file lives in exactly one folder. There are no root-level files in the UI by design.

Deleting a folder cascades: SQLAlchemy and the database remove all child folders and files automatically. You do not need recursive delete code in Python.

Duplicate names are blocked **within the same parent** (folders) or **within the same folder** (files), case-insensitively. Two folders called `Archive` and `archive` under the same parent → 409 Conflict.

---

## How a typical user flow works

1. **Page load** — Frontend calls `/health`, then `/folders` and `/files`. It builds an in-memory tree from flat lists (group by `parent_id` / `folder_id`).

2. **Create folder** — User clicks “+ Root folder” or hovers a folder and clicks “+”. Inline form → `POST /folders` with `{ name, parent_id }` → tree refreshes.

3. **Create file** — User hovers a folder, clicks file icon → `POST /folders/{id}/files` with `{ name }`.

4. **Search** — User types in the search box. After 300ms debounce, frontend calls `GET /search?query=...`. Results appear in a dropdown (max 10). Optional checkbox scopes search to the **currently selected folder’s direct children only**.

5. **Delete** — Confirm dialog → `DELETE /folders/{id}` or `DELETE /files/{id}` → refresh.

Errors from the API (404, 409, 422) are parsed and shown in a red banner with a retry option.

---

## Search — the trickiest part of the spec

The brief mentions “exact name” in one sentence and then clarifies: **only “starts with” logic is required**, for autocomplete while typing, **top 10 results**.

This implementation does **prefix search**:

- `query=rep` matches `report-001.pdf` ✓
- `query=rep` does **not** match `my-report.pdf` ✓
- Case-insensitive
- Sorted alphabetically, capped at 10

If you type a **full filename**, it still works — a complete name is a prefix of itself.

**Folder-scoped search** uses `folder_id`. Important nuance: it searches files **directly in that folder**, not inside subfolders. That is documented in the README. A reviewer might ask “why not recursive?” — honest answer: the spec did not require it, direct-child scope is simpler and predictable, and the UI makes the selected folder explicit via breadcrumbs.

Demo seed data includes **150 files** in prefix clusters (`report`, `test`, `photo`, etc.) so you can demo the 10-result cap: search `report` finds 22 matches but only shows 10.

---

## Why two Docker Compose files?

You will almost certainly be asked this.

### `docker-compose.yml` — the default path

This is what you run day to day:

```bash
docker compose up --build
```

It starts backend + frontend. SQLite lives in a **named Docker volume** (`backend-data`) so data survives container restarts. The compose file loads `backend/.env` for settings like `DEBUG` and `ENVIRONMENT`, but **overrides only `DATABASE_URL`** to point at the volume path inside the container (`/app/data/...`). Your local `.env` might say `./stj_file_system.db` — that path would be wrong inside Docker, hence the override.

### `docker-compose.postgres.yml` — optional override

This is **not** a second standalone stack. It is a **Compose override pattern**:

```bash
docker compose -f docker-compose.yml -f docker-compose.postgres.yml up --build
```

Compose merges the two files. The override adds a Postgres container and tells the backend to use `postgresql+psycopg://...` instead of SQLite.

**Why bother?** To show the architecture is not locked to SQLite. Same SQLAlchemy models, same API — swap connection string and driver. The brief allows any SQL DB; SQLite keeps onboarding friction at zero, Postgres shows you thought about “real” deployment.

You do not need Postgres to complete or demo the exercise.

---

## Local dev vs Docker — why both?

| | Local dev | Docker |
|---|-----------|--------|
| **Frontend** | Vite dev server (hot reload) | nginx serving production build |
| **Backend** | uvicorn `--reload` | uvicorn in container |
| **API routing** | Vite proxy → localhost:8000 | nginx proxy → backend:8000 |
| **Database** | `backend/stj_file_system.db` on disk | SQLite in Docker volume |
| **Best for** | Writing code | “Does it run on a clean machine?” |

The brief requires debug mode — local dev is the primary development path. Docker proves reproducibility for reviewers who do not want to install Python and Node.

---

## Demo seed data

On startup, if the database is **empty** and both `ENVIRONMENT=development` and `DEBUG=true`, the backend seeds:

- 4 root folders + nested subfolders (up to 3 levels deep)
- 150 files placed **logically** — photos in Photos/2024, reports in Reports, backups in Archive, config/test files in the Web App project folders, etc.

Seeding is idempotent in spirit: if folders already exist, it skips. To re-seed: delete the DB file or `docker compose down -v`.

---

## Project structure (what to point at in a review)

```
backend/app/
  main.py          → app entry, CORS, router registration, startup seed
  routers/         → thin HTTP layer (folders, files, search, health)
  crud.py          → database operations (could split into services/repos later)
  models.py        → SQLAlchemy tables
  schemas.py       → Pydantic request/response types
  exceptions.py    → domain errors (404, 409, etc.)
  error_handlers.py→ consistent JSON error shape
  seed.py          → demo data

frontend/src/
  api.ts           → fetch wrapper, error parsing
  hooks/           → useFileSystem (state + mutations)
  components/      → FolderTree, SearchPanel, FileExplorer, …
  utils/tree.ts    → build tree from flat lists, breadcrumbs

backend/tests/     → pytest suite
```

**Why is everything in `crud.py` and not split into services/repositories?**  
At this size, an extra layer would be ceremony without benefit. Routers stay thin; crud holds the logic. If the app grew (permissions, file content, sync), you would extract a service layer. That is a reasonable answer in an interview — pragmatic YAGNI, not ignorance of patterns.

---

## What we deliberately did not build

Be upfront about these — it shows you read the scope:

- **No authentication** — brief says not to worry about it.
- **No file content / upload / download** — files are names only.
- **No mobile layout** — not required.
- **No recursive folder search** — documented; direct children only.
- **No pagination on list endpoints** — returns all rows; fine at exercise scale (150 files). Would add cursor pagination before production.

---

## How to demo it in 2 minutes

1. Open http://localhost:5173 (Docker) or run backend + `npm run dev`.
2. Show the folder tree — expand Documents → Work → Reports, point out report files.
3. Create a subfolder or file inline.
4. Search `report` — show 10 results, mention 22 exist in DB.
5. Select Photos, enable “Current folder only”, search `photo` — scoped results.
6. Open http://localhost:8000/docs — show Swagger, run a POST /folders live.
7. Optional: `cd backend && pytest` — tests pass.

---

## Likely questions and honest answers

**“Why SQLite?”**  
Zero config, meets the brief, file-based persistence. Postgres override exists if you want a server DB.

**“How does search work?”**  
SQL `ILIKE 'query%'` — prefix match, case-insensitive, `ORDER BY name LIMIT 10`. Designed for autocomplete, not full-text search.

**“What happens when you delete a folder with children?”**  
Database cascade. One DELETE on the parent row; FK cascades remove descendants.

**“Why nginx in front of React?”**  
Production pattern: serve static assets efficiently and proxy API on same origin. Vite dev server is not used in Docker.

**“How do you handle errors?”**  
Custom exceptions map to HTTP status + JSON `{ error: { code, message, details } }`. Frontend parses and displays them.

**“Is this production-ready?”**  
As a exercise demo, yes. For real production you would add auth, pagination, proper migrations (Alembic), HTTPS, and likely object storage if files had content. The structure supports that evolution.

**“Exact name vs prefix search?”**  
The brief’s detailed requirement is prefix for the search box. Full filename search works because it is a prefix of itself. A separate exact-equality mode was not required.

---

## Commands cheat sheet

```powershell
# Local backend
cd backend
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload --port 8000

# Local frontend
cd frontend
npm install
npm run dev

# Tests
cd backend
pytest

# Docker
docker compose up --build

# Fresh database (Docker)
docker compose down -v
docker compose up --build

# Docker with Postgres (optional)
docker compose -f docker-compose.yml -f docker-compose.postgres.yml up --build
```

---

## One-sentence pitch

*“A FastAPI + React file explorer with nested folders, name-only files, prefix search capped at ten results, SQLite by default, Docker for one-command deployment, and pytest covering the core API behaviour — scoped intentionally to the F24 brief without auth or file content.”*

That is the project. You built a coherent small system with clear boundaries, documented trade-offs, and a path to grow if requirements changed.
