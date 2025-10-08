# MK-proptech

Unified property-operations platform with a FastAPI backend, a React (CRACO) frontend, and AI-assisted contract/billing workflows.

## Requirements

- Python 3.9+
- Node.js 20+ (Corepack enabled for Yarn)
- MongoDB 7+ when `USE_IN_MEMORY_DB=false`

## Repository Layout

```
backend/          FastAPI application and persistence utilities
frontend/         React SPA (CRACO) and shared UI components
scripts/          Start/stop helpers for dev servers
brand/, docs/     Design guidelines, RBAC matrix, etc.
tests/            Pytest suites and shared factories
backend_test.py   External API smoke tester (defaults to localhost)
```

## Getting Started

### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

### Frontend

```bash
cd frontend
corepack enable       # once, if Corepack is disabled
corepack yarn install
```

## Configuration

Use environment files (`.env`, `.env.local`) or exported variables. Key settings:

| Variable                                       | Description                                                                  |
| ---------------------------------------------- | ---------------------------------------------------------------------------- |
| `MONGO_URL`, `DB_NAME`                         | Mongo connection (required when persistence enabled)                         |
| `USE_IN_MEMORY_DB`                             | `true` (default) keeps all data transient; set `false` for Mongo             |
| `OPENAI_API_KEY`                               | Enables AI endpoints (`/api/ai/*`); fallback templates still work when empty |
| `API_TOKENS`                                   | Comma-separated `token:role` pairs for Bearer auth                           |
| `AUTO_RUN_MIGRATIONS`, `SEED_ADMIN_ON_STARTUP` | Control automatic migrations/seed                                            |
| `INITIAL_ADMIN_*`                              | Bootstrap credentials for the first admin                                    |
| `CORS_ORIGINS`                                 | Allowed origins for the SPA                                                  |
| `REACT_APP_BACKEND_URL`                        | Frontend pointer to the API                                                  |

> Sample envs live at `backend/.env`, `backend/.env.production.example`, and `frontend/.env` (plus `.env.production.example`); copy to `.env.local` or your deployment secrets store as needed.

### Login Page

The application exposes a browser login form at:

- URL: `http://localhost:3000/login`
- Method: the form posts to `POST /api/auth/login`
- Inputs:
  - `email` (text input)
  - `password` (password input)

Successful authentication stores a Bearer token inside `localStorage` under the `authToken` key, which is then attached to subsequent API requests. A logout button in the header clears this value and redirects back to the login page.

## Database Migrations & Seeding

```
source backend/.venv/bin/activate
python -m backend.manage migrate       # apply migrations
python -m backend.manage seed-admin    # ensure initial admin
python -m backend.manage init          # migrate + seed according to env flags
```

The FastAPI app runs `initialize_persistence()` automatically when `USE_IN_MEMORY_DB=false`.

## Running Services

Backed start/stop scripts prevent duplicate processes:

```bash
./scripts/start_backend.sh    # uvicorn with reload on :8000
./scripts/start_frontend.sh   # CRACO dev server on :3000
./scripts/stop_backend.sh
./scripts/stop_frontend.sh
```

If you need persistence locally, start MongoDB first (binary installed in `deps/mongodb`):

```bash
deps/mongodb/bin/mongod \
  --dbpath deps/mongodb-data \
  --logpath deps/mongodb-data/mongod.log \
  --fork
```

## Authentication

- The first administrator can be created via `POST /api/auth/register` while the user collection is empty. For subsequent registrations you need a user with the `users:create` scope.
- Start the backend and frontend, then visit `http://localhost:3000/login` to sign in. The SPA stores the issued access token in `localStorage` and automatically injects it into subsequent API calls.
- Za odjavu koristite gumb **Odjava** u gornjoj navigaciji (po potrebi možete ručno obrisati `authToken` iz `localStorage`).

## Testing & Quality Gates

- Backend: `pytest`
- Frontend: `corepack yarn test` (runs Jest with `CI=true --runInBand --detectOpenHandles`)
- API smoke: `python backend_test.py` (`BACKEND_BASE_URL` overrides target)
- Formatting hooks: `pre-commit run --all-files`

Pre-commit currently runs:

- Black (Python)
- isort (`--profile=black`)
- Prettier (JS/JSON/CSS/MD)
  Install once via `pip install pre-commit && pre-commit install`.

## Operational Notes

- Every request is logged to `/api/activity-logs` with actor/scope metadata.
- AI contract helpers degrade gracefully when no `OPENAI_API_KEY` is provided.
- Runtime artifacts (logs, pid files) remain untracked; `deps/` houses the local Mongo install.

### Multi-tenant behaviour

- The backend requires an `X-Tenant-Id` header on all protected routes. The default tenant (`tenant-default`) is provisioned automatically, and user registrations map platform roles to tenant roles (see `ROLE_TENANT_MEMBERSHIP_MAP`).
- `/api/tenants` returns the profiles a user can access. Switching tenants updates the context for every subsequent request and cascades through the React app via the tenant switcher that sits in the global navigation.
- Attempting to select a tenant without membership yields `403 Nemate pristup odabranom profilu`; automated tests for these guardrails live in `tests/test_tenant_scoping.py`.

### Document requirements & metadata

- Document validation is driven by `frontend/src/shared/documentRequirements.json`. Each type describes whether property/tenant/contract association is mandatory and lists any metadata fields that must be captured.
- The helper `getDocumentRequirements` (exported from `frontend/src/shared/documents.js`) merges defaults, normalises field identifiers, and is shared between the FastAPI document endpoints and the React wizard.
- Metadata validation occurs on the backend (`create_dokument`) and rejects payloads that miss required metadata or supply malformed values. Tests covering these rules are in `tests/test_tenant_scoping.py::test_document_metadata_validation`.

## Ready-for-publish Checklist

- [x] Automated migrations/seeders verified against Mongo
- [x] Consistent formatting enforced via pre-commit
- [x] Flake8 linting re-enabled with targeted configuration
- [x] Production env templates added (`backend/.env.production.example`, `frontend/.env.production.example`)
- [x] CI workflow (`.github/workflows/ci.yml`) running tests and formatting checks
- [x] Tenant migration plan documented (data backfill, membership seeding, rollout checklist) - see `docs/tenant-migration-plan.md`
- [ ] QA pass covering AI-assisted document flows and multi-tenant access scenarios - follow `docs/qa-playbook.md`

Once the remaining checklist items are complete, the project is ready for deployment packaging.
