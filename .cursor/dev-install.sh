#!/usr/bin/env bash
# Idempotent Cloud Agent install for Nancyfi.
# Prepares the toolchain, a local Postgres, env config, deps, and DB schema.
# Safe to run repeatedly and against a warm snapshot.
set -euo pipefail

cd "$(dirname "$0")/.."

PG_VERSION=16
PG_CLUSTER=main
DB_NAME=nancyfi
DB_USER=nancyfi
DB_PASSWORD=nancyfi
LOCAL_DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@127.0.0.1:5432/${DB_NAME}"

echo "==> Ensuring bun is installed"
if ! command -v bun >/dev/null 2>&1 && [ ! -x "$HOME/.bun/bin/bun" ]; then
  curl -fsSL https://bun.sh/install | bash
fi
export PATH="$HOME/.bun/bin:$PATH"

echo "==> Ensuring PostgreSQL is installed"
if ! command -v pg_ctlcluster >/dev/null 2>&1; then
  sudo apt-get update -qq
  sudo apt-get install -y -qq postgresql postgresql-contrib
fi

echo "==> Starting PostgreSQL cluster ${PG_VERSION}/${PG_CLUSTER}"
sudo pg_ctlcluster "${PG_VERSION}" "${PG_CLUSTER}" start >/dev/null 2>&1 || true

echo "==> Ensuring database role and database exist"
sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';"
sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"

echo "==> Ensuring .env.local exists"
if [ ! -f .env.local ]; then
  cat > .env.local <<EOF
DATABASE_URL=${LOCAL_DATABASE_URL}
BETTER_AUTH_SECRET=$(openssl rand -base64 32)
BETTER_AUTH_URL=http://localhost:3000
# Placeholder: set a real Resend key to deliver auth emails.
RESEND_API_KEY=re_placeholder_local_dev
EMAIL_FROM="Nancyfi <noreply@nancyfi.app>"
EOF
  echo "    wrote .env.local"
else
  echo "    .env.local already present, leaving untouched"
fi

echo "==> Installing JS dependencies"
bun install

echo "==> Applying database migrations to the local database"
# Force the local URL so migrations never touch an injected remote DATABASE_URL
# secret (env vars would otherwise shadow .env.local).
DATABASE_URL="${LOCAL_DATABASE_URL}" bun run db:migrate

echo "==> Install complete"
