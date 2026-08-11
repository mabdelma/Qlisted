import type { ReactNode } from 'react';
import { MarketingHeader } from '../../../components/layout/MarketingHeader';
import { Footer } from '../../../components/layout/Footer';

// Single source of truth for the policy suite. Update the date when policies change.
export const LEGAL_UPDATED = '1 July 2026';
export const LEGAL_ENTITY = 'Grand Minds Technology';
export const LEGAL_CONTACT = 'legal@qlisted.com';
export const PRIVACY_CONTACT = 'privacy@qlisted.com';
export const SUPPORT_CONTACT = 'support@qlisted.com';

export function LegalLayout({ title, intro, children }: { title: string; intro?: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <MarketingHeader />
      <section className="bg-gradient-to-b from-amber-50 to-white py-16 border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">{title}</h1>
          <p className="text-sm text-gray-500">Last updated: {LEGAL_UPDATED}</p>
          {intro && <p className="mt-5 text-gray-600 leading-relaxed">{intro}</p>}
        </div>
      </section>
      <article className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {children}
        <div className="mt-12 rounded-xl bg-gray-50 border border-gray-100 p-5 text-sm text-gray-500">
          This document is provided for general information and does not constitute legal advice.
          Questions? Contact us at{' '}
          <a href={`mailto:${LEGAL_CONTACT}`} className="text-[#0f766e] hover:underline">{LEGAL_CONTACT}</a>.
        </div>
      </article>
      <Footer />
    </div>
  );
}

/** Numbered policy section. */
export function S({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-xl font-semibold text-gray-900 mb-3">{n}. {title}</h2>
      <div className="space-y-3 text-gray-600 leading-relaxed">{children}</div>
    </section>
  );
}

export function UL({ items }: { items: ReactNode[] }) {
  return <ul className="list-disc pl-5 space-y-1.5">{items.map((it, i) => <li key={i}>{it}</li>)}</ul>;
}
