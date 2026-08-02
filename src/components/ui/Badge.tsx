import React from 'react';

type BadgeVariant = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  dot?: boolean;
}

const VARIANTS: Record<BadgeVariant, string> = {
  neutral:
    'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  brand:
    'bg-brand-100 text-brand-800 dark:bg-brand-900 dark:text-brand-200',
  success:
    'bg-green-100 text-green-800 dark:bg-green-900/60 dark:text-green-200',
  warning:
    'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200',
  danger:
    'bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-200',
  info:
    'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200',
};

const DOTS: Record<BadgeVariant, string> = {
  neutral: 'bg-gray-400',
  brand: 'bg-brand-500',
  success: 'bg-green-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
  info: 'bg-blue-500',
};

export function Badge({ variant = 'neutral', dot = false, className = '', children, ...props }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${VARIANTS[variant]} ${className}`}
      {...props}
    >
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${DOTS[variant]}`} aria-hidden />}
      {children}
    </span>
  );
}
