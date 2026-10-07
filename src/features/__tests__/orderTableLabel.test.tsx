// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import type { ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router';

import { ThemeProvider } from '../../contexts/ThemeContext';
import { I18nProvider } from '../../contexts/I18nContext';
import { ToastProvider } from '../../components/ui/Toast';
import { AuthProvider } from '../../contexts/AuthContext';
import { OrderManagement } from '../admin/OrderManagement';

/**
 * The admin order list used to label a dine-in order
 * `Table ${order.tableId.slice(0, 8)}` — a UUID fragment. "Table 09644ab9" is
 * not something anyone can find on a floor, and the API did not return a table
 * name at all, so the page could not have done better.
 *
 * These assert the label falls back sensibly rather than ever showing an id,
 * and that the header count reflects the list.
 */

const TENANT = {
  id: 't1', name: 'Test Cafe', slug: 'test-cafe', email: 'tenant@test.com',
  currency: 'USD', timezone: 'UTC', taxRate: 0, serviceCharge: 0, isActive: true,
  primaryColor: '#0f766e', accentColor: '#1e3a5f',
};

const UUID = '09644ab9-5f3a-4fac-b1d1-43efd4869d80';

function orderRow(over: Record<string, unknown>) {
  return {
    id: 'o1', tenantId: 't1', tableId: UUID, orderType: 'dine_in',
    status: 'pending', itemCount: 2, subtotal: 20, tax: 0, serviceCharge: 0,
    total: 20, paymentStatus: 'unpaid', paidAmount: 0,
    createdAt: '2026-10-01T10:00:00Z', updatedAt: '2026-10-01T10:00:00Z',
    ...over,
  };
}

function mockFetch(orders: Record<string, unknown>[]): typeof fetch {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    let body: unknown = [];
    if (url.includes('/auth/me')) body = { user: { id: 'u1', tenantId: 't1', name: 'A', email: 'a@t.com', role: 'admin', isActive: true }, tenant: TENANT };
    else if (url.includes('/auth/refresh')) return { ok: false, status: 401, json: async () => ({}), text: async () => '' } as unknown as Response;
    else if (url.includes('/orders')) body = { data: orders, page: 1, limit: 20, total: orders.length };
    else if (url.includes('/tenants/')) body = TENANT;
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
  // The page now subscribes to the order stream; jsdom has no EventSource.
  class FakeEventSource {
    close() {}
    addEventListener() {}
    removeEventListener() {}
    onerror: ((e: unknown) => void) | null = null;
  }
  vi.stubGlobal('EventSource', FakeEventSource);
  // AuthProvider only calls /auth/me when a token is present, and without a
  // tenant the page has no slug and sits on its loading state.
  localStorage.setItem('token', 'test-token');
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

async function render(orders: Record<string, unknown>[]) {
  vi.stubGlobal('fetch', mockFetch(orders));
  await act(async () => {
    root.render(
      <Providers>
        <MemoryRouter initialEntries={['/admin/orders']}>
          <OrderManagement />
        </MemoryRouter>
      </Providers>,
    );
  });
  await act(async () => { await new Promise((r) => setTimeout(r, 80)); });
  return container.textContent || '';
}

describe('admin order list — table label', () => {
  it('shows the table name when the join provided one', async () => {
    const text = await render([orderRow({ tableName: 'Terrace 1', tableNumber: 7 })]);
    expect(text).toContain('Terrace 1');
    // The id must not leak into the UI even when it is present on the row.
    expect(text).not.toContain(UUID.slice(0, 8));
  });

  it('falls back to the number when there is no name', async () => {
    const text = await render([orderRow({ tableName: null, tableNumber: 4 })]);
    expect(text).toContain('4');
    expect(text).not.toContain(UUID.slice(0, 8));
  });

  it('never renders a raw id when neither name nor number came back', async () => {
    // This is the regression: the old code printed the uuid fragment here.
    const text = await render([orderRow({ tableName: null, tableNumber: null })]);
    expect(text).not.toContain(UUID.slice(0, 8));
  });

  it('counts the orders in the header', async () => {
    const text = await render([
      orderRow({ id: 'o1', tableName: 'T1', status: 'pending' }),
      orderRow({ id: 'o2', tableName: 'T2', status: 'preparing' }),
      orderRow({ id: 'o3', tableName: 'T3', status: 'delivered' }),
    ]);
    // 3 total, 2 of them still active (pending + preparing).
    expect(text).toMatch(/3/);
    expect(text).toMatch(/2/);
  });
});
