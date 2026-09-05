import { env } from 'cloudflare:workers';

export function getD1() {
  if (!env.DB) {
    throw new Error('Cloudflare D1 binding `DB` is unavailable.');
  }
  return env.DB;
}

export function getAttachmentBucket() {
  if (!env.ATTACHMENTS) {
    throw new Error('Cloudflare R2 binding `ATTACHMENTS` is unavailable.');
  }
  return env.ATTACHMENTS;
}

export function getStripeConfiguration() {
  const secretKey = env.STRIPE_SECRET_KEY?.trim();
  const webhookSecret = env.STRIPE_WEBHOOK_SECRET?.trim();
  return {
    secretKey,
    webhookSecret,
    testModeConfigured:
      Boolean(secretKey?.startsWith('sk_test_')) &&
      Boolean(webhookSecret?.startsWith('whsec_')),
  };
}
