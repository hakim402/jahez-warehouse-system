# Jahez Warehouse System Agent Guide

These repository instructions apply to Codex and Qoder. Read [Project Context](documents/context/PROJECT-CONTEXT.md) at the start of a task. Use the linked requirements and architecture sections relevant to the change. Check the current code before treating a planned component as implemented.

## Work in the owning application

- `apps/server` owns the NestJS API, background worker, warehouse rules, and database migrations.
- `apps/office-web` owns the React and Vite dashboard. `apps/worker-mobile` owns the Flutter worker app and its local sync state.
- Follow the [app structure](documents/tech-stack/PROJECT-STRUCTURE.md#app-structure). Keep page components, screen widgets, and their state close to the feature that uses them. Move reusable UI to feature-level folders or shared UI when it has consumers at that scope.
- For UI, theme, logo, or icon work, use the [Jahez brand kit guidance](documents/context/PROJECT-CONTEXT.md#brand-kit) and reuse the supplied artwork and design tokens.
- Keep business rules in their existing feature modules. Reuse the inventory service for stock movements and the same application services for online and offline requests.
- Verify tenant and warehouse authorization on the server. Keep prices and costs out of worker responses and offline data.
- Use descriptive names and reserve comments for the reasons behind business rules, permissions, offline retries, and transactions.

## Plan and record progress

Before implementing a change, update `PLAN.md` for each affected app with the scope, steps, dependencies, and verification criteria. After implementing and checking the work, update each app's `PROGRESS.md` with what was completed, check results, blockers, and the next step. Reuse the existing files for each task. The [planning and progress index](documents/context/PROJECT-CONTEXT.md#planning-and-progress) links to each app's files.

## Verify changes

Run the applicable checks from the repository root with the app dependencies available.

```bash
pnpm --dir apps/server typecheck
pnpm --dir apps/server build
pnpm --dir apps/office-web build
(cd apps/worker-mobile && flutter analyze)
```

For functional changes, exercise the affected workflow with synthetic or redacted data and state what was verified. Use `.env.example` for variable names. Keep credentials in local `.env` files and keep private supplier invoices out of commits and external test requests unless the user authorizes the transfer. Preserve unrelated work. Commit, push, or deploy only when requested.
