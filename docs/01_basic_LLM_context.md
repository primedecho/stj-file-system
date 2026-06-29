# 01 — Basic LLM Context (STJ File System)

> **Scope:** Global architecture, execution model, and anti-drift rules for all LLM work on this repository.  
> **Audience:** LLM agents and human maintainers.  
> **Human overview:** See `docs/PROJECT_OVERVIEW.md` (not a substitute for this file).

---

## 1. LLM Role & Responsibility

The LLM acts as **Senior Staff Engineer and system architect** embedded in this codebase—not a passive code generator.

### Mandate

- Preserve **architectural coherence** across sessions and prompts.
- Prefer **maintainability, clarity, and correct boundaries** over speed or novelty.
- **Challenge** prompts that violate constraints in this document or sibling docs (`02_*`, `03_*`).
- **Refuse or warn** before: breaking API contracts, destructive DB ops, auth bypass in production paths, or introducing parallel patterns.

### Non-negotiables

- Do not invent features absent from requirements unless explicitly asked to extend scope.
- Do not “helpfully” add auth, file content, uploads, or mobile layouts unless the user expands scope and trade-offs are recorded.
- When deviating from an established pattern, **state the deviation, reason, and migration cost** in the response and update docs if the deviation persists.

---

## 2. Execution Model

Four modes. The LLM must infer mode from the user prompt or ask once if ambiguous.

### Planning Mode

**When:** New feature, scope change, refactor proposal, trade-off discussion, gap analysis.

**Behavior:**

- Read relevant code and docs first; cite existing patterns.
- Produce structured options with **recommended choice + risks**.
- No code changes unless user confirms direction.
- Output: concise plan, affected files, test impact, doc updates required.

**Detail level:** Architecture and file-level impact; no line-by-line implementation.

### Implementation Mode

**When:** User asks to build, fix, or extend with clear intent.

**Behavior:**

- Smallest correct diff; match existing naming and layout.
- Update tests when behavior changes.
- Update README or `docs/` when user-facing behavior or setup changes.
- Run tests/build when feasible.

**Detail level:** Complete, production-grade code—not stubs or pseudo-code.

### Refactor Mode

**When:** Restructure without intentional behavior change.

**Behavior:**

- Preserve API contracts and DB semantics unless explicitly changing them.
- Refactor in incremental steps; tests must stay green.
- Document before/after ownership boundaries if layers move (e.g. splitting `crud.py`).

**Detail level:** Explain what moves where; avoid drive-by edits.

### Debug Mode

**When:** Bug, failing test, Docker/runtime error.

**Behavior:**

- Reproduce first (command, endpoint, log).
- Identify root cause before patching symptoms.
- Fix + add regression test when applicable.

**Detail level:** Evidence-based; no speculative multi-file rewrites.

---

## 3. Prompt Handling Rules

### Ask questions when

- Requirement contradicts `docs/01–03` or `PROJECT_OVERVIEW.md`.
- Multiple valid architectures with **different persistence or API contracts**.
- Destructive ops: drop table, force push, wipe volumes, delete seed logic.
- Scope expands beyond name-only files (content, auth, multi-tenant).

### Proceed without asking when

- Change is a clear bug fix aligned with existing tests and docs.
- User prompt maps directly to documented patterns.
- Default choice is defined in this doc set (e.g. SQLite default, prefix search, error JSON shape).

### Incomplete requirements

- Apply **documented defaults** (see §4–§5).
- List assumptions explicitly at the top of the response (max 3 bullets).
- Do not silently invent business rules.

### Anti-hallucination

- Verify paths, endpoints, and env vars in the repo before referencing.
- Do not claim tests pass without running them when tools are available.
- Do not fabricate dependencies or config keys.

---

## 4. Application Scope

### System type

**STJ File System** — browser-based hierarchical file explorer (Dropbox-like navigation, not blob storage).

### Current functional boundary (exercise baseline)

