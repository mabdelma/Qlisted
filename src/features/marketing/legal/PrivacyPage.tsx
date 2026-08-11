import { LegalLayout, S, UL, LEGAL_ENTITY, PRIVACY_CONTACT } from './LegalLayout';

export function PrivacyPage() {
  return (
    <LegalLayout
      title="Privacy Policy"
      intro={`This Privacy Policy explains how ${LEGAL_ENTITY} ("Qlisted", "we", "us") collects, uses, and protects personal information when you use the Qlisted platform, websites, and mobile apps (the "Service").`}
    >
      <S n={1} title="Who we are">
        <p>
          Qlisted is a hospitality operations platform owned and operated by {LEGAL_ENTITY}. For any
          business that uses Qlisted to run its restaurant or hotel (a "Merchant"), the Merchant is the
          controller of its guests' personal data and Qlisted acts as a processor on the Merchant's behalf.
          For our own account holders and website visitors, Qlisted is the controller.
        </p>
      </S>

      <S n={2} title="Information we collect">
        <UL items={[
          <><strong>Account data</strong> — name, email, phone, password (hashed), role, and business details you provide when you register.</>,
          <><strong>Merchant &amp; menu data</strong> — venues, menus, tables, rooms, inventory, staff schedules, and settings you enter.</>,
          <><strong>Guest &amp; customer data</strong> — where a Merchant uses our CRM, loyalty, or ordering tools: guest names, contact details, order history, visits, and points.</>,
          <><strong>Payment data</strong> — payments are processed by Stripe. We receive limited transaction metadata (amounts, status, last four digits); we do not store full card numbers.</>,
          <><strong>Usage &amp; device data</strong> — IP address, browser/device type, pages viewed, and diagnostic logs used to keep the Service secure and reliable.</>,
          <><strong>Cookies</strong> — see our <a href="/cookies" className="text-[#0f766e] hover:underline">Cookie Policy</a>.</>,
        ]} />
      </S>

      <S n={3} title="How we use information">
        <UL items={[
          'Provide, operate, and secure the Service and process orders and payments.',
          'Authenticate users, prevent fraud and abuse, and maintain audit logs.',
          'Send transactional messages (receipts, password resets, order updates) and, where permitted, product or marketing communications you can opt out of.',
          'Analyse usage to improve features, performance, and reliability.',
          'Comply with legal, tax, and accounting obligations.',
        ]} />
      </S>

      <S n={4} title="Legal bases (EEA/UK)">
        <p>
          Where the GDPR or UK GDPR applies, we rely on: performance of a contract (to provide the Service);
          legitimate interests (to secure and improve the Service); consent (for optional marketing and
          non-essential cookies); and legal obligation (for tax and compliance). You may withdraw consent at
          any time.
        </p>
      </S>

      <S n={5} title="How we share information">
        <p>We do not sell personal data. We share it only with:</p>
        <UL items={[
          <><strong>Payment processing</strong> — Stripe, Inc., to take and reconcile payments.</>,
          <><strong>Infrastructure &amp; email</strong> — hosting, storage, and email-delivery providers that run the Service under contract.</>,
          <><strong>Merchants</strong> — a guest's data is shared with the Merchant whose venue they interact with.</>,
          <><strong>Legal &amp; safety</strong> — authorities or advisers where required by law or to protect rights and safety.</>,
          <><strong>Business transfers</strong> — a successor entity in the event of a merger, acquisition, or asset sale.</>,
        ]} />
      </S>

      <S n={6} title="International transfers">
        <p>
          The Service operates on infrastructure that may be located in different countries. Where personal
          data is transferred across borders, we use appropriate safeguards such as Standard Contractual
          Clauses or transfers to jurisdictions recognised as providing adequate protection.
        </p>
      </S>

      <S n={7} title="Data retention">
        <p>
          We keep personal data for as long as your account is active or as needed to provide the Service, and
          thereafter only as required for legal, tax, dispute-resolution, or security purposes. Merchants
          control the retention of their guests' data and can export or delete it from their dashboard.
        </p>
      </S>

      <S n={8} title="Security">
        <p>
          We protect data with encryption in transit, hashed credentials, role-based access controls, and
          continuous monitoring. No method of transmission or storage is completely secure, but we work to
          protect your information and to notify affected users of material breaches as required by law.
        </p>
      </S>

      <S n={9} title="Your rights">
        <p>
          Depending on your location, you may have the right to access, correct, delete, or port your data, to
          object to or restrict certain processing, and to withdraw consent. To exercise these rights for data
          we control, contact us. For data held by a Merchant, please contact that Merchant directly.
        </p>
      </S>

      <S n={10} title="Children">
        <p>The Service is not directed to children under 16, and we do not knowingly collect their personal data.</p>
      </S>

      <S n={11} title="Changes to this policy">
        <p>
          We may update this policy from time to time. Material changes will be posted here with a revised
          "Last updated" date, and, where appropriate, communicated to you.
        </p>
      </S>

      <S n={12} title="Contact">
        <p>
          For privacy questions or requests, email{' '}
          <a href={`mailto:${PRIVACY_CONTACT}`} className="text-[#0f766e] hover:underline">{PRIVACY_CONTACT}</a>.
        </p>
      </S>
    </LegalLayout>
  );
}
