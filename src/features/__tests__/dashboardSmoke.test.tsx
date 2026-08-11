// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import type { ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router';

import { ThemeProvider } from '../../contexts/ThemeContext';
import { I18nProvider } from '../../contexts/I18nContext';
import { ToastProvider } from '../../components/ui/Toast';
import { AuthProvider } from '../../contexts/AuthContext';
import { AdminPortal } from '../../components/admin/AdminPortal';
import { StaffPortal } from '../../components/staff/StaffPortal';
import { SuperAdminPortal } from '../admin/SuperAdminPortal';
import { TableFlowLayout } from '../restaurant/TableFlowLayout';

type Role = 'admin' | 'manager' | 'waiter' | 'kitchen' | 'cashier' | 'super_admin';

const TENANT = {
  id: 't1',
  name: 'Test Cafe',
  slug: 'test-cafe',
  email: 'tenant@test.com',
  currency: 'USD',
  timezone: 'UTC',
  taxRate: 0,
  serviceCharge: 0,
  isActive: true,
  primaryColor: '#2563eb',
  accentColor: '#7c3aed',
};

const USERS: Record<Role, Record<string, unknown>> = {
  admin: { id: 'u-admin', tenantId: 't1', name: 'Admin', email: 'admin@test.com', role: 'admin', isActive: true, joinedAt: '2025-01-01', lastActive: '2025-01-01' },
  manager: { id: 'u-manager', tenantId: 't1', name: 'Manager', email: 'manager@test.com', role: 'manager', isActive: true, joinedAt: '2025-01-01', lastActive: '2025-01-01' },
  waiter: { id: 'u-waiter', tenantId: 't1', name: 'Waiter', email: 'waiter@test.com', role: 'waiter', isActive: true, joinedAt: '2025-01-01', lastActive: '2025-01-01' },
  kitchen: { id: 'u-kitchen', tenantId: 't1', name: 'Kitchen', email: 'kitchen@test.com', role: 'kitchen', isActive: true, joinedAt: '2025-01-01', lastActive: '2025-01-01' },
  cashier: { id: 'u-cashier', tenantId: 't1', name: 'Cashier', email: 'cashier@test.com', role: 'cashier', isActive: true, joinedAt: '2025-01-01', lastActive: '2025-01-01' },
  super_admin: { id: 'u-super', tenantId: null, name: 'Super', email: 'super@test.com', role: 'super_admin', isActive: true, joinedAt: '2025-01-01', lastActive: '2025-01-01' },
};

class MockEventSource {
  url: string;
  onerror: (() => void) | null = null;
  constructor(url: string) {
    this.url = url;
  }
  addEventListener() {}
  removeEventListener() {}
  close() {
    this.onerror = null;
  }
}

function mockFetch(role: Role): typeof fetch {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    let body: unknown = [];

    if (url.includes('/auth/me')) {
      body = { user: USERS[role], tenant: role === 'super_admin' ? null : TENANT };
    } else if (url.includes('/auth/refresh')) {
      return { ok: false, status: 401, json: async () => ({}), text: async () => '' } as unknown as Response;
    } else if (url.includes('/admin/analytics')) {
      body = {
        activeTenants: 0,
        totalTenants: 0,
        totalRevenue: 0,
        totalOrders: 0,
        totalUsers: 0,
        totalCustomers: 0,
        newTenantsThisMonth: 0,
        mrr: 0,
        churnRate: 0,
      };
    } else if (url.includes('/admin/tenants')) {
      body = [];
    } else if (url.includes('/admin/users')) {
      body = [];
    } else if (url.includes('/admin/leads')) {
      body = [];
    } else if (url.includes('/admin/audit-logs')) {
      body = [];
    } else if (url.includes('/tenants/')) {
      body = TENANT;
    } else if (url.includes('/r/')) {
      if (url.includes('/menu') && !url.includes('/modifier')) {
        body = { categories: [], items: [] };
      } else if (url.includes('/modifier-groups')) {
        body = { data: [] };
      } else if (
        url.includes('/hourly-traffic') ||
        url.includes('/peak-hours') ||
        url.includes('/category-performance') ||
        url.includes('/trending') ||
        url.includes('/recommendations') ||
        url.includes('/campaigns')
      ) {
        body = { data: [] };
      } else if (url.includes('/loyalty')) {
        body = { points: 0, tier: 'bronze', lifetimePoints: 0, history: [], rewards: [] };
      } else if (url.includes('/analytics/revenue')) {
        body = { daily: [] };
      } else if (url.includes('/analytics/')) {
        body = {};
      } else if (url.includes('/table/')) {
        body = { id: 'table-1', number: 1, capacity: 4, status: 'available', qrCode: 'qr-1' };
      }
    }

    return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) } as unknown as Response;
  });
}

