import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Building2, Check } from 'lucide-react';
import { tenantApi } from '../../lib/api';

type Step = 'tenant' | 'admin' | 'done';

export function OnboardingWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('tenant');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [tenantInfo, setTenantInfo] = useState<{ name: string; slug: string; email: string; phone: string; venueType: 'restaurant' | 'hotel' | 'both' }>({ name: '', slug: '', email: '', phone: '', venueType: 'restaurant' });
  const [adminInfo, setAdminInfo] = useState({ name: '', password: '' });
  const [agreed, setAgreed] = useState(false);
  const [result, setResult] = useState<{ tenantSlug: string; adminEmail: string } | null>(null);

  async function handleSubmit() {
    setLoading(true);
    setError('');
    try {
      const res = await tenantApi.create({
        name: tenantInfo.name,
        slug: tenantInfo.slug,
        email: tenantInfo.email,
        phone: tenantInfo.phone,
        venueType: tenantInfo.venueType,
        adminName: adminInfo.name,
        adminPassword: adminInfo.password,
      });
      setResult({ tenantSlug: res.tenant.slug, adminEmail: tenantInfo.email });
      setStep('done');
    } catch {
      setError('Failed to create tenant. The slug may already be taken.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-lg">
        <div className="flex items-center justify-center mb-6">
          <Building2 className="h-10 w-10 text-[#0f766e]" />
          <h1 className="text-2xl font-bold text-[#1e3a5f] ml-3">Qlisted Setup</h1>
        </div>

        {error && <div className="bg-red-50 text-red-600 p-3 rounded-md mb-4">{error}</div>}

        {step === 'tenant' && (
          <div className="space-y-4">
            <h2 className="text-lg font-medium text-gray-900">Business Details</h2>
            <div>
              <label htmlFor="restaurant-name" className="block text-sm font-medium text-gray-700 mb-1">Business Name</label>
              <input id="restaurant-name" type="text" value={tenantInfo.name}
                onChange={(e) => setTenantInfo({ ...tenantInfo, name: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-[#0f766e] focus:border-[#0f766e]"
                placeholder="My Restaurant" />
            </div>
            <div>
              <label htmlFor="slug" className="block text-sm font-medium text-gray-700 mb-1">Slug (URL identifier)</label>
              <input id="slug" type="text" value={tenantInfo.slug}
                onChange={(e) => setTenantInfo({ ...tenantInfo, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-[#0f766e] focus:border-[#0f766e]"
                placeholder="my-restaurant" />
              <p className="text-xs text-gray-500 mt-1">Your URL will be: /r/{tenantInfo.slug || 'my-restaurant'}</p>
            </div>
            <div>
              <label htmlFor="admin-email" className="block text-sm font-medium text-gray-700 mb-1">Admin Email</label>
              <input id="admin-email" type="email" value={tenantInfo.email}
                onChange={(e) => setTenantInfo({ ...tenantInfo, email: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-[#0f766e] focus:border-[#0f766e]"
                placeholder="admin@example.com" />
            </div>
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">Phone (optional)</label>
              <input id="phone" type="tel" value={tenantInfo.phone}
                onChange={(e) => setTenantInfo({ ...tenantInfo, phone: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-[#0f766e] focus:border-[#0f766e]"
                placeholder="+1 234 567 8900" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">What do you run?</label>
              <div className="grid grid-cols-3 gap-2">
                {([['restaurant', '🍽️', 'Restaurant'], ['hotel', '🏨', 'Hotel'], ['both', '✨', 'Both']] as const).map(([v, icon, label]) => (
                  <button key={v} type="button" onClick={() => setTenantInfo({ ...tenantInfo, venueType: v })}
                    className={`flex flex-col items-center gap-1 rounded-lg border p-3 text-sm transition-colors ${tenantInfo.venueType === v ? 'border-[#0f766e] bg-[#0f766e]/5 text-[#0f766e] font-medium' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
                    <span className="text-xl">{icon}</span>{label}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={() => setStep('admin')} disabled={!tenantInfo.name || !tenantInfo.slug || !tenantInfo.email}
              className="w-full bg-[#0f766e] text-white py-2 rounded-md hover:bg-[#1e3a5f] disabled:opacity-50">
              Next: Admin Account
            </button>
          </div>
        )}

        {step === 'admin' && (
          <div className="space-y-4">
            <h2 className="text-lg font-medium text-gray-900">Admin Account</h2>
            <div>
              <label htmlFor="admin-name" className="block text-sm font-medium text-gray-700 mb-1">Admin Name</label>
              <input id="admin-name" type="text" value={adminInfo.name}
                onChange={(e) => setAdminInfo({ ...adminInfo, name: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-[#0f766e] focus:border-[#0f766e]"
                placeholder="John Doe" />
            </div>
            <div>
              <label htmlFor="admin-password" className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input id="admin-password" type="password" value={adminInfo.password}
                onChange={(e) => setAdminInfo({ ...adminInfo, password: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-[#0f766e] focus:border-[#0f766e]"
                placeholder="Min 6 characters" />
            </div>
            <label className="flex items-start gap-2 text-sm text-gray-600">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[#0f766e] focus:ring-[#0f766e]" />
              <span>
                I agree to the{' '}
                <a href="/terms" target="_blank" rel="noopener noreferrer" className="font-medium text-[#0f766e] hover:underline">Terms of Service</a>{' '}
                and{' '}
                <a href="/privacy" target="_blank" rel="noopener noreferrer" className="font-medium text-[#0f766e] hover:underline">Privacy Policy</a>.
              </span>
            </label>
            <div className="flex space-x-3">
              <button onClick={() => setStep('tenant')}
                className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-md hover:bg-gray-300">Back</button>
              <button onClick={handleSubmit} disabled={!adminInfo.name || !adminInfo.password || !agreed || loading}
                className="flex-1 bg-[#0f766e] text-white py-2 rounded-md hover:bg-[#1e3a5f] disabled:opacity-50">
                {loading ? 'Creating...' : 'Complete Setup'}
              </button>
            </div>
          </div>
        )}

        {step === 'done' && result && (
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <Check className="w-8 h-8 text-green-600" />
              </div>
            </div>
            <h2 className="text-lg font-medium text-gray-900">Setup Complete!</h2>
            <p className="text-gray-600">Your restaurant <strong>{tenantInfo.name}</strong> is ready.</p>
            <div className="bg-gray-50 rounded-md p-4 text-left text-sm">
              <p><strong>Admin URL:</strong> /signin</p>
              <p><strong>Email:</strong> {result.adminEmail}</p>
              <p><strong>Customer Menu:</strong> /r/{result.tenantSlug}</p>
            </div>
            <button onClick={() => navigate('/signin')}
              className="w-full bg-[#0f766e] text-white py-2 rounded-md hover:bg-[#1e3a5f]">
              Go to Admin Login
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
