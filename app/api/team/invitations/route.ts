import { requireContext } from '@/db/session';
import {
  errorResponse,
  json,
  readJsonObject,
  requiredString,
} from '@/lib/api-response';
import type { TeamInvitation } from '@/lib/contracts';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  try {
    const { db, workspace, user } = await requireContext(request, ['owner']);
    const body = await readJsonObject(request);
    const email = requiredString(body, 'email', 200).toLowerCase();
    const role = requiredString(body, 'role', 20);
    if (!EMAIL_PATTERN.test(email))
      return json({ error: 'Enter a valid email address.' }, { status: 400 });
    if (!['dispatcher', 'technician'].includes(role))
      return json(
        { error: 'Choose Dispatcher or Technician.' },
        { status: 400 },
      );

    const existingMember = await db
      .prepare(`SELECT m.id FROM memberships m JOIN users u ON u.id = m.user_id
      WHERE m.workspace_id = ? AND u.email = ? LIMIT 1`)
      .bind(workspace.id, email)
      .first();
    if (existingMember)
      return json(
        { error: 'This person is already a workspace member.' },
        { status: 409 },
      );
    const pending = await db
      .prepare(
        "SELECT id FROM invitations WHERE workspace_id = ? AND email = ? AND status = 'pending' LIMIT 1",
      )
      .bind(workspace.id, email)
      .first();
    if (pending)
      return json(
        { error: 'A pending invitation already exists for this email.' },
        { status: 409 },
      );

    const id = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 86_400_000).toISOString();
    await db.batch([
      db
        .prepare(`INSERT INTO invitations (id, workspace_id, email, role, status, invited_by, expires_at)
        VALUES (?, ?, ?, ?, 'pending', ?, ?)`)
        .bind(id, workspace.id, email, role, user.id, expiresAt),
      db
        .prepare(`INSERT INTO activities (id, workspace_id, actor_id, entity_type, entity_id, action, message)
        VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .bind(
          crypto.randomUUID(),
          workspace.id,
          user.id,
          'invitation',
          id,
          'invitation.created',
          `${email} was invited as ${role}`,
        ),
    ]);
    const invitation: TeamInvitation = {
      id,
      email,
      role: role as TeamInvitation['role'],
      status: 'pending',
      expiresAt,
      createdAt: new Date().toISOString(),
    };
    return json(invitation, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
