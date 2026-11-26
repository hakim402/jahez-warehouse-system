# Jahez Deployment Runbook — Regional Staging and Pilot Readiness

Both regions deploy the **same code revision** with the shared [`compose.yml`](compose.yml); only the
env file differs. International runs on Hostinger, mainland China on Alibaba Cloud ECS. Record each
region's deployed revision separately.

## International production addresses

| Service | Address |
| --- | --- |
| Office Web | `https://office.jahez.online` |
| Server API | `https://api.jahez.online/api/v1` |
| API readiness | `https://api.jahez.online/api/v1/health/ready` |
| Socket.IO | `https://api.jahez.online`, default path `/socket.io/` |

Point both DNS records to the Hostinger VPS and provide a TLS certificate covering both names.
The shared Nginx template serves both hostnames using the international template's quoted `DOMAIN`
value. Verify DNS and certificate issuance during deployment.

For the current Office Web build, keep `VITE_API_BASE_URL=/api/v1`. Nginx proxies Office Web's
`/api/` and `/socket.io/` routes to the same backend, keeping browser requests on the office origin.
Mobile and external API clients use `https://api.jahez.online/api/v1` directly.
If Office Web switches to the absolute API domain later, first configure and verify REST and
Socket.IO cross-origin access specifically for `https://office.jahez.online`.

## Prerequisites (operator-supplied, not in the repo)

- A staging host per region with Docker + Docker Compose.
- A domain per region and TLS certificates (Let's Encrypt or purchased) placed in `deploy/tls/`.
- Cloud storage credentials: S3-compatible (international) or Alibaba OSS (mainland).
- Invoice AI keys: DeepSeek (international) or Qwen/Model Studio (mainland).
- An off-server backup target mounted at `BACKUP_DIR` (separate volume, remote share, or bucket mount).

## Deploy a region

1. Build the office web assets into `deploy/www/`:
   `pnpm --dir apps/office-web build` and copy `apps/office-web/dist/*` to `deploy/www/`.
2. Create the region env: `cp env/<region>.env.example env/<region>.env` and fill in secrets. Keep
   `env/<region>.env` out of git.
3. Render Nginx: 
   `envsubst '${DOMAIN} ${TLS_CERT} ${TLS_KEY} ${MAX_UPLOAD_MB}' < nginx/jahez.conf.template > nginx/jahez.conf`
   using the region's values (export them or source the env first).
4. Place TLS cert/key in `deploy/tls/` matching `TLS_CERT`/`TLS_KEY`.
5. Start PostgreSQL first with `docker compose --env-file env/<region>.env up -d postgres`.
   Provision the separate `jahez_app` runtime login using a private password through the database
   administrator connection. Set `DATABASE_URL` to that login and keep `MIGRATION_DATABASE_URL`
   on the migration role. Build the API image, run migrations with `docker compose --env-file
   env/<region>.env run --rm api node apps/server/dist/migrate.js`, then apply the runtime grants
   listed below. Bring up the full stack with `docker compose --env-file env/<region>.env up -d --build`.
   The `api` service runs `dist/migrate.js` then `dist/main.js`; the `worker` runs `dist/worker.js`.
6. International health check: `curl --fail https://api.jahez.online/api/v1/health/ready`.
   Open `https://office.jahez.online` and verify its proxied API and Socket.IO connections.

### Required runtime database grants

Create a separate runtime role and migration role instead of one superuser, then apply the grants
listed in [`apps/server/.env.example`](../apps/server/.env.example): USAGE on `public`, SELECT/INSERT
on application tables, the column-level UPDATE on `export_jobs` and `invoice_imports`, USAGE/CREATE
on the `pgboss` schema, and REVOKE UPDATE/DELETE/TRUNCATE on the append-only ledgers. Point
`DATABASE_URL` at the runtime role and `MIGRATION_DATABASE_URL` at the owner/migration role.

## Backups and restore drill

- For S3/OSS, enable versioning and configure a separate regional backup or replication target.
  The scripts below archive local disk only. Verify recovery of every provider referenced in the
  database, including objects retained after switching the write provider, in the staging drill.
- Schedule `backup/backup.sh` (cron) with the region env exported. It writes an encrypted PostgreSQL
  dump, an encrypted files archive, and a sha256 manifest to the off-server `BACKUP_DIR`.
- Restore drill: create an empty target database, then run `backup/restore.sh` with `RESTORE_*`
  env pointing at the archives, the target DB, and a storage dir. Verify row/file counts afterward.
- Encryption is OpenSSL AES-256-CBC with PBKDF2; a wrong passphrase fails the restore rather than
  producing garbage.

## Verification checklist (per region)

- [ ] Same build and migrations apply cleanly from the current revision.
- [ ] Independent database, file storage, and AI settings for this region.
- [ ] Docker Compose services (postgres, api, worker, nginx) are healthy.
- [ ] Nginx serves office-web, proxies `/api/`, and upgrades `/socket.io/` WebSockets over HTTPS.
- [ ] HTTP redirects to HTTPS; TLS chain is valid.
- [ ] Core API and live updates reachable from Yiwu **without a VPN** (mainland region).
- [ ] Mobile app upgrades against the deployed `/api/v1` without breaking the previous release.
- [ ] Backup completes to the off-server target; restore drill reproduces data and files.

## Open checks (cannot be verified from the development machine)

These require real staging hosts, domains, TLS, cloud credentials, AI keys, and physical Yiwu
network access, so they are recorded as pending rather than done:

- Docker image build and Compose startup (Docker is unavailable in the dev environment).
- Nginx config load and HTTPS/WebSocket routing under a real domain (nginx not installed locally).
- Live S3/OSS storage reads and writes with real bucket credentials.
- Live DeepSeek/Qwen invoice extraction accuracy with authorized synthetic samples.
- Regional network reachability from Yiwu without a VPN.
- Mobile-upgrade compatibility against the deployed API.
- A full-schema regional restore drill to the off-server target.

Locally verified instead: the encrypted backup/restore round-trip (PostgreSQL dump + files archive),
wrong-passphrase failure, and that the committed templates contain no secrets. See
[Step 11 progress](../documents/progress/server/PROGRESS.md#step-11--regional-staging-and-pilot-readiness).
