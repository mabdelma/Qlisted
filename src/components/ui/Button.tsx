import React from 'react';
import { Loader2 } from 'lucide-react';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
type Size = 'sm' | 'md' | 'lg' | 'icon';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-brand-500 text-white hover:bg-brand-600 active:bg-brand-700 shadow-sm disabled:bg-brand-300 dark:bg-brand-600 dark:hover:bg-brand-500 dark:disabled:bg-brand-800',
  secondary:
    'bg-brand-50 text-brand-700 border border-brand-200 hover:bg-brand-100 dark:bg-brand-900/50 dark:text-brand-200 dark:border-brand-800 dark:hover:bg-brand-900',
  outline:
    'bg-transparent text-gray-700 border border-gray-300 hover:bg-gray-50 hover:border-gray-400 dark:text-gray-200 dark:border-gray-700 dark:hover:bg-gray-900',
  ghost:
    'bg-transparent text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-900',
  danger:
    'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 shadow-sm disabled:bg-red-300 dark:disabled:bg-red-900',
  success:
    'bg-green-600 text-white hover:bg-green-700 active:bg-green-800 shadow-sm disabled:bg-green-300 dark:disabled:bg-green-900',
};

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2',
  icon: 'h-10 w-10',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  className = '',
  disabled,
  children,
  ...props
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center rounded-lg font-medium transition-colors duration-150 focus-visible:outline-2 disabled:cursor-not-allowed disabled:opacity-70 select-none';
  const cls = [
    base,
    VARIANTS[variant],
    SIZES[size],
    fullWidth ? 'w-full' : '',
    className,
  ].join(' ');

  return (
    <button className={cls} disabled={disabled || loading} {...props}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : leftIcon}
      {children}
      {!loading && rightIcon}
    </button>
  );
}
