# 03 — Best Practices LLM Context (STJ File System)

> **Scope:** Coding standards, patterns, testing, and generation quality bar.  
> **Enforcement:** All generated code must comply unless user approves documented deviation.

---

## 1. Core Engineering Principles

| Principle | Rule |
|-----------|------|
| Clarity > cleverness | Prefer readable control flow over meta-programming |
| Explicitness > abstraction | One clear function beats three-layer indirection at current size |
| Maintainability > speed | Small correct diffs; no drive-by refactors |
| Consistency > novelty | Extend existing patterns before introducing new ones |
| Tests > assumptions | Behavior change requires test update or explicit justification |

Production bias: code must handle failure, invalid input, and empty states—not only happy paths.

---

## 2. Code Quality Standards

### Function size

- Target **≤ 40 lines** per function; split when exceeding **~60**.
- Routers: ideally **≤ 15 lines** (delegate to crud).
- React components: extract subcomponents when JSX branches multiply.

### Naming rules

**Python**

- Modules/functions: `snake_case`
- Classes/exceptions: `PascalCase`
- Constants: `UPPER_SNAKE` for true constants only
- Private helpers: `_leading_underscore`

**TypeScript**

- Components: `PascalCase`
- Hooks: `useCamelCase`
- Utils/types: `camelCase` / `PascalCase` for types
- Files: match export (`FolderTree.tsx`, `useFileSystem.ts`)

**API**

- REST plural nouns: `/folders`, `/files`
- Query params: `snake_case` (matches backend: `folder_id`)

### Comment philosophy

- Code explains **what**; comments explain **why** (non-obvious business rules only).
- No commented-out code in commits.
- Docstrings on public crud functions when behavior is not obvious (search limits, case rules).

### Formatting

- Python: follow existing file style; type hints required on new functions.
- TS: strict mode; no `any` without inline justification.
- Shell scripts: LF endings (see `.gitattributes`).

---

## 3. Error Handling (Strict)

### Backend pattern (required)

1. Raise `AppException` subclasses from `exceptions.py` for domain errors.
2. Global handlers in `error_handlers.py` map to JSON:

```json
{ "error": { "code": "SNAKE_CASE", "message": "...", "details": {} } }
```

3. Validation errors → `422` + `VALIDATION_ERROR` + field details.
4. Unexpected errors → `500` + generic message; **no stack traces to client**.

**Never** return ad-hoc `{ "detail": "..." }` from new endpoints.

### Frontend pattern (required)

- `api.ts` throws `ApiError` with parsed message.
- Hooks/components surface errors via `ErrorAlert`; mutations rethrow after setting state.
- Network failure (`status === 0`) shows connectivity message.

### Logging

- Use `logging` module in backend for seed failures and unexpected exceptions.
- Do not log PII or secrets.
- `DEBUG=true` enables SQL echo via SQLAlchemy—dev only.

### Edge cases (mandatory handling)

| Case | Expected response |
|------|-------------------|
| Missing folder/file ID | 404 + domain code |
| Duplicate name | 409 |
| Empty name / invalid payload | 422 |
| Empty search query | 422 (min_length=1 on query param) |
| Delete non-empty folder | 204; cascade handled by DB |

---

## 4. Architecture Patterns

### REQUIRED

| Pattern | Where | Why |
|---------|-------|-----|
| Thin routers | `backend/app/routers/` | HTTP concerns only |
| Pydantic DTOs | `schemas.py` | Contract + validation |
| Centralized errors | `exceptions.py`, `error_handlers.py` | Consistent API |
| Dependency injection | `get_db` | Testability |
| Custom hook for data | `useFileSystem` | Single refresh/mutation path |
| Pure tree utils | `utils/tree.ts` | Testable without DOM |
| pytest + TestClient | `backend/tests/` | Regression safety |

### OPTIONAL (with justification)

| Pattern | When |
|---------|------|
| Service layer split from crud | crud.py > ~400 lines or multiple domains |
| React sub-hooks | Component state > 3 related useState |
| ADR docs | Non-obvious trade-offs |

### FORBIDDEN (at current scope)

| Pattern | Why |
|---------|-----|
| God components (>300 lines JSX) | Unmaintainable |
| Business logic in routers | Untestable, duplicated |
| Direct `fetch` in components bypassing `api.ts` | Error handling drift |
| Global mutable singletons for DB sessions | Thread/concurrency bugs |
| Redux/MobX for current state size | Unnecessary complexity |
| Silent `except: pass` | Hides failures |
| Prefix search with `%query%` | Violates product spec |

---

## 5. Separation of Concerns

### Domain rules (must live in backend crud/services)

- Duplicate name checks (case-insensitive)
- Search prefix + limit 10
- Folder existence validation before file create
- Seed idempotency rules

### Infrastructure (database.py, settings.py, Docker)

