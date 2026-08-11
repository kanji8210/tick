import React, { useEffect, useState } from 'react';
import { useQuery } from 'urql';
import { useAuth } from '../../lib/AuthContext';
import { useResponsive } from '../../lib/useResponsive';

const MY_POLICIES = `
  query ClaimEligiblePolicies {
    myPolicySales {
      id policyNumber policyTitle policyInsurerName policyStatus
    }
  }
`;

const CLAIM_TYPES = [
  ['MEDICAL_EXPENSE', 'Medical expense'],
  ['LOST_LUGGAGE', 'Lost or delayed luggage'],
  ['FLIGHT_DELAY', 'Flight delay or cancellation'],
  ['TRIP_INTERRUPTION', 'Trip interruption'],
  ['PERSONAL_ACCIDENT', 'Personal accident'],
  ['OTHER', 'Other insured event'],
];
const INSURERS = ['Jubilee', 'UAP Old Mutual', 'AIG', 'APA', 'Britam', 'CIC'];
const STEPS = ['Policy', 'Incident', 'Documents', 'Review', 'Contact'];
const TODAY = new Date().toISOString().slice(0, 10);
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_FILES = 8;

const ClaimSupportPage = () => {
  const { user } = useAuth();
  const { mobile } = useResponsive();
  const [step, setStep] = useState(0);
  const [config, setConfig] = useState({ fee: 0, currency: 'KES', nonce: '' });
  const [selectedPolicy, setSelectedPolicy] = useState('');
  const [formValues, setFormValues] = useState({
    policy_number: '', insurer_name: '', incident_date: TODAY,
    claim_type: 'MEDICAL_EXPENSE', description: '',
    client_name: user?.name || '', client_email: user?.email || '', client_phone: user?.phone || '',
  });
  const [documents, setDocuments] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [reference, setReference] = useState('');
  const [checkout, setCheckout] = useState(null);
  const [{ data: policyData, fetching: policiesLoading }] = useQuery({ query: MY_POLICIES, pause: !user });

  useEffect(() => {
    fetch('/wp-json/maljani/v1/admin/claim-fees', { headers: { Accept: 'application/json' } })
      .then((response) => {
        if (!response.ok) throw new Error('Configuration unavailable');
        return response.json();
      })
      .then((data) => setConfig({
        fee: Number(data.fee_amount ?? data.fee ?? 0),
        currency: data.currency || 'KES',
        nonce: data.nonce || '',
      }))
      .catch(() => setError('Claims support is temporarily unavailable. Please try again shortly.'));
  }, []);

  const activePolicies = (policyData?.myPolicySales || []).filter((policy) =>
    ['active', 'approved', 'confirmed'].includes(String(policy.policyStatus || '').toLowerCase()) && policy.policyNumber
  );
  const chosenPolicy = activePolicies.find((policy) => String(policy.id) === selectedPolicy);
  const feeLabel = config.fee > 0
    ? `${config.currency} ${config.fee.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : 'No service fee';

  const updateValue = (event) => setFormValues((current) => ({ ...current, [event.target.name]: event.target.value }));

  const validateStep = () => {
    const policyNumber = chosenPolicy?.policyNumber || formValues.policy_number.trim();
    const insurerName = chosenPolicy?.policyInsurerName || chosenPolicy?.policyTitle || formValues.insurer_name.trim();
    if (step === 0 && (!policyNumber || !insurerName)) return 'Select a policy or complete both policy fields.';
    if (step === 1 && (!formValues.incident_date || !formValues.claim_type || formValues.description.trim().length < 20)) return 'Add the incident date, type, and a description of at least 20 characters.';
    if (step === 2 && documents.length === 0) return 'Add at least one supporting document.';
    if (step === 4 && (!formValues.client_name.trim() || !formValues.client_email.trim() || !formValues.client_phone.trim())) return 'Complete all contact fields.';
    return '';
  };

  const nextStep = () => {
    const message = validateStep();
    if (message) {
      setError(message);
      return;
    }
    setError('');
    setStep((current) => Math.min(current + 1, STEPS.length - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const addDocuments = (event) => {
    const incoming = Array.from(event.target.files || []);
    setError('');
    if (documents.length + incoming.length > MAX_FILES) {
      setError(`Upload no more than ${MAX_FILES} documents.`);
      event.target.value = '';
      return;
    }
    const invalid = incoming.find((file) => file.size > MAX_FILE_SIZE || !['application/pdf', 'image/jpeg', 'image/png'].includes(file.type));
    if (invalid) {
      setError('Each document must be a PDF, JPG, or PNG no larger than 5 MB.');
      event.target.value = '';
      return;
    }
    setDocuments((current) => [...current, ...incoming]);
    event.target.value = '';
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const message = validateStep();
    if (message) {
      setError(message);
      return;
    }
    if (!config.nonce) {
      setError('Claims support is temporarily unavailable. Please try again shortly.');
      return;
    }

    const formData = new FormData();
    Object.entries(formValues).forEach(([key, value]) => formData.set(key, value));
    formData.set('request_type', 'claim');
    formData.set('consent', '1');
    formData.set('policy_number', chosenPolicy?.policyNumber || formValues.policy_number);
    formData.set('insurer_name', chosenPolicy?.policyInsurerName || chosenPolicy?.policyTitle || formValues.insurer_name);
    documents.forEach((document) => formData.append('supporting_documents[]', document));

    setSubmitting(true);
    setError('');
    try {
      const headers = { Accept: 'application/json', 'X-Maljani-Nonce': config.nonce };
      if (user?.token) headers.Authorization = `Bearer ${user.token}`;
      const response = await fetch('/wp-json/maljani/v1/claims/submit', { method: 'POST', headers, body: formData });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || 'We could not submit your claim.');
      setReference(result.reference);
      setCheckout(result.checkout || null);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (submissionError) {
      setError(submissionError.message || 'We could not submit your claim.');
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
  const sectionTitle = { fontSize: 24, marginBottom: 8 };

  if (reference) {
    return (
      <div className="fade-in container" style={{ paddingTop: mobile ? 108 : 142, paddingBottom: 90, maxWidth: 820 }}>
        <section className="glass-card" role="status" style={{ padding: mobile ? 24 : 42, borderTop: '4px solid var(--gold)', textAlign: 'center' }}>
          <div style={{ width: 58, height: 58, borderRadius: '50%', display: 'grid', placeItems: 'center', margin: '0 auto 20px', background: 'rgba(34,197,94,.14)', color: '#6ee7b7', fontSize: 28 }} aria-hidden="true">✓</div>
          <p className="section-label">Claim received</p>
          <h1 style={{ fontSize: 'clamp(30px,5vw,48px)', marginBottom: 12 }}>Your support ticket is open.</h1>
          <p style={{ color: 'var(--slate)', lineHeight: 1.7 }}>Reference <strong style={{ color: 'var(--white)' }}>{reference}</strong>. Keep it for follow-up with the TIC-Kenya claims desk.</p>
          <div style={{ margin: '26px auto 0', padding: 18, maxWidth: 520, border: '1px solid var(--glass-border)', borderRadius: 8, textAlign: 'left' }}>
            <strong style={{ display: 'block', marginBottom: 6 }}>{config.fee > 0 ? 'Service fee payment pending' : 'No service fee required'}</strong>
            <span style={{ color: 'var(--slate)', fontSize: 13 }}>{config.fee > 0 ? `${feeLabel} must be paid before processing begins.` : 'Our team can begin reviewing your documents.'}</span>
            {checkout?.payment_url && <a className="btn btn--primary" href={checkout.payment_url} style={{ display: 'inline-flex', marginTop: 16 }}>Proceed to payment</a>}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="fade-in container" style={{ paddingTop: mobile ? 100 : 126, paddingBottom: 80 }}>
      <style>{`
        .claim-step { display:grid; place-items:center; gap:7px; min-width:0; color:var(--slate); font-size:11px; font-weight:700; }
        .claim-step span { width:32px; height:32px; display:grid; place-items:center; border:1px solid var(--glass-border-bright); border-radius:50%; background:var(--glass-bg); }
        .claim-step.is-active { color:var(--white); }
        .claim-step.is-active span { border-color:var(--gold); background:var(--gold); color:var(--navy); }
        .claim-field:focus { outline:none; border-color:var(--indigo-glow) !important; box-shadow:0 0 0 3px rgba(49,99,49,.2); }
        .claim-upload { display:grid; place-items:center; min-height:180px; padding:24px; border:1px dashed var(--glass-border-bright); border-radius:8px; background:var(--glass-bg); text-align:center; cursor:pointer; }
        .claim-upload:focus-within { outline:3px solid rgba(246,166,35,.25); outline-offset:2px; }
        .claim-spinner { width:16px; height:16px; border:2px solid currentColor; border-right-color:transparent; border-radius:50%; animation:claim-spin .7s linear infinite; }
        @keyframes claim-spin { to { transform:rotate(360deg); } }
        @media (prefers-reduced-motion:reduce) { .claim-spinner { animation-duration:1.5s; } }
      `}</style>

      <section style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : 'minmax(0,1.7fr) minmax(240px,.7fr)', gap: 28, alignItems: 'end', marginBottom: 30 }}>
        <div>
          <p className="section-label">Claims support</p>
          <h1 className="section-title" style={{ fontSize: 'clamp(34px,5vw,58px)', maxWidth: 760, marginBottom: 16 }}>Put an experienced claims desk on your side.</h1>
          <p style={{ color: 'var(--slate)', fontSize: 16, lineHeight: 1.8, maxWidth: 720 }}>Send us the incident details and evidence. We will prepare, submit, and follow up on your travel insurance claim.</p>
        </div>
        <aside className="glass-card" style={{ padding: 24, borderLeft: '4px solid var(--gold)' }}>
          <div style={{ color: 'var(--slate)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Processing fee</div>
          <strong style={{ display: 'block', margin: '8px 0', color: 'var(--white)', fontFamily: 'var(--font-display)', fontSize: 28 }}>{feeLabel}</strong>
          <p style={{ color: 'var(--slate)', fontSize: 12, lineHeight: 1.6 }}>Fixed at submission from the active backend configuration.</p>
        </aside>
      </section>

      <ol aria-label="Claim submission progress" style={{ display: 'grid', gridTemplateColumns: `repeat(${STEPS.length}, minmax(0,1fr))`, gap: 6, listStyle: 'none', padding: mobile ? '16px 4px' : '18px 24px', margin: '0 0 22px', borderBlock: '1px solid var(--glass-border)' }}>
        {STEPS.map((label, index) => <li key={label} className={`claim-step${index === step ? ' is-active' : ''}`} aria-current={index === step ? 'step' : undefined}><span>{index + 1}</span>{!mobile && label}</li>)}
      </ol>

      {error && <div role="alert" style={{ padding: 16, marginBottom: 20, border: '1px solid rgba(239,68,68,.35)', borderRadius: 8, background: 'rgba(239,68,68,.08)', color: '#fca5a5' }}>{error}</div>}

      <form onSubmit={handleSubmit} className="glass-card" style={{ padding: mobile ? 20 : 34 }}>
        {step === 0 && <section><h2 style={sectionTitle}>Policy &amp; insurer details</h2><p style={{ color: 'var(--slate)', fontSize: 13, marginBottom: 22 }}>Choose an active TIC-Kenya policy or enter an external policy.</p>{user && activePolicies.length > 0 ? <label style={labelStyle}>Your active policy<select className="claim-field" style={fieldStyle} value={selectedPolicy} onChange={(event) => setSelectedPolicy(event.target.value)}><option value="">Select a policy</option>{activePolicies.map((policy) => <option key={policy.id} value={policy.id}>{policy.policyNumber} - {policy.policyInsurerName || policy.policyTitle}</option>)}</select></label> : <div style={gridStyle}><label style={labelStyle}>Policy number<input className="claim-field" style={fieldStyle} name="policy_number" value={formValues.policy_number} onChange={updateValue} /></label><label style={labelStyle}>Insurer<select className="claim-field" style={fieldStyle} name="insurer_name" value={formValues.insurer_name} onChange={updateValue}><option value="">Select insurer</option>{INSURERS.map((insurer) => <option key={insurer}>{insurer}</option>)}<option>Other</option></select></label></div>}{user && policiesLoading && <p style={{ display: 'flex', gap: 8, marginTop: 12, color: 'var(--slate)', fontSize: 12 }}><span className="claim-spinner" />Loading active policies...</p>}{user && !policiesLoading && activePolicies.length === 0 && <p style={{ color: 'var(--slate)', fontSize: 12, marginTop: 12 }}>No active policy was found. Enter the external policy details above.</p>}</section>}

        {step === 1 && <section><h2 style={sectionTitle}>Claim incident</h2><p style={{ color: 'var(--slate)', fontSize: 13, marginBottom: 22 }}>Tell us what happened with enough detail to begin the claim.</p><div style={gridStyle}><label style={labelStyle}>Incident date<input className="claim-field" style={fieldStyle} type="date" name="incident_date" max={TODAY} value={formValues.incident_date} onChange={updateValue} /></label><label style={labelStyle}>Incident type<select className="claim-field" style={fieldStyle} name="claim_type" value={formValues.claim_type} onChange={updateValue}>{CLAIM_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label style={{ ...labelStyle, gridColumn: mobile ? 'auto' : '1 / -1' }}>What happened?<textarea className="claim-field" style={{ ...fieldStyle, minHeight: 150, resize: 'vertical' }} name="description" value={formValues.description} onChange={updateValue} placeholder="Include the location, people involved, treatment or airline response, and any reference numbers." /></label></div></section>}

        {step === 2 && <section><h2 style={sectionTitle}>Supporting documents</h2><p style={{ color: 'var(--slate)', fontSize: 13, marginBottom: 20 }}>Upload hospital bills, police abstracts, airline reports, boarding passes, or receipts. PDF, JPG, or PNG; 5 MB each.</p><label className="claim-upload"><input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={addDocuments} style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }} /><strong style={{ fontSize: 16, marginBottom: 7 }}>Choose supporting evidence</strong><span style={{ color: 'var(--slate)', fontSize: 12 }}>Up to {MAX_FILES} documents</span></label>{documents.length > 0 && <ul style={{ listStyle: 'none', padding: 0, margin: '18px 0 0', display: 'grid', gap: 8 }}>{documents.map((document) => <li key={`${document.name}-${document.lastModified}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 12px', border: '1px solid var(--glass-border)', borderRadius: 8 }}><span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--white)', fontSize: 13 }}>{document.name}</span><button type="button" aria-label={`Remove ${document.name}`} onClick={() => setDocuments((current) => current.filter((item) => item !== document))} style={{ minWidth: 44, minHeight: 44, border: 0, background: 'transparent', color: '#fca5a5', cursor: 'pointer' }}>Remove</button></li>)}</ul>}</section>}

        {step === 3 && <section><h2 style={sectionTitle}>Review &amp; service fee</h2><p style={{ color: 'var(--slate)', fontSize: 13, marginBottom: 20 }}>Confirm the intake summary before adding contact details.</p><div style={{ display: 'grid', gap: 1, background: 'var(--glass-border)', border: '1px solid var(--glass-border)', borderRadius: 8, overflow: 'hidden' }}>{[['Policy', chosenPolicy?.policyNumber || formValues.policy_number], ['Insurer', chosenPolicy?.policyInsurerName || chosenPolicy?.policyTitle || formValues.insurer_name], ['Claim type', CLAIM_TYPES.find(([value]) => value === formValues.claim_type)?.[1]], ['Incident date', formValues.incident_date], ['Documents', `${documents.length} attached`], ['Service fee', feeLabel]].map(([label, value]) => <div key={label} style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : 'minmax(140px,.35fr) 1fr', gap: 8, padding: 14, background: 'var(--field-bg)' }}><strong style={{ fontSize: 12, color: 'var(--slate)' }}>{label}</strong><span style={{ color: 'var(--white)', fontSize: 14 }}>{value}</span></div>)}</div>{config.fee > 0 && <p style={{ marginTop: 18, padding: 14, borderLeft: '3px solid var(--gold)', color: 'var(--slate)', fontSize: 13, lineHeight: 1.7 }}>Submission creates a ticket with payment status Pending. Processing begins after the {feeLabel} service fee is paid.</p>}</section>}

        {step === 4 && <section><h2 style={sectionTitle}>Contact &amp; submission</h2><p style={{ color: 'var(--slate)', fontSize: 13, marginBottom: 20 }}>We will use these details for document queries and insurer updates.</p><div style={gridStyle}><label style={labelStyle}>Full name<input className="claim-field" style={fieldStyle} name="client_name" autoComplete="name" value={formValues.client_name} onChange={updateValue} /></label><label style={labelStyle}>Email address<input className="claim-field" style={fieldStyle} type="email" name="client_email" autoComplete="email" value={formValues.client_email} onChange={updateValue} /></label><label style={{ ...labelStyle, gridColumn: mobile ? 'auto' : '1 / -1' }}>Phone number<input className="claim-field" style={fieldStyle} type="tel" name="client_phone" autoComplete="tel" value={formValues.client_phone} onChange={updateValue} /></label></div><label style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginTop: 22, color: 'var(--slate)', fontSize: 13, lineHeight: 1.7 }}><input type="checkbox" required style={{ width: 20, height: 20, marginTop: 2, flex: '0 0 auto', accentColor: 'var(--indigo)' }} /><span>I confirm the information is accurate and authorize TIC-Kenya to prepare, submit, and follow up on this claim. Insurer approval is not guaranteed.</span></label></section>}

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 30, paddingTop: 22, borderTop: '1px solid var(--glass-border)' }}>
          <button type="button" className="btn btn--ghost" disabled={step === 0 || submitting} onClick={() => { setError(''); setStep((current) => Math.max(0, current - 1)); }} style={{ minHeight: 48, visibility: step === 0 ? 'hidden' : 'visible' }}>Back</button>
          {step < STEPS.length - 1 ? <button type="button" className="btn btn--primary" onClick={nextStep} style={{ minHeight: 48 }}>Continue</button> : <button type="submit" className="btn btn--primary" disabled={submitting || !config.nonce} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 48, opacity: submitting || !config.nonce ? .65 : 1 }}>{submitting && <span className="claim-spinner" />}{submitting ? 'Creating ticket...' : config.fee > 0 ? 'Submit & proceed to payment' : 'Submit claim'}</button>}
        </div>
      </form>
    </div>
  );
};

export default ClaimSupportPage;