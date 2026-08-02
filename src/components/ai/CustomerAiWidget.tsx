import { useState, useEffect, useRef, useContext } from 'react';
import { MessageCircle, X } from 'lucide-react';
import { aiApi, type AiCartLine, type CustomerChatContext } from '../../lib/api';
import { useI18n } from '../../contexts/I18nContext';
import { CartContext } from '../../contexts/CartContext';
import { AiChat, type ChatMessage, type AiSendResult } from './AiChat';

const SESSION_KEY = (slug: string) => `qcart:ai:session:${slug}`;

/** Floating "ask about the menu" assistant for the customer ordering page. */
export function CustomerAiWidget({ slug, cartUrl }: { slug: string; cartUrl?: string }) {
  const { t, locale } = useI18n();
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const cartCtx = useContext(CartContext);
  const orderTokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    orderTokenRef.current = localStorage.getItem(SESSION_KEY(slug));
    aiApi.status(slug).then((r) => setEnabled(r.enabled)).catch(() => setEnabled(false));
  }, [slug]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!enabled) return null;

  const context = (): CustomerChatContext => {
    const lines: AiCartLine[] = (cartCtx?.state.items ?? []).map((i) => ({
      menuItemId: i.menuItem.id,
      name: i.menuItem.name,
      quantity: i.quantity,
      unitPrice: i.menuItem.price,
    }));
    return { cart: lines, orderToken: orderTokenRef.current || undefined, locale, isMobile: window.innerWidth < 768 };
  };

  const send = async (messages: ChatMessage[]): Promise<AiSendResult> => {
    const res = await aiApi.customerChat(slug, messages, context());
    if (res.orderToken) {
      orderTokenRef.current = res.orderToken;
      try { localStorage.setItem(SESSION_KEY(slug), res.orderToken); } catch { /* private mode */ }
    }
    return { reply: res.reply, blocks: res.blocks, done: res.done, nextStep: res.nextStep };
  };

  const nextStepLabels: Record<string, string> = {
    review_cart: t('customer.assistant.stepReview'),
    checkout: t('customer.assistant.stepCheckout'),
    order_now: t('customer.assistant.stepOrder'),
  };

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label={t('customer.assistant.ask')}
          className="fixed bottom-24 right-5 z-40 flex items-center gap-2 rounded-full bg-brand-500 px-4 py-3 text-white shadow-card hover:bg-brand-600"
        >
          <MessageCircle className="h-5 w-5" />
          <span className="text-sm font-medium">{t('customer.assistant.ask')}</span>
        </button>
      )}

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t('customer.assistant.title')}
          className="fixed bottom-24 right-5 z-40 flex h-[28rem] w-[min(92vw,22rem)] flex-col rounded-card bg-white shadow-float ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-800"
        >
          <div className="flex items-center justify-between rounded-t-card bg-brand-500 px-4 py-3 text-white">
            <span className="text-sm font-semibold">{t('customer.assistant.title')}</span>
            <button onClick={() => setOpen(false)} aria-label={t('common.close')} className="rounded-md p-1 transition-colors hover:bg-brand-600"><X className="h-5 w-5" /></button>
          </div>
          <div className="flex-1 min-h-0 p-2">
            <AiChat
              greeting={t('customer.assistant.greeting')}
              placeholder={t('customer.assistant.placeholder')}
              suggestions={[
                t('customer.assistant.s1'),
                t('customer.assistant.s2'),
                t('customer.assistant.s3'),
              ]}
              send={send}
              cartUrl={cartUrl}
              nextStepLabels={nextStepLabels}
            />
          </div>
        </div>
      )}
    </>
  );
}
