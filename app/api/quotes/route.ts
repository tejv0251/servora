import { requireContext } from '@/db/session';
import {
  errorResponse,
  json,
  readJsonObject,
  requiredMoney,
  requiredString,
} from '@/lib/api-response';

export async function POST(request: Request) {
  try {
    const { db, workspace, user } = await requireContext(request, [
      'owner',
      'dispatcher',
    ]);
    const body = await readJsonObject(request);
    const customerId = requiredString(body, 'customerId');
    const title = requiredString(body, 'title', 160);
    const amountCents = requiredMoney(body, 'amountCents');
    const expiresAt = requiredString(body, 'expiresAt', 50);
    if (!Number.isFinite(Date.parse(expiresAt)))
      return json(
        { error: 'expiresAt must be a valid ISO date.' },
        { status: 400 },
      );
    const customer = await db
      .prepare(
        'SELECT id, name FROM customers WHERE id = ? AND workspace_id = ? LIMIT 1',
      )
      .bind(customerId, workspace.id)
      .first<{ id: string; name: string }>();
    if (!customer)
      return json(
        { error: 'Customer not found in this workspace.' },
        { status: 404 },
      );

    const id = crypto.randomUUID();
    await db.batch([
      db
        .prepare(
          "INSERT INTO quotes (id, workspace_id, customer_id, title, amount_cents, status, expires_at, created_by) VALUES (?, ?, ?, ?, ?, 'sent', ?, ?)",
        )
        .bind(
          id,
          workspace.id,
          customer.id,
          title,
          amountCents,
          expiresAt,
          user.id,
        ),
      db
        .prepare(
          'INSERT INTO activities (id, workspace_id, actor_id, entity_type, entity_id, action, message) VALUES (?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(
          crypto.randomUUID(),
          workspace.id,
          user.id,
          'quote',
          id,
          'quote.created',
          `Quote for ${title} sent to ${customer.name}`,
        ),
    ]);
    return json(
      { id, status: 'sent', customer: customer.name, title, amountCents },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
