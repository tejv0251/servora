import { requireContext } from '@/db/session';
import {
  errorResponse,
  json,
  readJsonObject,
  requiredString,
} from '@/lib/api-response';

export async function POST(request: Request) {
  try {
    const { db, workspace, user } = await requireContext(request, [
      'owner',
      'dispatcher',
    ]);
    const body = await readJsonObject(request);
    const invoiceId = requiredString(body, 'invoiceId');
    const invoice = await db
      .prepare(`SELECT i.id, i.status, c.name AS customer FROM invoices i
      JOIN customers c ON c.id = i.customer_id AND c.workspace_id = i.workspace_id
      WHERE i.id = ? AND i.workspace_id = ? LIMIT 1`)
      .bind(invoiceId, workspace.id)
      .first<{ id: string; status: string; customer: string }>();
    if (!invoice)
      return json(
        { error: 'Invoice not found in this workspace.' },
        { status: 404 },
      );
    if (!['open', 'overdue'].includes(invoice.status))
      return json(
        { error: `A ${invoice.status} invoice cannot be marked paid.` },
        { status: 409 },
      );
    const updated = await db
      .prepare(
        "UPDATE invoices SET status = 'paid', paid_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND workspace_id = ? AND status IN ('open', 'overdue')",
      )
      .bind(invoice.id, workspace.id)
      .run();
    if (updated.meta.changes !== 1)
      return json(
        {
          error:
            'The invoice changed before this update. Refresh and try again.',
        },
        { status: 409 },
      );
    await db
      .prepare(
        'INSERT INTO activities (id, workspace_id, actor_id, entity_type, entity_id, action, message) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .bind(
        crypto.randomUUID(),
        workspace.id,
        user.id,
        'invoice',
        invoice.id,
        'invoice.paid',
        `Invoice paid by ${invoice.customer}`,
      )
      .run();
    return json({ id: invoice.id, status: 'paid' });
  } catch (error) {
    return errorResponse(error);
  }
}
