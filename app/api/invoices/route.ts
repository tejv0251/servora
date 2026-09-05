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
    const jobId = requiredString(body, 'jobId');
    const amountCents = requiredMoney(body, 'amountCents');
    const dueAt = requiredString(body, 'dueAt', 50);
    if (!Number.isFinite(Date.parse(dueAt)))
      return json(
        { error: 'dueAt must be a valid ISO date.' },
        { status: 400 },
      );
    const job = await db
      .prepare(`SELECT j.id, j.customer_id AS customerId, j.service, j.status, c.name AS customer,
      i.id AS invoiceId FROM jobs j JOIN customers c ON c.id = j.customer_id AND c.workspace_id = j.workspace_id
      LEFT JOIN invoices i ON i.job_id = j.id AND i.workspace_id = j.workspace_id
      WHERE j.id = ? AND j.workspace_id = ? LIMIT 1`)
      .bind(jobId, workspace.id)
      .first<{
        id: string;
        customerId: string;
        service: string;
        status: string;
        customer: string;
        invoiceId: string | null;
      }>();
    if (!job)
      return json(
        { error: 'Job not found in this workspace.' },
        { status: 404 },
      );
    if (job.status !== 'Completed')
      return json(
        { error: 'Only completed jobs can be invoiced.' },
        { status: 409 },
      );
    if (job.invoiceId)
      return json(
        { error: 'This job already has an invoice.' },
        { status: 409 },
      );

    const id = crypto.randomUUID();
    await db.batch([
      db
        .prepare(
          "INSERT INTO invoices (id, workspace_id, customer_id, job_id, amount_cents, status, issued_at, due_at) VALUES (?, ?, ?, ?, ?, 'open', CURRENT_TIMESTAMP, ?)",
        )
        .bind(id, workspace.id, job.customerId, job.id, amountCents, dueAt),
      db
        .prepare(
          'INSERT INTO activities (id, workspace_id, actor_id, entity_type, entity_id, action, message) VALUES (?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(
          crypto.randomUUID(),
          workspace.id,
          user.id,
          'invoice',
          id,
          'invoice.created',
          `Invoice issued to ${job.customer} for ${job.service}`,
        ),
    ]);
    return json(
      { id, status: 'open', jobId: job.id, amountCents },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
