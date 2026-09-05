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
    const invitationId = requiredString(body, 'invitationId');
    const invitation = await db
      .prepare(
        "SELECT id, email FROM invitations WHERE id = ? AND workspace_id = ? AND status = 'pending' LIMIT 1",
      )
      .bind(invitationId, workspace.id)
      .first<{ id: string; email: string }>();
    if (!invitation)
      return json(
        { error: 'Pending invitation not found in this workspace.' },
        { status: 404 },
      );
    const result = await db
      .prepare(`UPDATE invitations SET status = 'revoked', revoked_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP WHERE id = ? AND workspace_id = ? AND status = 'pending'`)
      .bind(invitation.id, workspace.id)
      .run();
    if (result.meta.changes !== 1)
      return json(
        {
          error:
            'The invitation changed before this update. Refresh and try again.',
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
        'invitation',
        invitation.id,
        'invitation.revoked',
        `Invitation for ${invitation.email} was revoked`,
      )
      .run();
    return json({ id: invitation.id, status: 'revoked' });
  } catch (error) {
    return errorResponse(error);
  }
}
