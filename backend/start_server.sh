#!/bin/bash
source .venv/bin/activate

# Explicitly set all critical environment variables
export PROJECT_NAME="Riforma API"
export API_V1_STR="/api"
export SECRET_KEY="dev-secret-key-change-in-prod"
export AUTH_SECRET="dev-secret-key-change-in-prod"
export ACCESS_TOKEN_EXPIRE_MINUTES=11520

# Force MariaDB usage
export DATABASE_URL="mariadb+asyncmy://mkproptech:mkproptech@127.0.0.1:3306/mkproptech"
export DB_ECHO=false

# Allow both localhost and 127.0.0.1
# export BACKEND_CORS_ORIGINS="*"

# Admin Seeding - loaded from .env
# export SEED_ADMIN_ON_STARTUP=true
# export INITIAL_ADMIN_EMAIL="karlo.mijoc@pm.me"
# export INITIAL_ADMIN_PASSWORD="admin"
# export INITIAL_ADMIN_FULL_NAME="System Admin"
# export INITIAL_ADMIN_ROLE="owner"

export USE_IN_MEMORY_DB=false

echo "Starting Backend with explicit configuration..."
echo "Database: $DATABASE_URL"
echo "Admin: $INITIAL_ADMIN_EMAIL"

# Run the server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 > backend.log 2>&1
