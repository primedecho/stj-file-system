# STJ File System

A full-stack file explorer for managing nested folders and files. The backend exposes a REST API built with FastAPI; the frontend provides a React UI with a recursive folder tree, inline create/delete actions, and live search.

---

## Tech Stack

| Layer | Technologies |
|-------|----------------|
| **Backend** | FastAPI, SQLAlchemy 2.0, Pydantic v2, pydantic-settings, Uvicorn |
| **Database** | SQLite (default); PostgreSQL supported via compose override |
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS v4 |
| **DevOps** | Docker, Docker Compose, nginx (production frontend) |

---

## Features

### Backend
- REST API for folders and files with nested folder support (`parent_id`)
- Prefix search endpoint (top 10 results, optional folder scope)
- Health check at `/health`
- Global error handling with consistent JSON error responses
- Custom exceptions (`FolderNotFound`, `FileNotFound`, `FileAlreadyExists`, etc.)
- CORS configured for local frontend origins
- Environment-based configuration via pydantic-settings
- Optional demo data seeding in development mode

### Frontend
- Recursive folder tree with expand/collapse
- Files displayed inside their parent folders
- Create folders and files at any level (root or nested) via inline forms
- Delete folders and files with confirmation
- Live debounced search with optional “current folder only” filter (direct children only)
- Clickable folder breadcrumbs for the selected folder
- Loading states, API connectivity badge, and user-friendly error messages

### Infrastructure
- One-command Docker Compose setup
- SQLite persisted in a Docker volume
- Optional PostgreSQL override for future production use

---

## Prerequisites

| Tool | Version | Needed for |
|------|---------|------------|
| Python | 3.11+ | Local backend |
| Node.js | 18+ | Local frontend |
| npm | 9+ | Local frontend |
| Docker + Compose V2 | 24+ | Docker setup |

---

## Running Locally (without Docker)

You need **two terminals** — one for the backend, one for the frontend.

### 1. Backend

```bash
cd backend
python -m venv .venv
```

**Windows (PowerShell):**

```powershell
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload --port 8000
```

**macOS / Linux:**

```bash
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

| Resource | URL |
|----------|-----|
| API root | http://localhost:8000 |
| Swagger UI (API docs) | http://localhost:8000/docs |
| Health check | http://localhost:8000/health |

The SQLite database file `stj_file_system.db` is created automatically in the `backend/` directory.

### 2. Frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**.

The Vite dev server proxies API requests to the backend:

| Path | Proxied to |
|------|------------|
| `/folders`, `/files`, `/search`, `/health` | http://localhost:8000 |

> Start the backend before the frontend. The UI shows an **API offline** badge if it cannot reach the server.

---

## Running with Docker

From the project root:

```bash
docker compose up --build
```

| Service | URL |
|---------|-----|
| Frontend (UI) | http://localhost:5173 |
| Backend API | http://localhost:8000 |
| Swagger UI | http://localhost:8000/docs |

This starts:
- **backend** — FastAPI on port 8000, SQLite in a named Docker volume
- **frontend** — production React build served by nginx, proxying API routes to the backend

### Useful commands

```bash
docker compose up --build -d    # run in background
docker compose logs -f          # follow logs
docker compose down             # stop containers
docker compose down -v          # stop and wipe database volume
```

### Reset database (Docker)

```bash
docker compose down -v
docker compose up --build
```

### Optional: PostgreSQL

```bash
docker compose -f docker-compose.yml -f docker-compose.postgres.yml up --build
```

Uses `DATABASE_URL=postgresql+psycopg://stj:stj@postgres:5432/stj_file_system`. The `psycopg` driver is already in `requirements.txt`.

---

## Seeding Demo Data

When **`ENVIRONMENT=development`** and **`DEBUG=true`**, the backend calls `seed_database()` on startup and fills an **empty** database with sample data:

| Item | Details |
|------|---------|
| Root folders | Documents, Projects, Photos, Archive |
| Nesting | Up to 3 levels (e.g. `Documents → Work → Reports`) |
| Files | 150 demo files in prefix clusters (`report`, `test`, `data`, …) for search testing |

Prefix clusters let you verify the **top-10** search cap — e.g. searching `report` matches 22 files but returns only 10. Files are placed in folders that match their type (photos in **Photos/2024**, reports in **Reports**, backups in **Archive**, etc.).

### Enable seeding

Add to `backend/.env`:

```env
ENVIRONMENT=development
DEBUG=true
```

Or pass inline when starting the server:

```bash
# macOS / Linux
ENVIRONMENT=development DEBUG=true uvicorn app.main:app --reload --port 8000

# Windows PowerShell
$env:ENVIRONMENT="development"; $env:DEBUG="true"
uvicorn app.main:app --reload --port 8000
```

### When seeding is skipped

- `DEBUG=false` or `ENVIRONMENT=production` without overriding in `backend/.env`
- Database already contains folders (no duplicates)

### Re-seed from scratch

1. Stop the backend
2. Delete the database:

   ```bash
   # macOS / Linux
   rm -f backend/stj_file_system.db

   # Windows PowerShell
   Remove-Item backend\stj_file_system.db -ErrorAction SilentlyContinue
   ```

3. Restart with `ENVIRONMENT=development` and `DEBUG=true`

---

## API Documentation (Swagger UI)

FastAPI generates interactive API documentation automatically.

**Swagger UI:** http://localhost:8000/docs