function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <I18nProvider>
        <ToastProvider>
          <AuthProvider>{children}</AuthProvider>
        </ToastProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}

const mountedRoots: Root[] = [];

async function mount(ui: ReactNode) {
  const errors: unknown[] = [];
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container, { onUncaughtError: (e) => errors.push(e) });
  mountedRoots.push(root);
  try {
    await act(async () => {
      root.render(ui);
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
  } catch (e) {
    errors.push(e);
  }
  return { container, root, errors };
}

function unmountAll() {
  while (mountedRoots.length > 0) {
    const root = mountedRoots.pop();
    root!.unmount();
  }
}

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.EventSource = MockEventSource as unknown as typeof EventSource;
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  globalThis.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
    root = null;
    rootMargin = '';
    thresholds = [];
  } as unknown as typeof IntersectionObserver;
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
  Object.defineProperty(window, 'scrollTo', { writable: true, value: vi.fn() });
  localStorage.setItem('token', 'test-token');
});

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch('admin'));
});

afterEach(() => {
  unmountAll();
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

const ADMIN_TABS: [string, string][] = [
  ['analytics', '/admin/analytics'],
  ['analytics/sales', '/admin/analytics/sales'],
  ['analytics/insights', '/admin/analytics/insights'],
  ['analytics/exports', '/admin/analytics/exports'],
  ['orders', '/admin/orders'],
  ['payment-links', '/admin/payment-links'],
  ['reports', '/admin/reports'],
  ['assistant', '/admin/assistant'],
  ['staff', '/admin/staff'],
  ['menu', '/admin/menu'],
  ['modifiers', '/admin/modifiers'],
  ['tables', '/admin/tables'],
  ['profile', '/admin/profile'],
  ['users', '/admin/users'],
  ['settings', '/admin/settings'],
  ['subscription', '/admin/subscription'],
  ['branding', '/admin/branding'],
  ['campaigns', '/admin/campaigns'],
  ['loyalty', '/admin/loyalty'],
  ['reservations', '/admin/reservations'],
  ['waitlist', '/admin/waitlist'],
  ['tax', '/admin/tax'],
  ['layout', '/admin/layout'],
  ['inventory', '/admin/inventory'],
  ['schedule', '/admin/schedule'],
  ['customers', '/admin/customers'],
  ['rooms', '/admin/rooms'],
  ['gift-cards', '/admin/gift-cards'],
  ['time-tracking', '/admin/time-tracking'],
];

describe('Admin dashboard', () => {
  it.each(ADMIN_TABS)('renders /admin/%s without crashing', async (_label, path) => {
    const { container, errors } = await mount(
      <Providers>
        <MemoryRouter initialEntries={[path]}>
          <AdminPortal />
        </MemoryRouter>
      </Providers>,
    );
    expect(errors).toEqual([]);
    expect(container.textContent?.length ?? 0).toBeGreaterThan(0);
  });
});

describe('Staff dashboards', () => {
  it.each(['waiter', 'kitchen', 'cashier'] as Role[])('renders staff portal for %s', async (role) => {
    vi.stubGlobal('fetch', mockFetch(role));
    const { container, errors } = await mount(
      <Providers>
        <MemoryRouter initialEntries={['/staff']}>
          <StaffPortal />
        </MemoryRouter>
      </Providers>,
    );
    expect(errors).toEqual([]);
    expect(container.textContent?.length ?? 0).toBeGreaterThan(0);
  });
});

describe('Super admin dashboard', () => {
  it('renders the platform console without crashing', async () => {
    vi.stubGlobal('fetch', mockFetch('super_admin'));
    const { container, errors } = await mount(
      <Providers>
        <MemoryRouter initialEntries={['/super-admin']}>
          <SuperAdminPortal />
        </MemoryRouter>
      </Providers>,
    );
    expect(errors).toEqual([]);
    expect(container.textContent?.length ?? 0).toBeGreaterThan(0);
  });
});

describe('Customer ordering flow', () => {
  it.each(['/r/test-cafe/table/1/menu', '/r/test-cafe/table/1/cart', '/r/test-cafe/table/1/orders', '/r/test-cafe/table/1/bill'] as string[])(
    'renders the table flow at %s without crashing',
    async (path) => {
      vi.stubGlobal('fetch', mockFetch('admin'));
      const { container, errors } = await mount(
        <Providers>
          <MemoryRouter initialEntries={[path]}>
            <TableFlowLayout />
          </MemoryRouter>
        </Providers>,
      );
      expect(errors).toEqual([]);
      expect(container.textContent?.length ?? 0).toBeGreaterThan(0);
    },
  );
});
