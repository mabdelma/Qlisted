import React, { useState } from 'react';
import { User, DollarSign, LogOut, Store, Settings, Clock } from 'lucide-react';
import { NotificationsBell } from '../ui/NotificationsBell';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router';
import { useI18n } from '../../contexts/I18nContext';

interface CashierHeaderProps {
  activeView: 'pos' | 'payments' | 'history';
  onViewChange: (view: 'pos' | 'payments' | 'history') => void;
  onProfileClick: () => void;
}

export function CashierHeader({ activeView, onViewChange, onProfileClick }: CashierHeaderProps) {
  const { t } = useI18n();
  const { state, logout } = useAuth();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/signin');
  };

  return (
    <div className="bg-[#1e3a5f] shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold text-white">{t('staff.cashierPanel')}</h1>
            <nav className="ml-6 flex space-x-2">
              <button
                onClick={() => onViewChange('pos')}
                className={`px-4 py-2 rounded-lg flex items-center ${
                  activeView === 'pos'
                    ? 'bg-[#0f766e] text-white'
                    : 'text-[#ccfbf1] hover:bg-[#115e59]'
                }`}
              >
                <Store className="w-5 h-5 mr-2" />
                {t('staff.pos')}
              </button>
              <button
                onClick={() => onViewChange('payments')}
                className={`px-4 py-2 rounded-lg flex items-center ${
                  activeView === 'payments'
                    ? 'bg-[#0f766e] text-white'
                    : 'text-[#ccfbf1] hover:bg-[#115e59]'
                }`}
              >
                <DollarSign className="w-5 h-5 mr-2" />
                {t('staff.payments')}
              </button>
              <button
                onClick={() => onViewChange('history')}
                className={`px-4 py-2 rounded-lg flex items-center ${
                  activeView === 'history'
                    ? 'bg-[#0f766e] text-white'
                    : 'text-[#ccfbf1] hover:bg-[#115e59]'
                }`}
              >
                <Clock className="w-5 h-5 mr-2" />
                {t('staff.history')}
              </button>
            </nav>
          </div>
          
          <div className="flex items-center space-x-4">
            <NotificationsBell />
            <div className="relative">
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="flex items-center space-x-3 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ccfbf1] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1e3a5f]"
              >
                <span className="text-[#ccfbf1]">{state.user?.name}</span>
                <div className="w-10 h-10 rounded-full bg-[#0f766e] flex items-center justify-center overflow-hidden">
                  {state.user?.profileImage ? (
                    <img
                      src={state.user.profileImage}
                      alt={state.user.name}
                      width="40"
                      height="40"
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-6 h-6 text-[#ccfbf1]" />
                  )}
                </div>
              </button>
              {showProfileMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-10">
                  <button
                    onClick={() => {
                      onProfileClick();
                      setShowProfileMenu(false);
                    }}
                    className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    {t('staff.profileSettings')}
                  </button>
                  <button
                    onClick={handleLogout}
                    className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    {t('staff.signOut')}
                  </button>
                </div>
              )}

              {showProfileMenu && (
                <div
                  className="fixed inset-0 z-0"
                  onClick={() => setShowProfileMenu(false)}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}