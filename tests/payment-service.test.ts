import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { Miniflare } from 'miniflare';

import {
  createStripeCheckoutSession,
  fulfillStripeCheckout,
  recordManualPayment,
  type StripeEvent,
  verifyStripeWebhook,
} from '../lib/payment-service';

async function database() {
  const miniflare = new Miniflare({
    compatibilityDate: '2026-05-15',
    d1Databases: { DB: 'servora-payment-test' },
    modules: true,
    script: 'export default { fetch() { return new Response("ok") } }',
  });
  const db = await miniflare.getD1Database('DB');
  for (const migration of [
    'drizzle/0000_silent_chronomancer.sql',
    'drizzle/0001_flat_gladiator.sql',
    'drizzle/0002_messy_wrecking_crew.sql',
    'drizzle/0003_smooth_leper_queen.sql',
  ]) {
    const sql = await readFile(
      new URL(`../${migration}`, import.meta.url),
      'utf8',
    );
    for (const statement of sql.split('--> statement-breakpoint')) {
      if (statement.trim()) await db.prepare(statement).run();
    }
  }
  await db.batch([
    db.prepare(
      "INSERT INTO users (id, email, display_name) VALUES ('owner', 'owner@example.com', 'Owner')",
    ),
    db.prepare(
      "INSERT INTO workspaces (id, name, slug) VALUES ('ws', 'Services', 'services')",
    ),
    db.prepare(
      "INSERT INTO memberships (id, workspace_id, user_id, role) VALUES ('mem', 'ws', 'owner', 'owner')",
    ),
    db.prepare(
      "INSERT INTO customers (id, workspace_id, name, contact_name, email, phone, city) VALUES ('cus', 'ws', 'Alpha Dental', 'Alex', 'alex@example.com', '1', 'Chicago')",
    ),
    db.prepare(
      "INSERT INTO invoices (id, workspace_id, customer_id, amount_cents, status, issued_at, due_at) VALUES ('inv_manual', 'ws', 'cus', 12500, 'open', '2026-09-01T00:00:00.000Z', '2026-09-15T00:00:00.000Z')",
    ),
    db.prepare(
      "INSERT INTO invoices (id, workspace_id, customer_id, amount_cents, status, issued_at, due_at) VALUES ('inv_stripe', 'ws', 'cus', 9900, 'open', '2026-09-01T00:00:00.000Z', '2026-09-15T00:00:00.000Z')",
    ),
  ]);
  return { db, miniflare };
}

test('manual payments are persisted once and update the invoice', async () => {
  const { db, miniflare } = await database();
  try {
    const input = {
      db,
      workspaceId: 'ws',
      userId: 'owner',
      invoiceId: 'inv_manual',
      method: 'bank_transfer' as const,
      reference: 'BANK-1042',
      receivedAt: '2026-09-05T12:00:00.000Z',
      idempotencyKey: 'manual:payment:request:1',
    };
    const first = await recordManualPayment(input);
    const replay = await recordManualPayment(input);
    assert.equal(first.duplicate, false);
    assert.equal(replay.duplicate, true);
    assert.equal(replay.payment.id, first.payment.id);
    assert.equal(
      (
        await db
          .prepare("SELECT status FROM invoices WHERE id = 'inv_manual'")
          .first<{ status: string }>()
      )?.status,
      'paid',
    );
    assert.equal(
      (
        await db
          .prepare(
            "SELECT COUNT(*) AS count FROM payments WHERE invoice_id = 'inv_manual'",
          )
          .first<{ count: number }>()
      )?.count,
      1,
    );
    await assert.rejects(
      () =>
        recordManualPayment({
          ...input,
          idempotencyKey: 'manual:payment:request:2',
        }),
      (error: unknown) => error instanceof Response && error.status === 409,
    );
  } finally {
    await miniflare.dispose();
  }
});

