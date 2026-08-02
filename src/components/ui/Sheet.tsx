import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from './Button';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  side?: 'left' | 'right' | 'bottom';
}

export function Sheet({ open, onClose, title, children, side = 'right' }: SheetProps) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  const position =
    side === 'bottom'
      ? 'inset-x-0 bottom-0 max-h-[85vh] rounded-t-card animate-slide-up'
      : side === 'left'
        ? 'inset-y-0 start-0 w-80 max-w-[85vw] animate-fade-in'
        : 'inset-y-0 end-0 w-80 max-w-[85vw] animate-slide-in';

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50 animate-fade-in" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`absolute flex flex-col bg-white shadow-float dark:bg-gray-900 ${position}`}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-800">
          {title && <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h2>}
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close panel" className="ms-auto">
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
