'use client';

import { useState, type SyntheticEvent } from 'react';
import { ArrowLeft, CreditCard, Landmark, ReceiptText } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import type { DashboardInvoice, PaymentMethod } from '@/lib/contracts';

export type PaymentDraft = {
  method: PaymentMethod;
  reference: string;
  receivedAt: string;
  idempotencyKey: string;
};

const paymentMethods: Array<{ value: PaymentMethod; label: string }> = [
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'cash', label: 'Cash' },
  { value: 'check', label: 'Check' },
  { value: 'card', label: 'Card — recorded offline' },
  { value: 'other', label: 'Other' },
];

const today = () => new Date().toISOString().slice(0, 10);
const money = (cents: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);

export function InvoicePaymentDialog({
  invoice,
  stripeTestMode,
  onRecord,
  onStartStripeCheckout,
}: {
  invoice: DashboardInvoice;
  stripeTestMode: boolean;
  onRecord: (
    invoice: DashboardInvoice,
    draft: PaymentDraft,
  ) => Promise<unknown>;
  onStartStripeCheckout: (
    invoice: DashboardInvoice,
    idempotencyKey: string,
  ) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'details' | 'review'>('details');
  const [method, setMethod] = useState<PaymentMethod>('bank_transfer');
  const [reference, setReference] = useState('');
  const [receivedAt, setReceivedAt] = useState(today);
  const [requestKey, setRequestKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState('');

  function changeOpen(next: boolean) {
    if (saving) return;
    setOpen(next);
    if (next) {
      setStep('details');
      setMethod('bank_transfer');
      setReference('');
      setReceivedAt(today());
      setRequestKey(crypto.randomUUID());
      setFailure('');
    }
  }

  function review(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setFailure('');
    if (!receivedAt) {
      setFailure('Choose the date the payment was received.');
      return;
    }
    setStep('review');
  }

  async function record() {
    setSaving(true);
    setFailure('');
    try {
      await onRecord(invoice, {
        method,
        reference,
        receivedAt: new Date(`${receivedAt}T12:00:00`).toISOString(),
        idempotencyKey: requestKey,
      });
      setOpen(false);
    } catch (error) {
      setFailure(
        error instanceof Error
          ? error.message
          : 'Payment could not be recorded.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function startStripeCheckout() {
    setSaving(true);
    setFailure('');
    try {
      await onStartStripeCheckout(invoice, requestKey);
    } catch (error) {
      setFailure(
        error instanceof Error
          ? error.message
          : 'Stripe checkout could not start.',
      );
      setSaving(false);
    }
  }

  const selectedMethod = paymentMethods.find(
    (item) => item.value === method,
  )?.label;

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        Record payment
      </DialogTrigger>
      <DialogContent className="payment-dialog sm:max-w-[500px]">
        {step === 'details' ? (
          <form noValidate onSubmit={review}>
            <DialogHeader>
              <DialogTitle className="text-lg">
                Record invoice payment
              </DialogTitle>
              <DialogDescription>
                Add a confirmed payment for {invoice.customer}. This marks the
                full invoice paid.
              </DialogDescription>
            </DialogHeader>

            <div className="payment-summary">
              <ReceiptText aria-hidden="true" />
              <div>
                <span>{invoice.customer}</span>
                <strong>{money(invoice.amountCents)}</strong>
              </div>
              <small>Full balance</small>
            </div>

            <div className="form-grid form-grid--single">
              <label>
                Payment method
                <select
                  value={method}
                  onChange={(event) =>
                    setMethod(event.target.value as PaymentMethod)
                  }
                >
                  {paymentMethods.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Reference <span className="optional-label">Optional</span>
                <input
                  value={reference}
                  maxLength={120}
                  onChange={(event) => setReference(event.target.value)}
                  placeholder="Transfer, receipt, or check number"
                />
              </label>
              <label>
                Date received
                <input
                  type="date"
                  value={receivedAt}
                  aria-invalid={!receivedAt || undefined}
                  aria-describedby={
                    !receivedAt ? `payment-date-error-${invoice.id}` : undefined
                  }
                  onChange={(event) => setReceivedAt(event.target.value)}
                />
              </label>
            </div>

            {failure ? (
              <p
                className="form-alert"
                id={`payment-date-error-${invoice.id}`}
                role="alert"
              >
                {failure}
              </p>
            ) : null}

            <aside className="payment-mode-note">
              <Landmark aria-hidden="true" />
              <div>
                <strong>Manual payment ledger</strong>
                <p>
                  The balance changes only after you review and confirm this
                  entry.
                </p>
              </div>
            </aside>

            {stripeTestMode ? (
              <Button
                type="button"
                variant="outline"
                className="stripe-test-button"
                disabled={saving}
                aria-busy={saving}
                onClick={() => void startStripeCheckout()}
              >
                <CreditCard /> Pay in Stripe test mode
              </Button>
            ) : (
              <p className="form-help">
                Stripe test checkout becomes available when test credentials are
                configured. No live payments are accepted.
              </p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => changeOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" className="primary-button">
                Review payment
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="payment-review">
            <DialogHeader>
              <DialogTitle className="text-lg">Confirm payment</DialogTitle>
              <DialogDescription>
                Check the details before updating the invoice and revenue
                totals.
              </DialogDescription>
            </DialogHeader>

            <dl>
              <div>
                <dt>Invoice</dt>
                <dd>{invoice.customer}</dd>
              </div>
              <div>
                <dt>Amount</dt>
                <dd>{money(invoice.amountCents)}</dd>
              </div>
              <div>
                <dt>Method</dt>
                <dd>{selectedMethod}</dd>
              </div>
              <div>
                <dt>Date received</dt>
                <dd>
                  {new Intl.DateTimeFormat('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  }).format(new Date(`${receivedAt}T12:00:00`))}
                </dd>
              </div>
              {reference.trim() ? (
                <div>
                  <dt>Reference</dt>
                  <dd>{reference.trim()}</dd>
                </div>
              ) : null}
            </dl>

            {failure ? (
              <p className="form-alert" role="alert">
                {failure}
              </p>
            ) : null}

            <p className="payment-confirmation-copy">
              This records one successful payment for the invoice. Partial
              payments and refunds are not part of this portfolio release.
            </p>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => setStep('details')}
              >
                <ArrowLeft /> Edit details
              </Button>
              <Button
                type="button"
                className="primary-button"
                disabled={saving}
                aria-busy={saving}
                onClick={() => void record()}
              >
                {saving
                  ? 'Recording…'
                  : `Confirm ${money(invoice.amountCents)}`}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