test('Stripe webhook signatures are checked for integrity and age', async () => {
  const event = {
    id: 'evt_1',
    type: 'checkout.session.completed',
    livemode: false,
    data: { object: { id: 'cs_test_1', payment_status: 'paid' } },
  };
  const payload = JSON.stringify(event);
  const timestamp = 1_788_566_400;
  const secret = 'whsec_test_secret';
  const signature = createHmac('sha256', secret)
    .update(`${timestamp}.${payload}`)
    .digest('hex');
  assert.equal(
    (
      await verifyStripeWebhook(
        payload,
        `t=${timestamp},v1=${signature}`,
        secret,
        timestamp,
      )
    ).id,
    event.id,
  );
  await assert.rejects(
    () =>
      verifyStripeWebhook(payload, `t=${timestamp},v1=bad`, secret, timestamp),
    (error: unknown) => error instanceof Response && error.status === 400,
  );
  await assert.rejects(
    () =>
      verifyStripeWebhook(
        payload,
        `t=${timestamp},v1=${signature}`,
        secret,
        timestamp + 301,
      ),
    (error: unknown) => error instanceof Response && error.status === 400,
  );
});

test('Stripe fulfillment is amount-checked and event-idempotent', async () => {
  const { db, miniflare } = await database();
  try {
    const event: StripeEvent = {
      id: 'evt_paid_1',
      type: 'checkout.session.completed',
      livemode: false,
      data: {
        object: {
          id: 'cs_test_paid_1',
          amount_total: 9900,
          payment_status: 'paid',
          payment_intent: 'pi_test_1',
          metadata: { workspace_id: 'ws', invoice_id: 'inv_stripe' },
        },
      },
    };
    await assert.rejects(
      () =>
        fulfillStripeCheckout(db, {
          ...event,
          id: 'evt_wrong_amount',
          data: {
            object: { ...event.data.object, amount_total: 9800 },
          },
        }),
      (error: unknown) => error instanceof Response && error.status === 409,
    );
    const result = await fulfillStripeCheckout(db, event);
    const duplicate = await fulfillStripeCheckout(db, event);
    assert.equal(result.processed, true);
    assert.equal(duplicate.duplicate, true);
    assert.equal(
      (
        await db
          .prepare("SELECT status FROM invoices WHERE id = 'inv_stripe'")
          .first<{ status: string }>()
      )?.status,
      'paid',
    );
    assert.equal(
      (
        await db
          .prepare(
            "SELECT COUNT(*) AS count FROM payments WHERE provider_payment_id = 'cs_test_paid_1'",
          )
          .first<{ count: number }>()
      )?.count,
      1,
    );
  } finally {
    await miniflare.dispose();
  }
});

test('Stripe checkout is test-only and sends a duplicate-safe request', async () => {
  let capturedUrl = '';
  let capturedInit: RequestInit | undefined;
  const fetcher = (async (input: URL | RequestInfo, init?: RequestInit) => {
    capturedUrl = String(input);
    capturedInit = init;
    return Response.json({
      id: 'cs_test_created',
      url: 'https://checkout.stripe.com/c/pay/cs_test_created',
      payment_status: 'unpaid',
      livemode: false,
    });
  }) as typeof fetch;
  const session = await createStripeCheckoutSession({
    secretKey: 'sk_test_secret',
    invoiceId: 'inv_1',
    workspaceId: 'ws_1',
    customerEmail: 'client@example.com',
    customerName: 'Client',
    amountCents: 7500,
    successUrl: 'https://example.com/success',
    cancelUrl: 'https://example.com/cancel',
    idempotencyKey: 'stripe:checkout:request:1',
    fetcher,
  });
  assert.equal(session.id, 'cs_test_created');
  assert.equal(capturedUrl, 'https://api.stripe.com/v1/checkout/sessions');
  assert.equal(
    new Headers(capturedInit?.headers).get('idempotency-key'),
    'stripe:checkout:request:1',
  );
  assert.match(String(capturedInit?.body), /metadata%5Binvoice_id%5D=inv_1/);
  await assert.rejects(
    () =>
      createStripeCheckoutSession({
        secretKey: 'sk_live_forbidden',
        invoiceId: 'inv_1',
        workspaceId: 'ws_1',
        customerEmail: 'client@example.com',
        customerName: 'Client',
        amountCents: 7500,
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
        idempotencyKey: 'stripe:checkout:request:2',
        fetcher,
      }),
    (error: unknown) => error instanceof Response && error.status === 503,
  );
});
