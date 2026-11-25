# Jahez Warehouse System Project Context

Jahez manages supplier orders, receiving, dispatch, stock, expenses, and reporting. Office staff prepare and review orders. Workers confirm goods and attach evidence with minimal typing, including when the warehouse has no connection.

## Source documents

- The [System Design v2 requirements](../Requirments%20/REQUIREMENTS.md) define the pilot scope and behavior. The [original Word document](../Requirments%20/Requirments.docx) contains the source design.
- [Technology stack](../tech-stack/README.md) records the approved tools, regional architecture, and configuration choices.
- [Project structure](../tech-stack/PROJECT-STRUCTURE.md) defines feature ownership and implementation order. The [app layouts](../tech-stack/PROJECT-STRUCTURE.md#app-structure) show where React pages and components, Flutter screens and widgets, and NestJS modules belong.

## Brand kit

- Use the [Jahez design tokens](../brand-kit/design-tokens/jahez-tokens.json) as the shared reference for colors, fonts, spacing, and corner radii. The [CSS variables](../brand-kit/design-tokens/jahez-brand.css) expose the color and font values for the office web. Keep web and mobile theme values aligned with the kit.
- Use the [bilingual logo](../brand-kit/logos/jahez-master-brand.png) for sign-in and other placements with room for the wordmark. Use the [standalone icon](../brand-kit/logos/jahez-icon-brand.png) for compact navigation and mobile placements. The [logo folder](../brand-kit/logos/) contains ink, black, and white variants. The SVG files embed their matching PNGs. Use path-based artwork when a deliverable requires vector scaling.
- The kit specifies Roboto for English and Cairo for Arabic. A Simplified Chinese font stack remains open. Use white for normal text on the dark background. Keep Arabic right-to-left and verify contrast when pairing brand colors for text and controls.

## Development status

- `main` contains the requirements, architecture documents, and minimal React, Flutter, and NestJS starters. The server has a health route and a background worker entry point.
- The approved app layout groups UI by feature and keeps page or screen components beside their owners. Server modules own business rules. The app folders have the layout ready for the first features.
- The server, dashboard, and mobile environment templates exist locally. The app starters still need configuration loading and validation, API URL wiring, and PostgreSQL integration.
- A read-only local PostgreSQL query and a direct DeepSeek Flash text request succeeded. These checks cover the external connections. Invoice extraction and application integration still need verification.
- International production is planned for Hostinger. Mainland China production is planned for Alibaba Cloud ECS in Hangzhou with a separate database, file storage, and credentials. Local disk is the default storage provider, with S3 and Alibaba OSS as planned options.

## Next milestone

Wire the environment configuration and database connection, then build the first complete flow from a manual order through offline receipt sync, stock movement, and the live office dashboard. Verify tenant isolation and duplicate sync handling using synthetic data. Benchmark invoice extraction separately on approved samples before relying on it in receiving.

## Planning and progress

Keep one plan and one progress log per app. Update the plan before implementation. For work spanning apps, update each affected plan and link the dependencies between them. After implementation and verification, add a dated progress entry with completed work, check results, any blockers, and the next step. Record any outstanding checks when work is incomplete.

| App | Plan | Progress |
| --- | --- | --- |
| Office web | [PLAN.md](../plan/office-web/PLAN.md) | [PROGRESS.md](../progress/office-web/PROGRESS.md) |
| Server | [PLAN.md](../plan/server/PLAN.md) | [PROGRESS.md](../progress/server/PROGRESS.md) |
| Worker mobile | [PLAN.md](../plan/worker-mobile/PLAN.md) | [PROGRESS.md](../progress/worker-mobile/PROGRESS.md) |

## Agent setup

Use the same repository for Codex and Qoder. Both use the root [agent guide](../../AGENTS.md). The `jahez-feature` skill defines the repeatable implementation workflow. Its [canonical instructions](../../.agents/skills/jahez-feature/SKILL.md) are shared through a [Qoder entry point](../../.qoder/skills/jahez-feature/SKILL.md).
