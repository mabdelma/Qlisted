import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  padded?: boolean;
  hover?: boolean;
}

export function Card({ title, subtitle, actions, padded = true, hover = false, className = '', children, ...props }: CardProps) {
  return (
    <div
      className={`card ${padded ? 'p-4 sm:p-6' : ''} ${
        hover ? 'transition-shadow hover:shadow-card-hover' : ''
      } ${className}`}
      {...props}
    >
      {(title || actions) && (
        <div className={`flex items-start justify-between gap-3 ${padded ? '' : 'px-4 pt-4 sm:px-6'}`}>
          <div>
            {title && <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
