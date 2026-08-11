import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n, type TranslationKey } from '../../contexts/I18nContext';
import { Star, Gift, RefreshCw, Award, Clock } from 'lucide-react';

interface PointsTransaction {
  id: string;
  type: 'earn' | 'redeem';
  amount: number;
  description: string;
  createdAt: string;
}

interface Reward {
  id: string;
  name: string;
  pointsCost: number;
  description: string;
}

interface LoyaltyData {
  points: number;
  tier: string;
  lifetimePoints: number;
  history: PointsTransaction[];
  rewards: Reward[];
}

export function LoyaltyPoints() {
  const { t } = useI18n();
  const { state: { tenant } } = useAuth();
  const slug = tenant?.slug;
  const [data, setData] = useState<LoyaltyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/r/${slug}/loyalty`);
      if (!res.ok) throw new Error('Failed to load loyalty data');
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => { load(); }, [load]);

  async function handleRedeem(reward: Reward) {
    if (!slug) return;
    try {
      const res = await fetch(`/api/r/${slug}/loyalty/redeem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ points: reward.pointsCost, rewardId: reward.id }),
      });
      if (!res.ok) throw new Error('Redemption failed');
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const tierLabel = t(`loyalty.${(data?.tier ?? 'bronze').toLowerCase()}` as TranslationKey);

  if (loading) return <div className="text-center py-8 text-gray-500">{t('common.loading')}</div>;

  if (error) return <div className="bg-red-50 border-l-4 border-red-400 p-4 text-sm text-red-700">{error}</div>;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">{t('loyalty.title')}</h2>

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

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-2 mb-4">
          <Gift className="w-5 h-5 text-[#0f766e]" />
          <h3 className="text-lg font-medium">{t('loyalty.rewards')}</h3>
        </div>
        {(data?.rewards ?? []).length === 0 ? (
          <p className="text-sm text-gray-500">{t('loyalty.noRewards')}</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(data?.rewards ?? []).map((reward) => (
              <div key={reward.id} className="border border-gray-200 rounded-lg p-4 flex justify-between items-center">
                <div>
                  <p className="font-medium text-gray-900">{reward.name}</p>
                  <p className="text-sm text-gray-500">{reward.description}</p>
                  <p className="text-sm text-[#0f766e] font-medium mt-1">{reward.pointsCost} {t('loyalty.points')}</p>
                </div>
                <button
                  onClick={() => handleRedeem(reward)}
                  disabled={(data?.points ?? 0) < reward.pointsCost}
                  className="px-3 py-1.5 bg-[#0f766e] text-white text-sm rounded-lg hover:bg-[#1e3a5f] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t('loyalty.redeem')}
                </button>
              </div>
            ))}
          </div>
        )}
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

      <button onClick={load} className="flex items-center gap-2 text-sm text-[#0f766e] hover:underline">
        <RefreshCw className="w-4 h-4" /> {t('loyalty.refresh')}
      </button>
    </div>
  );
}
