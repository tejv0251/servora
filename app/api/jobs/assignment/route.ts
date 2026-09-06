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
    const jobId = requiredString(body, 'jobId');
    const technicianUserId = requiredString(body, 'technicianUserId');
    const [job, technician] = await Promise.all([
      db
        .prepare(
          'SELECT id, service FROM jobs WHERE id = ? AND workspace_id = ? LIMIT 1',
        )
        .bind(jobId, workspace.id)
        .first<{ id: string; service: string }>(),
      db
        .prepare(`SELECT u.display_name AS displayName FROM memberships m
          JOIN users u ON u.id = m.user_id
          WHERE m.workspace_id = ? AND m.user_id = ? AND m.role = 'technician' LIMIT 1`)
        .bind(workspace.id, technicianUserId)
        .first<{ displayName: string }>(),
    ]);
    if (!job)
      return json(
        { error: 'Job not found in this workspace.' },
        { status: 404 },
      );
    if (!technician)
      return json(
        { error: 'Choose an active technician in this workspace.' },
        { status: 400 },
      );
    await db.batch([
      db
        .prepare(`INSERT INTO job_assignments
          (id, workspace_id, job_id, technician_user_id, assigned_by)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(job_id) DO UPDATE SET technician_user_id = excluded.technician_user_id,
            assigned_by = excluded.assigned_by, updated_at = CURRENT_TIMESTAMP`)
        .bind(
          crypto.randomUUID(),
          workspace.id,
          job.id,
          technicianUserId,
          user.id,
        ),
      db
        .prepare(
          'UPDATE jobs SET technician = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND workspace_id = ?',
        )
        .bind(technician.displayName, job.id, workspace.id),
      db
        .prepare(`INSERT INTO activities
          (id, workspace_id, actor_id, entity_type, entity_id, action, message)
          VALUES (?, ?, ?, 'job', ?, 'job.assigned', ?)`)
        .bind(
          crypto.randomUUID(),
          workspace.id,
          user.id,
          job.id,
          `${job.service} assigned to ${technician.displayName}`,
        ),
    ]);
    return json({
      jobId: job.id,
      assignedUserId: technicianUserId,
      assignedTechnician: technician.displayName,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
