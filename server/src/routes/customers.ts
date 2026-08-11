import { Hono } from 'hono';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { resolveTenant } from '../middleware/tenant.js';
import { getCustomers, findOrCreateCustomer, updateCustomer } from '../services/customerService.js';

const customers = new Hono();

customers.get('/:slug/customers', authMiddleware, requireRole('admin', 'manager', 'waiter'), resolveTenant, async (c) => {
  const tenantId = c.get('tenantId');
  const list = await getCustomers(tenantId);
  return c.json({ data: list });
});

customers.post('/:slug/customers', authMiddleware, requireRole('admin', 'manager', 'waiter'), resolveTenant, async (c) => {
  const tenantId = c.get('tenantId');
  const body = await c.req.json() as { name: string; email?: string; phone?: string };
  const customer = await findOrCreateCustomer(tenantId, body);
  return c.json({ data: customer }, 201);
});

customers.put('/:slug/customers/:customerId', authMiddleware, requireRole('admin', 'manager'), resolveTenant, async (c) => {
  const tenantId = c.get('tenantId');
  const customerId = c.req.param('customerId')!;
  const body = await c.req.json() as { name?: string; email?: string; phone?: string; notes?: string };
  await updateCustomer(customerId, tenantId, body);
  return c.json({ success: true });
});

export default customers;
