import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serveStatic } from '@hono/node-server/serve-static';
import { HTTPException } from 'hono/http-exception';
import { sql } from 'drizzle-orm';
import { createRequire } from 'module';
import { db } from './db/index.js';
import { logger } from './lib/logger.js';
import { initSentry, captureError } from './lib/sentry.js';
import { generalLimiter, authLimiter, publicLimiter, paymentLimiter, pointsLimiter } from './middleware/rateLimiter.js';
import { requestLogger } from './middleware/requestLogger.js';

const _require = createRequire(import.meta.url);

function validateEnv() {
  const required = ['DATABASE_URL', 'JWT_SECRET', 'REDIS_URL'];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error(`FATAL: Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }
}

if (!process.env.VITEST) {
  validateEnv();
}
initSentry();

process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'Unhandled promise rejection');
  captureError(reason instanceof Error ? reason : new Error(String(reason)), { type: 'unhandledRejection' });
});
import {
  authRoutes,
  tenantRoutes,
  menuRoutes,
  tableRoutes,
  orderRoutes,
  paymentRoutes,
  webhookRoutes,
  userRoutes,
  adminRoutes,
  adminAuditRoutes,
  eventRoutes,
  uploadRoutes,
  demoRoutes,
  analyticsRoutes,
  docsRoutes,
  printRoutes,
  modifierRoutes,
  promoRoutes,
  exportRoutes,
  reportRoutes,
  aiRoutes,
  inventoryRoutes,
  procurementRoutes,
  schedulingRoutes,
  marketingRoutes,
  hotelRoutes,
  groupRoutes,
  onboardingRoutes,
  customerRoutes,
  integrationRoutes,
  pushRoutes,
  auditRoutes,
  loyaltyRoutes,
  promoValidateRoutes,
  reservationRoutes,
  waitlistRoutes,
  taxCategoryRoutes,
  giftCardRoutes,
  connectRoutes,
  invoiceRoutes,
  timeRoutes,
  smsRoutes,
} from './routes/index.js';

const app = new Hono();

// Baseline security headers (defense-in-depth; Caddy also sets HSTS at the edge).
app.use('*', async (c, next) => {
  await next();
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header('X-Permitted-Cross-Domain-Policies', 'none');
  c.header('Cross-Origin-Resource-Policy', 'same-site');
  c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  c.header('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' https://js.stripe.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://api.stripe.com https://*.ingest.sentry.io https://api.openai.com https://*.openai.com; frame-src https://js.stripe.com; base-uri 'self'; form-action 'self'");
});

app.use('*', cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  maxAge: 86400,
}));

// Request logging (after security headers + CORS, before everything else)
app.use('*', requestLogger);

// Rate limiting
app.use('/api/auth/*', authLimiter);
app.use('/api/tenants/*', generalLimiter);
app.use('/api/r/*', publicLimiter);
app.use('/api/r/*/payments/create-intent', paymentLimiter);
app.use('/api/r/*/loyalty/earn', pointsLimiter);
app.use('/api/r/*/loyalty/redeem', pointsLimiter);
app.use('/api/r/*/loyalty/redeem-for-order', pointsLimiter);
// Guest room-service orders post charges to a folio — hold them to the stricter
// payment-grade limit on top of the public limiter.
app.use('/api/r/*/room/*/order', paymentLimiter);
app.use('/api/webhooks/*', generalLimiter);
app.use('/api/admin/*', generalLimiter);
app.use('/api/demo', publicLimiter);
app.use('/api/health*', publicLimiter);

// Liveness probe — process is alive
app.get('/api/health/liveness', (c) => {
  return c.json({ status: 'alive', timestamp: new Date().toISOString() });
});

// Readiness probe — all dependencies are reachable
app.get('/api/health/readiness', async (c) => {
  const checks: Record<string, string> = {};

  try {
    await db.execute(sql`select 1`);
    checks.db = 'up';
  } catch {
    checks.db = 'down';
  }

  try {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      checks.redis = 'not_configured';
    } else {
      const IORedis = _require('ioredis') as new (url: string, opts: Record<string, unknown>) => { connect(): Promise<void>; ping(): Promise<string>; disconnect(): void };
      const client = new IORedis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1 });
      await client.connect();
      await client.ping();
      checks.redis = 'up';
      client.disconnect();
    }
  } catch {
    checks.redis = 'down';
  }

  const allUp = Object.values(checks).every((v) => v === 'up' || v === 'not_configured');
  return c.json({ status: allUp ? 'ready' : 'degraded', checks, timestamp: new Date().toISOString() },
    allUp ? 200 : 503);
});

// Legacy health check — aggregate status
app.get('/api/health', async (c) => {
  const uptime = process.uptime();
  try {
    await db.execute(sql`select 1`);
    return c.json({ status: 'ok', db: 'up', uptime, timestamp: new Date().toISOString() });
  } catch (err) {
    logger.error({ err: (err as Error).message }, 'Health check DB ping failed');
    return c.json({ status: 'degraded', db: 'down', uptime, timestamp: new Date().toISOString() }, 503);
  }
});

// Routes
app.route('/api/auth', authRoutes);
app.route('/api/tenants', tenantRoutes);
app.route('/api/r', menuRoutes);
app.route('/api/r', tableRoutes);
app.route('/api/r', orderRoutes);
app.route('/api/r', paymentRoutes);
app.route('/api', webhookRoutes);
app.route('/api/r', userRoutes);
app.route('/api/r', eventRoutes);
app.route('/api/r', uploadRoutes);
app.route('/api/r', analyticsRoutes);
app.route('/api/demo', demoRoutes);

// Serve uploaded files
app.use('/uploads/*', serveStatic({ root: './' }));

app.route('/api', adminRoutes);
app.route('/api', adminAuditRoutes);
app.route('/api', groupRoutes);
app.route('/api', onboardingRoutes);

// OpenAPI docs
app.route('/api', docsRoutes);
app.route('/api/r', printRoutes);
app.route('/api/r', modifierRoutes);
app.route('/api/r', promoRoutes);
app.route('/api/r', exportRoutes);
app.route('/api/r', reportRoutes);
app.route('/api/r', aiRoutes);
app.route('/api/r', inventoryRoutes);
app.route('/api/r', procurementRoutes);
app.route('/api/r', schedulingRoutes);
app.route('/api/r', marketingRoutes);
app.route('/api/r', hotelRoutes);
app.route('/api/r', customerRoutes);
app.route('/api/r', integrationRoutes);
app.route('/api/r', pushRoutes);
app.route('/api/r', auditRoutes);
app.route('/api/r', loyaltyRoutes);
app.route('/api/r', promoValidateRoutes);
app.route('/api/r', reservationRoutes);
app.route('/api/r', waitlistRoutes);
app.route('/api/r', taxCategoryRoutes);
app.route('/api/r', giftCardRoutes);
app.route('/api/r', connectRoutes);
app.route('/api/r', invoiceRoutes);
app.route('/api/r', timeRoutes);
app.route('/api/r', smsRoutes);

// Error handling
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status);
  }
  logger.error({ err: err.message, stack: err.stack }, 'Unhandled error');
  captureError(err, { path: c.req.path, method: c.req.method });
  return c.json({ error: 'Internal server error' }, 500);
});

// 404
app.notFound((c) => c.json({ error: 'Not found' }, 404));

const port = parseInt(process.env.PORT || '3001', 10);

serve({
  fetch: app.fetch,
  port,
}, (info) => {
  logger.info({ port: info.port }, 'Qlisted API server started');
});

export default app;
