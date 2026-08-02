import { Check } from 'lucide-react';

export interface Step {
  id: string;
  label: string;
}

export interface StepperProps {
  steps: Step[];
  current: number; // zero-based index of active step
  className?: string;
}

export function Stepper({ steps, current, className = '' }: StepperProps) {
  const activeIndex = Math.min(Math.max(current, 0), steps.length - 1);

  return (
    <ol className={`flex items-center gap-0 ${className}`} aria-label="Progress">
      {steps.map((step, i) => {
        const done = i < activeIndex;
        const isActive = i === activeIndex;
        return (
          <li key={step.id} className={`flex items-center ${i < steps.length - 1 ? 'flex-1' : ''}`}>
            <div className="flex flex-col items-center">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                  done
                    ? 'bg-brand-500 text-white'
                    : isActive
                      ? 'bg-brand-100 text-brand-700 ring-2 ring-brand-500 dark:bg-brand-900 dark:text-brand-200'
                      : 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500'
                }`}
                aria-current={isActive ? 'step' : undefined}
              >
                {done ? <Check className="h-4 w-4" aria-hidden /> : i + 1}
              </div>
              <span
                className={`mt-1.5 hidden text-xs font-medium sm:block ${
                  isActive ? 'text-brand-700 dark:text-brand-200' : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`mx-2 mb-5 h-0.5 flex-1 rounded-full sm:mb-0 ${
                  i < activeIndex ? 'bg-brand-500' : 'bg-gray-200 dark:bg-gray-800'
                }`}
                aria-hidden
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
