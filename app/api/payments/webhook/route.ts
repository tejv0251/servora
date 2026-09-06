import { getD1, getStripeConfiguration } from '@/db';
import { errorResponse, json, readTextBody } from '@/lib/api-response';
import {
  fulfillStripeCheckout,
  verifyStripeWebhook,
} from '@/lib/payment-service';

export async function POST(request: Request) {
  try {
    const { webhookSecret } = getStripeConfiguration();
    if (!webhookSecret) {
      return json(
        { error: 'Stripe webhook verification is not configured.' },
        { status: 503 },
      );
    }
    const signature = request.headers.get('stripe-signature');
    if (!signature)
      return json({ error: 'Stripe signature is required.' }, { status: 400 });
    const payload = await readTextBody(request, 512 * 1024);
    const event = await verifyStripeWebhook(payload, signature, webhookSecret);
    const result = await fulfillStripeCheckout(getD1(), event);
    return json({ received: true, ...result });
  } catch (error) {
    return errorResponse(error, request);
  }
}