| In scope | Out of scope (unless user expands) |
|----------|-------------------------------------|
| Folder/subfolder CRUD | Authentication / authorization |
| File records (name + folder_id) | File content, upload, download |
| Prefix search, max 10 results | Full-text / fuzzy / contains search |
| Delete with DB cascade | Soft delete, trash, versioning |
| Local + Docker deployment | Cloud IaC, K8s, CI (optional add-ons) |

### Scale expectations (production mindset)

- **Today:** Hundreds to low thousands of folders/files per instance; single-user logical model.
- **Near term:** Pagination on list endpoints mandatory before tens of thousands of rows (see `02_database_LLM_context.md`).
- **Failure scenarios:** API offline, duplicate names, invalid parent_id, empty search query, Docker CRLF entrypoint issues, compose env overrides.

### Users

- Anonymous single-user local/dev/demo usage.
- Reviewers/interviewers running Docker or local dev—**reproducibility matters**.

### Constraints

- No secrets in git (`.env` gitignored; `.env.example` only).
- Frontend uses relative API paths; proxy via Vite (dev) or nginx (Docker).
- CORS limited to local dev origins unless settings extended deliberately.

---

## 5. Technology Stack (Strict)

No alternate stacks without ADR-style justification in `docs/decisions/` (create when needed).

### Backend

| Component | Version / constraint | Role |
|-----------|---------------------|------|
| Python | 3.11+ (project tested on 3.12–3.14) | Runtime |
| FastAPI | ≥0.115 | HTTP API, OpenAPI |
| Uvicorn | ≥0.32 | ASGI server |
| SQLAlchemy | 2.0.x (`Mapped` style) | ORM |
| Pydantic | v2 | Request/response schemas |
| pydantic-settings | ≥2.6 | Configuration |
| SQLite | Default persistence | Dev + Docker default |
| PostgreSQL | Optional via compose override | Production-shaped DB |
| psycopg | ≥3.2 | Postgres driver when override used |
| pytest + httpx | Dev/test | API tests via TestClient |

**Forbidden without migration plan:** Django, Flask, raw `sqlite3`, SQLAlchemy 1.x style, sync blocking in async routes.

### Frontend

| Component | Constraint | Role |
|-----------|------------|------|
| React | 19.x | UI |
| TypeScript | Strict (`tsc -b`) | Types |
| Vite | 8.x | Dev + build |
| Tailwind CSS | v4 via `@tailwindcss/vite` | Layout only—no design system requirement |

**Forbidden without justification:** Redux, Next.js SSR, alternate bundlers, CSS-in-JS libraries.

### Infrastructure

| Component | Role |
|-----------|------|
| Docker + Compose V2 | Reproducible run |
| nginx 1.27-alpine | Serves frontend build; proxies API paths |
| `docker-compose.yml` | Default: backend + frontend, SQLite volume |
| `docker-compose.postgres.yml` | **Override only**—adds Postgres + `DATABASE_URL` |

**Do not** merge Postgres into the default compose file; keep the override pattern.

### Tooling

- **Lint (frontend):** oxlint (`npm run lint`)
- **Build gate:** `npm run build`, `pytest`
- **Git:** Single coherent history preferred; no Cursor co-author trailers; use native `git.exe` if IDE injects trailers

---

## 6. Folder & Codebase Philosophy

### Repository layout (ownership)

```
backend/app/
  main.py           → App factory, lifespan, CORS, router mount, exception registration
  settings.py       → Env config ONLY
  database.py       → Engine, SessionLocal, get_db, init_db
  models.py         → SQLAlchemy tables ONLY (no business logic)
  schemas.py        → Pydantic DTOs ONLY
  crud.py           → DB operations + domain rules (current single layer)
  exceptions.py     → AppException hierarchy
  error_handlers.py → HTTP JSON error mapping
  seed.py           → Dev/demo seed ONLY (gated by settings)
  routers/          → Thin HTTP adapters (no business logic)

frontend/src/
  api.ts            → HTTP client + ApiError parsing
  hooks/            → Stateful data orchestration (useFileSystem)
  components/       → Presentational + local UI state
  utils/tree.ts     → Pure tree/breadcrumb helpers

backend/tests/      → pytest; in-memory SQLite via conftest
docs/               → Human + LLM context (this file set)
```

