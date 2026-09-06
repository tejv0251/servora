import {
  getAttachmentBucket,
  isDemoResetEnabled,
} from '@/db';
import { ensureDemoData } from '@/db/seed';
import { requireContext } from '@/db/session';
import { errorResponse, json, readJsonObject } from '@/lib/api-response';
import { requireDemoResetConfirmation } from '@/lib/demo-reset';
import { createRequestId, logEvent } from '@/lib/observability';

export async function POST(request: Request) {
  const requestId = createRequestId(request);
  try {
    if (!isDemoResetEnabled()) {
      throw new Response('Demo reset is not enabled.', { status: 404 });
    }
    const context = await requireContext(request, ['owner']);
    const body = await readJsonObject(request);
    requireDemoResetConfirmation(body.confirm);

    const attachmentRows = await context.db
      .prepare(
        'SELECT object_key AS objectKey FROM job_attachments WHERE workspace_id = ?',
      )
      .bind(context.workspace.id)
      .all<{ objectKey: string }>();
    const objectKeys = attachmentRows.results.map((row) => row.objectKey);
    if (objectKeys.length) await getAttachmentBucket().delete(objectKeys);

    await context.db.batch([
      context.db
        .prepare(
          `DELETE FROM payment_events WHERE object_id IN
            (SELECT provider_payment_id FROM payments WHERE workspace_id = ?)`,
        )
        .bind(context.workspace.id),
      context.db
        .prepare('DELETE FROM payments WHERE workspace_id = ?')
        .bind(context.workspace.id),
      context.db
        .prepare('DELETE FROM technician_operations WHERE workspace_id = ?')
        .bind(context.workspace.id),
      context.db
        .prepare('DELETE FROM job_notes WHERE workspace_id = ?')
        .bind(context.workspace.id),
      context.db
        .prepare('DELETE FROM job_assignments WHERE workspace_id = ?')
        .bind(context.workspace.id),
      context.db
        .prepare('DELETE FROM job_attachments WHERE workspace_id = ?')
        .bind(context.workspace.id),
      context.db
        .prepare('DELETE FROM invoices WHERE workspace_id = ?')
        .bind(context.workspace.id),
      context.db
        .prepare('DELETE FROM jobs WHERE workspace_id = ?')
        .bind(context.workspace.id),
      context.db
        .prepare('DELETE FROM quotes WHERE workspace_id = ?')
        .bind(context.workspace.id),
      context.db
        .prepare('DELETE FROM activities WHERE workspace_id = ?')
        .bind(context.workspace.id),
      context.db
        .prepare('DELETE FROM customers WHERE workspace_id = ?')
        .bind(context.workspace.id),
      context.db
        .prepare('DELETE FROM invitations WHERE workspace_id = ?')
        .bind(context.workspace.id),
    ]);
    await ensureDemoData(context.db, context.workspace.id, context.user.id);
    logEvent('info', 'demo.workspace.reset', {
      requestId,
      workspaceId: context.workspace.id,
      actorId: context.user.id,
      removedAttachmentCount: objectKeys.length,
    });
    return json(
      { reset: true, removedAttachmentCount: objectKeys.length },
      undefined,
      requestId,
    );
  } catch (error) {
    return errorResponse(error, request);
  }
}
