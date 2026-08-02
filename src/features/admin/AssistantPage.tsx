import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../contexts/I18nContext';
import { aiApi } from '../../lib/api';
import { AiChat, type ChatMessage } from '../../components/ai/AiChat';

export function AssistantPage() {
  const { t } = useI18n();
  const { state: { tenant } } = useAuth();
  const slug = tenant?.slug;
  const [enabled, setEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    if (!slug) return;
    aiApi.status(slug).then((r) => setEnabled(r.enabled)).catch(() => setEnabled(false));
  }, [slug]);

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 8rem)' }}>
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-6 h-6 text-brand-500" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('nav.assistant')}</h1>
      </div>

      {enabled === false ? (
        <div className="bg-amber-50 border-l-4 border-amber-400 p-4 text-sm text-amber-800">
          {t('assistant.notConfigured')}
        </div>
      ) : (
        <div className="flex-1 min-h-0 rounded-card bg-white shadow-card dark:bg-gray-900">
          {slug && (
            <AiChat
              greeting={t('assistant.greeting')}
              placeholder={t('assistant.placeholder')}
              suggestions={[
                t('assistant.s1'),
                t('assistant.s2'),
                t('assistant.s3'),
                t('assistant.s4'),
              ]}
              send={(messages: ChatMessage[]) => aiApi.adminChat(slug, messages)}
            />
          )}
        </div>
      )}
    </div>
  );
}
