import { requireContext } from '@/db/session';
import { errorResponse, json, readJsonObject, requiredString } from '@/lib/api-response';

export async function POST(request: Request) {
  try {
    const { db, workspace, user } = await requireContext(request, ['owner', 'dispatcher']);
    const body = await readJsonObject(request);
    const quoteId = requiredString(body, 'quoteId');
    const technician = requiredString(body, 'technician', 120);
    const scheduledAt = requiredString(body, 'scheduledAt', 50);
    if (!Number.isFinite(Date.parse(scheduledAt))) return json({ error: 'scheduledAt must be a valid ISO date.' }, { status: 400 });
    const quote = await db.prepare(`SELECT q.id, q.customer_id AS customerId, q.title, q.status, c.name AS customer, c.city
      FROM quotes q JOIN customers c ON c.id = q.customer_id AND c.workspace_id = q.workspace_id
      WHERE q.id = ? AND q.workspace_id = ? LIMIT 1`).bind(quoteId, workspace.id).first<{ id: string; customerId: string; title: string; status: string; customer: string; city: string }>();
    if (!quote) return json({ error: 'Quote not found in this workspace.' }, { status: 404 });
    if (!['draft', 'sent'].includes(quote.status)) return json({ error: `Only draft or sent quotes can be accepted; this quote is ${quote.status}.` }, { status: 409 });

    const jobId = crypto.randomUUID();
    await db.batch([
      db.prepare("UPDATE quotes SET status = 'accepted', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND workspace_id = ? AND status IN ('draft', 'sent')").bind(quote.id, workspace.id),
      db.prepare("INSERT INTO jobs (id, workspace_id, customer_id, quote_id, service, city, technician, scheduled_at, priority, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Medium', 'Scheduled', ?)").bind(jobId, workspace.id, quote.customerId, quote.id, quote.title, quote.city, technician, scheduledAt, user.id),
      db.prepare('INSERT INTO activities (id, workspace_id, actor_id, entity_type, entity_id, action, message) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(crypto.randomUUID(), workspace.id, user.id, 'quote', quote.id, 'quote.accepted', `Quote accepted and job scheduled for ${quote.customer}`),
    ]);
    return json({ id: quote.id, status: 'accepted', jobId });
  } catch (error) {
    return errorResponse(error);
  }
}