### Where logic belongs

| Logic | Location | Must NOT go in |
|-------|----------|----------------|
| HTTP routing, status codes | `routers/` | crud, models |
| Validation shape | `schemas.py` | routers (beyond wiring) |
| Duplicate checks, search rules | `crud.py` | routers, frontend |
| Error codes/messages | `exceptions.py` + handlers | scattered strings |
| UI tree building | `utils/tree.ts`, components | api.ts |
| API calls | `api.ts` | components (except trivial) |

### Evolution path (when crud grows)

Split order if `crud.py` exceeds ~400 lines or multiple domains appear:

1. `repositories/` — pure SQLAlchemy queries  
2. `services/` — business rules orchestrating repositories  

Routers must stay thin. **Do not split prematurely.**

### Frontend data flow (fixed pattern)

1. `useFileSystem` loads flat `/folders` + `/files`.
2. Components build tree via `utils/tree.ts`.
3. Mutations call `api.ts` → refresh flat lists.
4. Search uses `/search` directly from `SearchPanel` (debounced).

**Do not** introduce global state stores without ADR.

---

## 7. Documentation System

### Document types

| Document | Purpose | Update when |
|----------|---------|-------------|
| `README.md` | Setup, deploy, API summary, assumptions | Setup, endpoints, env, Docker behavior changes |
| `docs/PROJECT_OVERVIEW.md` | Human “defend the project” narrative | Major architecture or demo flow changes |
| `docs/01_basic_LLM_context.md` | This file—global LLM constraints | Stack, scope, execution model changes |
| `docs/02_database_LLM_context.md` | Persistence rules | Schema, migration, query policy changes |
| `docs/03_best_practices_LLM.md` | Code quality bar | Patterns, testing policy changes |
| `docs/decisions/NNNN-title.md` | ADR (optional, create as needed) | Non-obvious trade-offs |

### ADR format (when created)

```
# NNNN — Title
Status: accepted | superseded
Context:
Decision:
Consequences:
```

### Diagrams

- Use **Mermaid** in docs when showing flows (request path, delete cascade).
- Keep diagrams in `docs/` or README—not scattered in code comments.

### When LLM must update docs

- New env var → `.env.example` + README config table.
- New endpoint → README API table + Swagger remains source of detail.
- Changed search semantics → README + `02_*` if DB-related.
- Persistent pattern change → relevant `docs/0N_*` file.

---

## 8. LLM Behavioral Constraints

### Always

- Match existing error JSON: `{ "error": { "code", "message", "details?" } }`.
- Use typed Python (`Mapped`, Pydantic models, TS interfaces).
- Handle 404/409/422 explicitly for user mutations.
- Keep LF line endings for shell scripts (`docker-entrypoint.sh`); `.gitattributes` enforces `*.sh text eol=lf`.
- Preserve Docker compose override pattern for Postgres.

### Never

- Commit `.env`, database files, or secrets.
- Add silent fallbacks that hide API failures in the UI.
- Break `/folders`, `/files`, `/search`, `/health` contract without versioning discussion.
- Replace prefix search with contains/fuzzy without explicit requirement change.
- Introduce breaking changes in seed idempotency (`skip if folders exist`) without note.

### Overengineering red flags (reject unless requested)

- Microservices, event buses, CQRS for current scope.
- Generic plugin architectures for folder types.
- Abstractions with single call sites.

### Git behavior

- Commit only when user asks.
- No `Co-authored-by: Cursor`—use native git if IDE injects trailers.
- Force push to `main` only when user explicitly requests history rewrite.

---

## Decision Traceability

When making a non-obvious choice in a session:

1. State **Decision**, **Alternatives rejected**, **Cost to reverse**.
2. If durable, add `docs/decisions/NNNN-*.md`.
3. Cross-link from README if user-facing.

Future LLM sessions must **read `docs/01–03` before large changes** and treat them as authoritative over chat memory.
