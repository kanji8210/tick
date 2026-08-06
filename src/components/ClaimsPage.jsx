import React, { useEffect, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { useResponsive } from '../lib/useResponsive';

const INITIAL_CONFIG = { fee: 0, currency: 'KSH', nonce: '' };

const ClaimsPage = () => {
  const { user } = useAuth();
  const { mobile } = useResponsive();
  const [config, setConfig] = useState(INITIAL_CONFIG);
  const [configError, setConfigError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [reference, setReference] = useState('');

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
      .catch(() => setConfigError(true));
  }, []);

  const feeLabel = config.fee > 0
    ? `${config.currency} ${config.fee.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : 'No fee';

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setReference('');

    if (!config.nonce) {
      setError('The claims service is temporarily unavailable. Please try again shortly.');
      return;
    }

    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    data.consent = data.consent === '1';

    setSubmitting(true);
    try {
      const response = await fetch('/wp-json/maljani/v1/claims', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-Maljani-Nonce': config.nonce,
        },
        body: JSON.stringify(data),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || 'We could not submit your request.');

      setReference(result.reference);
      form.reset();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (submissionError) {
      setError(submissionError.message || 'We could not submit your request.');
    } finally {
      setSubmitting(false);
    }
  };

  const fieldStyle = {
    width: '100%', minHeight: 48, padding: '12px 14px', borderRadius: 10,
    border: '1px solid var(--glass-border-bright)', background: 'var(--field-bg)',
    color: 'var(--field-text)', fontFamily: 'var(--font-body)', fontSize: 16,
  };
  const labelStyle = { display: 'grid', gap: 7, fontSize: 12, fontWeight: 700, color: 'var(--white)' };

  return (
    <div className="fade-in container" style={{ paddingTop: mobile ? 100 : 130, paddingBottom: 80 }}>
      <style>{`
        .claims-choice { position: relative; cursor: pointer; }
        .claims-choice input { position: absolute; opacity: 0; pointer-events: none; }
        .claims-choice span { display: grid; gap: 5px; min-height: 92px; padding: 18px; border: 1px solid var(--glass-border); border-radius: var(--radius-md); background: var(--glass-bg); transition: border-color .2s, background .2s; }
        .claims-choice input:checked + span { border-color: var(--gold); background: var(--glass-bg-md); }
        .claims-choice input:focus-visible + span { outline: 3px solid rgba(246,166,35,.25); outline-offset: 2px; }
        .claims-choice small { color: var(--slate); font-size: 12px; line-height: 1.5; }
        .claims-field:focus { outline: none; border-color: var(--indigo-glow) !important; box-shadow: 0 0 0 3px rgba(49,99,49,.2); }
      `}</style>

      <section style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : 'minmax(0,1.7fr) minmax(240px,.7fr)', gap: 28, alignItems: 'end', marginBottom: 36 }}>
        <div>
          <p className="section-label">Claims &amp; Refunds</p>
          <h1 className="section-title" style={{ fontSize: 'clamp(34px,5vw,64px)', maxWidth: 760, marginBottom: 18 }}>
            We handle the follow-up. You focus on recovery.
          </h1>
          <p style={{ color: 'var(--slate)', fontSize: 16, lineHeight: 1.8, maxWidth: 720 }}>
            Tell us what happened and our team will review your cover, prepare the request, and follow up with the insurer on your behalf.
          </p>
        </div>
        <aside className="glass-card" style={{ padding: 24, borderLeft: '4px solid var(--gold)' }}>
          <div style={{ color: 'var(--slate)', fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase' }}>Assistance fee</div>
          <strong style={{ display: 'block', margin: '8px 0', color: 'var(--white)', fontFamily: 'var(--font-display)', fontSize: 28 }}>{feeLabel}</strong>
          <p style={{ color: 'var(--slate)', fontSize: 12, lineHeight: 1.6 }}>Charged for processing and follow-up, not for the insurer payout.</p>
        </aside>
      </section>

      {reference && (
        <div role="status" className="glass-card" style={{ padding: 20, marginBottom: 24, borderColor: 'rgba(34,197,94,.45)' }}>
          <strong style={{ color: 'var(--success-text)' }}>Request received.</strong>
          <span style={{ display: 'block', marginTop: 4, color: 'var(--slate)' }}>Your reference is {reference}. Our team will contact you with the next steps.</span>
        </div>
      )}
      {(error || configError) && (
        <div role="alert" style={{ padding: 16, marginBottom: 24, border: '1px solid rgba(239,68,68,.35)', borderRadius: 10, background: 'rgba(239,68,68,.08)', color: '#fca5a5' }}>
          {error || 'Fee information is temporarily unavailable. Please refresh the page.'}
        </div>
      )}

      <form onSubmit={handleSubmit} className="glass-card" style={{ padding: mobile ? 20 : 34 }}>
        <fieldset style={{ border: 0, marginBottom: 36 }}>
          <legend style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, marginBottom: 16 }}>What can we help with?</legend>
          <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: 12 }}>
            <label className="claims-choice"><input type="radio" name="request_type" value="claim" defaultChecked /><span><strong>Insurance claim</strong><small>Medical, baggage, delay, cancellation, or another insured event.</small></span></label>
            <label className="claims-choice"><input type="radio" name="request_type" value="refund" /><span><strong>Premium refund</strong><small>Request a cancellation or eligible premium refund.</small></span></label>
          </div>
        </fieldset>

        <section style={{ marginBottom: 36 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, marginBottom: 6 }}>Client details</h2>
          <p style={{ color: 'var(--slate)', fontSize: 13, marginBottom: 20 }}>How we can identify and contact you.</p>
          <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: 16 }}>
            <label style={labelStyle}>Full name<input className="claims-field" style={fieldStyle} type="text" name="client_name" autoComplete="name" required defaultValue={user?.name || ''} /></label>
            <label style={labelStyle}>Email address<input className="claims-field" style={fieldStyle} type="email" name="client_email" autoComplete="email" required defaultValue={user?.email || ''} /></label>
            <label style={labelStyle}>Phone number<input className="claims-field" style={fieldStyle} type="tel" name="client_phone" autoComplete="tel" required defaultValue={user?.phone || ''} /></label>
            <label style={labelStyle}>Policy number<input className="claims-field" style={fieldStyle} type="text" name="policy_number" required /></label>
            <label style={{ ...labelStyle, gridColumn: mobile ? 'auto' : '1 / -1' }}>Insurer<input className="claims-field" style={fieldStyle} type="text" name="insurer_name" required /></label>
          </div>
        </section>

        <section style={{ paddingTop: 30, borderTop: '1px solid var(--glass-border)' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, marginBottom: 6 }}>Request details</h2>
          <p style={{ color: 'var(--slate)', fontSize: 13, marginBottom: 20 }}>Give us enough context for the first review. We will request documents privately.</p>
          <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: 16 }}>
            <label style={labelStyle}>Incident or cancellation date<input className="claims-field" style={fieldStyle} type="date" name="incident_date" max={new Date().toISOString().slice(0, 10)} /></label>
            <label style={labelStyle}>Reason or incident type<input className="claims-field" style={fieldStyle} type="text" name="incident_type" placeholder="e.g. Medical emergency" /></label>
            <label style={labelStyle}>Amount requested<input className="claims-field" style={fieldStyle} type="number" name="requested_amount" min="0" step="0.01" inputMode="decimal" /></label>
            <label style={labelStyle}>Currency<select className="claims-field" style={fieldStyle} name="currency" defaultValue="KSH"><option value="KSH">KSH</option><option value="USD">USD</option><option value="EUR">EUR</option><option value="GBP">GBP</option></select></label>
            <label style={{ ...labelStyle, gridColumn: mobile ? 'auto' : '1 / -1' }}>What happened?<textarea className="claims-field" style={{ ...fieldStyle, minHeight: 140, resize: 'vertical' }} name="description" required placeholder="Include the event, location, people involved, and any contact already made with the insurer." /></label>
          </div>
        </section>

        <div style={{ marginTop: 28, paddingTop: 24, borderTop: '1px solid var(--glass-border)' }}>
          <label style={{ display: 'flex', gap: 12, alignItems: 'flex-start', color: 'var(--slate)', fontSize: 13, lineHeight: 1.7 }}>
            <input type="checkbox" name="consent" value="1" required style={{ width: 20, height: 20, marginTop: 2, flex: '0 0 auto', accentColor: 'var(--indigo)' }} />
            <span>I authorize TIC-Kenya to contact the insurer and act on my behalf. I understand the disclosed assistance fee is {config.fee > 0 ? feeLabel : 'zero'} and insurer approval or payment is not guaranteed.</span>
          </label>
          <button type="submit" className="btn btn--primary" disabled={submitting || !config.nonce} style={{ marginTop: 22, minHeight: 48, minWidth: 190, opacity: submitting || !config.nonce ? .65 : 1 }}>
            {submitting ? 'Submitting…' : 'Submit for review'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ClaimsPage;
