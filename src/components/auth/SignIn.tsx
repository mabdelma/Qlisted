import { useState, type FormEvent, type ComponentType } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  UtensilsCrossed, Mail, Lock, Eye, EyeOff, ArrowRight, ArrowLeft,
  ShieldCheck, Store, Activity, Users, CreditCard, ClipboardList, ChefHat,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../contexts/I18nContext';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { Logo } from '../ui/Logo';
import { homePathForRole } from '../../lib/roleRoutes';
import { GoogleSignInButton } from './GoogleSignInButton';

type Audience = 'platform' | 'admin' | 'staff' | 'default';
type Point = { icon: ComponentType<{ className?: string }>; title: string; desc: string };

// Which login experience to show, derived from the subdomain the user arrived on.
// central → platform console · app/ai → restaurant dashboard · login → staff.
function detectAudience(): Audience {
  const sub = typeof window !== 'undefined' ? window.location.hostname.split('.')[0] : '';
  if (sub === 'central') return 'platform';
  if (sub === 'app' || sub === 'ai') return 'admin';
  if (sub === 'login') return 'staff';
  return 'default';
}

const AUDIENCES: Record<Audience, {
  badge: string; brandTitle: string; brandSubtitle: string;
  formTitle: string; formSubtitle: string; gradient: string; button: string;
  Icon: ComponentType<{ className?: string }>; placeholder: string; points: Point[];
  altPortals: { label: string; href: string }[];
}> = {
  platform: {
    badge: 'Platform Console',
    brandTitle: 'The control plane for every Qlisted restaurant.',
    brandSubtitle: 'Secure access for platform super admins.',
    formTitle: 'Platform sign-in',
    formSubtitle: 'Restricted to Qlisted platform super admins.',
    gradient: 'from-[#1e293b] to-[#0b1120]',
    button: 'bg-[#1e293b] hover:bg-[#0f172a] focus:ring-[#1e293b]',
    Icon: ShieldCheck,
    placeholder: 'you@qlisted.com',
    points: [
      { icon: Store, title: 'Every restaurant', desc: 'Create, suspend, and oversee all tenants.' },
      { icon: Users, title: 'All users', desc: 'See every account across the platform.' },
      { icon: CreditCard, title: 'Billing & leads', desc: 'Track revenue, subscriptions, and demo requests.' },
    ],
    altPortals: [{ label: 'Restaurant dashboard →', href: 'https://app.qlisted.com' }],
  },
  admin: {
    badge: 'Restaurant Dashboard',
    brandTitle: 'Run your restaurant from one dashboard.',
    brandSubtitle: 'For owners and managers.',
    formTitle: 'Restaurant sign-in',
    formSubtitle: 'For restaurant owners and managers.',
    gradient: 'from-[#0f766e] to-[#1e3a5f]',
    button: 'bg-[#0f766e] hover:bg-[#1e3a5f] focus:ring-[#0f766e]',
    Icon: Store,
    placeholder: 'you@restaurant.com',
    points: [
      { icon: ChefHat, title: 'Menus & orders', desc: 'Manage your menu, modifiers, and live orders.' },
      { icon: Users, title: 'Team', desc: 'Add staff and control what each role can do.' },
      { icon: CreditCard, title: 'Payments', desc: 'Subscriptions, payouts, and reporting.' },
    ],
    altPortals: [{ label: 'Platform console →', href: 'https://central.qlisted.com' }],
  },
  staff: {
    badge: 'Team',
    brandTitle: 'Your shift, in sync.',
    brandSubtitle: 'For kitchen, waiters, and cashiers.',
    formTitle: 'Staff sign-in',
    formSubtitle: 'For kitchen, waiters, and cashiers.',
    gradient: 'from-[#0f766e] to-[#134e4a]',
    button: 'bg-[#0f766e] hover:bg-[#115e59] focus:ring-[#0f766e]',
    Icon: Activity,
    placeholder: 'you@restaurant.com',
    points: [
      { icon: ClipboardList, title: 'Live orders', desc: 'See tickets the moment they come in.' },
      { icon: Activity, title: 'Real-time', desc: 'Kitchen, floor, and cashier stay in sync.' },
      { icon: ChefHat, title: 'Your station', desc: 'A view built for your role.' },
    ],
    altPortals: [
      { label: 'Restaurant dashboard →', href: 'https://app.qlisted.com' },
      { label: 'Platform console →', href: 'https://central.qlisted.com' },
    ],
  },
  default: {
    badge: 'Console',
    brandTitle: 'The console behind every Qlisted restaurant.',
    brandSubtitle: 'One secure sign-in for super admins, restaurant admins, and staff.',
    formTitle: 'Sign in',
    formSubtitle: 'Super admins, restaurant admins, and staff all sign in here.',
    gradient: 'from-[#0f766e] to-[#1e3a5f]',
    button: 'bg-[#0f766e] hover:bg-[#1e3a5f] focus:ring-[#0f766e]',
    Icon: UtensilsCrossed,
    placeholder: 'you@restaurant.com',
    points: [
      { icon: ShieldCheck, title: 'Platform oversight', desc: 'Super admins manage every restaurant from one place.' },
      { icon: Store, title: 'Restaurant management', desc: 'Owners and managers run menus, tables, staff, and settings.' },
      { icon: Activity, title: 'Live operations', desc: 'Kitchen, waiters, and cashiers stay in sync in real time.' },
    ],
    altPortals: [
      { label: 'Platform console →', href: 'https://central.qlisted.com' },
      { label: 'Restaurant dashboard →', href: 'https://app.qlisted.com' },
    ],
  },
};

