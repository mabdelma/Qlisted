import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../contexts/I18nContext';
import { AuthLayout } from './AuthLayout';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { ChefHat, UserCircle, DollarSign, Shield } from 'lucide-react';

export function StaffSignIn() {
  const navigate = useNavigate();
  const { login, state } = useAuth();
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const user = await login(email, password);
      if (user) {
        if (user.role === 'admin') navigate('/admin');
        else if (['kitchen', 'waiter', 'cashier'].includes(user.role)) {
          navigate('/staff');
        } else {
          throw new Error(t('error.unauthorized'));
        }
      }
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  return (
    <AuthLayout title={t('auth.signin')}>
      <div className="flex justify-center space-x-8 mb-8">
        <div className="text-center">
          <div className="p-3 bg-purple-100 rounded-full inline-flex mb-2">
            <Shield className="w-6 h-6 text-purple-600" />
          </div>
          <p className="text-sm font-medium text-gray-600">{t('staff.admin')}</p>
        </div>
        <div className="text-center">
          <div className="p-3 bg-blue-100 rounded-full inline-flex mb-2">
            <ChefHat className="w-6 h-6 text-blue-600" />
          </div>
          <p className="text-sm font-medium text-gray-600">{t('staff.kitchen')}</p>
        </div>
        <div className="text-center">
          <div className="p-3 bg-yellow-100 rounded-full inline-flex mb-2">
            <DollarSign className="w-6 h-6 text-yellow-600" />
          </div>
          <p className="text-sm font-medium text-gray-600">{t('staff.cashier')}</p>
        </div>
        <div className="text-center">
          <div className="p-3 bg-green-100 rounded-full inline-flex mb-2">
            <UserCircle className="w-6 h-6 text-green-600" />
          </div>
          <p className="text-sm font-medium text-gray-600">{t('staff.waiter')}</p>
        </div>
      </div>

      <form className="space-y-6" onSubmit={handleSubmit}>
        {state.error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4">
            <p className="text-sm text-red-700">{state.error}</p>
          </div>
        )}

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            {t('auth.email')}
          </label>
          <div className="mt-1">
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">
            {t('auth.password')}
          </label>
          <div className="mt-1">
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        </div>

        <div>
          <button
            type="submit"
            disabled={state.loading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[#0f766e] hover:bg-[#1e3a5f] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0f766e] disabled:opacity-50"
          >
            {state.loading ? <LoadingSpinner /> : t('auth.signin')}
          </button>
        </div>

        <div className="text-sm text-center">
          <button
            type="button"
            onClick={() => navigate('/staff/signup')}
            className="font-medium text-[#0f766e] hover:text-[#1e3a5f]"
          >
            {t('auth.noAccount')} {t('cta.signUp')}
          </button>
        </div>
      </form>
    </AuthLayout>
  );
}