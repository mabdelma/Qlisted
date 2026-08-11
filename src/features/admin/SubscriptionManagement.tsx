import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../contexts/I18nContext';
import { formatPrice } from '../../lib/pricing';
import { api, connectApi } from '../../lib/api';
import type { ConnectAccountStatus, PayoutInfo } from '../../lib/api/types';
import { CreditCard, Check, ChevronDown, ChevronUp, Loader2, DollarSign, Plus, ExternalLink } from 'lucide-react';

interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  usersLimit: number;
  ordersLimit: number;
  features: string[];
}

interface SubscriptionInfo {
  plan: SubscriptionPlan;
  renewDate: string;
  billingHistory: Array<{ id: string; date: string; amount: number; status: string }>;
  usage: { users: number; orders: number };
}

const PLANS: SubscriptionPlan[] = [
  { id: 'starter', name: 'Starter', price: 29, usersLimit: 3, ordersLimit: 500, features: ['Up to 3 staff', '500 orders/month', 'Basic analytics', 'Email support'] },
  { id: 'growth', name: 'Growth', price: 79, usersLimit: 10, ordersLimit: 2000, features: ['Up to 10 staff', '2,000 orders/month', 'Advanced analytics', 'Priority support', 'Custom branding'] },
  { id: 'enterprise', name: 'Enterprise', price: 199, usersLimit: 50, ordersLimit: 10000, features: ['Up to 50 staff', '10,000 orders/month', 'Full analytics', 'Dedicated support', 'Custom branding', 'API access'] },
];

