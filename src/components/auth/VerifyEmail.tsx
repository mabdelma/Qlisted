import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router';
import { useI18n } from '../../contexts/I18nContext';
import { api } from '../../lib/api/client';

export function VerifyEmail() {
  const { t } = useI18n();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setStatus('error');
      setMessage(t('auth.invalidToken'));
      return;
    }
    api.post<{ message?: string }>('/auth/verify-email', { token })
      .then((res) => {
        setStatus('success');
        setMessage(res.message || t('auth.verificationSent'));
      })
      .catch((err: { error?: string; message?: string }) => {
        setStatus('error');
        setMessage(err?.error || err?.message || t('auth.tokenExpired'));
      });
  }, [searchParams, t]);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <div style={{ textAlign: 'center', maxWidth: 400, padding: 32 }}>
        {status === 'loading' && <p>{t('common.loading')}</p>}
        {status === 'success' && (
          <>
            <h2 style={{ color: 'var(--color-success, #16a34a)' }}>{t('auth.verificationSent')}</h2>
            <p>{message}</p>
            <Link to="/signin" style={{ display: 'inline-block', marginTop: 16, color: 'var(--color-primary)' }}>
              {t('auth.signin')}
            </Link>
          </>
        )}
        {status === 'error' && (
          <>
            <h2 style={{ color: 'var(--color-error, #dc2626)' }}>{t('auth.tokenExpired')}</h2>
            <p>{message}</p>
            <Link to="/signin" style={{ display: 'inline-block', marginTop: 16, color: 'var(--color-primary)' }}>
              {t('auth.backToSignIn')}
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
