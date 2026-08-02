export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  id?: string;
}

export function Switch({ checked, onChange, label, description, disabled = false, id }: SwitchProps) {
  const switchId = id || `switch-${label?.toLowerCase().replace(/\s+/g, '-') || Math.random().toString(36).slice(2)}`;

  return (
    <label htmlFor={switchId} className={`flex items-start gap-3 ${disabled ? 'opacity-60' : 'cursor-pointer'}`}>
      <button
        type="button"
        id={switchId}
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-2 ${
          checked ? 'bg-brand-500' : 'bg-gray-300 dark:bg-gray-700'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
          aria-hidden
        />
      </button>
      {(label || description) && (
        <span className="select-none">
          {label && <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">{label}</span>}
          {description && <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">{description}</span>}
        </span>
      )}
    </label>
  );
}
