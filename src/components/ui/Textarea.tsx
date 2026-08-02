import React from 'react';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
  id?: string;
}

export function Textarea({ label, error, hint, id, className = '', ...props }: TextareaProps) {
  const inputId = id || props.name || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </label>
      )}
      <textarea
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 dark:bg-gray-900 dark:text-gray-100 dark:border-gray-700 ${
          error ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
        } ${className}`}
        {...props}
      />
      {error && (
        <p id={`${inputId}-error`} className="mt-1.5 text-xs text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
      {!error && hint && (
        <p id={`${inputId}-hint`} className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
          {hint}
        </p>
      )}
    </div>
  );
}
