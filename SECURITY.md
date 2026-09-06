# Security policy

## Supported version

Security fixes are applied to the latest commit on `main`.

## Reporting a vulnerability

Please do not open a public issue for a suspected vulnerability. Use GitHub's
private vulnerability reporting feature for this repository. Include the affected
route or component, reproduction conditions, impact, and any suggested mitigation.

## Security boundaries

Servora treats authenticated identity headers supplied by Sites as trusted only in
the hosted environment. Local test headers are accepted exclusively on
`localhost`/`127.0.0.1`. Every data query is scoped to an authenticated workspace,
and state-changing routes apply server-side role checks.

Attachments are type/size checked and stored under tenant-scoped object keys.
Stripe support accepts test-mode keys only, verifies webhook signatures and age,
and processes events idempotently.

Never commit `.env` files, Sites credentials, Stripe secrets, customer data, or
production database exports.
