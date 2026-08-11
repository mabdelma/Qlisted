import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { registerUser, loginWithRefresh, refreshAccessToken, revokeRefreshToken, verifyEmail, resendVerificationEmail, getCurrentUser, requestPasswordReset, resetPassword, googleLogin, googleEnabled, setupTotp, enableTotp, disableTotp } from '../services/authService.js';

const auth = new Hono();

const registerSchema = z.object({
  tenantSlug: z.string().min(1).max(50),
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(6).max(100),
  role: z.enum(['admin', 'manager', 'waiter', 'kitchen', 'cashier']).optional().default('waiter'),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  totpToken: z.string().optional(),
});

const totpTokenSchema = z.object({ token: z.string().min(6).max(6) });

auth.post('/register', zValidator('json', registerSchema), async (c) => {
  const input = c.req.valid('json');
  const result = await registerUser(input);

  if ('error' in result) {
    return c.json({ error: result.error }, result.status);
  }
  return c.json(result.data, result.status);
});

auth.post('/login', zValidator('json', loginSchema), async (c) => {
  const input = c.req.valid('json');
  const result = await loginWithRefresh(input);

  if ('error' in result) {
    return c.json({ error: result.error }, result.status);
  }
  return c.json(result.data, result.status);
});

// Google sign-in: client sends the Google ID-token credential; we verify it,
// match an existing user by email, and issue the same token/refresh as /login.
const googleSchema = z.object({ credential: z.string().min(1) });

auth.get('/google/status', (c) => c.json({ enabled: googleEnabled(), clientId: process.env.GOOGLE_CLIENT_ID || null }));

auth.post('/google', zValidator('json', googleSchema), async (c) => {
  const result = await googleLogin(c.req.valid('json').credential);
  if ('error' in result) return c.json({ error: result.error }, result.status);
  return c.json(result.data, result.status);
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

auth.post('/refresh', zValidator('json', refreshSchema), async (c) => {
  const { refreshToken } = c.req.valid('json');
  const result = await refreshAccessToken(refreshToken);

  if ('error' in result) {
    return c.json({ error: result.error }, result.status);
  }
  return c.json(result.data, result.status);
});

auth.post('/logout', zValidator('json', refreshSchema), async (c) => {
  const { refreshToken } = c.req.valid('json');
  await revokeRefreshToken(refreshToken);
  return c.json({ success: true });
});

const verifyEmailSchema = z.object({
  token: z.string().min(1),
});

auth.post('/verify-email', zValidator('json', verifyEmailSchema), async (c) => {
  const { token } = c.req.valid('json');
  const result = await verifyEmail(token);

  if ('error' in result) {
    return c.json({ error: result.error }, result.status);
  }
  return c.json(result.data, result.status);
});

const resendVerificationSchema = z.object({
  email: z.string().email(),
});

auth.post('/resend-verification', zValidator('json', resendVerificationSchema), async (c) => {
  const { email } = c.req.valid('json');
  const result = await resendVerificationEmail(email);

  if ('error' in result) {
    return c.json({ error: result.error }, result.status);
  }
  return c.json(result.data, result.status);
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(100),
});

auth.post('/forgot-password', zValidator('json', forgotPasswordSchema), async (c) => {
  const { email } = c.req.valid('json');
  const result = await requestPasswordReset(email);

  if ('error' in result) {
    return c.json({ error: result.error }, result.status);
  }
  return c.json(result.data, result.status);
});

auth.post('/reset-password', zValidator('json', resetPasswordSchema), async (c) => {
  const { token, password } = c.req.valid('json');
  const result = await resetPassword(token, password);

  if ('error' in result) {
    return c.json({ error: result.error }, result.status);
  }
  return c.json(result.data, result.status);
});

auth.get('/me', async (c) => {
  const result = await getCurrentUser(c);

  if ('error' in result) {
    return c.json({ error: result.error }, result.status);
  }
  return c.json(result.data, result.status);
});

// ── TOTP 2FA enrollment (authed; reached via gateway fall-through) ───────────
auth.post('/2fa/setup', async (c) => {
  const result = await setupTotp(c);
  if ('error' in result) return c.json({ error: result.error }, result.status);
  return c.json(result.data, result.status);
});

auth.post('/2fa/enable', zValidator('json', totpTokenSchema), async (c) => {
  const result = await enableTotp(c, c.req.valid('json').token);
  if ('error' in result) return c.json({ error: result.error }, result.status);
  return c.json(result.data, result.status);
});

auth.post('/2fa/disable', zValidator('json', totpTokenSchema), async (c) => {
  const result = await disableTotp(c, c.req.valid('json').token);
  if ('error' in result) return c.json({ error: result.error }, result.status);
  return c.json(result.data, result.status);
});

export default auth;
