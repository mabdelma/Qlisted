import { useState, useEffect } from 'react';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import type { Stripe } from '@stripe/stripe-js';
import { useI18n } from '../../contexts/I18nContext';
import { paymentApi } from '../../lib/api';

interface StripePaymentFormProps {
  stripePromise: Promise<Stripe | null> | null;
  slug: string;
  orderId: string;
  amount: number;
  tip?: number;
  /** When set, charges only this amount against the order (partial / split-by-item). */
  partialAmount?: number;
  onSuccess: () => void;
  onCancel: () => void;
}

/**
 * Self-contained Stripe checkout using the Payment Element, so every method the
 * tenant has enabled (cards, wallets, and local methods like Bizum for EUR/Spain)
 * renders automatically. The intent is created on mount; the Element is then
 * mounted with its clientSecret. Redirect methods return to /payment/return;
 * cards confirm inline (no redirect) and call onSuccess directly.
 */
export function StripePaymentForm({ stripePromise, slug, orderId, amount, tip, partialAmount, onSuccess, onCancel }: StripePaymentFormProps) {
  const { t } = useI18n();
  const [clientSecret, setClientSecret] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    paymentApi.createIntent(slug, { orderId, tip, amount: partialAmount })
      .then((r) => { if (!cancelled) setClientSecret(r.clientSecret); })
      .catch(() => { if (!cancelled) setError(t('error.generic')); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, orderId, tip, partialAmount]);

  if (error) return <p className="text-red-600 text-sm">{error}</p>;
  if (!clientSecret || !stripePromise) {
    return <div className="py-6 text-center text-sm text-gray-500">{t('common.loading')}…</div>;
  }

  return (
    <Elements
      stripe={stripePromise}
      options={{ clientSecret, appearance: { theme: 'stripe', variables: { colorPrimary: '#0f766e' } } }}
    >
      <PaymentInner amount={amount} onSuccess={onSuccess} onCancel={onCancel} />
    </Elements>
  );
}

function PaymentInner({ amount, onSuccess, onCancel }: { amount: number; onSuccess: () => void; onCancel: () => void }) {
  const { t } = useI18n();
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setProcessing(true);
    setError('');

    const { error: stripeError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}/payment/return` },
      // Cards confirm inline; only redirect-based methods (e.g. Bizum) leave the page.
      redirect: 'if_required',
    });

    if (stripeError) {
      setError(stripeError.message || t('error.generic'));
      setProcessing(false);
    } else if (paymentIntent && (paymentIntent.status === 'succeeded' || paymentIntent.status === 'processing')) {
      onSuccess();
    } else {
      setProcessing(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-white rounded-lg shadow-sm p-4 border">
        <PaymentElement />
      </div>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <div className="flex gap-3">
        <button type="button" onClick={onCancel}
          className="flex-1 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">{t('common.cancel')}</button>
        <button type="submit" disabled={!stripe || processing}
          className="flex-1 py-2 bg-[#0f766e] text-white rounded-lg hover:bg-[#1e3a5f] disabled:opacity-50">
          {processing ? `${t('common.loading')}...` : `${t('payment.pay')} ${amount.toFixed(2)}`}
        </button>
      </div>
    </form>
  );
}
