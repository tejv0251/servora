# Servora UX contract

## Canonical UI map

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
|---|---|---|---|---|
| Select/Listbox | Native select | Form behavior below | Short single-choice fields | Keyboard + narrow layout |
| Date | Native date/time input | Form behavior below | Schedule, expiry, receipt | ISO boundary tests |
| Form | Product form in Base UI Dialog | Durable behavior below | Commercial/team creation | Validation + duplicate prevention |
| File upload | Job attachments dialog | `lib/attachment-policy.ts` | Picker, drag/drop, field camera | Policy + HTTP checks |
| Offline queue | Technician field app | `lib/offline-queue.ts` | Status, note, attachment | Replay + conflict checks |
| Scrollbar | `app/globals.css` | `DESIGN.md` | Horizontal semantic tables | Static + browser review |
| Toast | Polite status output | Durable behavior below | Confirmed mutation feedback | Live-region review |
| CRUD | Same-route dialog and owning list | Durable behavior below | Commercial/team workflows | Success/conflict/forbidden tests |

## Durable behavior

- Desktop navigation is persistent; compact layouts expose the same destinations in
  a labelled drawer. The active location and workspace stay visible.
- Mutations use explicit verbs, prevent duplicate submission, and keep recoverable
  failure feedback near the initiating action.
- Financial, permission-changing, or destructive operations require an app-owned
  confirmation. Dialogs restore focus and support Escape.
- Search announces its result count and provides an immediate labelled clear action.
- Tables transform into labelled cards on narrow screens when horizontal scrolling
  would hide primary decisions.
- Product forms use `noValidate` and visible app-owned validation.
- Uploads support picker and drag/drop with validation, progress, cancel, retry, and
  stable failure states.
- Offline mutations are scoped to user/workspace, replay in order, and earn success
  only after an idempotent server response.
- Owner, dispatcher, and technician visibility is always backed by server-side
  workspace and role authorization.
- `403` explains a role boundary; cross-workspace resources remain undiscoverable;
  server errors never expose stack or SQL detail.

## Accessibility target

WCAG 2.2 AA: visible focus, semantic controls, labelled icons/status, 4.5:1 body-text
contrast, visual-order keyboard navigation, 44px mobile targets, reduced motion, and
a non-drag alternative for uploads.