- Engine creation, session factory
- Env loading
- Container paths, nginx proxy

### Application / HTTP (routers, main.py)

- Route definitions, status codes, dependency wiring
- CORS, lifespan hooks

### Presentation (frontend)

- Tree expand/collapse, breadcrumbs, debounced search UI
- Confirm dialogs for delete
- **No** authoritative validation or duplicate logic

### If business rule appears in frontend

- Treat as UX hint only; backend must enforce same rule.

---

## 6. Testing Strategy

### Mandatory (must exist / must update on change)

| Area | Requirement |
|------|-------------|
| API CRUD | pytest coverage for create/read/delete paths |
| Search | Prefix cap 10, no contains match, folder scope |
| Duplicates | 409 case-insensitive |
| Cascade delete | Folder delete empties children |
| Validation | 422 error shape |
| CI gate (recommended) | `pytest` + `npm run build` before merge |

### Test implementation rules

- Location: `backend/tests/`
- Isolation: in-memory SQLite via `conftest.py`; override `get_db`
- No dependency on seed data for unit/integration tests
- Descriptive test names: `test_<behavior>_<condition>`
- One logical assertion focus per test (multiple asserts OK if same behavior)

### Optional

- Frontend component tests (not required by exercise)
- E2E Playwright (future)
- Load tests (before claiming scale)

### Mocking rules

- Prefer real DB session over mocking SQLAlchemy for API tests.
- Mock external services only when introduced (none today).
- Do not mock `crud` in router tests—test through HTTP.

### Coverage expectations (qualitative)

- Every new endpoint: at least one success + one failure test.
- Every bug fix: regression test.
- No untested changes to search limit or duplicate logic.

### Running tests

```bash
cd backend && pytest
# or
python scripts/run_api_tests.py
```

---

## 7. Code Generation Rules

When implementing in **Implementation Mode**, generated code must:

1. **Compile and type-check** (Python imports, `tsc -b`).
2. **Match existing patterns** in neighboring files.
3. **Handle edge cases** listed in §3.
4. **Avoid pseudo-code**—ship complete functions.
5. **Minimize diff scope**—no unrelated formatting or renames.
6. **Add/update tests** for behavior changes.
7. **Update docs** when user-facing (README, `docs/PROJECT_OVERVIEW.md`).

### New endpoint checklist

- [ ] Pydantic schema
- [ ] crud function
- [ ] Router with correct status code
- [ ] Exception mapping if domain error
- [ ] README API table row
- [ ] pytest cases

### New frontend feature checklist

- [ ] `api.ts` function
- [ ] Hook or component wiring
- [ ] Error/loading state
- [ ] No duplicate business rules

---

## 8. Refactoring Rules

### Allowed when

- User requests cleanup
- File exceeds size guidelines
- Duplication appears **3+ times** (Rule of Three)

### Process

1. State **behavior preservation** intent.
2. Ensure tests green before and after.
3. Refactor in commits/steps isolatable by file.
4. Do not mix refactor + feature in one diff unless trivial.

### Breaking changes

- Require explicit user approval.
- Document API migration in README.
- Prefer additive changes (new fields optional) over removals.

### Safe improvement proposals

Present as: **Problem → Option A/B → Recommendation → Effort**

Do not rewrite working code for stylistic preferences alone.

---

## 9. Consistency Enforcement

### Pattern precedence (highest wins)

1. User explicit instruction in current prompt
2. `docs/01–03` (this set)
3. Existing code in same module
4. General language/framework conventions

If (1) conflicts with (2), warn user and proceed only after acknowledgment.

### Style drift prevention

- Match import order and typing style of target file.
- Use same error codes for same failure types.
- Keep API field naming `snake_case` in JSON (Pydantic default).
- Frontend mirrors backend types in `api.ts` interfaces.

### Anti-patterns to reject in review

- New error response shapes
- Alternate search semantics
- Hardcoded secrets
- Synchronous blocking calls in async FastAPI routes (keep sync def routes consistent with existing code unless migrating endpoint-by-endpoint)
- Creating `SETUP_CHECKLIST.md`-style duplicate docs—extend README or `docs/` hierarchy instead

---

## LLM Self-Check Before Submitting Code

Answer internally:

1. Did I read the affected modules?
2. Is the change the smallest that works?
3. Are tests updated?
4. Are docs updated if user-visible?
5. Does this violate prefix search, cascade delete, or error JSON contract?
6. Would this surprise a reviewer reading `PROJECT_OVERVIEW.md`?

If any answer is wrong, revise before finishing.

---

## Evolution

This document grows with the project. Propose amendments via PR or explicit user request. When amending:

- Keep rules **actionable** (if/then, must/must not).
- Remove superseded rules—do not accumulate contradictions.
- Reference ADRs for contested changes.
