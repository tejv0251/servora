import { requireContext } from '@/db/session';
import {
  errorResponse,
  json,
  readJsonObject,
  requiredString,
} from '@/lib/api-response';
import { recordManualPayment } from '@/lib/payment-service';

// Compatibility endpoint retained for earlier portfolio clients. New UI uses
// /api/payments/manual so payment method and reference are captured explicitly.
export async function POST(request: Request) {
  try {
    const { db, workspace, user } = await requireContext(request, [
      'owner',
      'dispatcher',
    ]);
    const body = await readJsonObject(request);
    const invoiceId = requiredString(body, 'invoiceId');
    const idempotencyKey =
      typeof body.idempotencyKey === 'string' && body.idempotencyKey.trim()
        ? body.idempotencyKey.trim()
        : 'legacy:' + invoiceId;
    const result = await recordManualPayment({
      db,
      workspaceId: workspace.id,
      userId: user.id,
      invoiceId,
      method: 'other',
      reference: 'Legacy mark-paid action',
      receivedAt: new Date().toISOString(),
      idempotencyKey,
    });
    return json(result, { status: result.duplicate ? 200 : 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
