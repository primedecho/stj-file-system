# 02 — Database LLM Context (STJ File System)

> **Scope:** Persistence, schema, queries, migrations, and data-access rules.  
> **Companion:** `01_basic_LLM_context.md` (architecture), `03_best_practices_LLM.md` (code patterns).

---

## 1. Database Philosophy

### Primary choice (default, strongly opinionated)

**SQLite** via SQLAlchemy + file-backed DB:

- Local dev: `sqlite:///./stj_file_system.db` (under `backend/`)
- Docker: `sqlite:////app/data/stj_file_system.db` in named volume `backend-data`

**Why:** Zero ops overhead, meets exercise allowance, fast iteration, single-file reproducibility for reviewers.

### Allowed alternative (explicit opt-in only)

**PostgreSQL 16** via Compose override:

```bash
docker compose -f docker-compose.yml -f docker-compose.postgres.yml up --build
```

Connection: `postgresql+psycopg://stj:stj@postgres:5432/stj_file_system`

**When to use:** Demonstrating production-shaped deployment, concurrency testing, or future features needing Postgres-specific types.

**When NOT to switch:** Convenience alone, or “best practice” without scale justification.

### Forbidden as default

- In-memory DB for dev/prod runtime (tests only).
- Multiple active DB engines in one process.
- JSON file or ad-hoc pickle persistence for domain data.

### ORM as source of truth

SQLAlchemy models in `models.py` define schema. `init_db()` uses `Base.metadata.create_all`—acceptable for exercise; **Alembic required before production schema evolution** (see §5).

---

## 2. Schema Design Rules

### Naming conventions (strict)

| Element | Rule | Example |
|---------|------|---------|
| Table names | lowercase plural snake | `folders`, `files` |
| Column names | lowercase snake | `parent_id`, `folder_id` |
| FK columns | `{referenced_singular}_id` | `parent_id`, `folder_id` |
| Indexes | `ix_{table}_{column}` (SQLAlchemy default) | `ix_folders_parent_id` |
| Python models | PascalCase singular | `Folder`, `File` |
| `__tablename__` | explicit string matching DB | `"folders"` |

### ID strategy

- **Integer autoincrement** primary keys (`Mapped[int]`)—current standard.
- **Do not** switch to UUID without ADR + migration plan + frontend ID type audit.
- IDs are stable for API URLs (`/folders/{id}`, `/files/{id}`).

### Timestamp conventions

- **Not present today.** Files/folders have no `created_at` / `updated_at`.
- **If added:** use timezone-aware UTC (`DateTime(timezone=True)`), set in app layer on create/update, never nullable on existing rows without backfill migration.

### Soft delete policy

- **Hard delete only**—matches cascade FK behavior and exercise scope.
- **Do not** add `deleted_at` without ADR, API contract change, and UI trash flow.

### String fields

- `name`: `String(255)`, non-null.
- Validate length in Pydantic **and** rely on DB constraint.

### Current schema (authoritative)

**folders:** `id`, `name`, `parent_id` (nullable FK → folders.id, ON DELETE CASCADE)

**files:** `id`, `name`, `folder_id` (nullable FK → folders.id, ON DELETE CASCADE)

**Note:** `folder_id` nullable in DB but **API/UI require folder** for new files. Nullable exists for ORM flexibility; do not expose root-file creation without explicit product decision.

---

## 3. Data Integrity Rules

### Foreign keys

- All relationships enforced at DB level with `ondelete="CASCADE"`.
- Folder delete removes subfolders and files recursively via DB—**no manual recursive delete in Python**.

### Uniqueness (application-enforced)

| Rule | Scope | Behavior |
|------|-------|----------|
| Folder name unique | Same `parent_id` (including `NULL` root) | Case-insensitive check → `409 FOLDER_ALREADY_EXISTS` |
| File name unique | Same `folder_id` | Case-insensitive check → `409 FILE_ALREADY_EXISTS` |

Implemented in `crud.py` via `func.lower(name)`.

**Future hardening:** optional DB unique indexes on `(lower(name), parent_id)` / `(lower(name), folder_id)` when on Postgres; SQLite requires migration care.

### Validation boundaries

| Layer | Responsibility |
|-------|----------------|
| Pydantic (`schemas.py`) | Shape, min/max length, required fields |
| CRUD (`crud.py`) | Existence checks, duplicate checks, search rules |
| Database | FK, NOT NULL, string length |
| Frontend | UX validation only—never authoritative |

**Never** trust frontend-only validation for integrity.

### Referential safety on create

- `parent_id` on folder create: parent must exist or `404 FOLDER_NOT_FOUND`.
- File create in folder: folder must exist.
- **No cycle prevention on update** today (no folder move/rename API). If update endpoints added, must validate against circular `parent_id`.

---

## 4. Data Access Strategy

### ORM vs raw SQL

| Use | Allowed |
|-----|---------|
| SQLAlchemy 2.0 `select()` + `Session` | **Default for all access** |
| Raw SQL strings | **Forbidden** except documented performance exception with ADR |
| `session.execute(text(...))` | Only for migrations or proven index hints |

### Session management

- Request scope: `get_db()` dependency yields session, closes in `finally`.
- Tests: override `get_db` in `tests/conftest.py` with in-memory engine + `StaticPool`.
- Seed: uses `SessionLocal()` directly in lifespan—acceptable; keep seed logic idempotent.

### Repository pattern

- **Current:** No separate repository layer—`crud.py` owns queries + rules.
- **Rule:** Do not add repository classes until `crud.py` split is justified (see `01_basic_LLM_context.md` §6).
- **When split:** repositories return models; services enforce rules; routers stay thin.

