import { LegalLayout, S, UL, PRIVACY_CONTACT } from './LegalLayout';

export function CookiePolicyPage() {
  return (
    <LegalLayout
      title="Cookie Policy"
      intro="This Cookie Policy explains how Qlisted uses cookies and similar technologies when you use our websites and platform, and how you can control them."
    >
      <S n={1} title="What are cookies">
        <p>
          Cookies are small text files stored on your device. Similar technologies include local storage and
          session storage. Together they let the Service remember your session and preferences and help us keep
          it secure and reliable.
        </p>
      </S>

      <S n={2} title="How we use cookies">
        <UL items={[
          <><strong>Strictly necessary</strong> — authentication, session management, security, and load balancing. The Service cannot function without these, so they do not require consent.</>,
          <><strong>Preferences</strong> — remember choices such as your language and interface settings.</>,
          <><strong>Analytics &amp; diagnostics</strong> — help us understand usage and detect errors so we can improve performance. These are used only where permitted or with your consent.</>,
        ]} />
      </S>

      <S n={3} title="Third-party cookies">
        <p>
          Some features rely on third parties — for example, Stripe may set cookies to process payments securely
          and prevent fraud. These are governed by the respective provider's own cookie and privacy policies.
        </p>
      </S>

      <S n={4} title="Managing cookies">
        <p>
          You can control or delete cookies through your browser settings, and block non-essential cookies where
          a consent control is offered. Blocking strictly necessary cookies may prevent parts of the Service
          from working, including signing in.
        </p>
      </S>

      <S n={5} title="Changes">
        <p>We may update this Cookie Policy from time to time; the "Last updated" date above reflects the latest version.</p>
      </S>

      <S n={6} title="Contact">
        <p>
          Questions about cookies? Email{' '}
          <a href={`mailto:${PRIVACY_CONTACT}`} className="text-[#0f766e] hover:underline">{PRIVACY_CONTACT}</a>.
          See also our <a href="/privacy" className="text-[#0f766e] hover:underline">Privacy Policy</a>.
        </p>
      </S>
    </LegalLayout>
  );
}
