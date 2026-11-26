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

- Server Steps 1–5 are on `main`. The backend covers PostgreSQL readiness, identity and warehouse access, manual orders, receipt sync, and stock reads with live updates. The Office Web and Worker Mobile clients still need their integration work. [Server progress](../progress/server/PROGRESS.md)
- The approved app layout groups UI by feature and keeps page or screen components beside their owners. Server modules own business rules. The app folders have the layout ready for the first features.
- The server, dashboard, and mobile environment templates are versioned. Client API URL and session wiring are part of each client's first roadmap step.
- A direct DeepSeek Flash text request succeeded during local setup. Invoice extraction still needs its own verification.
- International production is planned for Hostinger. Mainland China production is planned for Alibaba Cloud ECS in Hangzhou with a separate database, file storage, and credentials. Local disk is the default storage provider, with S3 and Alibaba OSS as planned options.

## Next milestone

The next Server step is private file storage and evidence. For the first end-to-end client milestone, create a manual order in Office Web, receive it offline in Worker Mobile, then verify that the office dashboard reflects the synced stock update. Benchmark invoice extraction separately on approved samples before relying on it in receiving. [Server plan](../plan/server/PLAN.md#step-6--files-and-evidence)

## Planning and progress

Use the roadmap number in both the plan and progress log. Save the plan before editing application code, then record the verification results before committing and pushing the update. For cross-app work, update both records in every affected app and link the dependencies. [Agent workflow](../../AGENTS.md#workflow-for-every-step)

| App | Roadmap | Plan | Progress |
| --- | --- | --- | --- |
| Office web | [Roadmap](../plan/office-web/ROADMAP.md) | [PLAN.md](../plan/office-web/PLAN.md) | [PROGRESS.md](../progress/office-web/PROGRESS.md) |
| Server | [Roadmap](../plan/server/ROADMAP.md) | [PLAN.md](../plan/server/PLAN.md) | [PROGRESS.md](../progress/server/PROGRESS.md) |
| Worker mobile | [Roadmap](../plan/worker-mobile/ROADMAP.md) | [PLAN.md](../plan/worker-mobile/PLAN.md) | [PROGRESS.md](../progress/worker-mobile/PROGRESS.md) |

## Agent setup

Use the same repository for Codex and Qoder. Both use the root [agent guide](../../AGENTS.md). The `jahez-feature` skill defines the repeatable implementation workflow. Its [canonical instructions](../../.agents/skills/jahez-feature/SKILL.md) are shared through a [Qoder entry point](../../.qoder/skills/jahez-feature/SKILL.md).
