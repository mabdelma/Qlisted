import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../contexts/I18nContext';
import { timeApi } from '../../lib/api';
import { Clock, LogIn, LogOut, Users } from 'lucide-react';
import type { TimeEntry } from '../../lib/api/types';

export default function TimeTracking() {
  const { t } = useI18n();
  const { slug } = useAuth();
  const [active, setActive] = useState<TimeEntry[]>([]);
  const [timesheet, setTimesheet] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'active' | 'history'>('active');

  const load = async () => {
    if (!slug) return;
    setLoading(true);
    try {
      const [activeData, timesheetData] = await Promise.all([
        timeApi.active(slug).catch(() => []),
        timeApi.timesheet(slug).catch(() => []),
      ]);
      setActive(activeData);
      setTimesheet(timesheetData);
    } catch { /* keep the last good data */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, [slug]);

  if (!slug) return <div className="p-4 text-gray-500">{t('common.loading')}</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">{t('timeTracking.title')}</h2>
        <div className="flex space-x-2">
          <button onClick={() => timeApi.clockIn(slug)} className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm">
            <LogIn className="w-4 h-4 mr-1" /> {t('timeTracking.clockIn')}
          </button>
          <button onClick={() => timeApi.clockOut(slug)} className="flex items-center px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm">
            <LogOut className="w-4 h-4 mr-1" /> {t('timeTracking.clockOut')}
          </button>
        </div>
      </div>

      <div className="flex space-x-2">
        <button onClick={() => setTab('active')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'active' ? 'bg-[#0f766e] text-white' : 'bg-white text-gray-700 border'}`}>
          <Users className="w-4 h-4 inline mr-1" /> {t('timeTracking.active')}
        </button>
        <button onClick={() => setTab('history')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'history' ? 'bg-[#0f766e] text-white' : 'bg-white text-gray-700 border'}`}>
          <Clock className="w-4 h-4 inline mr-1" /> {t('timeTracking.timesheet')}
        </button>
      </div>

      {loading ? (
        <p className="text-gray-500">{t('common.loading')}</p>
      ) : tab === 'active' ? (
        <div className="space-y-2">
          {active.length === 0 ? (
            <p className="text-gray-500">{t('timeTracking.noActive')}</p>
          ) : active.map((e: TimeEntry) => (
            <div key={e.id} className="bg-white rounded-lg shadow p-4 flex justify-between items-center">
              <div>
                <p className="font-medium">{e.userName}</p>
                <p className="text-sm text-gray-500">{e.userRole} · since {new Date(e.clockIn).toLocaleTimeString()}</p>
              </div>
              <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">{t('giftCards.active')}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-3 font-medium text-gray-700">{t('timeTracking.staff')}</th>
                <th className="text-left p-3 font-medium text-gray-700">{t('timeTracking.clockIn')}</th>
                <th className="text-left p-3 font-medium text-gray-700">{t('timeTracking.clockOut')}</th>
                <th className="text-right p-3 font-medium text-gray-700">{t('timeTracking.hours')}</th>
              </tr>
            </thead>
            <tbody>
              {timesheet.length === 0 ? (
                <tr><td colSpan={4} className="p-3 text-center text-gray-500">{t('timeTracking.noActive')}</td></tr>
              ) : timesheet.map((e: TimeEntry) => (
                <tr key={e.id} className="border-t border-gray-100">
                  <td className="p-3">{e.userName}</td>
                  <td className="p-3">{new Date(e.clockIn).toLocaleString()}</td>
                  <td className="p-3">{e.clockOut ? new Date(e.clockOut).toLocaleString() : '—'}</td>
                  <td className="p-3 text-right">{e.totalHours?.toFixed(1) ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
