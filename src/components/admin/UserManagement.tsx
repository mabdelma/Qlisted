import { useState, useEffect, useCallback } from 'react';
import { PlusCircle, Edit, Trash2, Shield } from 'lucide-react';
import { userApi } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n, type TranslationKey } from '../../contexts/I18nContext';
import type { User } from '../../lib/api/types';

export function UserManagement() {
  const { t } = useI18n();
  const { state: { tenant } } = useAuth();
  const slug = tenant?.slug;
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<Partial<User> & { password?: string } | null>(null);

  const loadUsers = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    try {
      const data = await userApi.list(slug);
      setUsers(data);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    if (!slug) return;
    loadUsers();
  }, [slug, loadUsers]);

  async function saveUser(e: React.FormEvent) {
    e.preventDefault();
    if (!slug || !editingUser) return;
    try {
      if (editingUser.id) {
        await userApi.update(slug, editingUser.id, {
          name: editingUser.name,
          email: editingUser.email,
          role: editingUser.role as User['role'],
        });
      } else {
        await userApi.create(slug, {
          name: editingUser.name || '',
          email: editingUser.email || '',
          password: editingUser.password || 'pass123',
          role: editingUser.role || 'waiter',
        });
      }
      setEditingUser(null);
      await loadUsers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save user');
    }
  }

  async function deleteUser(id: string) {
    if (!slug) return;
    try {
      await userApi.delete(slug, id);
      setUsers((prev) => prev.filter((u) => u.id !== id));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete user');
    }
  }

  const roleLabel = (r: string) => t(`staff.${r}` as TranslationKey);

  if (!slug) return <div className="p-4 text-gray-500">{t('common.loading')}</div>;
  if (loading) return <div className="p-4 text-gray-500">{t('common.loading')}</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">{t('users.management')}</h2>
        <button
          onClick={() => setEditingUser({ name: '', email: '', role: 'waiter', password: '' })}
          className="flex items-center px-4 py-2 bg-[#0f766e] text-white rounded-md hover:bg-[#1e3a5f]"
        >
          <PlusCircle className="w-5 h-5 mr-2" />
          {t('users.addUser')}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">{error}</div>
      )}

      {editingUser && (
        <div className="fixed inset-0 bg-gray-600/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h3 className="text-xl font-semibold mb-4">
              {editingUser.id ? t('users.editUser') : t('users.newUser')}
            </h3>
            <form onSubmit={saveUser} className="space-y-4">
              <div>
                <label htmlFor="user-name" className="block text-sm font-medium text-gray-700">{t('common.name')}</label>
                <input
                  id="user-name"
                  type="text" required
                  value={editingUser.name || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#0f766e] focus:ring-[#0f766e]"
                />
              </div>
              <div>
                <label htmlFor="user-email" className="block text-sm font-medium text-gray-700">{t('common.email')}</label>
                <input
                  id="user-email"
                  type="email" required
                  value={editingUser.email || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#0f766e] focus:ring-[#0f766e]"
                />
              </div>
              {!editingUser.id && (
                <div>
                  <label htmlFor="user-password" className="block text-sm font-medium text-gray-700">{t('users.password')}</label>
                  <input
                    id="user-password"
                    type="password" required
                    value={editingUser.password || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, password: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#0f766e] focus:ring-[#0f766e]"
                  />
                </div>
              )}
              <div>
                <label htmlFor="user-role" className="block text-sm font-medium text-gray-700">{t('users.role')}</label>
                <select
                  id="user-role"
                  value={editingUser.role || 'waiter'}
                  onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#0f766e] focus:ring-[#0f766e]"
                >
                  <option value="waiter">{t('staff.waiter')}</option>
                  <option value="cashier">{t('staff.cashier')}</option>
                  <option value="kitchen">{t('staff.kitchen')}</option>
                  <option value="manager">{t('staff.manager')}</option>
                  <option value="admin">{t('staff.admin')}</option>
                </select>
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button type="button" onClick={() => setEditingUser(null)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">
                  {t('common.cancel')}
                </button>
                <button type="submit"
                  className="px-4 py-2 bg-[#0f766e] text-white rounded-md hover:bg-[#1e3a5f]">
                  {t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('common.name')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('common.email')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('users.role')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('common.status')}</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map((user) => (
              <article key={user.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500">
                  {user.id.slice(0, 8)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <Shield className="h-5 w-5 text-gray-400 mr-3" />
                    <span className="text-sm font-medium text-gray-900">{user.name}</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.email}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    user.role === 'admin' ? 'bg-purple-100 text-purple-800'
                    : user.role === 'manager' ? 'bg-indigo-100 text-indigo-800'
                    : user.role === 'kitchen' ? 'bg-green-100 text-green-800'
                    : user.role === 'cashier' ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-blue-100 text-blue-800'
                  }`}>
                    {roleLabel(user.role)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                    user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {user.isActive ? t('giftCards.active') : t('users.inactive')}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button onClick={() => setEditingUser(user)}
                    className="text-indigo-600 hover:text-indigo-900 mr-4">
                    <Edit className="h-5 w-5" />
                  </button>
                  <button onClick={() => deleteUser(user.id)}
                    className="text-red-600 hover:text-red-900">
                    <Trash2 className="h-5 w-5" />
                  </button>
                </td>
              </article>
            ))}
          </tbody>
        </table>
      </div>

      {users.length === 0 && (
        <p className="text-center text-gray-500 py-12">{t('users.noUsers')}</p>
      )}
    </div>
  );
}

