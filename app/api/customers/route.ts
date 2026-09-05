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
    const name = requiredString(body, 'name', 120);
    const contactName = requiredString(body, 'contactName', 120);
    const email = requiredString(body, 'email', 200).toLowerCase();
    const phone = requiredString(body, 'phone', 40);
    const city = requiredString(body, 'city', 100);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return json({ error: 'Enter a valid email address.' }, { status: 400 });

    const duplicate = await db
      .prepare(
        'SELECT id FROM customers WHERE workspace_id = ? AND email = ? LIMIT 1',
      )
      .bind(workspace.id, email)
      .first();
    if (duplicate)
      return json(
        { error: 'A customer with this email already exists.' },
        { status: 409 },
      );

    const id = crypto.randomUUID();
    await db.batch([
      db
        .prepare(
          'INSERT INTO customers (id, workspace_id, name, contact_name, email, phone, city) VALUES (?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(id, workspace.id, name, contactName, email, phone, city),
      db
        .prepare(
          'INSERT INTO activities (id, workspace_id, actor_id, entity_type, entity_id, action, message) VALUES (?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(
          crypto.randomUUID(),
          workspace.id,
          user.id,
          'customer',
          id,
          'customer.created',
          `${name} was added as a customer`,
        ),
    ]);
    return json({ id, name, contactName, email, phone, city }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
