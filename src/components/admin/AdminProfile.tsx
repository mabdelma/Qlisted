import { useState } from 'react';
import { User, Mail } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../contexts/I18nContext';
import { userApi } from '../../lib/api';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { ErrorMessage } from '../ui/ErrorMessage';
import { TwoFactorSettings } from './TwoFactorSettings';

export function AdminProfile() {
  const { t } = useI18n();
  const { state } = useAuth();
  const slug = state.tenant?.slug;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: state.user?.name || '',
    email: state.user?.email || '',
    password: '',
    confirmPassword: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!state.user || !slug) return;

    if (formData.password && formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await userApi.update(slug, state.user.id, {
        name: formData.name,
        email: formData.email,
      });
      setEditing(false);
    } catch (err) {
      setError((err as { message?: string }).message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  if (!state.user) return null;

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="relative h-32 bg-gradient-to-r from-[#0f766e] to-[#1e3a5f]">
          <div className="absolute -bottom-16 left-6">
            <div className="relative">
              <div className="w-32 h-32 rounded-full border-4 border-white bg-gray-200 overflow-hidden">
                {state.user.avatar ? (
                  <img src={state.user.avatar} alt={state.user.name} width="128" height="128" loading="lazy" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-full h-full p-4 text-gray-400" />
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="pt-20 px-6 pb-6">
          {error && <ErrorMessage message={error} />}

          {editing ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="admin-profile-name" className="block text-sm font-medium text-gray-700">{t('common.name')}</label>
                <div className="mt-1 relative">
                  <input id="admin-profile-name" type="text" value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#0f766e] focus:ring-[#0f766e]" />
                  <User className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
                </div>
              </div>

              <div>
                <label htmlFor="admin-profile-email" className="block text-sm font-medium text-gray-700">{t('common.email')}</label>
                <div className="mt-1 relative">
                  <input id="admin-profile-email" type="email" value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#0f766e] focus:ring-[#0f766e]" />
                  <Mail className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button type="button" onClick={() => setEditing(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">{t('common.cancel')}</button>
                <button type="submit" disabled={loading}
                  className="px-4 py-2 bg-[#0f766e] text-white rounded-md hover:bg-[#1e3a5f] disabled:opacity-50">
                  {loading ? <LoadingSpinner /> : t('profile.saveChanges')}
                </button>
              </div>
            </form>
          ) : (
            <div>
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{state.user.name}</h2>
                  <span className="inline-block mt-1 px-3 py-1 bg-[#ccfbf1] text-[#0f766e] rounded-full text-sm font-medium capitalize">
                    {state.user.role}
                  </span>
                </div>
                <button onClick={() => {
                  setFormData({ name: state.user?.name || '', email: state.user?.email || '', password: '', confirmPassword: '' });
                  setEditing(true);
                }}
                  className="px-4 py-2 bg-white border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">
                  {t('profile.editProfile')}
                </button>
              </div>

              <dl className="mt-6 space-y-4">
                <div className="flex items-center text-gray-500">
                  <Mail className="w-5 h-5 mr-2" />
                  <dt className="sr-only">Email</dt>
                  <dd>{state.user.email}</dd>
                </div>
                {state.tenant && (
                  <div className="flex items-center text-gray-500">
                    <dt className="text-sm">{t('profile.restaurant')}: {state.tenant.name}</dt>
                  </div>
                )}
              </dl>
            </div>
          )}
        </div>
      </div>
      <div className="mt-6 -mx-6"><TwoFactorSettings /></div>
    </div>
  );
}

