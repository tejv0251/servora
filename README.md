# Servora Operations SaaS

Servora is a portfolio-grade field-service operations product for HVAC, plumbing,
electrical, and cleaning businesses. It gives owners and dispatchers one calm
workspace for revenue, quotes, jobs, technicians, invoices, and operational risk.

Private live preview: <https://servora-operations-saas.tejvishwakarma.chatgpt.site>

## Implemented milestone

- Responsive operations dashboard based on an approved four-direction design study
- Decision-ready KPIs and weekly revenue-versus-target reporting
- Live job board with Scheduled, En route, In progress, and Completed states
- Technician availability, attention queue, and recent activity
- Navigable job, schedule, customer, quote, invoice, and technician data views
- Search result feedback and a validated create-job flow
- Keyboard focus, semantic status labels, reduced-motion handling, and mobile navigation
- Page tools for reading the operations summary and creating a scheduled job

## Stack

- React 19 and TypeScript
- vinext / Vite for the Cloudflare-compatible application runtime
- Tailwind CSS and shadcn/Base UI primitives
- Recharts and Lucide icons
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
npm run lint
npm run build
```

## Product workflow

`Lead → Customer → Quote → Accepted → Job → Scheduled → Completed → Invoice → Paid`

Future milestones add authenticated multi-tenancy, the Node.js API, PostgreSQL data,
Stripe test-mode billing, automated tests, observability, and the final Upwork case
study assets.

