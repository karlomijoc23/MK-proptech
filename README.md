# MK-proptech - Runbook

Backend (FastAPI)
- Env file `backend/.env`:
  - `MONGO_URL=mongodb://localhost:27017`
  - `DB_NAME=mkproptech`
  - `CORS_ORIGINS=http://localhost:3000`
  - `OPENAI_API_KEY=sk-...` (only required for the PDF AI endpoint)
  - `USE_IN_MEMORY_DB=true` (set `false` to connect to Mongo/Postgres)
  - `API_TOKENS=token123:admin,viewerToken:viewer` (optional auth)
  - `DEFAULT_ROLE=admin`
- Run:
  - `cd backend`
  - `python -m venv .venv && source .venv/bin/activate`
  - `pip install -r requirements.txt`
  - `uvicorn server:app --reload --port 8000`

Frontend (CRA + CRACO)
- Env file `frontend/.env`:
  - `REACT_APP_BACKEND_URL=http://localhost:8000`
- Run:
  - `cd frontend`
  - `yarn install`
  - `yarn start`

Notes
- The PDF parsing endpoint `/api/ai/parse-pdf-contract` detects ugovor/račun documents and feeds document + bill workflows.
- Activity logs are recorded for every API call (`GET /api/activity-logs`). Set `API_TOKENS` or `API_TOKEN` for Bearer auth in production.
- All entities (properties, tenants, contracts, documents, bills) share a central in-memory store; set `USE_IN_MEMORY_DB=false` to persist to Mongo/Postgres.
