import { useState } from 'react';
import { X } from 'lucide-react';
import { useInstallPrompt } from '../../hooks/useInstallPrompt';

export function InstallBanner() {
  const { isInstallable, promptInstall } = useInstallPrompt();
  const [dismissed, setDismissed] = useState(false);

  if (!isInstallable || dismissed) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 animate-slide-up">
      <div className="bg-[#0f766e] text-white px-4 py-3 flex items-center justify-between shadow-lg">
        <span className="text-sm font-medium">Install Qlisted</span>
        <div className="flex items-center gap-2">
          <button
            onClick={promptInstall}
            className="bg-white text-[#0f766e] px-4 py-1.5 rounded text-sm font-semibold hover:bg-gray-100 transition-colors"
          >
            Install
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="p-1 hover:bg-white/20 rounded transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
