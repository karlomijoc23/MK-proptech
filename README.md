# MK-proptech

Unified property-operations platform with a FastAPI backend, a React (CRACO) frontend, and AI-assisted contract/billing workflows.

## Requirements

- Python 3.9+
- Node.js 20+ (Corepack enabled for Yarn)
- MariaDB 11.4+ (or compatible managed instance) when `USE_IN_MEMORY_DB=false`

## Repository Layout

```
backend/          FastAPI application and persistence utilities
frontend/         React SPA (CRACO) and shared UI components
scripts/          Start/stop helpers for dev servers
brand/, docs/     Design guidelines, RBAC matrix, etc.
tests/            Pytest suites and shared factories
tests/            Pytest suites and shared factories
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

| Variable                                                                          | Description                                                                  |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `DATABASE_URL` **or** (`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`) | MariaDB connection details (required when persistence enabled)               |
| `USE_IN_MEMORY_DB`                                                                | `true` (default) keeps all data transient; set `false` to use MariaDB        |
| `OPENAI_API_KEY`                                                                  | Enables AI endpoints (`/api/ai/*`); fallback templates still work when empty |
| `API_TOKENS`                                                                      | Comma-separated `token:role` pairs for Bearer auth                           |
| `AUTO_RUN_MIGRATIONS`, `SEED_ADMIN_ON_STARTUP`                                    | Control automatic migrations/seed                                            |
| `INITIAL_ADMIN_*`                                                                 | Bootstrap credentials for the first admin                                    |
| `CORS_ORIGINS`                                                                    | Allowed origins for the SPA                                                  |
| `REACT_APP_BACKEND_URL`                                                           | Frontend pointer to the API                                                  |

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
alembic upgrade head           # apply migrations
# Admin seeding happens automatically on startup if configured
```

The FastAPI app runs `initialize_persistence()` automatically when `USE_IN_MEMORY_DB=false`.

## Daily Operations (How to Run)

### Starting the App

1.  **Start Backend**:
    ```bash
    ./scripts/start_backend.sh
    ```
2.  **Start Frontend**:
    ```bash
    ./scripts/start_frontend.sh
    ```
3.  **Access**: Open `http://localhost:3000` in your browser.

### Stopping the App

- Press `Ctrl+C` in the terminal windows where the servers are running.
- Or run:
  ```bash
  ./scripts/stop_backend.sh
  ./scripts/stop_frontend.sh
  ```

### Data Persistence

- **Your data is safe**: All users, tenants, and documents are stored in your local **MariaDB** database.
- **Turning off the computer**: You can safely turn off your computer. The database saves data to your hard drive.
- **Restarting**: When you turn your computer back on, just run the "Starting the App" commands above. MariaDB should start automatically (managed by Homebrew).

### Troubleshooting

- **"Site can't be reached"**: Ensure both backend and frontend scripts are running.
- **"Database connection failed"**: Ensure MariaDB is running (`brew services start mariadb`).

## Authentication

- The first administrator can be created via `POST /api/auth/register` while the user collection is empty. For subsequent registrations you need a user with the `users:create` scope.
- Start the backend and frontend, then visit `http://localhost:3000/login` to sign in. The SPA stores the issued access token in `localStorage` and automatically injects it into subsequent API calls.
- Za odjavu koristite gumb **Odjava** u gornjoj navigaciji (po potrebi možete ručno obrisati `authToken` iz `localStorage`).

## Testing & Quality Gates

- Backend: `pytest`
- Frontend: `corepack yarn test` (runs Jest with `CI=true --runInBand --detectOpenHandles`)
- Frontend: `corepack yarn test` (runs Jest with `CI=true --runInBand --detectOpenHandles`)
- Formatting hooks: `pre-commit run --all-files`

Pre-commit currently runs:

- Black (Python)
- isort (`--profile=black`)
- Prettier (JS/JSON/CSS/MD)
  Install once via `pip install pre-commit && pre-commit install`.

## Operational Notes

- Every request is logged to `/api/activity-logs` with actor/scope metadata.
- AI contract helpers degrade gracefully when no `OPENAI_API_KEY` is provided.
- Runtime artifacts (logs, pid files) remain untracked; `deps/` houses optional local tooling.

### Multi-tenant behaviour

- The backend requires an `X-Tenant-Id` header on all protected routes. The default tenant (`tenant-default`) is provisioned automatically, and user registrations map platform roles to tenant roles (see `ROLE_TENANT_MEMBERSHIP_MAP`).
- `/api/tenants` returns the profiles a user can access. Switching tenants updates the context for every subsequent request and cascades through the React app via the tenant switcher that sits in the global navigation.
- Attempting to select a tenant without membership yields `403 Nemate pristup odabranom profilu`; automated tests for these guardrails live in `tests/test_tenant_scoping.py`.

### Document requirements & metadata

- Document validation is driven by `frontend/src/shared/documentRequirements.json`. Each type describes whether property/tenant/contract association is mandatory and lists any metadata fields that must be captured.
- The helper `getDocumentRequirements` (exported from `frontend/src/shared/documents.js`) merges defaults, normalises field identifiers, and is shared between the FastAPI document endpoints and the React wizard.
- Metadata validation occurs on the backend (`create_dokument`) and rejects payloads that miss required metadata or supply malformed values. Tests covering these rules are in `tests/test_tenant_scoping.py::test_document_metadata_validation`.
