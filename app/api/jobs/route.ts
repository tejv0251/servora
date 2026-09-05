import { requireContext } from '@/db/session';
import { findWorkspaceCustomer } from '@/db/tenant';
import {
  errorResponse,
  json,
  readJsonObject,
  requiredString,
} from '@/lib/api-response';
import type { Priority } from '@/lib/contracts';

export async function POST(request: Request) {
  try {
    const { db, workspace, user } = await requireContext(request, [
      'owner',
      'dispatcher',
    ]);
    const body = await readJsonObject(request);
    const customerId = requiredString(body, 'customerId');
    const service = requiredString(body, 'service', 160);
    const city = requiredString(body, 'city', 100);
    const technician = requiredString(body, 'technician', 120);
    const scheduledAt = requiredString(body, 'scheduledAt', 50);
    const priority = requiredString(body, 'priority', 20) as Priority;
    if (!['Low', 'Medium', 'High'].includes(priority))
      return json(
        { error: 'priority must be Low, Medium, or High.' },
        { status: 400 },
      );
    if (!Number.isFinite(Date.parse(scheduledAt)))
      return json(
        { error: 'scheduledAt must be a valid ISO date.' },
        { status: 400 },
      );

    const customer = await findWorkspaceCustomer(db, workspace.id, customerId);
    if (!customer)
      return json(
        { error: 'Customer not found in this workspace.' },
        { status: 404 },
      );

    const id = crypto.randomUUID();
    await db.batch([
      db
        .prepare(
          "INSERT INTO jobs (id, workspace_id, customer_id, service, city, technician, scheduled_at, priority, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Scheduled', ?)",
        )
        .bind(
          id,
          workspace.id,
          customer.id,
          service,
          city,
          technician,
          scheduledAt,
          priority,
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
          'job',
          id,
          'job.created',
          `${service} scheduled for ${customer.name}`,
        ),
    ]);
    return json(
      { id, status: 'Scheduled', customer: customer.name, service },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
