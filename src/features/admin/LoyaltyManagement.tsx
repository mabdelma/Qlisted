import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n, type TranslationKey } from '../../contexts/I18nContext';
import { loyaltyApi, orderApi } from '../../lib/api';
import type { Order } from '../../lib/api/types';
import { Star, Award, Clock, Gift, RefreshCw, PlusCircle } from 'lucide-react';

interface PointsTransaction {
  id: string;
  type: 'earn' | 'redeem';
  amount: number;
  description: string;
  createdAt: string;
}

interface LoyaltyData {
  points: number;
  tier: string;
  lifetimePoints: number;
  history: PointsTransaction[];
}

export function LoyaltyManagement() {
  const { t } = useI18n();
  const { state: { tenant } } = useAuth();
  const slug = tenant?.slug;
  const [data, setData] = useState<LoyaltyData | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [redeemOrderId, setRedeemOrderId] = useState('');
  const [redeemPoints, setRedeemPoints] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [redeemResult, setRedeemResult] = useState<{ points: number; discount: number; newTotal: number } | null>(null);

  const [earnAmount, setEarnAmount] = useState('');
  const [earning, setEarning] = useState(false);

  const load = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    setError('');
    try {
      const res = await loyaltyApi.get(slug);
      setData({
        points: res.points,
        tier: res.tier,
        lifetimePoints: res.lifetimePoints,
        history: res.history,
      });
      const ordersRes = await orderApi.list(slug);
      setOrders(ordersRes.filter((o) => o.paymentStatus !== 'paid' && o.paymentStatus !== 'refunded'));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => { load(); }, [load]);

  async function handleRedeem(e: React.FormEvent) {
    e.preventDefault();
    if (!slug || !redeemOrderId || !redeemPoints) return;
    setRedeeming(true);
    setError('');
    setRedeemResult(null);
    try {
      const res = await loyaltyApi.redeemForOrder(slug, {
        orderId: redeemOrderId,
        points: parseInt(redeemPoints, 10),
      });
      setRedeemResult({ points: res.pointsRedeemed, discount: res.discountApplied, newTotal: res.newTotal });
      setRedeemOrderId('');
      setRedeemPoints('');
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRedeeming(false);
    }
  }

  async function handleEarn(e: React.FormEvent) {
    e.preventDefault();
    if (!slug || !earnAmount) return;
    setEarning(true);
    setError('');
    try {
      await loyaltyApi.earn(slug, { amount: parseInt(earnAmount, 10) });
      setEarnAmount('');
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setEarning(false);
    }
  }

  const tierLabel = t(`loyalty.${(data?.tier ?? 'bronze').toLowerCase()}` as TranslationKey);

  if (loading) return <div className="text-center py-8 text-gray-500">{t('common.loading')}</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">{t('loyalty.title')}</h2>
        <button onClick={load} className="flex items-center gap-2 text-sm text-[#0f766e] hover:underline">
          <RefreshCw className="w-4 h-4" /> {t('loyalty.refresh')}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 text-sm text-red-700">{error}</div>
      )}
      {redeemResult && (
        <div className="bg-green-50 border-l-4 border-green-400 p-4 text-sm text-green-800">
          {t('loyalty.redeemedSuccess', { points: redeemResult.points, discount: redeemResult.discount.toFixed(2) })} · {t('loyalty.orderTotal')}: ${redeemResult.newTotal.toFixed(2)}
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-4 mb-4">
          <Star className="w-10 h-10 text-yellow-500" />
          <div>
            <p className="text-3xl font-bold text-gray-900">{data?.points ?? 0}</p>
            <p className="text-sm text-gray-500">{t('loyalty.availablePoints')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Award className="w-4 h-4" />
          <span>{t('loyalty.tier')}: <strong>{tierLabel}</strong></span>
          <span className="mx-2">·</span>
          <span>{t('loyalty.lifetime')}: <strong>{data?.lifetimePoints ?? 0}</strong></span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-2 mb-4">
            <Gift className="w-5 h-5 text-[#0f766e]" />
            <h3 className="text-lg font-medium">{t('loyalty.redeemForOrder')}</h3>
          </div>
          <form onSubmit={handleRedeem} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">{t('loyalty.selectOrder')}</label>
              <select
                value={redeemOrderId}
                onChange={(e) => setRedeemOrderId(e.target.value)}
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#0f766e] focus:ring-[#0f766e]"
              >
                <option value="">{t('common.select')}</option>
                {orders.map((o) => (
                  <option key={o.id} value={o.id}>
                    #{o.id.slice(0, 8)} · ${o.total.toFixed(2)} · {o.customerName || o.orderType} · {o.status}
                  </option>
                ))}
              </select>
              {orders.length === 0 && (
                <p className="text-xs text-gray-500 mt-1">{t('loyalty.noUnpaidOrders')}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('loyalty.pointsToRedeem')}</label>
                <input type="number" min="1" required value={redeemPoints}
                  onChange={(e) => setRedeemPoints(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#0f766e] focus:ring-[#0f766e]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('loyalty.discountApplied')}</label>
                <p className="mt-2 text-sm text-gray-600">
                  ${(parseInt(redeemPoints || '0', 10) * 0.05).toFixed(2)}
                </p>
              </div>
            </div>
            <button type="submit" disabled={redeeming || !redeemOrderId || !redeemPoints}
              className="w-full px-4 py-2 bg-[#0f766e] text-white rounded-md hover:bg-[#1e3a5f] disabled:opacity-50 disabled:cursor-not-allowed">
              {redeeming ? t('common.loading') : t('loyalty.redeem')}
            </button>
          </form>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-2 mb-4">
            <PlusCircle className="w-5 h-5 text-[#0f766e]" />
            <h3 className="text-lg font-medium">{t('loyalty.manualEarn')}</h3>
          </div>
          <form onSubmit={handleEarn} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">{t('loyalty.earnAmount')}</label>
              <input type="number" min="1" required value={earnAmount}
                onChange={(e) => setEarnAmount(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#0f766e] focus:ring-[#0f766e]" />
            </div>
            <button type="submit" disabled={earning || !earnAmount}
              className="w-full px-4 py-2 bg-[#1e3a5f] text-white rounded-md hover:bg-[#0f766e] disabled:opacity-50 disabled:cursor-not-allowed">
              {earning ? t('common.loading') : t('loyalty.earn')}
            </button>
          </form>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-[#0f766e]" />
          <h3 className="text-lg font-medium">{t('loyalty.transactions')}</h3>
        </div>
        {(data?.history ?? []).length === 0 ? (
          <p className="text-sm text-gray-500">{t('loyalty.noTransactions')}</p>
        ) : (
          <div className="space-y-3">
            {(data?.history ?? []).map((tx) => (
              <div key={tx.id} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                <div className="flex items-center gap-2">
                  {tx.type === 'earn' ? (
                    <Star className="w-4 h-4 text-green-500" />
                  ) : (
                    <Gift className="w-4 h-4 text-[#0f766e]" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-gray-900">{tx.description}</p>
                    <p className="text-xs text-gray-400">{new Date(tx.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
                <span className={`text-sm font-medium ${tx.type === 'earn' ? 'text-green-600' : 'text-red-600'}`}>
                  {tx.type === 'earn' ? '+' : '-'}{tx.amount}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
