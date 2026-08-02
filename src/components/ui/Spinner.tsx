interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  label?: string;
}

const SIZES = { sm: 'h-4 w-4 border-2', md: 'h-6 w-6 border-2', lg: 'h-8 w-8 border-2' };

export function Spinner({ size = 'md', className = '', label = 'Loading' }: SpinnerProps) {
  return (
    <div className={`flex items-center justify-center ${className}`} role="status" aria-label={label}>
      <div
        className={`${SIZES[size]} animate-spin rounded-full border-brand-200 border-t-brand-500 dark:border-brand-800 dark:border-t-brand-400`}
      />
    </div>
  );
}
