import { requireContext } from '@/db/session';
import { errorResponse, json } from '@/lib/api-response';
import type { TeamData, TeamInvitation, TeamMember } from '@/lib/contracts';

export async function GET(request: Request) {
  try {
    const { db, workspace, role } = await requireContext(request, [
      'owner',
      'dispatcher',
    ]);
    await db
      .prepare(
        "UPDATE invitations SET status = 'expired', updated_at = CURRENT_TIMESTAMP WHERE workspace_id = ? AND status = 'pending' AND datetime(expires_at) <= datetime('now')",
      )
      .bind(workspace.id)
      .run();
    const [memberRows, invitationRows] = await Promise.all([
      db
        .prepare(`SELECT m.id, m.user_id AS userId, u.display_name AS displayName, u.email, m.role,
        m.created_at AS joinedAt FROM memberships m JOIN users u ON u.id = m.user_id
        WHERE m.workspace_id = ? ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'dispatcher' THEN 1 ELSE 2 END, u.display_name LIMIT 50`)
        .bind(workspace.id)
        .all<TeamMember>(),
      db
        .prepare(`SELECT id, email, role, status, expires_at AS expiresAt, created_at AS createdAt
        FROM invitations WHERE workspace_id = ? AND status = 'pending'
        ORDER BY created_at DESC LIMIT 50`)
        .bind(workspace.id)
        .all<TeamInvitation>(),
    ]);
    const payload: TeamData = {
      role,
      canManage: role === 'owner',
      memberCount: memberRows.results.length,
      members: memberRows.results,
      invitations: invitationRows.results,
    };
    return json(payload);
  } catch (error) {
    return errorResponse(error);
  }
}
