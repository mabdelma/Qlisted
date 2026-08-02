import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { CheckCircle2, Info, X, XCircle, AlertTriangle } from 'lucide-react';

type ToastTone = 'success' | 'error' | 'info' | 'warning';

interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
  description?: string;
}

interface ToastContextValue {
  toast: (message: string, opts?: { tone?: ToastTone; description?: string }) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS: Record<ToastTone, React.ReactNode> = {
  success: <CheckCircle2 className="h-5 w-5 text-green-500" aria-hidden />,
  error: <XCircle className="h-5 w-5 text-red-500" aria-hidden />,
  info: <Info className="h-5 w-5 text-blue-500" aria-hidden />,
  warning: <AlertTriangle className="h-5 w-5 text-amber-500" aria-hidden />,
};

const BAR: Record<ToastTone, string> = {
  success: 'bg-green-500',
  error: 'bg-red-500',
  info: 'bg-blue-500',
  warning: 'bg-amber-500',
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, opts?: { tone?: ToastTone; description?: string }) => {
      const id = ++idRef.current;
      const tone = opts?.tone ?? 'success';
      setToasts((prev) => [...prev.slice(-4), { id, tone, message, description: opts?.description }]);
      window.setTimeout(() => remove(id), 4500);
    },
    [remove]
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex flex-col items-center gap-2 px-4" aria-live="polite" role="status">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto relative w-full max-w-sm overflow-hidden rounded-lg bg-white shadow-popover ring-1 ring-black/5 dark:bg-gray-900 dark:ring-white/10 animate-scale-in"
          >
            <div className={`absolute inset-y-0 start-0 w-1 ${BAR[t.tone]}`} aria-hidden />
            <div className="flex items-start gap-3 py-3 ps-4 pe-3">
              {ICONS[t.tone]}
              <div className="flex-1 text-sm">
                <p className="font-medium text-gray-900 dark:text-gray-100">{t.message}</p>
                {t.description && <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{t.description}</p>}
              </div>
              <button
                onClick={() => remove(t.id)}
                className="shrink-0 rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
                aria-label="Dismiss notification"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
