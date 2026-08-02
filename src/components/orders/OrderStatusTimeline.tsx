import { Check, Clock } from 'lucide-react';
import { useI18n, type TranslationKey } from '../../contexts/I18nContext';

const STEPS = ['pending', 'preparing', 'ready', 'delivered'] as const;
const CANCELLED = 'cancelled';

interface OrderStatusTimelineProps {
  status: string;
  className?: string;
}

export function OrderStatusTimeline({ status, className = '' }: OrderStatusTimelineProps) {
  const { t } = useI18n();

  if (status === CANCELLED) {
    return (
      <div className={`flex items-center gap-2 text-sm ${className}`} role="status" aria-live="polite">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/60 dark:text-red-300">
          <Clock className="h-3.5 w-3.5" aria-hidden />
        </span>
        <span className="font-medium text-red-600 dark:text-red-400">{t('order.cancelled')}</span>
      </div>
    );
  }

  const currentIdx = STEPS.indexOf(status as (typeof STEPS)[number]);
  const activeIdx = currentIdx === -1 ? 0 : currentIdx;

  return (
    <ol className={`flex items-center ${className}`} aria-label={t('common.status')} role="status" aria-live="polite">
      {STEPS.map((step, i) => {
        const done = i <= activeIdx;
        const label = t(`order.${step}` as TranslationKey);
        return (
          <li key={step} className={`flex items-center ${i < STEPS.length - 1 ? 'flex-1' : ''}`}>
            <span className="flex flex-col items-center">
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors ${
                  done ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500'
                }`}
                aria-hidden
              >
                {done ? <Check className="h-4 w-4" /> : i + 1}
              </span>
              <span className={`mt-1 hidden text-[10px] font-medium sm:block ${done ? 'text-brand-600 dark:text-brand-300' : 'text-gray-400'}`}>
                {label}
              </span>
            </span>
            {i < STEPS.length - 1 && (
              <span
                className={`mx-1.5 mb-4 h-0.5 flex-1 rounded-full sm:mb-0 ${i < activeIdx ? 'bg-brand-500' : 'bg-gray-200 dark:bg-gray-800'}`}
                aria-hidden
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
