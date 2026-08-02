import { useState, useRef, useEffect, type FormEvent } from 'react';
import { Send, Loader2, Sparkles } from 'lucide-react';
import type { AiBlock } from '../../lib/api';
import { AiBlocks } from './AiBlocks';

export interface ChatMessage { role: 'user' | 'assistant'; content: string }

export interface AiSendResult {
  reply: string;
  blocks?: AiBlock[];
  done?: boolean;
  nextStep?: string;
}

interface InternalMessage extends ChatMessage {
  blocks?: AiBlock[];
  nextStep?: string;
}

interface AiChatProps {
  send: (messages: ChatMessage[]) => Promise<AiSendResult>;
  placeholder?: string;
  greeting?: string;
  suggestions?: string[];
  cartUrl?: string;
  nextStepLabels?: Record<string, string>;
}

export function AiChat({ send, placeholder, greeting, suggestions = [], cartUrl, nextStepLabels }: AiChatProps) {
  const [messages, setMessages] = useState<InternalMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, busy]);

  async function ask(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    setError('');
    const next: InternalMessage[] = [...messages, { role: 'user', content: q }];
    setMessages(next);
    setInput('');
    setBusy(true);
    try {
      const res = await send(next.map(({ role, content }) => ({ role, content })));
      setMessages([...next, {
        role: 'assistant',
        content: res.reply,
        blocks: res.blocks,
        nextStep: res.done ? undefined : res.nextStep,
      }]);
    } catch (err) {
      setError((err as { message?: string }).message || 'The assistant is unavailable.');
      setMessages((prev) => {
        const copy = [...prev];
        if (copy.length > 0 && copy[copy.length - 1].role === 'user') copy.pop();
        return copy;
      });
    } finally {
      setBusy(false);
    }
  }

  const orderItem = (itemName: string) => { ask(`Add ${itemName}`); };

  const onSubmit = (e: FormEvent) => { e.preventDefault(); ask(input); };

  const last = messages[messages.length - 1];
  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 overflow-y-auto space-y-3 p-1" role="log" aria-label="Chat messages">
        <div className="sr-only" aria-live="polite">{lastAssistant?.content}</div>
        {messages.length === 0 && (
          <div className="text-sm text-gray-500 dark:text-gray-400 p-3">
            <div className="flex items-center gap-2 text-brand-600 dark:text-brand-400 font-medium mb-2"><Sparkles className="h-4 w-4" /> {greeting || 'Ask me anything.'}</div>
            {suggestions.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {suggestions.map((s) => (
                  <button key={s} onClick={() => ask(s)} className="text-xs px-3 py-1.5 rounded-full border border-brand-200 text-brand-700 hover:bg-brand-50 dark:border-brand-800 dark:text-brand-300 dark:hover:bg-brand-900/40">{s}</button>
                ))}
              </div>
            )}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className="space-y-1.5">
            <div className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap ${
                m.role === 'user' ? 'bg-brand-500 text-white dark:bg-brand-600' : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
              }`}>{m.content}</div>
            </div>
            {m.role === 'assistant' && m.blocks && m.blocks.length > 0 && (
              <div className="flex justify-start">
                <div className="max-w-[92%]">
                  <AiBlocks blocks={m.blocks} onOrderItem={orderItem} cartUrl={cartUrl} />
                </div>
              </div>
            )}
          </div>
        ))}
        {busy && (
          <div className="flex justify-start">
            <div className="rounded-2xl px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          </div>
        )}
        {(() => {
          const step = last?.nextStep;
          const stepLabel = step ? nextStepLabels?.[step] : undefined;
          if (last?.role !== 'assistant' || !stepLabel) return null;
          return (
            <div className="flex justify-start">
              <button
                onClick={() => ask(stepLabel)}
                className="text-xs px-3 py-1.5 rounded-full border border-brand-200 text-brand-700 hover:bg-brand-50 dark:border-brand-800 dark:text-brand-300 dark:hover:bg-brand-900/40"
              >
                {stepLabel}
              </button>
            </div>
          );
        })()}
        <div ref={endRef} />
      </div>

      {error && <div className="px-3 py-2 text-xs text-red-600">{error}</div>}

      <form onSubmit={onSubmit} className="flex items-center gap-2 border-t border-gray-100 dark:border-gray-700 p-2">
        <input
          value={input} onChange={(e) => setInput(e.target.value)} disabled={busy} autoFocus
          placeholder={placeholder || 'Type a message…'}
          className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-900 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500/50 disabled:opacity-50"
        />
        <button type="submit" disabled={busy || !input.trim()}
          className="flex items-center justify-center rounded-lg bg-brand-500 p-2.5 text-white hover:bg-brand-600 dark:bg-brand-600 dark:hover:bg-brand-500 disabled:opacity-50">
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
