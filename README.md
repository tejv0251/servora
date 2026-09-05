# Servora Operations SaaS

Servora is a portfolio-grade field-service operations product for HVAC, plumbing,
electrical, and cleaning businesses. It gives owners and dispatchers one calm
workspace for revenue, quotes, jobs, technicians, invoices, and operational risk.

Private live preview: <https://servora-operations-saas.tejvishwakarma.chatgpt.site>

## Implemented vertical slice

- Responsive operations dashboard based on an approved four-direction design study
- Decision-ready KPIs and weekly revenue-versus-target reporting
- Live job board with Scheduled, En route, In progress, and Completed states
- Technician availability, attention queue, and recent activity
- Navigable job, schedule, customer, quote, invoice, and technician data views
- Durable customer, quote, job, and invoice records in Cloudflare D1
- Authenticated user-to-workspace provisioning and server-side role checks
- Customer creation, quote creation and acceptance, job status transitions, invoice issue, and payment capture
- Server-computed dashboard KPIs, attention queue, activity feed, and search feedback
- Keyboard focus, semantic status labels, reduced-motion handling, and mobile navigation
- Page tools for reading operations, creating customers/jobs, and advancing job status

## Stack

- React 19 and TypeScript
- vinext / Vite for the Cloudflare-compatible application runtime
- Tailwind CSS and shadcn/Base UI primitives
- Recharts and Lucide icons
- Cloudflare D1 with generated Drizzle migrations
- Sites for private preview hosting

The complete product, architecture, security, testing, and release plan lives one
directory above this application in the portfolio project workspace.

## Local development

```bash
npm install
npm run dev
```

Quality checks:

```bash
npm test
npm run lint
npx tsc --noEmit
npm run build
```

## Product workflow

`Lead → Customer → Quote → Accepted → Job → Scheduled → Completed → Invoice → Paid`

The working slice is intentionally focused. Future milestones add team invitations,
fine-grained technician assignment, Stripe test-mode payments, file storage,
observability, broader integration coverage, and final Upwork case-study assets.
