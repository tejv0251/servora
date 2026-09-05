import { requireContext } from '@/db/session';
import {
  errorResponse,
  json,
  readJsonObject,
  requiredString,
} from '@/lib/api-response';

export async function POST(request: Request) {
  try {
    const { db, workspace, user } = await requireContext(request, ['owner']);
    const body = await readJsonObject(request);
    const membershipId = requiredString(body, 'membershipId');
    const role = requiredString(body, 'role', 20);
    if (!['dispatcher', 'technician'].includes(role))
      return json(
        { error: 'Choose Dispatcher or Technician.' },
        { status: 400 },
      );
    const membership = await db
      .prepare(`SELECT m.id, m.role, u.display_name AS displayName FROM memberships m
      JOIN users u ON u.id = m.user_id WHERE m.id = ? AND m.workspace_id = ? LIMIT 1`)
      .bind(membershipId, workspace.id)
      .first<{ id: string; role: string; displayName: string }>();
    if (!membership)
      return json(
        { error: 'Member not found in this workspace.' },
        { status: 404 },
      );
    if (membership.role === 'owner')
      return json(
        { error: 'The workspace owner role cannot be changed here.' },
        { status: 409 },
      );
    if (membership.role === role) return json({ id: membership.id, role });
    const result = await db
      .prepare(
        'UPDATE memberships SET role = ? WHERE id = ? AND workspace_id = ? AND role != ?',
      )
      .bind(role, membership.id, workspace.id, 'owner')
      .run();
    if (result.meta.changes !== 1)
      return json(
        {
          error:
            'The member changed before this update. Refresh and try again.',
        },
        { status: 409 },
      );
    await db
      .prepare(`INSERT INTO activities (id, workspace_id, actor_id, entity_type, entity_id, action, message)
      VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .bind(
        crypto.randomUUID(),
        workspace.id,
        user.id,
        'membership',
        membership.id,
        'membership.role_changed',
        `${membership.displayName} changed from ${membership.role} to ${role}`,
      )
      .run();
    return json({ id: membership.id, role });
  } catch (error) {
    return errorResponse(error);
  }
}
