import { AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'default';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'default',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onCancel} size="sm" hideClose>
      <div className="flex gap-4">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
          tone === 'danger' ? 'bg-red-100 text-red-600 dark:bg-red-900/60 dark:text-red-300' : 'bg-brand-100 text-brand-600 dark:bg-brand-900 dark:text-brand-300'
        }`}>
          <AlertTriangle className="h-5 w-5" aria-hidden />
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
          {message && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{message}</p>}
        </div>
      </div>
      <div className="mt-6 flex justify-end gap-3">
        <Button variant="outline" onClick={onCancel} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
