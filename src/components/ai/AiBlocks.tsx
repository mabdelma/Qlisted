import { Link } from 'react-router';
import { Plus, ShoppingBag } from 'lucide-react';
import { useI18n } from '../../contexts/I18nContext';
import { formatPrice } from '../../lib/pricing';
import type { AiBlock } from '../../lib/api';

interface AiBlocksProps {
  blocks: AiBlock[];
  onOrderItem?: (itemName: string) => void;
  cartUrl?: string;
}

/** Renders structured assistant payloads (menu cards, live cart) under a reply. */
export function AiBlocks({ blocks, onOrderItem, cartUrl }: AiBlocksProps) {
  const { t, locale } = useI18n();

  return (
    <div className="mt-2 space-y-3">
      {blocks.map((block, i) => {
        if (block.type === 'menu') {
          return (
            <div key={i} className="space-y-3">
              {block.categories.map((cat) => (
                <div key={cat.id} className="rounded-card border border-gray-100 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">{cat.name}</p>
                  <div className="space-y-1.5">
                    {cat.items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{item.name}</p>
                          {item.description && <p className="line-clamp-2 text-xs text-gray-500 dark:text-gray-400">{item.description}</p>}
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="text-sm font-semibold text-brand-600 dark:text-brand-400">{formatPrice(item.price, locale)}</span>
                          {onOrderItem && (
                            <button
                              onClick={() => onOrderItem(item.name)}
                              aria-label={`${t('customer.assistant.addItem')}: ${item.name}`}
                              className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-500 text-white transition-colors hover:bg-brand-600 active:scale-95"
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          );
        }

        if (block.type === 'cart') {
          return (
            <div key={i} className="rounded-card border border-gray-100 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">
                <ShoppingBag className="h-3.5 w-3.5" /> {t('customer.assistant.yourCart')}
              </p>
              {block.items.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('customer.assistant.emptyCart')}</p>
              ) : (
                <div className="space-y-1.5">
                  {block.items.map((line) => (
                    <div key={line.menuItemId} className="flex items-center justify-between text-sm">
                      <span className="text-gray-800 dark:text-gray-200">
                        {line.quantity} × {line.name}
                      </span>
                      <span className="text-gray-600 dark:text-gray-400">{formatPrice(line.quantity * line.unitPrice, locale)}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between border-t border-gray-100 pt-1.5 text-sm font-semibold text-gray-900 dark:border-gray-800 dark:text-gray-100">
                    <span>{t('customer.assistant.cartTotal')}</span>
                    <span className="text-brand-600 dark:text-brand-400">{formatPrice(block.total, locale)}</span>
                  </div>
                  {cartUrl && (
                    <Link
                      to={cartUrl}
                      className="mt-2 block rounded-lg bg-brand-500 px-3 py-2 text-center text-sm font-medium text-white transition-colors hover:bg-brand-600"
                    >
                      {t('customer.assistant.reviewOrder')}
                    </Link>
                  )}
                </div>
              )}
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}
