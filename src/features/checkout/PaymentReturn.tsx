import { useSearchParams, Link } from 'react-router';
import { CheckCircle, Clock, XCircle } from 'lucide-react';

/**
 * Stripe redirect return target (Bizum and other redirect-based methods come
 * back here). The order's payment status is finalized server-side by the Stripe
 * webhook; this screen just confirms the outcome to the guest.
 */
export function PaymentReturn() {
  const [params] = useSearchParams();
  const status = params.get('redirect_status'); // succeeded | processing | failed | null

  const view = status === 'succeeded'
    ? { Icon: CheckCircle, color: 'text-green-600', title: 'Payment received', body: 'Thank you! Your payment was successful.' }
    : status === 'processing'
      ? { Icon: Clock, color: 'text-amber-500', title: 'Payment processing', body: 'Your payment is being processed — this can take a moment.' }
      : { Icon: XCircle, color: 'text-red-600', title: 'Payment not completed', body: 'Your payment was not completed. You can try again from your order.' };

  const { Icon, color, title, body } = view;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-sm">
        <Icon className={`mx-auto h-14 w-14 ${color}`} />
        <h1 className="mt-4 text-xl font-bold text-gray-900">{title}</h1>
        <p className="mt-2 text-sm text-gray-600">{body}</p>
        <Link to="/" className="mt-6 inline-block rounded-lg bg-[#0f766e] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#1e3a5f]">
          Done
        </Link>
      </div>
    </div>
  );
}
