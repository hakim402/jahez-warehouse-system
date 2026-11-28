# Multi-stage image for the Jahez server. The API and the background worker share this one image
# and differ only by command, matching the modular monolith with two entry points.
# Build context is the repository root: docker build -f apps/server/Dockerfile .
FROM node:22-bookworm-slim AS build
WORKDIR /app/apps/server
RUN corepack enable
COPY apps/server/package.json apps/server/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY apps/server ./
RUN pnpm build && pnpm prune --prod

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN groupadd -r jahez && useradd -r -g jahez jahez
COPY --from=build --chown=jahez:jahez /app/apps/server ./apps/server
RUN mkdir -p /data/storage && chown jahez:jahez /data/storage
USER jahez
EXPOSE 3000
# Default runs migrations then the API; the worker service overrides this with dist/worker.js.
CMD ["sh", "-c", "node apps/server/dist/migrate.js && node apps/server/dist/main.js"]
