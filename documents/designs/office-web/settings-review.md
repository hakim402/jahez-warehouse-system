# Core Step 5 settings — approved design review

**Status: approved by the user on 2026-11-28.** These references implement the user's requested mockup-review checkpoint, not working account/settings features. These design assets are a synthetic visual reference; the working implementation is recorded under Office Web Step 5 and Server Step 2. All names, phones, values, and records in this prototype are synthetic.

## Review references

| Reference | Coverage |
| --- | --- |
| [17-settings-users-access.png](17-settings-users-access.png) | Owner user list, name/phone search, role/status filters, warehouse assignments, and edit/reset/status actions |
| [18-settings-user-dialogs.png](18-settings-user-dialogs.png) | Create, edit/assign warehouses, password reset, disable, and reactivate dialogs |
| [19-settings-receiving-tolerances.png](19-settings-receiving-tolerances.png) | Company-wide volume/weight percentages, current values, save/discard, and future receipt-processing explanation |
| [settings-state-examples.png](settings-state-examples.png) | Duplicate phone and invalid percentage errors, stale-edit reload, loading/saving/success, last-owner/self-disable, and owner-only states |

Narrow previews use the matching `-mobile.png`, `-ar-mobile.png`, and `-zh-mobile.png` filenames. User-dialog previews include `18-settings-add-user-mobile.png` and `18-settings-edit-user-ar-mobile.png`.

The sources are `settings-review.html`, `settings-review.css`, and `settings-review.js`. The prototype loads the existing local background, Jahez icon, installed font assets, and Lucide SVGs. No API, account mutation, network provider, or application route is configured. It opens example dialogs only; Save/Create/Reset buttons are visual controls. It must not be presented as the implemented app.

Preview query parameters: `view=users`, `view=dialogs`, `view=tolerances`, or `view=states`; optional `lang=ar` or `lang=zh-Hans`; optional `dialog=add|edit|reset|disable|enable` on the user view. Serve these files and their local relative assets over a local static preview to inspect them interactively. PNGs require no preview tooling.

## Decisions represented

- Jahez company only for the pilot, retaining company-wide roles and multiple warehouse memberships in the design.
- Owners create users, issue initial/reset passwords directly (12–128 characters), manage roles/access, and disable/reactivate accounts. No forced password-change or messaging workflow.
- Additional owners are permitted. Self-disable and removal of the last active owner are blocked.
- Role/access/password/active changes end the affected user's sessions. Reactivation requires a new sign-in; historical records stay unchanged.
- Tolerances are 0–100 with up to two decimals, preserving 3% CBM and 5% weight defaults. New values affect subsequently processed receipts, including later syncs, without regenerating historical findings.
- Warehouse creation, a warehouse-administration page, and audit browsing remain deferred.

## Verification and next step

Rendered and visually inspected the desktop page/dialog references and narrow language variants. Checked 1440/1600 px desktop and 390 px narrow layouts, Arabic direction, Chinese expansion, dialog containment, and prototype Escape/focus return. No application or server tests were run because no application/server code changed.

The user approved these mockups and authorized the saved Office Web Step 5 / Server Step 2 implementation. See the corresponding progress logs for actual application/server verification; the checks above describe the original design-only review.
