# Operations runbook

## Health and monitoring

- Probe `GET /api/health` every five minutes.
- Alert after three consecutive non-200 responses.
- Use the response `x-request-id` to correlate failures with structured worker logs.
- Treat a `degraded` response as a D1 availability incident.

## Deployment

1. Require green CI and Security checks on the target commit.
2. Build the exact commit with `npm ci && npm run check`.
3. Save and deploy that commit through Sites.
4. Verify `/api/health`, authenticated dashboard load, and one read-only tenant
   isolation check.

## Rollback

Redeploy the most recent known-good saved Sites version. Do not reverse database
migrations destructively. If a migration caused the incident, ship a forward-only
corrective migration and verify it on an isolated database first.

## Backup and recovery

D1 and R2 backup/export scheduling is an environment-level responsibility. Before
schema changes, capture a D1 export and record the matching application commit.
Test restoration into a separate database. Never restore production data into the
public portfolio demo.

## Incident triage

1. Record start time, affected role/workspace, route, response code, and request ID.
2. Check Sites deployment status and structured error logs.
3. Disable Stripe checkout if payment integrity is uncertain; preserve webhooks.
4. Roll back application code when safe, or deploy a forward fix for schema issues.
5. Verify tenant isolation, payment idempotency, and attachment authorization before
   closing the incident.

## Secrets

Configure Stripe values only as Sites runtime secrets. Rotate a value immediately
if it appears in logs, commits, screenshots, or support messages, then invalidate
the exposed credential and review the audit trail.
