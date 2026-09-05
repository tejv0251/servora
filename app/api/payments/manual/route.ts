import { requireContext } from '@/db/session';
import {
  errorResponse,
  json,
  readJsonObject,
  requiredString,
} from '@/lib/api-response';
import { PAYMENT_METHODS, recordManualPayment } from '@/lib/payment-service';
import type { PaymentMethod } from '@/lib/contracts';

export async function POST(request: Request) {
  try {
    const { db, workspace, user } = await requireContext(request, [
      'owner',
      'dispatcher',
    ]);
    const body = await readJsonObject(request);
    const invoiceId = requiredString(body, 'invoiceId');
    const method = requiredString(body, 'method', 40) as PaymentMethod;
    const idempotencyKey = requiredString(body, 'idempotencyKey', 255);
    const receivedAt = requiredString(body, 'receivedAt', 50);
    const referenceValue = body.reference;
    const reference =
      typeof referenceValue === 'string' && referenceValue.trim()
        ? referenceValue.trim().slice(0, 120)
        : null;
    if (!PAYMENT_METHODS.includes(method)) {
      return json(
        { error: 'Choose a supported payment method.' },
        { status: 400 },
      );
    }
    if (!Number.isFinite(Date.parse(receivedAt))) {
      return json({ error: 'Choose a valid payment date.' }, { status: 400 });
    }
    if (!/^[a-zA-Z0-9:_-]{16,255}$/.test(idempotencyKey)) {
      return json(
        { error: 'The payment request key is invalid.' },
        { status: 400 },
      );
    }
    const result = await recordManualPayment({
      db,
      workspaceId: workspace.id,
      userId: user.id,
      invoiceId,
      method,
      reference,
      receivedAt: new Date(receivedAt).toISOString(),
      idempotencyKey,
    });
    return json(result, { status: result.duplicate ? 200 : 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