export function SignIn() {
  const navigate = useNavigate();
  const { login, state } = useAuth();
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [needsTotp, setNeedsTotp] = useState(false);
  const [totp, setTotp] = useState('');
  const a = AUDIENCES[detectAudience()];

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const result = await login(email, password, needsTotp ? totp : undefined);
    if (result === 'TWO_FACTOR') {
      setNeedsTotp(true); // password OK — now ask for the authenticator code.
      return;
    }
    if (result) {
      // One auth flow for every role — route to the right home regardless of which
      // login page (subdomain) they used.
      navigate(homePathForRole(result.role), { replace: true });
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* ── Brand panel (audience-specific) ──────────────────────────────── */}
      <div className={`relative hidden lg:flex lg:w-1/2 flex-col justify-between overflow-hidden bg-gradient-to-br ${a.gradient} p-12 text-white`}>
        <div className="pointer-events-none absolute -top-24 -right-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-white/5 blur-3xl" />

        <Link to="/" className="relative flex items-center gap-2">
          <Logo tone="light" size={30} />
          <span className="ml-2 rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-medium">{a.badge}</span>
        </Link>

        <div className="relative max-w-md">
          <h1 className="text-4xl font-bold leading-tight">{a.brandTitle}</h1>
          <p className="mt-4 text-white/80">{a.brandSubtitle}</p>
          <ul className="mt-10 space-y-5">
            {a.points.map((p) => (
              <li key={p.title} className="flex gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10">
                  <p.icon className="h-5 w-5" />
                </span>
                <div>
                  <div className="font-semibold">{p.title}</div>
                  <div className="text-sm text-white/70">{p.desc}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-sm text-white/60">&copy; {new Date().getFullYear()} Qlisted. All rights reserved.</p>
      </div>

      {/* ── Form panel ───────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col justify-center bg-gray-50 px-6 py-12 sm:px-12 lg:px-20">
        <div className="mx-auto w-full max-w-md">
          {/* Mobile logo */}
          <Link to="/" className="mb-8 flex items-center justify-center gap-2 lg:hidden">
            <Logo size={28} />
            <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600">{a.badge}</span>
          </Link>

          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-900">{a.formTitle}</h2>
            <p className="mt-2 text-sm text-gray-500">{a.formSubtitle}</p>
          </div>

          {state.error && (
            <div className="mb-6 rounded-lg border-l-4 border-red-400 bg-red-50 p-4" role="alert">
              <p className="text-sm text-red-700">{state.error}</p>
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">{t('auth.email')}</label>
              <div className="relative mt-1.5">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" aria-hidden />
                <input
                  id="email" name="email" type="email" autoComplete="email" required
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder={a.placeholder}
                  className="block w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-3 text-gray-900 placeholder-gray-400 shadow-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-400"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">{t('auth.password')}</label>
                <Link to="/forgot-password" className="text-xs font-medium text-gray-500 hover:text-gray-700">{t('auth.troubleSigningIn')}</Link>
              </div>
              <div className="relative mt-1.5">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" aria-hidden />
                <input
                  id="password" name="password" type={showPw ? 'text' : 'password'} autoComplete="current-password" required
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-10 text-gray-900 placeholder-gray-400 shadow-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-400"
                />
                <button
                  type="button" onClick={() => setShowPw((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-gray-400 hover:text-gray-600"
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                >
                  {showPw ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {needsTotp && (
              <div>
                <label htmlFor="totp" className="block text-sm font-medium text-gray-700">Authentication code</label>
                <div className="relative mt-1.5">
                  <ShieldCheck className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" aria-hidden />
                  <input
                    id="totp" name="totp" inputMode="numeric" autoComplete="one-time-code" required autoFocus
                    maxLength={6} value={totp}
                    onChange={(e) => setTotp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="123456"
                    className="block w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-3 tracking-[0.4em] text-gray-900 placeholder-gray-400 shadow-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-400"
                  />
                </div>
                <p className="mt-1.5 text-xs text-gray-500">Enter the 6-digit code from your authenticator app.</p>
              </div>
            )}

            <button
              type="submit" disabled={state.loading}
              className={`flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 ${a.button}`}
            >
              {state.loading ? <LoadingSpinner /> : <>{needsTotp ? 'Verify' : t('auth.signin')} <ArrowRight className="h-4 w-4" /></>}
            </button>
          </form>

          <GoogleSignInButton />

          {a.altPortals.length > 0 && (
            <div className="mt-6 border-t border-gray-200 pt-4 text-center text-sm text-gray-500">
              Not the right place?{' '}
              {a.altPortals.map((p, i) => (
                <span key={p.href}>
                  {i > 0 && <span className="mx-1 text-gray-300">·</span>}
                  <a href={p.href} className="font-medium text-gray-600 hover:text-gray-900">{p.label}</a>
                </span>
              ))}
            </div>
          )}

          <div className="mt-8 flex items-center justify-between text-sm">
            <Link to="/" className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-700">
              <ArrowLeft className="h-4 w-4" /> {t('common.back')}
            </Link>
            <Link to="/demo" className="font-medium text-gray-600 hover:text-gray-900">{t('cta.requestDemo')}</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
