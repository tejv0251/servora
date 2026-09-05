import type { PaymentMethod, PaymentRecord } from '@/lib/contracts';

export const PAYMENT_METHODS: readonly PaymentMethod[] = [
  'cash',
  'check',
  'bank_transfer',
  'card',
  'other',
];

type ManualPaymentInput = {
  db: D1Database;
  workspaceId: string;
  userId: string;
  invoiceId: string;
  method: PaymentMethod;
  reference: string | null;
  receivedAt: string;
  idempotencyKey: string;
};

type InvoiceForPayment = {
  id: string;
  amountCents: number;
  status: string;
  customer: string;
};

type StoredPayment = PaymentRecord & { workspaceId: string };

async function paymentByIdempotency(
  db: D1Database,
  workspaceId: string,
  idempotencyKey: string,
) {
  return db
    .prepare(`SELECT id, workspace_id AS workspaceId, invoice_id AS invoiceId, provider,
      amount_cents AS amountCents, status, method, reference, received_at AS receivedAt,
      created_at AS createdAt FROM payments
      WHERE workspace_id = ? AND idempotency_key = ? LIMIT 1`)
    .bind(workspaceId, idempotencyKey)
    .first<StoredPayment>();
}

export async function recordManualPayment(input: ManualPaymentInput) {
  const existing = await paymentByIdempotency(
    input.db,
    input.workspaceId,
    input.idempotencyKey,
  );
  if (existing) return { payment: existing, duplicate: true };

  const invoice = await input.db
    .prepare(`SELECT i.id, i.amount_cents AS amountCents, i.status, c.name AS customer
      FROM invoices i
      JOIN customers c ON c.id = i.customer_id AND c.workspace_id = i.workspace_id
      WHERE i.id = ? AND i.workspace_id = ? LIMIT 1`)
    .bind(input.invoiceId, input.workspaceId)
    .first<InvoiceForPayment>();
  if (!invoice)
    throw new Response('Invoice not found in this workspace.', { status: 404 });
  if (!['open', 'overdue'].includes(invoice.status)) {
    throw new Response(
      `A ${invoice.status} invoice cannot receive a payment.`,
      {
        status: 409,
      },
    );
  }

  const id = crypto.randomUUID();
  try {
    await input.db.batch([
      input.db
        .prepare(`INSERT INTO payments
          (id, workspace_id, invoice_id, provider, amount_cents, status, method,
           reference, idempotency_key, recorded_by, received_at)
          VALUES (?, ?, ?, 'manual', ?, 'succeeded', ?, ?, ?, ?, ?)`)
        .bind(
          id,
          input.workspaceId,
          invoice.id,
          invoice.amountCents,
          input.method,
          input.reference,
          input.idempotencyKey,
          input.userId,
          input.receivedAt,
        ),
      input.db
        .prepare(`UPDATE invoices SET status = 'paid', paid_at = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND workspace_id = ? AND status IN ('open', 'overdue')`)
        .bind(input.receivedAt, invoice.id, input.workspaceId),
      input.db
        .prepare(`INSERT INTO activities
          (id, workspace_id, actor_id, entity_type, entity_id, action, message)
          VALUES (?, ?, ?, 'invoice', ?, 'payment.recorded', ?)`)
        .bind(
          crypto.randomUUID(),
          input.workspaceId,
          input.userId,
          invoice.id,
          `Payment recorded for ${invoice.customer}`,
        ),
    ]);
  } catch (error) {
    const replay = await paymentByIdempotency(
      input.db,
      input.workspaceId,
      input.idempotencyKey,
    );
    if (replay) return { payment: replay, duplicate: true };
    const competing = await input.db
      .prepare(
        "SELECT id FROM payments WHERE invoice_id = ? AND status = 'succeeded' LIMIT 1",
      )
      .bind(invoice.id)
      .first();
    if (competing) {
      throw new Response(
        'This invoice was paid in another request. Refresh to see the payment.',
        { status: 409 },
      );
    }
    throw error;
  }

  const payment = await paymentByIdempotency(
    input.db,
    input.workspaceId,
    input.idempotencyKey,
  );
  if (!payment)
    throw new Error('Payment was recorded but could not be read back.');
  return { payment, duplicate: false };
}

