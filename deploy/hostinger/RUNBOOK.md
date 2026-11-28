# Hostinger international deployment

The Jahez account runs the warehouse API, worker and PostgreSQL 16 in the `jahez-warehouse-intl` rootless Compose project. The warehouse API listens on `127.0.0.1:18744`. Company Nginx serves Office Web and proxies the API and Socket.IO on `127.0.0.1:13080`. Public Nginx owns TLS for `office.jahez.online` and `api.jahez.online`.

## Build and prepare privately

1. Use `~/apps/jahez-warehouse-system/source` for the Git checkout. Pin the full reviewed Git SHA as `release` and record the previous Git SHA, image, Office Web symlink target and database backup on updates.
2. Build the shared Server image from the repository root.

   ```sh
   docker build -f apps/server/Dockerfile -t "jahez-warehouse-intl:$release" .
   ```

3. Keep `VITE_API_BASE_URL=/api/v1` and `VITE_DEFAULT_WAREHOUSE_ID` in the app’s `config/office.env`. Use the assigned production warehouse UUID. Reuse this environment file for each Office Web build from the checkout root.

   ```sh
   docker run --rm --memory=1200m --cpus=1.5 --pids-limit=192 \
     --mount "type=bind,source=$PWD,target=/workspace" --workdir /workspace/apps/office-web \
     --env-file ../config/office.env node:22-bookworm-slim \
     sh -ec 'corepack enable; pnpm install --frozen-lockfile; pnpm build'
   ```

   Install `dist` in a new directory under `www/releases/`. Keep old hashed assets reachable for open browser tabs, then switch `www/current` by atomic symlink replacement. Verify the live HTML, configured assets and API readiness. Restore the previous symlink if verification fails.
4. Install the files from this folder into the app’s sibling `deployment` directory. Run `bash ../deployment/initialize.sh "$release"` from the checkout. It creates mode-600 credentials on first install, starts PostgreSQL, creates the separate roles, applies migrations with the migration credential and applies the runtime grants. The API and worker carry the restricted login. Private files start on the warehouse storage volume. External invoice extraction starts disabled.
5. Register port `18744` for Jahez in the administrator-managed bind and connect policies before publishing it. Verify existing services and company isolation. Install `warehouse.service` as `~/.config/systemd/user/jahez-warehouse.service`, then run `systemctl --user daemon-reload` and `systemctl --user enable --now jahez-warehouse.service`. Check `/api/v1/health/ready` on the loopback listener and check the background worker logs.

## Route the international domains

1. Install `company-nginx-proxy.conf` as `~/services/nginx/snippets/jahez-warehouse-proxy.conf` and `company-nginx.conf` as `~/services/nginx/conf.d/jahez-warehouse.conf`. Test the Jahez Nginx configuration and reload it. Probe both private virtual hosts with their `Host` headers.
2. The administrator installs `public-nginx-http.conf` as a separate site and creates `/var/www/jahez-warehouse-acme/.well-known/acme-challenge/`. Test and reload public Nginx, then issue a webroot certificate named `warehouse.jahez.online` for both domains. Install `public-nginx-https.conf`, test and reload, and configure a renewal deploy hook to reload Nginx for that certificate.
3. Wait for the new Nginx workers to take over after each reload. Verify HTTPS on both hosts, redirects, SPA route refresh, assets, API readiness and Socket.IO upgrades. Recheck the Jahez website and Shipping. Run the Office Web pilot checklist against synthetic data before staff onboarding.

## Operate and recover

- The production environment lives at `config/production.env`; the migration credential lives at `config/migration.env`. Keep both files mode 600. Reuse their credentials on updates and edit only the image tag for a new release. Use matching `deploy/compose.yml` and `deployment/compose.yml` files when running Compose manually.
- To enable international invoice extraction, set `INVOICE_AI_PROVIDER=deepseek` and supply the key as `INVOICE_AI_API_KEY` in `config/production.env`. Configure the intended endpoint and vision model if different from the provider defaults. Recreate `api` and `worker` with `docker compose up -d --no-deps --no-build --wait api worker` using those deployment files, then verify extraction on a synthetic invoice.
- Use PostgreSQL 16 tools for warehouse backups, for example `pg_dump` and `pg_restore` in the warehouse PostgreSQL container. Archive the private files volume with the database, encrypt the archives and retain an off-server copy. Restore into an isolated stack and verify records and files before enabling pilot accounts.
- For application rollback, stop the warehouse user service, restore the previous image tag and static symlink, and start the warehouse service after confirming schema compatibility. A schema rollback needs a verified restore prior to switching traffic back. Keep both persistent volumes throughout a rollback.
