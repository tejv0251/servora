import { getStripeConfiguration } from '@/db';
import { requireContext } from '@/db/session';
import {
  errorResponse,
  json,
  readJsonObject,
  requiredString,
} from '@/lib/api-response';
import { createStripeCheckoutSession } from '@/lib/payment-service';

export async function POST(request: Request) {
  try {
    const { db, workspace } = await requireContext(request, [
      'owner',
      'dispatcher',
    ]);
    const { secretKey, testModeConfigured } = getStripeConfiguration();
    if (!testModeConfigured || !secretKey) {
      return json(
        {
          error:
            'Stripe test mode is not configured. Record an offline payment instead.',
        },
        { status: 503 },
      );
    }
    const body = await readJsonObject(request);
    const invoiceId = requiredString(body, 'invoiceId');
    const idempotencyKey = requiredString(body, 'idempotencyKey', 255);
    if (!/^[a-zA-Z0-9:_-]{16,255}$/.test(idempotencyKey)) {
      return json(
        { error: 'The checkout request key is invalid.' },
        { status: 400 },
      );
    }
    const invoice = await db
      .prepare(`SELECT i.id, i.amount_cents AS amountCents, i.status,
        c.name AS customerName, c.email AS customerEmail
        FROM invoices i JOIN customers c ON c.id = i.customer_id AND c.workspace_id = i.workspace_id
        WHERE i.id = ? AND i.workspace_id = ? LIMIT 1`)
      .bind(invoiceId, workspace.id)
      .first<{
        id: string;
        amountCents: number;
        status: string;
        customerName: string;
        customerEmail: string;
      }>();
    if (!invoice) return json({ error: 'Invoice not found.' }, { status: 404 });
    if (!['open', 'overdue'].includes(invoice.status)) {
      return json(
        { error: `A ${invoice.status} invoice cannot start checkout.` },
        { status: 409 },
      );
    }
    const origin = new URL(request.url).origin;
    const session = await createStripeCheckoutSession({
      secretKey,
      invoiceId: invoice.id,
      workspaceId: workspace.id,
      customerEmail: invoice.customerEmail,
      customerName: invoice.customerName,
      amountCents: invoice.amountCents,
      successUrl: `${origin}/?payment=success`,
      cancelUrl: `${origin}/?payment=cancelled`,
      idempotencyKey,
    });
    return json(
      { id: session.id, url: session.url, testMode: true },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
