import React from 'react';
import { useAuth } from '../lib/AuthContext';

const WP_REST_BASE = '/wp-json';
const APP_SECRET = import.meta.env.VITE_APP_SECRET ?? '';

const PaymentReturn = ({ onNavigate }) => {
  const { user } = useAuth();
  const [state, setState] = React.useState({ status: 'checking', saleId: null, message: '' });

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const trackingId = params.get('OrderTrackingId');
    const merchantReference = params.get('OrderMerchantReference');

    if (!trackingId || !merchantReference) {
      setState({ status: 'error', saleId: null, message: 'Payment reference details are missing.' });
      return undefined;
    }

    let cancelled = false;
    const verifyPayment = async () => {
      try {
        const query = new URLSearchParams({
          OrderTrackingId: trackingId,
          OrderMerchantReference: merchantReference,
        });
        const headers = {
          Accept: 'application/json',
          'X-Maljani-App-Secret': APP_SECRET,
          ...(user?.token ? { Authorization: `Bearer ${user.token}` } : {}),
        };
        const response = await fetch(`${WP_REST_BASE}/maljani/v1/payment-status?${query}`, { headers });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data.error || data.message || 'Payment verification failed.');
        }
        if (cancelled) return;

        if (data.confirmed) {
          setState({ status: 'confirmed', saleId: data.saleId, message: '' });
        } else if (data.failed) {
          setState({ status: 'failed', saleId: data.saleId, message: data.paymentStatus || 'Payment was not completed.' });
        } else {
          setState({ status: 'pending', saleId: data.saleId, message: data.paymentStatus || 'Pesapal is still processing the payment.' });
        }
      } catch (error) {
        if (!cancelled) setState({ status: 'error', saleId: null, message: error.message });
      }
    };

    verifyPayment();
    return () => { cancelled = true; };
  }, [user?.token]);

  const isConfirmed = state.status === 'confirmed';
  const isChecking = state.status === 'checking';

  return (
    <section className="payment-return" aria-live="polite">
      <style>{`
        .payment-return { min-height:70vh; padding:clamp(7rem,12vw,9rem) 1.25rem 5rem; display:grid; place-items:center; }
        .payment-return__panel { width:min(100%,680px); border:1px solid var(--glass-border); border-top:4px solid ${isConfirmed ? '#22c55e' : 'var(--gold)'}; background:var(--glass-bg); padding:clamp(1.5rem,5vw,3rem); box-shadow:0 24px 70px rgba(0,0,0,.18); }
        .payment-return__mark { width:64px; height:64px; display:grid; place-items:center; border-radius:50%; margin-bottom:1.5rem; font-size:30px; font-weight:900; color:${isConfirmed ? '#052e16' : 'var(--white)'}; background:${isConfirmed ? '#86efac' : 'rgba(246,166,35,.16)'}; border:1px solid ${isConfirmed ? '#22c55e' : 'rgba(246,166,35,.45)'}; }
        .payment-return__eyebrow { color:var(--gold); font-size:11px; font-weight:800; text-transform:uppercase; margin-bottom:.65rem; }
        .payment-return h1 { font-family:var(--font-display); font-size:clamp(1.75rem,6vw,3rem); line-height:1.05; margin:0 0 1rem; }
        .payment-return p { color:var(--slate); line-height:1.7; margin:0; }
        .payment-return__steps { display:grid; gap:.75rem; margin:1.75rem 0; padding:1.25rem 0; border-top:1px solid var(--glass-border); border-bottom:1px solid var(--glass-border); }
        .payment-return__step { display:flex; gap:.75rem; align-items:flex-start; color:var(--slate); font-size:13px; }
        .payment-return__actions { display:flex; flex-wrap:wrap; gap:.75rem; }
        .payment-return__actions .btn { min-height:44px; }
      `}</style>
      <div className="payment-return__panel">
        <div className="payment-return__mark" aria-hidden="true">{isChecking ? '…' : isConfirmed ? '✓' : '!'}</div>
        <div className="payment-return__eyebrow">Pesapal payment</div>
        <h1>{isChecking ? 'Confirming your payment' : isConfirmed ? 'Payment confirmed' : state.status === 'pending' ? 'Payment processing' : 'Payment not confirmed'}</h1>
        <p>
          {isChecking
            ? 'Please stay on this page while we verify the transaction directly with Pesapal.'
            : isConfirmed
              ? 'Your payment is complete. Your receipt is ready, and your insurance request has moved to insurer processing.'
              : state.message || 'We could not confirm this payment.'}
        </p>

        {isConfirmed && (
          <div className="payment-return__steps">
            <div className="payment-return__step"><strong>1.</strong><span>Payment receipt is available in your dashboard.</span></div>
            <div className="payment-return__step"><strong>2.</strong><span>Your policy request is being reviewed and prepared for insurer issuance.</span></div>
            <div className="payment-return__step"><strong>3.</strong><span>Your certificate remains accessible from the policy card.</span></div>
          </div>
        )}

        {!isChecking && (
          <div className="payment-return__actions">
            <button className="btn btn--primary" onClick={() => onNavigate('dashboard', null, { openTab: 'policies' })}>
              Open my dashboard
            </button>
            {!isConfirmed && <button className="btn btn--secondary" onClick={() => window.location.reload()}>Check again</button>}
          </div>
        )}
      </div>
    </section>
  );
};

export default PaymentReturn;