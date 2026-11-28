# Design References

Use the reference for the app and screen being implemented, together with the [brand kit](../context/PROJECT-CONTEXT.md#brand-kit) and [approved app structure](../tech-stack/PROJECT-STRUCTURE.md#app-structure). Record the selected filename in the app's plan before UI coding.

| App | Design folder | Current references |
| --- | --- | --- |
| Worker Mobile | `documents/designs/worker-mobile/` | `01-sign-in.png`, `02-home.png`, `03-receiving-queue-v2.png` |
| Office Web | `documents/designs/office-web/` | `01-sign-in.png`–`19-settings-receiving-tolerances.png` (numbered screen references), `background.png`, `catalog-products.png`, `reference-dialog.png`, `reference-dropdown.png`, `reference-table-states.png` |

**Approved 2026-11-28:** Office Web core Step 5 settings references 17–19 and their state/mobile variants passed the user’s mockup-review checkpoint. See the [approved settings review](office-web/settings-review.md).

Inspect the actual reference image before building the screen. Use the supplied design for layout and visual intent, then bind it to the permissions, fields, and workflows in the [Backend Integration Guide](../api/BACKEND-INTEGRATION.md). Preserve Arabic RTL, responsive phone/tablet behavior, and worker cost isolation.

When a screen has several versions, use the user's designated reference or the latest clearly versioned reference. Record missing or ambiguous designs in the plan and ask for direction before inventing a replacement layout. Organize page components and screen widgets beside their owning feature, and extract shared controls when multiple screens use them.
