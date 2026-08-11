import { LegalLayout, S, UL, LEGAL_ENTITY, SUPPORT_CONTACT } from './LegalLayout';

export function TermsPage() {
  return (
    <LegalLayout
      title="Terms of Service"
      intro={`These Terms of Service ("Terms") govern your access to and use of the Qlisted platform provided by ${LEGAL_ENTITY} ("Qlisted", "we", "us"). By creating an account or using the Service, you agree to these Terms.`}
    >
      <S n={1} title="The Service">
        <p>
          Qlisted provides software for hospitality businesses to take QR orders and payments and to manage
          menus, staff, inventory, guests, reservations, hotel rooms, analytics, and related operations. We may
          add, change, or remove features over time.
        </p>
      </S>

      <S n={2} title="Accounts &amp; eligibility">
        <p>
          You must be at least 18 and able to form a binding contract. You are responsible for the accuracy of
          your account information, for keeping your credentials secure, and for all activity under your
          account. Notify us promptly of any unauthorised use.
        </p>
      </S>

      <S n={3} title="Subscriptions, billing &amp; taxes">
        <UL items={[
          'Paid plans are billed in advance on a recurring basis (monthly or as stated at checkout) and renew automatically until cancelled.',
          'Payments are handled by Stripe; by subscribing you also agree to Stripe’s terms.',
          'Fees are exclusive of taxes unless stated; you are responsible for applicable taxes.',
          'We may change pricing with reasonable notice; changes take effect on your next billing cycle.',
        ]} />
      </S>

      <S n={4} title="Free trial">
        <p>
          If a free trial is offered, the Service converts to a paid subscription at the end of the trial
          unless you cancel beforehand. See our <a href="/refunds" className="text-[#0f766e] hover:underline">Refund &amp; Cancellation Policy</a>.
        </p>
      </S>

      <S n={5} title="Acceptable use">
        <p>You agree not to:</p>
        <UL items={[
          'Break the law or infringe others’ rights when using the Service.',
          'Upload malware, attempt to breach security, or disrupt the Service or other users.',
          'Reverse engineer, resell, or copy the Service except as permitted by law.',
          'Use the Service to send unlawful, deceptive, or unsolicited bulk messages.',
        ]} />
      </S>

      <S n={6} title="Your data &amp; responsibilities">
        <p>
          You retain ownership of the content and data you put into the Service ("Merchant Data"). You grant us
          a licence to host and process Merchant Data solely to provide the Service. You are the controller of
          your guests' personal data and are responsible for having a lawful basis to collect it and for your
          own privacy notices. Our handling of personal data is described in the{' '}
          <a href="/privacy" className="text-[#0f766e] hover:underline">Privacy Policy</a>.
        </p>
      </S>

      <S n={7} title="Intellectual property">
        <p>
          The Service, including its software, design, and trademarks, is owned by {LEGAL_ENTITY} and its
          licensors and is protected by law. These Terms grant you a limited, non-exclusive, non-transferable
          right to use the Service; no other rights are granted.
        </p>
      </S>

      <S n={8} title="Third-party services">
        <p>
          The Service integrates with third parties such as Stripe and email providers. We are not responsible
          for third-party services, and your use of them is subject to their own terms.
        </p>
      </S>

      <S n={9} title="Availability &amp; disclaimers">
        <p>
          We aim for high availability but do not guarantee the Service will be uninterrupted or error-free. The
          Service is provided "as is" and "as available" without warranties of any kind, to the fullest extent
          permitted by law.
        </p>
      </S>

      <S n={10} title="Limitation of liability">
        <p>
          To the maximum extent permitted by law, {LEGAL_ENTITY} will not be liable for indirect, incidental,
          special, or consequential damages, or for lost profits or data. Our total liability for any claim is
          limited to the amounts you paid for the Service in the 12 months before the claim.
        </p>
      </S>

      <S n={11} title="Indemnification">
        <p>
          You agree to indemnify {LEGAL_ENTITY} against claims arising from your Merchant Data, your use of the
          Service, or your breach of these Terms, to the extent permitted by law.
        </p>
      </S>

      <S n={12} title="Termination">
        <p>
          You may cancel at any time. We may suspend or terminate access for breach of these Terms or to protect
          the Service. On termination, your right to use the Service ends; you may export your data before your
          account is closed, after which it may be deleted subject to legal retention requirements.
        </p>
      </S>

      <S n={13} title="Governing law">
        <p>
          These Terms are governed by the laws of the jurisdiction in which {LEGAL_ENTITY} is established,
          without regard to conflict-of-law principles, and the courts of that jurisdiction have exclusive
          jurisdiction, except where mandatory local consumer law provides otherwise.
        </p>
      </S>

      <S n={14} title="Changes">
        <p>
          We may update these Terms. Material changes will be posted here with a revised date and, where
          appropriate, notified to you. Continued use after changes take effect constitutes acceptance.
        </p>
      </S>

      <S n={15} title="Contact">
        <p>
          Questions about these Terms? Email{' '}
          <a href={`mailto:${SUPPORT_CONTACT}`} className="text-[#0f766e] hover:underline">{SUPPORT_CONTACT}</a>.
        </p>
      </S>
    </LegalLayout>
  );
}
