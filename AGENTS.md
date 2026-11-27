# Jahez Warehouse System Agent Guide

These repository instructions apply to Codex and Qoder. Read [Project Context](documents/context/PROJECT-CONTEXT.md) at the start of a task. Use the linked requirements and architecture sections relevant to the change. Check the current code before treating a planned component as implemented.

For Office Web or Worker Mobile integration, read the shared [Backend Integration Guide](documents/api/BACKEND-INTEGRATION.md), then inspect the relevant [design references](documents/designs/README.md) before UI coding. Use `documents/designs/office-web/` for Office Web and `documents/designs/worker-mobile/` for Worker Mobile. Record the chosen design and API dependencies in the app's numbered plan. Follow the linked tech-stack layout and keep code DRY through the existing feature services, request layer, and reusable controls. Record a missing reference and ask for direction before inventing a replacement design.

## Work in the owning application

- `apps/server` owns the NestJS API, background worker, warehouse rules, and database migrations.
- `apps/office-web` owns the React and Vite dashboard. `apps/worker-mobile` owns the Flutter worker app and its local sync state.
- Follow the [app structure](documents/tech-stack/PROJECT-STRUCTURE.md#app-structure). Keep page components, screen widgets, and their state close to the feature that uses them. Move reusable UI to feature-level folders or shared UI when it has consumers at that scope.
- For UI, theme, logo, or icon work, use the [Jahez brand kit guidance](documents/context/PROJECT-CONTEXT.md#brand-kit) and reuse the supplied artwork and design tokens.
- Keep business rules in their existing feature modules. Reuse the inventory service for stock movements and the same application services for online and offline requests.
- Verify tenant and warehouse authorization on the server. Keep prices and costs out of worker responses and offline data.
- Use descriptive names and reserve comments for the reasons behind business rules, permissions, offline retries, and transactions.

## Workflow for every step

A request such as “start Server Step 6” includes the planning, implementation, verification, and progress work below. Use the [planning and progress index](documents/context/PROJECT-CONTEXT.md#planning-and-progress) to find the affected app's roadmap, plan, and progress log.

1. **Identify the step.** Read the requested app's roadmap, plan, and progress log. Confirm the step number, scope, and dependencies against the current code.
2. **Save the plan before coding.** Update the existing `PLAN.md` for every affected app under its matching `Step N` heading. Describe the goal, numbered implementation tasks, affected modules or screens, migrations or API changes where relevant, dependencies, and acceptance checks. Mark the plan `In progress` when implementation starts. For a fix, update the plan under the step that owns it. Write the plan to the repository before editing application code. A roadmap entry or chat outline alone is insufficient.
3. **Implement the step.** Stay within the apps and steps the user requested. Inspect other apps as needed to verify their contracts. Record out-of-scope dependencies and ask before expanding to another app or step. Update the plan before continuing if the implementation or checks materially change.
4. **Verify the work.** Run the applicable commands below and exercise the affected workflow with synthetic or redacted data. Record the actual results and any checks still pending.
5. **Save progress before committing.** Update the existing `PROGRESS.md` under the same `Step N` heading with the date, completed work, verification results, blockers or gaps, and next step. Keep both documents in roadmap order and update the status in `PLAN.md` to match. Mark the step verified once its required checks pass.
6. **Commit and push each verified update.** Review the staged diff and make a focused commit containing the implementation, plan, and progress updates together. Push to GitHub `main` and confirm the push before advancing. Preserve unrelated work and honor any request to stop at a plan or review checkpoint or to leave work uncommitted. Use the same commit-and-push workflow for requested documentation updates. Deploy only when explicitly requested.

## Verification commands

Run the applicable checks from the repository root with the app dependencies available.

```bash
pnpm --dir apps/server typecheck
pnpm --dir apps/server build
pnpm --dir apps/office-web build
(cd apps/worker-mobile && flutter analyze)
```

Use `.env.example` for variable names. Keep credentials in local `.env` files and keep private supplier invoices out of commits and external test requests unless the user authorizes the transfer.
