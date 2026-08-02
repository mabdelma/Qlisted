import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { Button } from './Button';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  hideClose?: boolean;
}

const SIZES = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-2xl', xl: 'max-w-4xl' };

export function Modal({ open, onClose, title, description, children, footer, size = 'md', hideClose = false }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement as HTMLElement;
    const panel = panelRef.current;
    if (panel) {
      const focusable = panel.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length > 0) focusable[0].focus();
    }
    return () => {
      previousFocus.current?.focus?.();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab') {
        const panel = panelRef.current;
        if (!panel) return;
        const focusable = Array.from(
          panel.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          )
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/50 animate-fade-in" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        className={`relative z-10 w-full ${SIZES[size]} max-h-[90vh] overflow-y-auto rounded-t-card sm:rounded-card bg-white shadow-float dark:bg-gray-900 animate-slide-up sm:animate-scale-in`}
      >
        {(title || !hideClose) && (
          <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-4 dark:border-gray-800">
            <div>
              {title && <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h2>}
              {description && <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{description}</p>}
            </div>
            {!hideClose && (
              <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close dialog" className="shrink-0">
                <X className="h-5 w-5" />
              </Button>
            )}
          </div>
        )}
        <div className="px-5 py-4">{children}</div>
        {footer && (
          <div className="flex justify-end gap-3 border-t border-gray-200 px-5 py-4 dark:border-gray-800">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
