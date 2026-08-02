import React from 'react';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  id?: string;
  options?: { value: string; label: string }[];
  placeholder?: string;
}

export function Select({
  label,
  error,
  hint,
  id,
  options = [],
  placeholder,
  className = '',
  children,
  ...props
}: SelectProps) {
  const selectId = id || props.name || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
  const describedBy = error ? `${selectId}-error` : hint ? `${selectId}-hint` : undefined;

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={selectId} className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </label>
      )}
      <select
        id={selectId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`h-10 w-full appearance-none rounded-lg border bg-white px-3.5 pr-9 text-sm text-gray-900 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 dark:bg-gray-900 dark:text-gray-100 dark:border-gray-700 ${
          error ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
        } ${className}`}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
        {children}
      </select>
    </div>
  );
}
