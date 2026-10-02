// @vitest-environment jsdom
// Reproduction for the bill page crashing when a table actually has an unpaid
// order. The existing dashboard smoke test mocks /orders as [], so it only ever
// renders the empty state and never touches this path.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import type { ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Routes, Route } from 'react-router';

import { ThemeProvider } from '../../contexts/ThemeContext';
import { I18nProvider } from '../../contexts/I18nContext';
import { ToastProvider } from '../../components/ui/Toast';
import { AuthProvider } from '../../contexts/AuthContext';
import { TableFlowLayout } from '../restaurant/TableFlowLayout';
import { BillPage } from '../checkout/BillPage';

const TENANT = {
  id: 't1', name: 'Demo Café', slug: 'demo-cafe', email: 'tenant@test.com',
  currency: 'USD', timezone: 'UTC', taxRate: 10, serviceCharge: 0, isActive: true,
  primaryColor: '#0f766e', accentColor: '#1e3a5f',
};

const ORDER = {
  id: 'order-1', tenantId: 't1', tableId: 'table-1', orderType: 'dine_in',
  status: 'delivered', itemCount: 3, subtotal: 38.97, tax: 3.9, serviceCharge: 0,
  total: 42.87, paymentStatus: 'unpaid', paidAmount: 0,
  createdAt: '2026-10-01T10:00:00Z', updatedAt: '2026-10-01T10:00:00Z',
};

const ORDER_ITEMS = [
  { id: 'oi-1', orderId: 'order-1', menuItemId: 'mi-1', name: 'Beef Burger', quantity: 2, unitPrice: 16.99, isComp: false },
  { id: 'oi-2', orderId: 'order-1', menuItemId: 'mi-2', name: 'Fresh Lemonade', quantity: 1, unitPrice: 4.99, isComp: false },
];

function mockFetch(): typeof fetch {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    let body: unknown = [];

    if (url.includes('/auth/me')) body = { user: null, tenant: TENANT };
    else if (url.includes('/auth/refresh')) return { ok: false, status: 401, json: async () => ({}), text: async () => '' } as unknown as Response;
    else if (url.includes('/tenants/')) body = TENANT;
    else if (/\/orders\/[^/]+$/.test(url)) body = { ...ORDER, items: ORDER_ITEMS };
    else if (url.includes('/orders')) body = [ORDER];
    else if (url.includes('/payments')) body = [];
    else if (url.includes('/table/')) body = { id: 'table-1', number: 1, capacity: 4, status: 'available', tenantSlug: 'demo-cafe', qrToken: 'table-1' };
    else if (url.includes('/menu')) body = { categories: [], items: [] };

    return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) } as unknown as Response;
  });
}

function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider><I18nProvider><ToastProvider><AuthProvider>{children}</AuthProvider></ToastProvider></I18nProvider></ThemeProvider>
  );
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  if (!window.matchMedia) {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (q: string) => ({ matches: false, media: q, onchange: null, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false }),
    });
  }
  class FakeEventSource {
    close() {}
    addEventListener() {}
    removeEventListener() {}
    onerror: ((e: unknown) => void) | null = null;
    onmessage: ((e: unknown) => void) | null = null;
  }
  vi.stubGlobal('EventSource', FakeEventSource);
  vi.stubGlobal('fetch', mockFetch());
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe('BillPage with an unpaid order', () => {
  it('renders the bill instead of an error boundary', async () => {
    const errors: unknown[] = [];
    const spy = vi.spyOn(console, 'error').mockImplementation((...a) => { errors.push(a[0]); });

    await act(async () => {
      root.render(
        <Providers>
          <MemoryRouter initialEntries={['/r/demo-cafe/table/table-1/bill']}>
            <Routes>
              <Route path="/r/:slug/table/:tableId" element={<TableFlowLayout />}>
                <Route path="bill" element={<BillPage />} />
              </Route>
            </Routes>
          </MemoryRouter>
        </Providers>,
      );
    });
    await act(async () => { await new Promise((r) => setTimeout(r, 60)); });

    spy.mockRestore();
    const text = container.textContent || '';
    if (errors.length) console.log('CAPTURED ERRORS:', errors.slice(0, 3));
    expect(text).not.toContain('Something went wrong');
  });
});
