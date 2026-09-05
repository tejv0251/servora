import { errorResponse, json } from '@/lib/api-response';
import type {
  DashboardActivity,
  DashboardCustomer,
  DashboardData,
  DashboardInvoice,
  DashboardJob,
  DashboardQuote,
} from '@/lib/contracts';
import { requireContext } from '@/db/session';
import { getStripeConfiguration } from '@/db';

export async function GET(request: Request) {
  try {
    const context = await requireContext(request, ['owner', 'dispatcher']);
    const { db, workspace } = context;

    const [
      jobRows,
      customerRows,
      invoiceRows,
      quoteRows,
      activityRows,
      revenue,
      outstanding,
      jobsToday,
      inProgress,
      quoteTotals,
    ] = await Promise.all([
      db
        .prepare(`SELECT j.id, j.customer_id AS customerId, c.name AS customer, j.service, j.city, j.technician,
        j.scheduled_at AS scheduledAt, j.priority, j.status, i.id AS invoiceId,
        (SELECT COUNT(*) FROM job_attachments a WHERE a.job_id = j.id AND a.workspace_id = j.workspace_id) AS attachmentCount
        FROM jobs j
        JOIN customers c ON c.id = j.customer_id AND c.workspace_id = j.workspace_id
        LEFT JOIN invoices i ON i.job_id = j.id AND i.workspace_id = j.workspace_id
        WHERE j.workspace_id = ? ORDER BY j.scheduled_at DESC, j.created_at DESC LIMIT 100`)
        .bind(workspace.id)
        .all<DashboardJob>(),
      db
        .prepare(`SELECT c.id, c.name, c.contact_name AS contactName, c.email, c.phone, c.city,
        (SELECT COUNT(*) FROM jobs j WHERE j.customer_id = c.id AND j.workspace_id = c.workspace_id) AS jobCount,
        (SELECT COALESCE(SUM(i.amount_cents), 0) FROM invoices i WHERE i.customer_id = c.id AND i.workspace_id = c.workspace_id AND i.status = 'paid') AS lifetimeValueCents
        FROM customers c WHERE c.workspace_id = ? ORDER BY c.created_at DESC LIMIT 100`)
        .bind(workspace.id)
        .all<DashboardCustomer>(),
      db
        .prepare(`SELECT i.id, c.name AS customer, i.job_id AS jobId, i.amount_cents AS amountCents,
        i.status, i.issued_at AS issuedAt, i.due_at AS dueAt, i.paid_at AS paidAt,
        (SELECT p.method FROM payments p WHERE p.invoice_id = i.id AND p.workspace_id = i.workspace_id
          AND p.status = 'succeeded' ORDER BY p.received_at DESC LIMIT 1) AS paymentMethod,
        (SELECT p.reference FROM payments p WHERE p.invoice_id = i.id AND p.workspace_id = i.workspace_id
          AND p.status = 'succeeded' ORDER BY p.received_at DESC LIMIT 1) AS paymentReference
        FROM invoices i JOIN customers c ON c.id = i.customer_id AND c.workspace_id = i.workspace_id
        WHERE i.workspace_id = ? ORDER BY i.issued_at DESC LIMIT 100`)
        .bind(workspace.id)
        .all<DashboardInvoice>(),
      db
        .prepare(`SELECT q.id, q.customer_id AS customerId, c.name AS customer, q.title, q.amount_cents AS amountCents,
        q.status, q.expires_at AS expiresAt
        FROM quotes q JOIN customers c ON c.id = q.customer_id AND c.workspace_id = q.workspace_id
        WHERE q.workspace_id = ? ORDER BY q.created_at DESC LIMIT 100`)
        .bind(workspace.id)
        .all<DashboardQuote>(),
      db
        .prepare(`SELECT id, message, created_at AS createdAt FROM activities
        WHERE workspace_id = ? ORDER BY created_at DESC LIMIT 8`)
        .bind(workspace.id)
        .all<DashboardActivity>(),
      db
        .prepare(
          "SELECT COALESCE(SUM(amount_cents), 0) AS value FROM invoices WHERE workspace_id = ? AND status = 'paid' AND issued_at >= datetime('now', 'start of month')",
        )
        .bind(workspace.id)
        .first<{ value: number }>(),
      db
        .prepare(
          "SELECT COALESCE(SUM(amount_cents), 0) AS value, SUM(CASE WHEN status = 'overdue' THEN 1 ELSE 0 END) AS overdueCount FROM invoices WHERE workspace_id = ? AND status IN ('open', 'overdue')",
        )
        .bind(workspace.id)
        .first<{ value: number; overdueCount: number }>(),
      db
        .prepare(
          "SELECT COUNT(*) AS value FROM jobs WHERE workspace_id = ? AND date(scheduled_at) = date('now')",
        )
        .bind(workspace.id)
        .first<{ value: number }>(),
      db
        .prepare(
          "SELECT COUNT(*) AS value FROM jobs WHERE workspace_id = ? AND status = 'In progress'",
        )
        .bind(workspace.id)
        .first<{ value: number }>(),
      db
        .prepare(
          "SELECT COUNT(*) AS total, SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) AS accepted FROM quotes WHERE workspace_id = ?",
        )
        .bind(workspace.id)
        .first<{ total: number; accepted: number }>(),
    ]);

    const totalQuotes = quoteTotals?.total ?? 0;
    const payload: DashboardData = {
      session: {
        user: context.user,
        workspace: context.workspace,
        role: context.role,
      },
      metrics: {
        revenueCents: revenue?.value ?? 0,
        outstandingCents: outstanding?.value ?? 0,
        overdueCount: outstanding?.overdueCount ?? 0,
        jobsToday: jobsToday?.value ?? 0,
        jobsInProgress: inProgress?.value ?? 0,
        quoteConversionPercent: totalQuotes
          ? Math.round(((quoteTotals?.accepted ?? 0) / totalQuotes) * 100)
          : 0,
      },
      jobs: jobRows.results,
      customers: customerRows.results,
      invoices: invoiceRows.results,
      quotes: quoteRows.results,
      activities: activityRows.results,
      capabilities: {
        attachments: true,
        stripeTestMode: getStripeConfiguration().testModeConfigured,
      },
    };
    return json(payload);
  } catch (error) {
    return errorResponse(error);
  }
}
