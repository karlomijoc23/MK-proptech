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

> The development `.env` ships with `REACT_APP_DEV_AUTH_TOKEN=token123`, matching the default backend token in `backend/.env`. This allows the SPA to authenticate automatically without a login screen. Remove or override this variable for production builds.

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
| `REACT_APP_DEV_AUTH_TOKEN`                     | Optional dev-only token provisioned to the SPA when no login flow exists     |

> Sample envs live at `backend/.env`, `backend/.env.production.example`, and `frontend/.env` (plus `.env.production.example`); copy to `.env.local` or your deployment secrets store as needed.

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

## Testing & Quality Gates

- Backend: `pytest`
- Frontend: `CI=1 corepack yarn test --watch=false`
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

## Ready-for-publish Checklist

- [x] Automated migrations/seeders verified against Mongo
- [x] Consistent formatting enforced via pre-commit
- [x] Flake8 linting re-enabled with targeted configuration
- [x] Production env templates added (`backend/.env.production.example`, `frontend/.env.production.example`)
- [x] CI workflow (`.github/workflows/ci.yml`) running tests and formatting checks

Once the remaining checklist items are complete, the project is ready for deployment packaging.
