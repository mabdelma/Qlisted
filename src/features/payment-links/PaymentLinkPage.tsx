import { useState, useEffect } from 'react';
import { useParams } from 'react-router';
import { paymentApi } from '../../lib/api';
import { useI18n } from '../../contexts/I18nContext';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { StripePaymentForm } from '../menu/StripePaymentForm';
import { CreditCard, Lock, Clock, CheckCircle, XCircle, Store } from 'lucide-react';
import type { PaymentLinkResponse } from '../../lib/api/types';

let stripePromise: Promise<Stripe | null> | null | undefined;
function getStripe() {
  if (stripePromise === undefined) {
    const key = import.meta.env.VITE_STRIPE_KEY || '';
    stripePromise = key ? loadStripe(key) : null;
  }
  return stripePromise;
}

export function PaymentLinkPage() {
  const { t } = useI18n();
  const { token } = useParams();
  const [link, setLink] = useState<PaymentLinkResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState(false);

  useEffect(() => {
    if (!token) { setError(t('error.generic')); setLoading(false); return; }
    paymentApi.getPaymentLink(token)
      .then(setLink)
      .catch((err: { message?: string }) => setError(err.message || t('error.notFound')))
      .finally(() => setLoading(false));
  }, [token, t]);

  if (loading) return <LoadingState message={t('common.loading')} />;
  if (error) return <ErrorState title={t('error.generic')} message={error} />;
  if (!link) return <ErrorState title={t('error.notFound')} message={t('error.notFound')} />;

  if (link.status === 'paid') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center space-y-4">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
          <h1 className="text-2xl font-bold text-gray-900">{t('payment.paid')}</h1>
          <p className="text-gray-500">{t('common.noResults')}</p>
        </div>
      </div>
    );
  }

  if (link.status === 'expired' || link.status === 'cancelled') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center space-y-4">
          <XCircle className="w-16 h-16 text-red-500 mx-auto" />
          <h1 className="text-2xl font-bold text-gray-900">{link.status === 'expired' ? t('order.cancelled') : t('order.cancelled')}</h1>
          <p className="text-gray-500">{t('common.notAvailable')}</p>
        </div>
      </div>
    );
  }

  const canPayCard = getStripe() && link.tenantSlug && link.orderId;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full space-y-6">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-[#ccfbf1] rounded-full flex items-center justify-center mx-auto">
            <CreditCard className="w-8 h-8 text-[#0f766e]" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{t('payment.pay')}</h1>
          {link.description && <p className="text-gray-500">{link.description}</p>}
          {link.tenantName && (
            <div className="flex items-center justify-center gap-1 text-sm text-gray-500">
              <Store className="w-4 h-4" />
              <span>{link.tenantName}</span>
            </div>
          )}
        </div>

        <div className="bg-[#ccfbf1]/30 rounded-lg p-4 text-center">
          <p className="text-sm text-gray-600">{t('payment.amount')}</p>
          <p className="text-3xl font-bold text-[#0f766e]">${link.amount.toFixed(2)}</p>
        </div>

        {link.expiresAt && (
          <div className="flex items-center justify-center gap-1 text-sm text-gray-500">
            <Clock className="w-4 h-4" />
            <span>{t('order.cancelled')} {new Date(link.expiresAt).toLocaleDateString()}</span>
          </div>
        )}

        {paid ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center space-y-2">
            <CheckCircle className="w-8 h-8 text-green-600 mx-auto" />
            <p className="text-green-700 font-medium">{t('payment.paid')}</p>
            <p className="text-green-600 text-sm">{t('payment.receipt')}</p>
          </div>
        ) : paying && link.tenantSlug && link.orderId && getStripe() ? (
          <div className="bg-gray-50 rounded-lg p-4">
            <Elements stripe={getStripe()!}>
              <StripePaymentForm
                slug={link.tenantSlug}
                orderId={link.orderId}
                amount={link.amount}
                onSuccess={() => setPaid(true)}
                onCancel={() => setPaying(false)}
              />
            </Elements>
          </div>
        ) : (
          <div className="space-y-3">
            {canPayCard && (
              <button onClick={() => setPaying(true)}
                className="w-full py-3 bg-[#0f766e] text-white rounded-lg font-medium hover:bg-[#1e3a5f] transition-colors">
                {t('payment.card')}
              </button>
            )}
            <div className="flex items-center justify-center gap-1 text-xs text-gray-400">
              <Lock className="w-3 h-3" />
              <span>{t('payment.paymentMethod')}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function LoadingState({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="w-8 h-8 border-2 border-[#0f766e] border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-gray-500">{message}...</p>
      </div>
    </div>
  );
}

function ErrorState({ title, message }: { title: string; message: string }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center space-y-4">
        <XCircle className="w-16 h-16 text-red-500 mx-auto" />
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        <p className="text-gray-500">{message}</p>
      </div>
    </div>
  );
}
