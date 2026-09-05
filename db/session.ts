import type { WorkspaceRole } from '@/lib/permissions';

import { getD1 } from './index';
import { ensureDemoData } from './seed';

export type { WorkspaceRole } from '@/lib/permissions';

export type RequestContext = {
  db: D1Database;
  user: { id: string; email: string; displayName: string };
  workspace: { id: string; name: string; slug: string };
  role: WorkspaceRole;
};

type MembershipRow = {
  role: WorkspaceRole;
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
};

type PendingInvitation = {
  id: string;
  workspaceId: string;
  role: Exclude<WorkspaceRole, 'owner'>;
};

function decodeDisplayName(request: Request, email: string) {
  const encoded = request.headers.get('oai-authenticated-user-full-name');
  const encoding = request.headers.get(
    'oai-authenticated-user-full-name-encoding',
  );
  if (encoded && encoding === 'percent-encoded-utf-8') {
    try {
      return decodeURIComponent(encoded);
    } catch {
      // Fall through to the email-based display name.
    }
  }
  const localPart = email.split('@')[0] || 'Servora Owner';
  return (
    localPart
      .split(/[._-]/)
      .filter(Boolean)
      .map((part) => `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}`)
      .join(' ') || 'Servora Owner'
  );
}

function authenticatedUser(request: Request) {
  const hostname = new URL(request.url).hostname;
  const local = hostname === 'localhost' || hostname === '127.0.0.1';
  const userId =
    request.headers.get('oai-authenticated-user-id') ||
    (local ? request.headers.get('x-servora-test-user-id') : null);
  const email =
    request.headers.get('oai-authenticated-user-email') ||
    (local ? request.headers.get('x-servora-test-user-email') : null);

  if (!userId && !local) return null;
  const resolvedEmail = (email || 'owner@servora.local').trim().toLowerCase();
  const testName = local
    ? request.headers.get('x-servora-test-user-name')
    : null;
  return {
    id: userId || 'local-servora-owner',
    email: resolvedEmail,
    displayName: testName?.trim() || decodeDisplayName(request, resolvedEmail),
  };
}

function workspaceIdentity(userId: string) {
  const safeId =
    userId
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(-28) || 'local';
  return {
    id: `ws_${safeId}`,
    name: 'Summit Services',
    slug: `summit-${safeId}`,
  };
}

async function membershipsFor(db: D1Database, userId: string) {
  const rows = await db
    .prepare(`SELECT m.role, w.id AS workspaceId, w.name AS workspaceName, w.slug AS workspaceSlug
    FROM memberships m JOIN workspaces w ON w.id = m.workspace_id
    WHERE m.user_id = ? ORDER BY m.created_at ASC`)
    .bind(userId)
    .all<MembershipRow>();
  return rows.results;
}

async function acceptFirstInvitation(
  db: D1Database,
  user: { id: string; email: string },
) {
  const invitations = await db
    .prepare(`SELECT id, workspace_id AS workspaceId, role FROM invitations
    WHERE email = ? AND status = 'pending' AND datetime(expires_at) > datetime('now')
    ORDER BY created_at ASC LIMIT 2`)
    .bind(user.email)
    .all<PendingInvitation>();
  if (invitations.results.length > 1) {
    throw new Response(
      'Multiple workspace invitations need an explicit selection.',
      { status: 409 },
    );
  }
  const invitation = invitations.results[0];
  if (!invitation) return false;
  await db.batch([
    db
      .prepare(
        'INSERT OR IGNORE INTO memberships (id, workspace_id, user_id, role) VALUES (?, ?, ?, ?)',
      )
      .bind(
        crypto.randomUUID(),
        invitation.workspaceId,
        user.id,
        invitation.role,
      ),
    db
      .prepare(`UPDATE invitations SET status = 'accepted', accepted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status = 'pending'`)
      .bind(invitation.id),
  ]);
  return true;
}

export async function requireContext(
  request: Request,
  allowedRoles: WorkspaceRole[] = ['owner', 'dispatcher', 'technician'],
): Promise<RequestContext> {
  const user = authenticatedUser(request);
  if (!user) throw new Response('Authentication required.', { status: 401 });

  const db = getD1();
  await db
    .prepare(`INSERT INTO users (id, email, display_name) VALUES (?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET email = excluded.email, display_name = excluded.display_name`)
    .bind(user.id, user.email, user.displayName)
    .run();

  let memberships = await membershipsFor(db, user.id);
  if (!memberships.length) {
    const joinedInvitedWorkspace = await acceptFirstInvitation(db, user);
    if (!joinedInvitedWorkspace) {
      const workspace = workspaceIdentity(user.id);
      await db.batch([
        db
          .prepare(
            'INSERT OR IGNORE INTO workspaces (id, name, slug) VALUES (?, ?, ?)',
          )
          .bind(workspace.id, workspace.name, workspace.slug),
        db
          .prepare(
            "INSERT OR IGNORE INTO memberships (id, workspace_id, user_id, role) VALUES (?, ?, ?, 'owner')",
          )
          .bind(`mem_${workspace.id}_${user.id}`, workspace.id, user.id),
      ]);
    }
    memberships = await membershipsFor(db, user.id);
  }

  const requestedWorkspaceId = request.headers.get('x-servora-workspace-id');
  const membership = requestedWorkspaceId
    ? memberships.find((item) => item.workspaceId === requestedWorkspaceId)
    : memberships[0];
  if (!membership)
    throw new Response('Workspace access denied.', { status: 403 });
  if (!allowedRoles.includes(membership.role))
    throw new Response('Your role cannot perform this action.', {
      status: 403,
    });

  const workspace = {
    id: membership.workspaceId,
    name: membership.workspaceName,
    slug: membership.workspaceSlug,
  };
  await ensureDemoData(db, workspace.id, user.id);
  return { db, user, workspace, role: membership.role };
}
