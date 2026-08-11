import { db } from '../db/index.js';
import { tenants } from '../db/schema.js';
import { eq, sql } from 'drizzle-orm';
import Stripe from 'stripe';

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('Stripe secret key not configured');
  return new Stripe(key, { apiVersion: '2025-02-24.acacia' });
}

export async function createConnectAccount(tenantId: string, email: string) {
  const stripe = getStripe();
  const account = await stripe.accounts.create({
    type: 'standard',
    email,
    business_type: 'individual',
    capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
  });

  await db.update(tenants)
    .set({ stripeAccountId: account.id, updatedAt: sql`now()` })
    .where(eq(tenants.id, tenantId));

  return account;
}

export async function getOnboardingLink(tenantId: string, refreshUrl: string, returnUrl: string) {
  const stripe = getStripe();
  const [tenant] = await db.select({ stripeAccountId: tenants.stripeAccountId })
    .from(tenants).where(eq(tenants.id, tenantId));

  if (!tenant?.stripeAccountId) {
    throw new Error('No Stripe Connect account. Create one first.');
  }

  const link = await stripe.accountLinks.create({
    account: tenant.stripeAccountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: 'account_onboarding',
  });

  return link;
}

export async function getAccountStatus(tenantId: string) {
  const stripe = getStripe();
  const [tenant] = await db.select({ stripeAccountId: tenants.stripeAccountId })
    .from(tenants).where(eq(tenants.id, tenantId));

  if (!tenant?.stripeAccountId) {
    return { connected: false, account: null };
  }

  const account = await stripe.accounts.retrieve(tenant.stripeAccountId);
  return {
    connected: account.charges_enabled,
    account: {
      id: account.id,
      email: account.email,
      country: account.country,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted,
    },
  };
}

export async function getBalance(tenantId: string) {
  const stripe = getStripe();
  const [tenant] = await db.select({ stripeAccountId: tenants.stripeAccountId })
    .from(tenants).where(eq(tenants.id, tenantId));

  if (!tenant?.stripeAccountId) throw new Error('No Stripe Connect account');

  const balance = await stripe.balance.retrieve({
    stripeAccount: tenant.stripeAccountId,
  });

  return {
    available: balance.available.map((b) => ({ amount: b.amount, currency: b.currency })),
    pending: balance.pending.map((b) => ({ amount: b.amount, currency: b.currency })),
  };
}

export async function createPayout(tenantId: string, amount: number, currency: string = 'usd') {
  const stripe = getStripe();
  const [tenant] = await db.select({ stripeAccountId: tenants.stripeAccountId })
    .from(tenants).where(eq(tenants.id, tenantId));

  if (!tenant?.stripeAccountId) throw new Error('No Stripe Connect account');

  const payout = await stripe.payouts.create({
    amount,
    currency,
  }, {
    stripeAccount: tenant.stripeAccountId,
  });

  return { id: payout.id, amount: payout.amount, status: payout.status, arrivalDate: new Date(payout.arrival_date * 1000).toISOString() };
}

export async function getPayoutHistory(tenantId: string) {
  const stripe = getStripe();
  const [tenant] = await db.select({ stripeAccountId: tenants.stripeAccountId })
    .from(tenants).where(eq(tenants.id, tenantId));

  if (!tenant?.stripeAccountId) throw new Error('No Stripe Connect account');

  const payouts = await stripe.payouts.list({
    limit: 20,
  }, {
    stripeAccount: tenant.stripeAccountId,
  });

  return payouts.data.map((p) => ({
    id: p.id,
    amount: p.amount,
    currency: p.currency,
    status: p.status,
    arrivalDate: new Date(p.arrival_date * 1000).toISOString(),
    created: new Date(p.created * 1000).toISOString(),
  }));
}
