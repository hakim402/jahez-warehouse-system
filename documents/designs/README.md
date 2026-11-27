# Design References

Use the reference for the app and screen being implemented, together with the [brand kit](../context/PROJECT-CONTEXT.md#brand-kit) and [approved app structure](../tech-stack/PROJECT-STRUCTURE.md#app-structure). Record the selected filename in the app's plan before UI coding.

| App | Design folder | Current references |
| --- | --- | --- |
| Worker Mobile | `documents/designs/worker-mobile/` | `01-sign-in.png`, `02-home.png`, `03-receiving-queue-v2.png` |
| Office Web | `documents/designs/office-web/` | No reference files present at the time of this update |

Inspect the actual reference image before building the screen. Use the supplied design for layout and visual intent, then bind it to the permissions, fields, and workflows in the [Backend Integration Guide](../api/BACKEND-INTEGRATION.md). Preserve Arabic RTL, responsive phone/tablet behavior, and worker cost isolation.

When a screen has several versions, use the user's designated reference or the latest clearly versioned reference. Record missing or ambiguous designs in the plan and ask for direction before inventing a replacement layout. Organize page components and screen widgets beside their owning feature, and extract shared controls when multiple screens use them.
