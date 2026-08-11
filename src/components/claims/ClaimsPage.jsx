import React, { useEffect, useState } from 'react';
import { useQuery } from 'urql';
import { useAuth } from '../../lib/AuthContext';
import { useResponsive } from '../../lib/useResponsive';

const MY_POLICIES = `
  query RefundEligiblePolicies {
    myPolicySales {
      id policyNumber policyTitle policyInsurerName policyStatus
    }
  }
`;

const REASONS = [
  ['VISA_REJECTION', 'Visa rejection'],
  ['TRIP_CANCELLATION', 'Trip cancellation'],
  ['DUPLICATE_PURCHASE', 'Duplicate purchase'],
  ['OTHER', 'Other'],
];
const INSURERS = ['Jubilee', 'UAP Old Mutual', 'AIG', 'APA', 'Britam', 'CIC'];
const TODAY = new Date().toISOString().slice(0, 10);

const ClaimsPage = () => {
  const { user } = useAuth();
  const { mobile } = useResponsive();
  const [config, setConfig] = useState({ fee: 0, currency: 'KSH', nonce: '' });
  const [reason, setReason] = useState('VISA_REJECTION');
  const [payoutMethod, setPayoutMethod] = useState('MPESA');
  const [selectedPolicy, setSelectedPolicy] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [reference, setReference] = useState('');
  const [{ data: policyData, fetching: policiesLoading }] = useQuery({ query: MY_POLICIES, pause: !user });

  useEffect(() => {
    fetch('/wp-json/maljani/v1/claims/config', { headers: { Accept: 'application/json' } })
      .then((response) => {
        if (!response.ok) throw new Error('Configuration unavailable');
        return response.json();
      })
      .then((data) => setConfig({
        fee: Number(data.fee || 0),
        currency: data.currency || 'KSH',
        nonce: data.nonce || '',
      }))
      .catch(() => setError('The refund service is temporarily unavailable. Please try again shortly.'));
  }, []);

  const activePolicies = (policyData?.myPolicySales || []).filter((policy) =>
    ['active', 'approved', 'confirmed'].includes(String(policy.policyStatus || '').toLowerCase()) && policy.policyNumber
  );
  const chosenPolicy = activePolicies.find((policy) => String(policy.id) === selectedPolicy);
  const feeLabel = config.fee > 0
    ? `${config.currency} ${config.fee.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : 'No fee';

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setReference('');
    if (!config.nonce) {
      setError('The refund service is temporarily unavailable. Please try again shortly.');
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.set('request_type', 'refund');
    formData.set('consent', '1');
    if (chosenPolicy) {
      formData.set('policy_number', chosenPolicy.policyNumber);
      formData.set('insurer_name', chosenPolicy.policyInsurerName || chosenPolicy.policyTitle || 'Unknown insurer');
    }

    setSubmitting(true);
    try {
      const headers = { Accept: 'application/json', 'X-Maljani-Nonce': config.nonce };
      if (user?.token) headers.Authorization = `Bearer ${user.token}`;
      const response = await fetch('/wp-json/maljani/v1/refunds/submit', { method: 'POST', headers, body: formData });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || 'We could not submit your refund request.');
      setReference(result.reference);
      form.reset();
      setSelectedPolicy('');
      setReason('VISA_REJECTION');
      setPayoutMethod('MPESA');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (submissionError) {
      setError(submissionError.message || 'We could not submit your refund request.');
    } finally {
      setSubmitting(false);
    }
  };

  const fieldStyle = {
    width: '100%', minHeight: 48, padding: '12px 14px', borderRadius: 8,
    border: '1px solid var(--glass-border-bright)', background: 'var(--field-bg)',
    color: 'var(--field-text)', fontFamily: 'var(--font-body)', fontSize: 16,
  };
  const labelStyle = { display: 'grid', gap: 7, fontSize: 12, fontWeight: 700, color: 'var(--white)' };
  const gridStyle = { display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: 16 };
  const fullWidthLabel = { ...labelStyle, gridColumn: mobile ? 'auto' : '1 / -1' };

  return (
    <div className="fade-in container" style={{ paddingTop: mobile ? 100 : 126, paddingBottom: 80 }}>
      <style>{`
        .refund-method { position: relative; cursor: pointer; }
        .refund-method input { position: absolute; opacity: 0; pointer-events: none; }
        .refund-method span { display: grid; gap: 4px; min-height: 78px; padding: 16px; border: 1px solid var(--glass-border); border-radius: 8px; background: var(--glass-bg); transition: border-color .2s, background .2s; }
        .refund-method input:checked + span { border-color: var(--gold); background: var(--glass-bg-md); }
        .refund-method input:focus-visible + span { outline: 3px solid rgba(246,166,35,.25); outline-offset: 2px; }
        .refund-method small { color: var(--slate); font-size: 12px; }
        .refund-field:focus { outline: none; border-color: var(--indigo-glow) !important; box-shadow: 0 0 0 3px rgba(49,99,49,.2); }
        .refund-section { padding-top: 28px; margin-top: 28px; border-top: 1px solid var(--glass-border); }
        .refund-spinner { width: 16px; height: 16px; border: 2px solid currentColor; border-right-color: transparent; border-radius: 50%; animation: refund-spin .7s linear infinite; }
        @keyframes refund-spin { to { transform: rotate(360deg); } }
        @media (prefers-reduced-motion: reduce) { .refund-spinner { animation-duration: 1.5s; } }
      `}</style>

      <section style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : 'minmax(0,1.7fr) minmax(240px,.7fr)', gap: 28, alignItems: 'end', marginBottom: 36 }}>
        <div>
          <p className="section-label">Refunds &amp; Cancellations</p>
          <h1 className="section-title" style={{ fontSize: 'clamp(34px,5vw,60px)', maxWidth: 760, marginBottom: 18 }}>Cancel a trip. Start your refund review.</h1>
          <p style={{ color: 'var(--slate)', fontSize: 16, lineHeight: 1.8, maxWidth: 720 }}>Share your policy, cancellation reason, proof, and preferred payout details. TIC-Kenya will review the request and follow up with your insurer.</p>
        </div>
        <aside className="glass-card" style={{ padding: 24, borderLeft: '4px solid var(--gold)' }}>
          <div style={{ color: 'var(--slate)', fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase' }}>Assistance fee</div>
          <strong style={{ display: 'block', margin: '8px 0', color: 'var(--white)', fontFamily: 'var(--font-display)', fontSize: 28 }}>{feeLabel}</strong>
          <p style={{ color: 'var(--slate)', fontSize: 12, lineHeight: 1.6 }}>Insurer eligibility and approval still apply.</p>
        </aside>
      </section>

      {reference && <div role="status" className="glass-card" style={{ padding: 22, marginBottom: 24, borderColor: 'rgba(34,197,94,.45)' }}><strong style={{ color: 'var(--success-text)' }}>Refund request received.</strong><span style={{ display: 'block', marginTop: 5, color: 'var(--slate)' }}>Ticket reference: {reference}. Keep this number for follow-up.</span></div>}
      {error && <div role="alert" style={{ padding: 16, marginBottom: 24, border: '1px solid rgba(239,68,68,.35)', borderRadius: 8, background: 'rgba(239,68,68,.08)', color: '#fca5a5' }}>{error}</div>}

      <form onSubmit={handleSubmit} encType="multipart/form-data" className="glass-card" style={{ padding: mobile ? 20 : 34 }}>
        <section>
          <h2 style={{ fontSize: 22, marginBottom: 6 }}>Policy selection</h2>
          <p style={{ color: 'var(--slate)', fontSize: 13, marginBottom: 20 }}>Choose an active policy or enter external policy details.</p>
          {user && activePolicies.length > 0 ? (
            <label style={labelStyle}>Your active policy<select className="refund-field" style={fieldStyle} value={selectedPolicy} onChange={(event) => setSelectedPolicy(event.target.value)} required><option value="">Select a policy</option>{activePolicies.map((policy) => <option key={policy.id} value={policy.id}>{policy.policyNumber} - {policy.policyInsurerName || policy.policyTitle}</option>)}</select></label>
          ) : (
            <div style={gridStyle}>
              <label style={labelStyle}>Policy number<input className="refund-field" style={fieldStyle} type="text" name="policy_number" required /></label>
              <label style={labelStyle}>Insurer<select className="refund-field" style={fieldStyle} name="insurer_name" defaultValue="" required><option value="" disabled>Select insurer</option>{INSURERS.map((insurer) => <option key={insurer} value={insurer}>{insurer}</option>)}<option value="Other">Other</option></select></label>
            </div>
          )}
          {user && policiesLoading && <p style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--slate)', fontSize: 12, marginTop: 10 }}><span className="refund-spinner" aria-hidden="true" />Loading your active policies...</p>}
          {user && !policiesLoading && activePolicies.length === 0 && <p style={{ color: 'var(--slate)', fontSize: 12, marginTop: 10 }}>No active policy was found, so you can enter the policy manually.</p>}
        </section>

        <section className="refund-section">
          <h2 style={{ fontSize: 22, marginBottom: 6 }}>Cancellation reason &amp; proof</h2>
          <p style={{ color: 'var(--slate)', fontSize: 13, marginBottom: 20 }}>Documents must be PDF, JPG, or PNG and no larger than 5 MB.</p>
          <div style={gridStyle}>
            <label style={labelStyle}>Cancellation date<input className="refund-field" style={fieldStyle} type="date" name="cancellation_date" max={TODAY} defaultValue={TODAY} required /></label>
            <label style={labelStyle}>Reason<select className="refund-field" style={fieldStyle} name="reason" value={reason} onChange={(event) => setReason(event.target.value)} required>{REASONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label style={fullWidthLabel}>{reason === 'VISA_REJECTION' ? 'Visa rejection letter or passport stamp' : 'Supporting proof (optional)'}<input className="refund-field" style={{ ...fieldStyle, padding: 10 }} type="file" name="proof_document" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" required={reason === 'VISA_REJECTION'} /></label>
          </div>
        </section>

        <fieldset className="refund-section" style={{ borderLeft: 0, borderRight: 0, borderBottom: 0 }}>
          <legend style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, marginBottom: 16 }}>Payout method</legend>
          <div style={{ ...gridStyle, marginBottom: 18 }}>
            <label className="refund-method"><input type="radio" name="payout_method" value="MPESA" checked={payoutMethod === 'MPESA'} onChange={() => setPayoutMethod('MPESA')} /><span><strong>M-Pesa</strong><small>Send approved funds to a Safaricom number.</small></span></label>
            <label className="refund-method"><input type="radio" name="payout_method" value="BANK_TRANSFER" checked={payoutMethod === 'BANK_TRANSFER'} onChange={() => setPayoutMethod('BANK_TRANSFER')} /><span><strong>Bank transfer</strong><small>Send approved funds to a Kenyan bank account.</small></span></label>
          </div>
          {payoutMethod === 'MPESA' ? (
            <label style={labelStyle}>Safaricom mobile number<input className="refund-field" style={fieldStyle} type="tel" name="mpesa_phone" autoComplete="tel" placeholder="07XX XXX XXX" required /></label>
          ) : (
            <div style={gridStyle}>
              <label style={labelStyle}>Bank name<input className="refund-field" style={fieldStyle} type="text" name="bank_name" autoComplete="organization" required /></label>
              <label style={labelStyle}>Account name<input className="refund-field" style={fieldStyle} type="text" name="bank_account_name" autoComplete="name" required /></label>
              <label style={labelStyle}>Account number<input className="refund-field" style={fieldStyle} type="text" name="bank_account_number" inputMode="numeric" required /></label>
              <label style={labelStyle}>Branch<input className="refund-field" style={fieldStyle} type="text" name="bank_branch" required /></label>
            </div>
          )}
        </fieldset>

        <section className="refund-section">
          <h2 style={{ fontSize: 22, marginBottom: 6 }}>Contact information</h2>
          <p style={{ color: 'var(--slate)', fontSize: 13, marginBottom: 20 }}>We will use these details for review updates.</p>
          <div style={gridStyle}>
            <label style={labelStyle}>Full name<input className="refund-field" style={fieldStyle} type="text" name="client_name" autoComplete="name" required defaultValue={user?.name || ''} /></label>
            <label style={labelStyle}>Email address<input className="refund-field" style={fieldStyle} type="email" name="client_email" autoComplete="email" required defaultValue={user?.email || ''} /></label>
            <label style={fullWidthLabel}>Phone number<input className="refund-field" style={fieldStyle} type="tel" name="client_phone" autoComplete="tel" required defaultValue={user?.phone || ''} /></label>
          </div>
        </section>

        <div style={{ marginTop: 28, paddingTop: 24, borderTop: '1px solid var(--glass-border)' }}>
          <label style={{ display: 'flex', gap: 12, alignItems: 'flex-start', color: 'var(--slate)', fontSize: 13, lineHeight: 1.7 }}><input type="checkbox" required style={{ width: 20, height: 20, marginTop: 2, flex: '0 0 auto', accentColor: 'var(--indigo)' }} /><span>I confirm these details are accurate and authorize TIC-Kenya to submit and follow up on this cancellation and refund request. Insurer approval is not guaranteed.</span></label>
          <button type="submit" className="btn btn--primary" disabled={submitting || !config.nonce} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 9, marginTop: 22, minHeight: 48, minWidth: 210, opacity: submitting || !config.nonce ? .65 : 1 }}>{submitting && <span className="refund-spinner" aria-hidden="true" />}{submitting ? 'Submitting request...' : 'Submit refund request'}</button>
        </div>
      </form>
    </div>
  );
};

export default ClaimsPage;