### Query patterns (mandatory style)

```python
stmt = select(models.File).where(...).order_by(models.File.name)
if limit is not None:
    stmt = stmt.limit(limit)
return list(db.scalars(stmt))
```

- Always **explicit `order_by`** on list/search endpoints.
- Search prefix: `models.File.name.ilike(f"{query}%")` — never leading wildcard.

---

## 5. Migration Strategy

### Current state (exercise)

- `init_db()` + `create_all` on startup.
- Acceptable for take-home; **not** sufficient for production schema changes.

### Before production or shared DB

- Introduce **Alembic** migrations under `backend/alembic/`.
- **Forward-only** migrations in prod; reversible scripts optional in dev.
- Never edit applied migration files—add new revision.

### Safe migration practices

1. Add nullable columns first → backfill → add NOT NULL constraint in later revision.
2. No destructive drops without backup plan and ADR.
3. Test migration against copy of prod-like data volume.
4. Seed data changes do **not** replace migrations.

### Production safety

- No `drop_all` outside tests.
- No `metadata.create_all` as sole schema strategy once Alembic adopted.
- Docker volume wipe (`docker compose down -v`) is **dev/demo only**—warn user before suggesting.

---

## 6. Performance Rules

### Current scale profile

- Demo seed: 150 files, ~13 folders.
- List endpoints return **all rows** (no default limit)—acceptable at this scale only.

### Pagination (mandatory before scale-up)

When folder/file count may exceed **1,000** per list call:

- Add `skip` + `limit` query params to `GET /folders` and `GET /files`.
- Frontend must paginate or virtualize tree—flat fetch will not scale.
- **Default limit** must be documented; unbounded lists forbidden in production.

### Search performance

- `/search`: **always** `LIMIT 10` at DB level—non-negotiable.
- Prefix `ILIKE 'query%'`—eligible for index on Postgres (`name varchar_pattern_ops` or `text_pattern_ops`).
- SQLite: table scans acceptable at current volume; add index on `lower(name)` if >10k files.

### Indexing requirements

| Column | Index | Reason |
|--------|-------|--------|
| `folders.parent_id` | yes (existing) | Tree listing by parent |
| `files.folder_id` | yes (existing) | Files per folder |
| `files.name` | add when >10k rows | Prefix search |

### N+1 queries

- Current flat list endpoints avoid N+1.
- If hierarchical API added, use eager loading (`selectinload`)—never lazy load in loops.

---

## 7. Environment Strategy

### Configuration source

`backend/app/settings.py` via pydantic-settings:

| Variable | Purpose |
|----------|---------|
| `ENVIRONMENT` | `development` \| `production` |
| `DEBUG` | SQL echo + seed gate |
| `DATABASE_URL` | SQLAlchemy URL |
| `CORS_ORIGINS` | JSON list of allowed origins |

Load order: env vars > `.env` file > defaults.

### Dev / test / prod separation

| Env | DATABASE_URL | Seed |
|-----|--------------|------|
| Local dev | `./stj_file_system.db` | Yes if `development` + `DEBUG=true` + empty DB |
| pytest | `sqlite:///:memory:` (conftest) | Never |
| Docker | volume path; `.env` for DEBUG/ENVIRONMENT | Per settings |
| Postgres override | `postgresql+psycopg://...` | Per settings |

### Secrets handling

- `.env` gitignored; commit `.env.example` only.
- Postgres compose credentials (`stj/stj`) are **demo only**—document as non-production.
- Never log `DATABASE_URL` with passwords.

### Connection management

- SQLite: `check_same_thread=False` in `database.py`.
- Postgres: use pool defaults; tune when deploying for concurrency.
- One engine per process—do not create engines per request.

### Docker compose env rule

- `docker-compose.yml` **overrides only `DATABASE_URL`** for container path.
- Other vars come from `backend/.env` via `env_file`.
- Do not hardcode `ENVIRONMENT`/`DEBUG` in compose unless user explicitly wants fixed prod mode.

---

## 8. LLM Database Behavior Rules

### Must warn before

- Dropping tables, columns, or volumes.
- Changing FK cascade behavior.
- Removing duplicate-name checks.
- Switching ID type (int → UUID).
- Unbounded list queries in production context.
- Raw SQL without ADR.

### Must consider scale

- Any new list endpoint needs pagination plan.
- Search must stay capped at 10.
- Tree UI loading all files will break at scale—flag when adding features.

### Must justify schema decisions

When adding columns/tables, state:

1. **Purpose** (what invariant it enforces)
2. **Alternative rejected**
3. **Migration path**
4. **API impact**

### Seed data rules (`seed.py`)

- Runs only when `settings.should_seed_database` and folder count == 0.
- 150 files in prefix clusters; **logical folder placement** via `FILE_CLUSTERS` mapping.
- Do not revert to round-robin placement across unrelated folders.
- Changing seed counts requires updating `SEARCH_DEMO_FILE_COUNT` validation.

### Search semantics (DB layer)

- Prefix only: `ilike(f"{query}%")`.
- Optional `folder_id`: filters **direct children of that folder only**—not subtree.
- Changing to recursive search requires query redesign + doc update + new tests.

### Destructive operation checklist

Before implementing DELETE schema changes or `down -v`:

1. Confirm user intent.
2. State data loss scope.
3. Offer backup/export if production-like data exists.

---

## Decision Traceability (Database)

Record in `docs/decisions/NNNN-*.md` when:

- Adopting Alembic
- Adding soft delete
- Changing uniqueness to DB constraints
- Moving to Postgres as default
- Adding pagination defaults

Supersede old ADRs; do not delete history silently.
