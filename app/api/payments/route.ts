import { requireContext } from '@/db/session';
import { errorResponse, json } from '@/lib/api-response';
import type { PaymentRecord } from '@/lib/contracts';

export async function GET(request: Request) {
  try {
    const { db, workspace } = await requireContext(request, [
      'owner',
      'dispatcher',
    ]);
    const invoiceId = new URL(request.url).searchParams
      .get('invoiceId')
      ?.trim();
    const rows = await db
      .prepare(`SELECT p.id, p.invoice_id AS invoiceId, p.provider, p.amount_cents AS amountCents,
        p.status, p.method, p.reference, p.received_at AS receivedAt, p.created_at AS createdAt
        FROM payments p JOIN invoices i ON i.id = p.invoice_id AND i.workspace_id = p.workspace_id
        WHERE p.workspace_id = ? AND (? IS NULL OR p.invoice_id = ?)
        ORDER BY p.received_at DESC LIMIT 100`)
      .bind(workspace.id, invoiceId || null, invoiceId || null)
      .all<PaymentRecord>();
    return json({ payments: rows.results });
  } catch (error) {
    return errorResponse(error);
  }
}