**ReDoc:** http://localhost:8000/redoc

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/folders` | List all folders |
| `POST` | `/folders` | Create folder (`name`, optional `parent_id`) |
| `DELETE` | `/folders/{id}` | Delete folder and contents (cascade) |
| `POST` | `/folders/{id}/files` | Create file in folder |
| `GET` | `/files` | List files (optional `?folder_id=`) |
| `DELETE` | `/files/{id}` | Delete file |
| `GET` | `/search?query=abc` | Prefix search (starts-with), max 10 results; optional `folder_id` scopes to direct children |

### Search behaviour

- **Starts-with only** — used for autocomplete while typing. `query=rep` matches `report.txt` but not `my-report.txt`.
- **Top 10** — results are ordered alphabetically and capped at 10.
- **Case-insensitive** — `Report` and `report` match the same files.
- **Full filename** — typing a complete name still works because it starts with itself (e.g. `report-001.pdf`).
- **Folder scope** — `folder_id` limits results to files **directly in that folder**, not in subfolders.

### Example

```bash
curl -X POST http://localhost:8000/folders \
  -H "Content-Type: application/json" \
  -d '{"name": "Documents"}'
```

### Error response format

```json
{
  "error": {
    "code": "FOLDER_NOT_FOUND",
    "message": "Folder with id 99 not found",
    "details": { "folder_id": 99 }
  }
}
```

---

## Testing

From the `backend/` directory with the virtual environment activated:

```bash
pip install -r requirements.txt
pytest
```

Or run the wrapper script:

```bash
python scripts/run_api_tests.py
```

Tests use an isolated in-memory SQLite database and cover folder/file CRUD, prefix search (including the 10-result cap), folder-scoped search, cascade delete, duplicate-name conflicts, and validation errors.

---

## Project Structure

```
stj-file-system/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app, CORS, lifespan, routers
│   │   ├── settings.py          # pydantic-settings (env, debug, DB, CORS)
│   │   ├── database.py          # SQLAlchemy engine and sessions
│   │   ├── models.py            # Folder & File ORM models
│   │   ├── schemas.py           # Pydantic request/response schemas
│   │   ├── crud.py              # Database operations
│   │   ├── seed.py              # Demo data seeder
│   │   ├── exceptions.py        # Custom API exceptions
│   │   ├── error_handlers.py    # Global exception handlers
│   │   └── routers/             # folders, files, search, health
│   ├── Dockerfile
│   ├── docker-entrypoint.sh
│   ├── requirements.txt
│   ├── tests/                   # pytest suite (conftest.py, test_api.py)
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── api.ts               # HTTP client for the backend
│   │   ├── hooks/               # useFileSystem, useDebouncedValue
│   │   ├── components/          # FolderTree, FileExplorer, SearchPanel, …
│   │   └── utils/               # Tree-building helpers
│   ├── Dockerfile               # Multi-stage build (Node → nginx)
│   ├── nginx.conf               # Static files + API proxy
│   └── vite.config.ts           # Dev server + API proxy
├── docker-compose.yml
├── docker-compose.postgres.yml  # Optional Postgres override
└── README.md
```

---

## Configuration

Settings are loaded from environment variables and `backend/.env` via **pydantic-settings** (`backend/app/settings.py`).

| Variable | Default | Description |
|----------|---------|-------------|
| `ENVIRONMENT` | `development` | `development` or `production` |
| `DEBUG` | `false` | SQL echo + demo seeding when combined with development |
| `DATABASE_URL` | `sqlite:///./stj_file_system.db` | SQLAlchemy connection URL |
| `CORS_ORIGINS` | `["http://localhost:5173", …]` | JSON array of allowed origins |

See `backend/.env.example` for a full template.

---

## Design Decisions & Notes

- **SQLite by default** — zero-config local development; swap to Postgres via `DATABASE_URL` and the optional compose override.
- **Separate Folder and File tables** — folders use self-referencing `parent_id`; files reference a `folder_id`.
- **Cascade deletes** — deleting a folder removes its subfolders and files at the database level.
- **Duplicate names** — case-insensitive uniqueness within the same parent folder or file folder; duplicates return `409 Conflict`.
- **Search is prefix-based** — `query=rep` matches `report.txt` but not `my-report.txt` (case-insensitive). Full filenames match when typed completely.
- **Folder-scoped search** — optional `folder_id` on `/search` matches files directly in that folder only, not descendants.
- **List endpoints return all rows** — `GET /folders` and `GET /files` are not capped at 100 items.
- **Files require a folder** — the API creates files inside a folder via `POST /folders/{id}/files`.
- **No authentication** — intended for local development; add auth before any public deployment.
- **Docker reads `backend/.env`** — compose loads your `.env` for `ENVIRONMENT`, `DEBUG`, and CORS; only `DATABASE_URL` is overridden to the Docker volume path.
- **Frontend API calls use relative paths** — Vite (dev) and nginx (Docker) proxy `/folders`, `/files`, `/search`, and `/health` to the backend.

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `API offline` in the UI | Start the backend (`uvicorn`) or run `docker compose up --build` |
| `Unable to reach the server` | Confirm backend is running on port 8000 |
| `ModuleNotFoundError: app` | Run uvicorn from the `backend/` directory with the venv activated |
| Port 8000 or 5173 in use | Stop the conflicting process or change ports in config / compose |
| Stale or corrupt data | Delete `stj_file_system.db` or run `docker compose down -v` |
| Docker build fails | Ensure Docker Desktop is running; try `docker compose build --no-cache` |
| Seeding did not run | Set `ENVIRONMENT=development` and `DEBUG=true` in `backend/.env`; ensure the database is empty (`docker compose down -v` for Docker) |

---

## Assumptions

- Files are **metadata only** (name + folder membership); no file content, upload, or download.
- No user authentication or authorization.
- Search autocomplete uses **starts-with** matching, not contains or fuzzy search.
- Files must belong to a folder; there are no root-level files in the UI.
- Frontend styling is functional, not mobile-optimised (per exercise scope).

---

## License

This project is provided as-is for learning and development purposes.