export type StripeCheckoutSession = {
  id: string;
  url: string;
  payment_status: string;
  livemode: boolean;
};

type CreateStripeCheckoutInput = {
  secretKey: string;
  invoiceId: string;
  workspaceId: string;
  customerEmail: string;
  customerName: string;
  amountCents: number;
  successUrl: string;
  cancelUrl: string;
  idempotencyKey: string;
  fetcher?: typeof fetch;
};

export async function createStripeCheckoutSession(
  input: CreateStripeCheckoutInput,
) {
  if (!input.secretKey.startsWith('sk_test_')) {
    throw new Response('Only Stripe test-mode keys are accepted.', {
      status: 503,
    });
  }
  const body = new URLSearchParams({
    mode: 'payment',
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    client_reference_id: input.invoiceId,
    customer_email: input.customerEmail,
    'line_items[0][price_data][currency]': 'usd',
    'line_items[0][price_data][product_data][name]': `Servora invoice for ${input.customerName}`,
    'line_items[0][price_data][unit_amount]': String(input.amountCents),
    'line_items[0][quantity]': '1',
    'metadata[invoice_id]': input.invoiceId,
    'metadata[workspace_id]': input.workspaceId,
    'payment_intent_data[metadata][invoice_id]': input.invoiceId,
    'payment_intent_data[metadata][workspace_id]': input.workspaceId,
  });
  const response = await (input.fetcher ?? fetch)(
    'https://api.stripe.com/v1/checkout/sessions',
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${input.secretKey}`,
        'content-type': 'application/x-www-form-urlencoded',
        'idempotency-key': input.idempotencyKey,
      },
      body,
    },
  );
  const payload = (await response.json().catch(() => ({}))) as {
    id?: string;
    url?: string;
    payment_status?: string;
    livemode?: boolean;
    error?: { message?: string };
  };
  if (!response.ok || !payload.id || !payload.url) {
    throw new Response(
      payload.error?.message ||
        'Stripe could not create a test checkout session.',
      { status: response.status >= 400 ? response.status : 502 },
    );
  }
  if (payload.livemode) {
    throw new Response('A live-mode Stripe session was rejected.', {
      status: 502,
    });
  }
  return payload as StripeCheckoutSession;
}

export type StripeEvent = {
  id: string;
  type: string;
  livemode: boolean;
  data: {
    object: {
      id: string;
      amount_total?: number | null;
      payment_status?: string | null;
      payment_intent?: string | null;
      metadata?: Record<string, string> | null;
    };
  };
};

function equalHex(left: string, right: string) {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

export async function verifyStripeWebhook(
  payload: string,
  signatureHeader: string,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
) {
  if (!secret.startsWith('whsec_')) {
    throw new Response('Stripe webhook verification is not configured.', {
      status: 503,
    });
  }
  const fields = signatureHeader.split(',').map((part) => part.trim());
  const timestamp = Number(
    fields.find((part) => part.startsWith('t='))?.slice(2) ?? '',
  );
  const signatures = fields
    .filter((part) => part.startsWith('v1='))
    .map((part) => part.slice(3));
  if (!Number.isInteger(timestamp) || !signatures.length) {
    throw new Response('Invalid Stripe signature header.', { status: 400 });
  }
  if (Math.abs(nowSeconds - timestamp) > 300) {
    throw new Response('Expired Stripe webhook signature.', { status: 400 });
  }
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const digest = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(`${timestamp}.${payload}`),
  );
  const expected = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
  if (!signatures.some((signature) => equalHex(signature, expected))) {
    throw new Response('Invalid Stripe webhook signature.', { status: 400 });
  }
  let event: StripeEvent;
  try {
    event = JSON.parse(payload) as StripeEvent;
  } catch {
    throw new Response('Invalid Stripe event payload.', { status: 400 });
  }
  if (!event?.id || !event?.type || !event?.data?.object?.id) {
    throw new Response('Invalid Stripe event payload.', { status: 400 });
  }
  if (event.livemode) {
    throw new Response('Live-mode Stripe events are not accepted.', {
      status: 400,
    });
  }
  return event;
}

export async function fulfillStripeCheckout(
  db: D1Database,
  event: StripeEvent,
) {
  const session = event.data.object;
  const existingEvent = await db
    .prepare('SELECT id FROM payment_events WHERE id = ? LIMIT 1')
    .bind(event.id)
    .first();
  if (existingEvent) return { processed: false, duplicate: true };

  const supported = [
    'checkout.session.completed',
    'checkout.session.async_payment_succeeded',
  ].includes(event.type);
  if (!supported || session.payment_status !== 'paid') {
    await db
      .prepare(
        "INSERT INTO payment_events (id, provider, event_type, object_id) VALUES (?, 'stripe_test', ?, ?)",
      )
      .bind(event.id, event.type, session.id)
      .run();
    return { processed: false, duplicate: false };
  }

  const workspaceId = session.metadata?.workspace_id;
  const invoiceId = session.metadata?.invoice_id;
  if (!workspaceId || !invoiceId || !Number.isInteger(session.amount_total)) {
    throw new Response('Stripe event metadata is incomplete.', { status: 400 });
  }
  const invoice = await db
    .prepare(`SELECT i.id, i.amount_cents AS amountCents, i.status, c.name AS customer
      FROM invoices i JOIN customers c ON c.id = i.customer_id AND c.workspace_id = i.workspace_id
      WHERE i.id = ? AND i.workspace_id = ? LIMIT 1`)
    .bind(invoiceId, workspaceId)
    .first<InvoiceForPayment>();
  if (!invoice)
    throw new Response('Stripe invoice metadata was not found.', {
      status: 404,
    });
  if (invoice.amountCents !== session.amount_total) {
    throw new Response('Stripe payment amount does not match the invoice.', {
      status: 409,
    });
  }
  const existingPayment = await db
    .prepare(
      "SELECT id FROM payments WHERE provider = 'stripe_test' AND provider_payment_id = ? LIMIT 1",
    )
    .bind(session.id)
    .first<{ id: string }>();
  if (existingPayment) {
    await db
      .prepare(
        "INSERT INTO payment_events (id, provider, event_type, object_id) VALUES (?, 'stripe_test', ?, ?)",
      )
      .bind(event.id, event.type, session.id)
      .run();
    return { processed: false, duplicate: true, paymentId: existingPayment.id };
  }
  if (!['open', 'overdue'].includes(invoice.status)) {
    throw new Response(
      `A ${invoice.status} invoice cannot receive a Stripe payment.`,
      {
        status: 409,
      },
    );
  }
  const owner = await db
    .prepare(
      "SELECT user_id AS userId FROM memberships WHERE workspace_id = ? AND role = 'owner' ORDER BY created_at ASC LIMIT 1",
    )
    .bind(workspaceId)
    .first<{ userId: string }>();
  if (!owner)
    throw new Response('Workspace owner was not found.', { status: 409 });

  const paymentId = crypto.randomUUID();
  const receivedAt = new Date().toISOString();
  await db.batch([
    db
      .prepare(`INSERT INTO payments
        (id, workspace_id, invoice_id, provider, provider_payment_id, amount_cents,
         status, method, reference, idempotency_key, received_at)
        VALUES (?, ?, ?, 'stripe_test', ?, ?, 'succeeded', 'card', ?, ?, ?)`)
      .bind(
        paymentId,
        workspaceId,
        invoice.id,
        session.id,
        invoice.amountCents,
        session.payment_intent || session.id,
        `stripe:${session.id}`,
        receivedAt,
      ),
    db
      .prepare(`UPDATE invoices SET status = 'paid', paid_at = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND workspace_id = ? AND status IN ('open', 'overdue')`)
      .bind(receivedAt, invoice.id, workspaceId),
    db
      .prepare(`INSERT INTO activities
        (id, workspace_id, actor_id, entity_type, entity_id, action, message)
        VALUES (?, ?, ?, 'invoice', ?, 'payment.stripe_test_succeeded', ?)`)
      .bind(
        `act_${event.id}`,
        workspaceId,
        owner.userId,
        invoice.id,
        `Stripe test payment received from ${invoice.customer}`,
      ),
    db
      .prepare(
        "INSERT INTO payment_events (id, provider, event_type, object_id) VALUES (?, 'stripe_test', ?, ?)",
      )
      .bind(event.id, event.type, session.id),
  ]);
  return { processed: true, duplicate: false, paymentId };
}
