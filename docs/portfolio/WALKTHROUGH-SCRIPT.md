# Servora — 90-second walkthrough recording script

Status: ready to record. This file is a script, not a completed video.

Record the local working application using fictional data and a 1440 × 900 or 1920 × 1080 viewport. Hide browser chrome, notifications and account menus. Show captions; record your own voice if desired. Use a dedicated fictional workspace and verify every mutation after refreshing. Keep private account details out of the recording.

| Time | Screen and action | Narration |
|---|---|---|
| 0–10s | Overview. Show the project name and metrics. | “Servora is my self-initiated service operations SaaS. It brings customer records, quotes, field jobs and billing into a single workspace. All data shown here is fictional.” |
| 10–25s | Quotes → New quote. Choose a fictional customer, enter a service, valid amount and expiry. Submit only in the demo workspace and show the new record. | “Quotes belong to a customer and workspace. The server validates the request and saves the record. Accepted quotes can become scheduled jobs.” |
| 25–40s | Accept the demonstration quote and schedule its job. Show Jobs, then refresh and return to Jobs to confirm persistence. | “The quote stays connected to the job. Records persist across reloads, and job status follows the allowed service lifecycle.” |
| 40–55s | Resize to mobile. Show the responsive owner Jobs cards, then return to desktop. | “The same owner workflow adapts to a phone. Customer details, priority, assignment, files and the next status action remain readable.” |
| 55–70s | Invoices → Record payment. Show the review step; use a fictional manual payment only if demonstrating completion. | “Invoices include a reviewed manual-payment flow and a payment ledger. A Stripe test-mode adapter is also implemented; it is not shown as a real card transaction.” |
| 70–83s | Repository architecture and dated successful CI run. | “Behind the interface are TypeScript APIs, workspace-scoped D1 records, private R2 files and role checks. Eighteen automated tests cover the critical workflows, with CI and release documentation.” |
| 83–90s | Return to Overview and finish on the project title. | “I built this project across the interface, API, data layer, testing and deployment. The source and technical documentation are available in the portfolio.” |

## Optional technician segment

Replace the responsive owner segment only after signing into a real invited technician test account with an assigned job. Show an offline note queued, reconnect, and verify the note appears after replay. The owner Jobs capture must not be presented as the technician PWA. Do not alter memberships in the production workspace just for a recording.

## Completion checks

- No empty loaders, error messages, unrelated tabs, QA identifiers or personal email addresses appear in the final recording.
- Every narrated action is actually visible; use cuts if waiting is necessary.
- Financial values remain explicitly fictional and payment integration is described as test-mode only.
- Captions are readable on a phone; video duration is 60–90 seconds.
- Preview the exported video from start to finish before uploading.

Historical CI evidence: https://github.com/tejv0251/servora/actions/runs/34040557303

Historical security workflow: https://github.com/tejv0251/servora/actions/runs/34040557309