export function SubscriptionManagement() {
  const { t, locale } = useI18n();
  const { state: { tenant } } = useAuth();
  const slug = tenant?.slug;
  const [info, setInfo] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [changing, setChanging] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Stripe Connect state
  const [connectStatus, setConnectStatus] = useState<ConnectAccountStatus | null>(null);
  const [connectLoading, setConnectLoading] = useState(false);
  const [balance, setBalance] = useState<{ available: { amount: number; currency: string }[]; pending: { amount: number; currency: string }[] } | null>(null);
  const [payouts, setPayouts] = useState<PayoutInfo[]>([]);
  const [email, setEmail] = useState('');
  const [payoutAmount, setPayoutAmount] = useState(0);
  const [payoutCreating, setPayoutCreating] = useState(false);

  const loadConnect = useCallback(async () => {
    if (!slug) return;
    setConnectLoading(true);
    try {
      const [status, bal, payoutList] = await Promise.all([
        connectApi.status(slug).catch(() => null),
        connectApi.balance(slug).catch(() => null),
        connectApi.payouts(slug).catch(() => []),
      ]);
      if (status) setConnectStatus(status);
      if (bal) setBalance(bal);
      setPayouts(payoutList);
    } catch { /* non-blocking: Connect data is optional */ }
    setConnectLoading(false);
  }, [slug]);

  useEffect(() => { if (slug) loadConnect(); }, [slug, loadConnect]);

  const handleCreateAccount = async () => {
    if (!slug || !email) return;
    try {
      await connectApi.createAccount(slug, email);
      await loadConnect();
    } catch { /* non-blocking: Connect data is optional */ }
  };

  const handleOnboarding = async () => {
    if (!slug) return;
    try {
      const { url } = await connectApi.onboardingLink(slug);
      window.open(url, '_blank');
    } catch { /* non-blocking: Connect data is optional */ }
  };

  const handlePayout = async () => {
    if (!slug || payoutAmount <= 0) return;
    setPayoutCreating(true);
    try {
      await connectApi.createPayout(slug, Math.round(payoutAmount * 100));
      setPayoutAmount(0);
      await loadConnect();
    } catch { /* non-blocking: Connect data is optional */ }
    setPayoutCreating(false);
  };

  const load = useCallback(async () => {
    if (!tenant) return;
    setLoading(true);
    setError('');
    try {
      // Authed via the api client (sends the Bearer token).
      const data = await api.get<SubscriptionInfo>(`/admin/subscriptions/${tenant.id}`);
      setInfo(data);
    } catch (err) {
      setError((err as { message?: string }).message || 'Failed to load subscription');
    } finally {
      setLoading(false);
    }
  }, [tenant]);

  useEffect(() => { load(); }, [load]);

  async function handleChangePlan(planId: string) {
    if (!tenant) return;
    setChanging(true);
    try {
      // Real billing: start a Stripe Checkout session and redirect to it.
      const { url } = await api.post<{ url: string }>(`/admin/subscriptions/${tenant.id}/checkout`, { planId });
      if (url) { window.location.href = url; return; }
      await load();
    } catch (err) {
      setError((err as { message?: string }).message || 'Failed to start checkout');
    } finally {
      setChanging(false);
    }
  }

  if (loading) return <div className="text-center py-8 text-gray-500">{t('common.loading')}</div>;
  if (error) return <div className="bg-red-50 border-l-4 border-red-400 p-4 text-sm text-red-700">{error}</div>;

  const currentPlanId = info?.plan.id || 'starter';

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">{t('sub.title')}</h2>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-3 mb-4">
          <CreditCard className="w-6 h-6 text-[#0f766e]" />
          <h3 className="text-lg font-medium">{t('sub.currentPlan')}</h3>
        </div>
        {info && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-sm text-gray-500">{t('sub.plan')}</p>
              <p className="text-lg font-bold text-gray-900">{info.plan.name}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-sm text-gray-500">{t('common.price')}</p>
              <p className="text-lg font-bold text-gray-900">{formatPrice(info.plan.price, locale)}{t('pricing.perMonth')}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-sm text-gray-500">{t('sub.renewal')}</p>
              <p className="text-lg font-bold text-gray-900">{new Date(info.renewDate).toLocaleDateString()}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-sm text-gray-500">{t('sub.users')}</p>
              <p className="text-lg font-bold text-gray-900">{info.usage.users}/{info.plan.usersLimit}</p>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium mb-4">{t('sub.availablePlans')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PLANS.map((plan) => {
            const isCurrent = plan.id === currentPlanId;
            const isDowngrade = PLANS.indexOf(plan) < PLANS.findIndex((p) => p.id === currentPlanId);
            return (
              <div key={plan.id} className={`border rounded-lg p-4 ${isCurrent ? 'border-[#0f766e] bg-[#ccfbf1]/20' : 'border-gray-200'}`}>
                <h4 className="text-lg font-bold text-gray-900">{plan.name}</h4>
                <p className="text-2xl font-bold text-[#0f766e] mt-2">{formatPrice(plan.price, locale)}<span className="text-sm text-gray-500 font-normal">{t('pricing.perMonth')}</span></p>
                <ul className="mt-3 space-y-1">
                  {plan.features.map((f, i) => (
                    <li key={i} className="text-sm text-gray-600 flex items-center gap-1">
                      <Check className="w-3 h-3 text-green-500" /> {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => handleChangePlan(plan.id)}
                  disabled={isCurrent || changing}
                  className={`mt-4 w-full py-2 rounded-lg text-sm font-medium ${
                    isCurrent ? 'bg-gray-100 text-gray-400 cursor-not-allowed' :
                    'bg-[#0f766e] text-white hover:bg-[#1e3a5f] disabled:opacity-50'
                  }`}
                >
                  {changing ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> :
                   isCurrent ? t('sub.currentPlanBtn') : isDowngrade ? t('sub.downgrade') : t('sub.upgrade')}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="flex items-center gap-2 text-lg font-medium text-gray-900"
        >
          {t('sub.billingHistory')}
          {showHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {showHistory && info && (
          <div className="mt-4 space-y-2">
            {info.billingHistory.length === 0 ? (
              <p className="text-sm text-gray-500">{t('sub.noBilling')}</p>
            ) : (
              info.billingHistory.map((b) => (
                <div key={b.id} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{new Date(b.date).toLocaleDateString()}</p>
                    <p className="text-xs text-gray-400 capitalize">{b.status}</p>
                  </div>
                  <span className="text-sm font-medium">${b.amount.toFixed(2)}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-3 mb-4">
          <DollarSign className="w-6 h-6 text-[#0f766e]" />
          <h3 className="text-lg font-medium">{t('sub.payouts')}</h3>
        </div>
        {connectLoading ? (
          <p className="text-sm text-gray-500">{t('common.loading')}</p>
        ) : connectStatus?.connected ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-sm text-gray-500">{t('sub.availableBalance')}</p>
                <p className="text-lg font-bold text-gray-900">
                  {balance ? `$${(balance.available.reduce((s, b) => s + b.amount, 0) / 100).toFixed(2)}` : '—'}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-sm text-gray-500">{t('sub.pendingBalance')}</p>
                <p className="text-lg font-bold text-gray-900">
                  {balance ? `$${(balance.pending.reduce((s, b) => s + b.amount, 0) / 100).toFixed(2)}` : '—'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input type="number" min="1" step="0.01" value={payoutAmount || ''} placeholder={t('sub.amount')}
                onChange={(e) => setPayoutAmount(parseFloat(e.target.value) || 0)}
                className="w-40 rounded-md border-gray-300 shadow-sm focus:border-[#0f766e] focus:ring-[#0f766e] text-sm" />
              <button onClick={handlePayout} disabled={payoutCreating}
                className="flex items-center px-4 py-2 bg-[#0f766e] text-white rounded-md hover:bg-[#1e3a5f] disabled:opacity-50">
                {payoutCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4 mr-1" /> {t('sub.payout')}</>}
              </button>
            </div>
            {payouts.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">{t('sub.payoutHistory')}</h4>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {payouts.map((p) => (
                    <div key={p.id} className="flex justify-between text-sm py-1 border-b border-gray-100">
                      <span className="text-gray-600">{new Date(p.created || p.arrivalDate).toLocaleDateString()}</span>
                      <span className="font-medium">${(p.amount / 100).toFixed(2)}</span>
                      <span className={`text-xs capitalize ${p.status === 'paid' ? 'text-green-600' : 'text-yellow-600'}`}>{p.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-500">{t('sub.connectStripe')}</p>
            <input type="email" placeholder={t('sub.emailForStripe')} value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="block w-80 rounded-md border-gray-300 shadow-sm focus:border-[#0f766e] focus:ring-[#0f766e] text-sm" />
            <div className="flex gap-2">
              <button onClick={handleCreateAccount}
                className="flex items-center px-4 py-2 bg-[#0f766e] text-white rounded-md hover:bg-[#1e3a5f] text-sm">
                <Plus className="w-4 h-4 mr-1" /> {t('sub.createAccount')}
              </button>
              <button onClick={handleOnboarding}
                className="flex items-center px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 text-sm">
                <ExternalLink className="w-4 h-4 mr-1" /> {t('sub.completeOnboarding')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
