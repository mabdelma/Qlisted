import { LegalLayout, S, UL, SUPPORT_CONTACT } from './LegalLayout';

export function RefundPolicyPage() {
  return (
    <LegalLayout
      title="Refund & Cancellation Policy"
      intro="This policy explains how subscriptions to the Qlisted platform can be cancelled and when refunds apply. It covers your Qlisted subscription, not orders placed by guests at a Merchant's venue."
    >
      <S n={1} title="Subscriptions">
        <p>
          Paid plans are billed in advance and renew automatically for the same period until cancelled. Your
          billing date is the day you first subscribed.
        </p>
      </S>

      <S n={2} title="Cancelling">
        <p>
          You can cancel at any time from your account's billing settings. Cancellation stops the next renewal;
          your plan stays active until the end of the current paid period, after which it will not renew.
        </p>
      </S>

      <S n={3} title="Refunds">
        <UL items={[
          'Subscription fees are generally non-refundable, and we do not provide refunds or credits for partial periods, unused time, or unused features.',
          'Where required by applicable consumer law, or in cases of a confirmed billing error or duplicate charge, we will provide a refund or credit.',
          'Approved refunds are returned to the original payment method via Stripe and may take several business days to appear.',
        ]} />
      </S>

      <S n={4} title="Free trials">
        <p>
          If a free trial is offered, you will not be charged during the trial. To avoid being billed, cancel
          before the trial ends. Once the trial converts to a paid subscription, the refund terms above apply.
        </p>
      </S>

      <S n={5} title="Guest orders &amp; payments">
        <p>
          Payments guests make to a Merchant (for food, rooms, or other goods and services) are between the guest
          and that Merchant. Refunds for those transactions are handled by the Merchant under its own policy;
          Qlisted only provides the technology used to process them.
        </p>
      </S>

      <S n={6} title="Chargebacks">
        <p>
          If you believe a charge is incorrect, please contact us first so we can help resolve it quickly.
          Initiating a chargeback without contacting us may result in suspension of the account while the dispute
          is reviewed.
        </p>
      </S>

      <S n={7} title="Contact">
        <p>
          For billing questions or refund requests, email{' '}
          <a href={`mailto:${SUPPORT_CONTACT}`} className="text-[#0f766e] hover:underline">{SUPPORT_CONTACT}</a>.
        </p>
      </S>
    </LegalLayout>
  );
}
