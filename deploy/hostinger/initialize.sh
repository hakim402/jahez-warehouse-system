#!/usr/bin/env bash
set -euo pipefail
umask 077

release=${1:?Pass the full SHA of the built warehouse release}
if [[ ! "$release" =~ ^[a-f0-9]{40}$ ]]; then
  printf '%s\n' 'Expected a full Git SHA' >&2
  exit 1
fi

deployment=$(cd "$(dirname "$0")" && pwd)
app=${deployment%/*}
production="$app/config/production.env"
migration="$app/config/migration.env"
cd "$app/source"
compose=(docker compose --env-file "$production" -f deploy/compose.yml -f "$deployment/compose.yml")

image="jahez-warehouse-intl:$release"
docker image inspect "$image" >/dev/null

if [[ ! -f "$production" && ! -f "$migration" ]]; then
  if docker volume inspect jahez-warehouse-intl_pgdata >/dev/null 2>&1; then
    printf '%s\n' 'Recover the environment files for the existing warehouse database volume before continuing' >&2
    exit 1
  fi

  mkdir -p "$app/config"
  postgres_password=$(openssl rand -hex 32)
  runtime_password=$(openssl rand -hex 32)
  migration_password=$(openssl rand -hex 32)
  jwt_secret=$(openssl rand -hex 48)
  (
    set -C
    cat > "$production" <<EOF
WAREHOUSE_IMAGE=$image
POSTGRES_DB=jahez_warehouse
POSTGRES_USER=warehouse_admin
POSTGRES_PASSWORD=$postgres_password
DATABASE_URL=postgresql://warehouse_runtime:$runtime_password@postgres:5432/jahez_warehouse
MIGRATION_DATABASE_URL=
DATABASE_POOL_MAX=8
JWT_SECRET=$jwt_secret
DEPLOYMENT_PROFILE=international
STORAGE_DRIVER=local
STORAGE_MAX_UPLOAD_MB=15
INVOICE_AI_PROVIDER=none
EOF
    printf 'MIGRATION_DATABASE_URL=postgresql://warehouse_migrator:%s@postgres:5432/jahez_warehouse\n' "$migration_password" > "$migration"
  )
fi

grep -qxF "WAREHOUSE_IMAGE=$image" "$production"
runtime_password=$(sed -nE 's|^DATABASE_URL=postgresql://warehouse_runtime:([a-f0-9]{64})@postgres:5432/jahez_warehouse$|\1|p' "$production")
migration_password=$(sed -nE 's|^MIGRATION_DATABASE_URL=postgresql://warehouse_migrator:([a-f0-9]{64})@postgres:5432/jahez_warehouse$|\1|p' "$migration")
[[ "$runtime_password" =~ ^[a-f0-9]{64}$ && "$migration_password" =~ ^[a-f0-9]{64}$ ]]

"${compose[@]}" config --quiet
"${compose[@]}" up -d --no-build --wait --wait-timeout 100 postgres

# Read credentials on stdin so they never appear in a process's command line.
{
  printf '\\set runtime_password %s\n\\set migration_password %s\n' "$runtime_password" "$migration_password"
  cat <<'SQL'
BEGIN;
SELECT format('CREATE ROLE warehouse_runtime LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD %L', :'runtime_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'warehouse_runtime') \gexec
SELECT format('CREATE ROLE warehouse_migrator LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD %L', :'migration_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'warehouse_migrator') \gexec
ALTER DATABASE jahez_warehouse OWNER TO warehouse_migrator;
REVOKE CONNECT ON DATABASE jahez_warehouse FROM PUBLIC;
GRANT CONNECT ON DATABASE jahez_warehouse TO warehouse_runtime;
COMMIT;
SQL
} | "${compose[@]}" exec -T postgres psql -X -q -v ON_ERROR_STOP=1 -U warehouse_admin -d jahez_warehouse

"${compose[@]}" run --rm --no-deps -T --env-from-file "$migration" api node apps/server/dist/migrate.js </dev/null
"${compose[@]}" exec -T postgres psql -X -v ON_ERROR_STOP=1 -U warehouse_admin -d jahez_warehouse \
  < "$deployment/runtime-grants.sql"
