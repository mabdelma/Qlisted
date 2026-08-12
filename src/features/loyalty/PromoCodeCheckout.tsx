import { useState } from 'react';
import { Tag, Check, X, Loader2 } from 'lucide-react';
import { promoApi } from '../../lib/api';
import { useI18n } from '../../contexts/I18nContext';

interface PromoCodeCheckoutProps {
  slug: string;
  subtotal: number;
  onApply: (discount: number) => void;
  onRemove: () => void;
}

export function PromoCodeCheckout({ slug, subtotal, onApply, onRemove }: PromoCodeCheckoutProps) {
  const { t } = useI18n();
  const [code, setCode] = useState('');
  const [appliedCode, setAppliedCode] = useState<string | null>(null);
  const [discount, setDiscount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleApply() {
    if (!code.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await promoApi.validate(slug, code.trim(), subtotal);
      const disc = Math.min(res.discount, subtotal);
      if (disc <= 0) {
        setError(t('promo.noDiscount'));
        return;
      }
      setDiscount(disc);
      setAppliedCode(code.trim().toUpperCase());
      onApply(disc);
    } catch (err) {
      const message = (err as { message?: string })?.message;
      setError(message || t('promo.invalid'));
    } finally {
      setLoading(false);
    }
  }

  function handleRemove() {
    setCode('');
    setAppliedCode(null);
    setDiscount(0);
    setError('');
    onRemove();
  }

  if (appliedCode) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-green-600" />
            <span className="text-sm font-medium text-green-700">{appliedCode}</span>
            <span className="text-sm text-green-600">-${discount.toFixed(2)}</span>
          </div>
          <button onClick={handleRemove} className="p-1 hover:bg-green-100 rounded-full">
            <X className="w-4 h-4 text-green-600" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="border-t px-4 py-3">
      <label className="block text-sm font-medium text-gray-700 mb-2">{t('promo.code')}</label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => { if (e.key === 'Enter') handleApply(); }}
            placeholder={t('promo.enterCode')}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0f766e]"
          />
        </div>
        <button
          onClick={handleApply}
          disabled={loading || !code.trim()}
          className="px-4 py-2 bg-[#0f766e] text-white text-sm rounded-lg hover:bg-[#1e3a5f] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          {t('promo.apply')}
        </button>
      </div>
      {error && <p className="text-sm text-red-600 mt-1 flex items-center gap-1"><X className="w-3 h-3" />{error}</p>}
    </div>
  );
}
