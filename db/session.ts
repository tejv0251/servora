import { getD1 } from './index';
import { ensureDemoData } from './seed';

export type WorkspaceRole = 'owner' | 'dispatcher' | 'technician';

export type RequestContext = {
  db: D1Database;
  user: { id: string; email: string; displayName: string };
  workspace: { id: string; name: string; slug: string };
  role: WorkspaceRole;
};

function decodeDisplayName(request: Request, email: string) {
  const encoded = request.headers.get('oai-authenticated-user-full-name');
  const encoding = request.headers.get('oai-authenticated-user-full-name-encoding');
  if (encoded && encoding === 'percent-encoded-utf-8') {
    try {
      return decodeURIComponent(encoded);
    } catch {
      // Fall through to the email-based display name.
    }
  }
  const localPart = email.split('@')[0] || 'Servora Owner';
  return localPart.split(/[._-]/).filter(Boolean).map((part) => `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}`).join(' ') || 'Servora Owner';
}

function authenticatedUser(request: Request) {
  const userId = request.headers.get('oai-authenticated-user-id');
  const email = request.headers.get('oai-authenticated-user-email');
  const hostname = new URL(request.url).hostname;
  const local = hostname === 'localhost' || hostname === '127.0.0.1';

  if (!userId && !local) return null;
  const resolvedEmail = email || 'owner@servora.local';
  return {
    id: userId || 'local-servora-owner',
    email: resolvedEmail,
    displayName: decodeDisplayName(request, resolvedEmail),
  };
}

function workspaceIdentity(userId: string) {
  const safeId = userId.toLowerCase().replace(/[^a-z0-9]/g, '').slice(-28) || 'local';
  return { id: `ws_${safeId}`, name: 'Summit Services', slug: `summit-${safeId}` };
}

export async function requireContext(request: Request, allowedRoles: WorkspaceRole[] = ['owner', 'dispatcher', 'technician']): Promise<RequestContext> {
  const user = authenticatedUser(request);
  if (!user) throw new Response('Authentication required.', { status: 401 });

  const db = getD1();
  const workspace = workspaceIdentity(user.id);
  const membershipId = `mem_${workspace.id}_${user.id}`;

  await db.batch([
    db.prepare('INSERT OR IGNORE INTO users (id, email, display_name) VALUES (?, ?, ?)').bind(user.id, user.email, user.displayName),
    db.prepare('INSERT OR IGNORE INTO workspaces (id, name, slug) VALUES (?, ?, ?)').bind(workspace.id, workspace.name, workspace.slug),
    db.prepare("INSERT OR IGNORE INTO memberships (id, workspace_id, user_id, role) VALUES (?, ?, ?, 'owner')").bind(membershipId, workspace.id, user.id),
  ]);

  const membership = await db.prepare('SELECT role FROM memberships WHERE workspace_id = ? AND user_id = ? LIMIT 1').bind(workspace.id, user.id).first<{ role: WorkspaceRole }>();
  if (!membership) throw new Response('Workspace access denied.', { status: 403 });
  if (!allowedRoles.includes(membership.role)) throw new Response('Your role cannot perform this action.', { status: 403 });

  await ensureDemoData(db, workspace.id, user.id);
  return { db, user, workspace, role: membership.role };
}

