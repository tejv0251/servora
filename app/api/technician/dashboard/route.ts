import { requireContext } from '@/db/session';
import { errorResponse, json } from '@/lib/api-response';
import type {
  TechnicianDashboardData,
  TechnicianJob,
  TechnicianNote,
} from '@/lib/contracts';

export async function GET(request: Request) {
  try {
    const context = await requireContext(request, ['technician']);
    const { db, workspace, user } = context;
    const [jobRows, noteRows] = await Promise.all([
      db
        .prepare(`SELECT j.id, c.name AS customer, c.contact_name AS contactName, c.phone,
          j.service, j.city, j.scheduled_at AS scheduledAt, j.priority, j.status,
          (SELECT COUNT(*) FROM job_attachments a WHERE a.workspace_id = j.workspace_id AND a.job_id = j.id) AS attachmentCount
          FROM job_assignments ja
          JOIN jobs j ON j.id = ja.job_id AND j.workspace_id = ja.workspace_id
          JOIN customers c ON c.id = j.customer_id AND c.workspace_id = j.workspace_id
          WHERE ja.workspace_id = ? AND ja.technician_user_id = ?
          ORDER BY CASE WHEN j.status IN ('Completed', 'Cancelled') THEN 1 ELSE 0 END,
            j.scheduled_at ASC LIMIT 100`)
        .bind(workspace.id, user.id)
        .all<Omit<TechnicianJob, 'notes'>>(),
      db
        .prepare(`SELECT n.id, n.job_id AS jobId, u.display_name AS author, n.body,
          n.created_at AS createdAt FROM job_notes n
          JOIN users u ON u.id = n.author_id
          JOIN job_assignments ja ON ja.job_id = n.job_id AND ja.workspace_id = n.workspace_id
          WHERE n.workspace_id = ? AND ja.technician_user_id = ?
          ORDER BY n.created_at DESC LIMIT 300`)
        .bind(workspace.id, user.id)
        .all<TechnicianNote>(),
    ]);
    const notesByJob = new Map<string, TechnicianNote[]>();
    for (const note of noteRows.results) {
      const notes = notesByJob.get(note.jobId) ?? [];
      notes.push(note);
      notesByJob.set(note.jobId, notes);
    }
    const payload: TechnicianDashboardData = {
      session: { user, workspace, role: context.role },
      jobs: jobRows.results.map((job) => ({
        ...job,
        notes: notesByJob.get(job.id) ?? [],
      })),
    };
    return json(payload);
  } catch (error) {
    return errorResponse(error);
  }
}
