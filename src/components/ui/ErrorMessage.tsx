import { AlertTriangle } from 'lucide-react';

interface ErrorMessageProps {
  message: string;
}

export function ErrorMessage({ message }: ErrorMessageProps) {
  return (
    <div
      className="my-4 flex items-start gap-3 rounded-card border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/40"
      role="alert"
    >
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" aria-hidden />
      <p className="text-sm text-red-700 dark:text-red-300">{message}</p>
    </div>
  );
}
