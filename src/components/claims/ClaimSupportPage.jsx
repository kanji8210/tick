import React, { useEffect, useState } from 'react';
import { useQuery } from 'urql';
import { useAuth } from '../../lib/AuthContext';
import { useResponsive } from '../../lib/useResponsive';

const MY_POLICIES = `
  query ClaimEligiblePolicies {
    myPolicySales {
      id policyNumber policyTitle policyInsurerName policyStatus paymentStatus
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

const CLAIM_DOCUMENT_FIELDS = [
  {
    key: 'completed_claim_form',
    label: 'Completed claim form',
    description: 'Download the insurer form, complete it, then upload the signed and scanned copy.',
    multiple: false,
  },
  {
    key: 'policy_copy',
    label: 'Copy of insurance policy',
    description: 'Upload the policy document issued for this trip.',
    multiple: false,
  },
  {
    key: 'loss_letter',
    label: 'Detailed loss or damage letter',
    description: 'Explain the event, the loss, and the timeline in a signed letter.',
    multiple: false,
  },
  {
    key: 'passport_pages',
    label: 'Passport first page and exit/entry dates',
    description: 'Upload the bio page and the relevant travel stamps or visa pages.',
    multiple: true,
  },
  {
    key: 'receipts',
    label: 'Receipts for incurred costs',
    description: 'Scans or clear photos of the original official receipts. Keep the originals.',
    multiple: true,
  },
  {
    key: 'contents_list',
    label: 'List of contents',
    description: 'Provide the itemized contents involved in the claim.',
    multiple: false,
  },
  {
    key: 'residence_proof',
    label: 'Proof of residence',
    description: 'Proof of residence in the country where the policy was issued.',
    multiple: false,
  },
];

const STEPS = ['Policy', 'Incident', 'Documents', 'Payout', 'Review'];
const TODAY = new Date().toISOString().slice(0, 10);
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const ACCEPTED_FILE_INPUT = '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png';
const DEFAULT_MAX_DOCUMENTS = 16;
const ELIGIBLE_POLICY_STATUSES = ['active', 'approved', 'confirmed', 'verification_ready'];
const CONFIRMED_PAYMENT_STATUSES = ['confirmed', 'paid'];

const isEligibleOwnedPolicy = (policy) => {
  const policyStatus = String(policy?.policyStatus || '').toLowerCase();
  const paymentStatus = String(policy?.paymentStatus || '').toLowerCase();
  return Boolean(policy?.policyNumber) && (
    ELIGIBLE_POLICY_STATUSES.includes(policyStatus) || CONFIRMED_PAYMENT_STATUSES.includes(paymentStatus)
  );
};

const createEmptyDocuments = () => CLAIM_DOCUMENT_FIELDS.reduce((accumulator, field) => {
  accumulator[field.key] = [];
  return accumulator;
}, {});

const ClaimDocumentField = ({
  field,
  files,
  onAdd,
  onRemove,
}) => (
  <div style={{ display: 'grid', gap: 14, padding: 18, border: '1px solid var(--glass-border)', borderRadius: 8, background: 'var(--glass-bg)' }}>
    <div style={{ display: 'grid', gap: 5 }}>
      <strong style={{ color: 'var(--white)', fontSize: 15 }}>{field.label}</strong>
      <p style={{ color: 'var(--slate)', fontSize: 12, lineHeight: 1.7, margin: 0 }}>{field.description}</p>
    </div>
    <label className="claim-upload" style={{ minHeight: 120, position: 'relative' }}>
      <input
        type="file"
        accept={ACCEPTED_FILE_INPUT}
        multiple={field.multiple}
        onChange={onAdd}
        style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }}
      />
      <strong style={{ fontSize: 15, marginBottom: 7 }}>Upload {field.label.toLowerCase()}</strong>
      <span style={{ color: 'var(--slate)', fontSize: 12 }}>
        {field.multiple ? 'Multiple files allowed' : 'One file required'} · PDF, JPG, or PNG · 5 MB each
      </span>
    </label>
    {files.length > 0 && (
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
        {files.map((file, index) => (
          <li
            key={`${field.key}-${file.name}-${file.lastModified}-${index}`}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 12px', border: '1px solid var(--glass-border)', borderRadius: 8 }}
          >
            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--white)', fontSize: 13 }}>
              {file.name}
            </span>
            <button
              type="button"
              aria-label={`Remove ${file.name}`}
              onClick={() => onRemove(index)}
              style={{ minWidth: 44, minHeight: 44, border: 0, background: 'transparent', color: '#fca5a5', cursor: 'pointer' }}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
    )}
  </div>
);

const ClaimSupportPage = ({ initialContext }) => {
  const { user } = useAuth();
  const { mobile } = useResponsive();
  const [step, setStep] = useState(0);
  const [config, setConfig] = useState({
    fee: 0,
    currency: 'KES',
    nonce: '',
    claimFormUrl: '',
    claimFormLabel: '',
    claimDocumentsMax: DEFAULT_MAX_DOCUMENTS,
    insurers: [],
  });
  const [selectedPolicy, setSelectedPolicy] = useState('');
  const [useExternalPolicy, setUseExternalPolicy] = useState(Boolean(initialContext?.externalPolicy));
  const [selectedInsurer, setSelectedInsurer] = useState('');
  const [payoutMethod, setPayoutMethod] = useState('MPESA');
  const [formValues, setFormValues] = useState({
    policy_number: '',
    incident_date: TODAY,
    claim_type: 'MEDICAL_EXPENSE',
    description: '',
    client_name: user?.name || '',
    client_email: user?.email || '',
    client_phone: user?.phone || '',
    mpesa_phone: user?.phone || '',
    bank_name: '',
    bank_account_name: '',
    bank_account_number: '',
    bank_branch: '',
  });
  const [claimDocuments, setClaimDocuments] = useState(createEmptyDocuments);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [reference, setReference] = useState('');
  const [checkout, setCheckout] = useState(null);
  const [{ data: policyData, fetching: policiesLoading }] = useQuery({ query: MY_POLICIES, pause: !user });

  useEffect(() => {
    setFormValues((current) => ({
      ...current,
      client_name: current.client_name || user?.name || '',
      client_email: current.client_email || user?.email || '',
      client_phone: current.client_phone || user?.phone || '',
      mpesa_phone: current.mpesa_phone || user?.phone || '',
    }));
  }, [user]);

  const activePolicies = (policyData?.myPolicySales || []).filter(isEligibleOwnedPolicy);
  const chosenPolicy = useExternalPolicy ? null : activePolicies.find((policy) => String(policy.id) === selectedPolicy);
  const activeInsurerName = (chosenPolicy?.policyInsurerName || chosenPolicy?.policyTitle || selectedInsurer || '').trim();
  const insurerOptions = Array.from(new Set([
    ...config.insurers,
    ...(policyData?.myPolicySales || []).map((policy) => policy.policyInsurerName || policy.policyTitle).filter(Boolean),
  ])).sort((a, b) => a.localeCompare(b));

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (activeInsurerName) {
      params.set('insurer_name', activeInsurerName);
    }

    fetch(`/wp-json/maljani/v1/claims/config${params.toString() ? `?${params.toString()}` : ''}`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error('Configuration unavailable');
        }
        return response.json();
      })
      .then((data) => {
        if (cancelled) return;
        setConfig({
          fee: Number(data.fee_amount ?? data.fee ?? 0),
          currency: data.currency || 'KES',
          nonce: data.nonce || '',
          claimFormUrl: data.claim_form_url || '',
          claimFormLabel: data.claim_form_label || '',
          claimDocumentsMax: Number(data.claim_documents_max || DEFAULT_MAX_DOCUMENTS),
          insurers: Array.isArray(data.insurers) ? data.insurers : [],
        });
      })
      .catch((fetchError) => {
        if (cancelled || fetchError.name === 'AbortError') return;
        setError('Claims support is temporarily unavailable. Please try again shortly.');
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [activeInsurerName]);

  useEffect(() => {
    if (chosenPolicy?.policyInsurerName || chosenPolicy?.policyTitle) {
      setSelectedInsurer(chosenPolicy.policyInsurerName || chosenPolicy.policyTitle);
    }
  }, [chosenPolicy]);

  useEffect(() => {
    if (!initialContext) return;
    if (initialContext.externalPolicy) {
      setUseExternalPolicy(true);
      setSelectedPolicy('');
      setSelectedInsurer(initialContext.insurerName || '');
      setFormValues((current) => ({
        ...current,
        policy_number: initialContext.policyNumber || current.policy_number,
      }));
      return;
    }
    if (initialContext.policySaleId) {
      setSelectedPolicy(String(initialContext.policySaleId));
    }
    if (initialContext.insurerName) {
      setSelectedInsurer(initialContext.insurerName);
    }
  }, [initialContext]);

  const feeLabel = config.fee > 0
    ? `${config.currency} ${config.fee.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : 'No service fee';

  const totalDocuments = Object.values(claimDocuments).reduce((count, files) => count + files.length, 0);

  const updateValue = (event) => setFormValues((current) => ({ ...current, [event.target.name]: event.target.value }));

  const validateStep = () => {
    const policyNumber = chosenPolicy?.policyNumber || formValues.policy_number.trim();
    const insurerName = activeInsurerName;
    if (step === 0 && (!policyNumber || !insurerName)) {
      return 'Select a policy or complete both policy fields.';
    }
    if (step === 1 && (!formValues.incident_date || !formValues.claim_type || formValues.description.trim().length < 20)) {
      return 'Add the incident date, type, and a description of at least 20 characters.';
    }
    if (step === 2) {
      if (!insurerName) {
        return 'Select the insurer before downloading the claim form.';
      }
      if (!config.claimFormUrl) {
        return `No blank claim form is uploaded yet for ${insurerName}. Please contact TIC-Kenya support.`;
      }
      const missingDocuments = CLAIM_DOCUMENT_FIELDS.filter((field) => claimDocuments[field.key].length === 0);
      if (missingDocuments.length > 0) {
        return `Upload all required claim documents: ${missingDocuments.map((field) => field.label).join(', ')}.`;
      }
    }
    if (step === 3) {
      if (!formValues.client_name.trim() || !formValues.client_email.trim() || !formValues.client_phone.trim()) {
        return 'Complete all contact fields.';
      }
      if (payoutMethod === 'MPESA' && !formValues.mpesa_phone.trim()) {
        return 'Enter the M-Pesa number that should receive the approved claim payout.';
      }
      if (payoutMethod === 'BANK_TRANSFER' && (
        !formValues.bank_name.trim()
        || !formValues.bank_account_name.trim()
        || !formValues.bank_account_number.trim()
        || !formValues.bank_branch.trim()
      )) {
        return 'Complete all bank payout fields.';
      }
    }
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

  const addDocuments = (field) => (event) => {
    const incoming = Array.from(event.target.files || []);
    setError('');
    if (incoming.length === 0) {
      return;
    }

    const invalid = incoming.find((file) => file.size > MAX_FILE_SIZE || !ACCEPTED_FILE_TYPES.includes(file.type));
    if (invalid) {
      setError('Each document must be a PDF, JPG, or PNG no larger than 5 MB.');
      event.target.value = '';
      return;
    }

    const existingCountWithoutCurrentField = totalDocuments - claimDocuments[field.key].length;
    const nextFieldFiles = field.multiple ? [...claimDocuments[field.key], ...incoming] : incoming.slice(0, 1);
    const nextTotalCount = existingCountWithoutCurrentField + nextFieldFiles.length;
    if (nextTotalCount > config.claimDocumentsMax) {
      setError(`Upload no more than ${config.claimDocumentsMax} claim documents in total.`);
      event.target.value = '';
      return;
    }

    setClaimDocuments((current) => ({
      ...current,
      [field.key]: field.multiple ? [...current[field.key], ...incoming] : incoming.slice(0, 1),
    }));
    event.target.value = '';
  };

  const removeDocument = (fieldKey, indexToRemove) => {
    setClaimDocuments((current) => ({
      ...current,
      [fieldKey]: current[fieldKey].filter((_, index) => index !== indexToRemove),
    }));
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

    const policyNumber = chosenPolicy?.policyNumber || formValues.policy_number.trim();
    const insurerName = activeInsurerName;
    const documentManifest = CLAIM_DOCUMENT_FIELDS.flatMap((field) =>
      claimDocuments[field.key].map((file) => `${field.label}: ${file.name}`)
    );
    const claimNarrative = `${formValues.description.trim()}\n\nClaim checklist:\n${documentManifest.map((entry) => `- ${entry}`).join('\n')}`;

    const submissionData = new FormData();
    submissionData.set('request_type', 'claim');
    submissionData.set('consent', '1');
    submissionData.set('policy_number', policyNumber);
    submissionData.set('insurer_name', insurerName);
    submissionData.set('incident_date', formValues.incident_date);
    submissionData.set('claim_type', formValues.claim_type);
    submissionData.set('description', claimNarrative);
    submissionData.set('client_name', formValues.client_name);
    submissionData.set('client_email', formValues.client_email);
    submissionData.set('client_phone', formValues.client_phone);
    submissionData.set('payout_method', payoutMethod);
    if (payoutMethod === 'MPESA') {
      submissionData.set('mpesa_phone', formValues.mpesa_phone);
    } else {
      submissionData.set('bank_name', formValues.bank_name);
      submissionData.set('bank_account_name', formValues.bank_account_name);
      submissionData.set('bank_account_number', formValues.bank_account_number);
      submissionData.set('bank_branch', formValues.bank_branch);
    }

    CLAIM_DOCUMENT_FIELDS.forEach((field) => {
      claimDocuments[field.key].forEach((file) => {
        submissionData.append('supporting_documents[]', file);
      });
    });

    setSubmitting(true);
    setError('');
    try {
      const headers = { Accept: 'application/json', 'X-Maljani-Nonce': config.nonce };
      if (user?.token) headers.Authorization = `Bearer ${user.token}`;
      const response = await fetch('/wp-json/maljani/v1/claims/submit', { method: 'POST', headers, body: submissionData });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.message || 'We could not submit your claim.');
      }
      setReference(result.reference);
      setCheckout(result.checkout || null);
      setUseExternalPolicy(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (submissionError) {
      setError(submissionError.message || 'We could not submit your claim.');
    } finally {
      setSubmitting(false);
    }
  };

  const fieldStyle = {
    width: '100%',
    minHeight: 48,
    padding: '12px 14px',
    borderRadius: 8,
    border: '1px solid var(--glass-border-bright)',
    background: 'var(--field-bg)',
    color: 'var(--field-text)',
    fontFamily: 'var(--font-body)',
    fontSize: 16,
  };
  const labelStyle = { display: 'grid', gap: 7, fontSize: 12, fontWeight: 700, color: 'var(--white)' };
  const fullWidthLabel = { ...labelStyle, gridColumn: mobile ? 'auto' : '1 / -1' };
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
        .refund-method { position:relative; cursor:pointer; }
        .refund-method input { position:absolute; opacity:0; pointer-events:none; }
        .refund-method span { display:grid; gap:4px; min-height:78px; padding:16px; border:1px solid var(--glass-border); border-radius:8px; background:var(--glass-bg); transition:border-color .2s, background .2s; }
        .refund-method input:checked + span { border-color:var(--gold); background:var(--glass-bg-md); }
        .refund-method input:focus-visible + span { outline:3px solid rgba(246,166,35,.25); outline-offset:2px; }
        .refund-method small { color:var(--slate); font-size:12px; }
        .claim-field:focus { outline:none; border-color:var(--indigo-glow) !important; box-shadow:0 0 0 3px rgba(49,99,49,.2); }
        .claim-upload { display:grid; place-items:center; min-height:180px; padding:24px; border:1px dashed var(--glass-border-bright); border-radius:8px; background:var(--glass-bg); text-align:center; cursor:pointer; }
        .claim-upload:focus-within { outline:3px solid rgba(246,166,35,.25); outline-offset:2px; }
        .claim-spinner { width:16px; height:16px; border:2px solid currentColor; border-right-color:transparent; border-radius:50%; animation:claim-spin .7s linear infinite; }
        .claim-download-link { display:inline-flex; align-items:center; gap:10px; margin-top:12px; padding:12px 16px; border-radius:999px; border:1px solid rgba(34,197,94,.35); background:rgba(34,197,94,.08); color:#bbf7d0; text-decoration:none; font-weight:700; }
        .claim-download-link:hover { border-color:rgba(34,197,94,.55); background:rgba(34,197,94,.14); }
        .claim-pill { display:inline-flex; align-items:center; gap:6px; padding:6px 10px; border-radius:999px; background:rgba(255,255,255,.04); color:var(--slate); font-size:12px; }
        @keyframes claim-spin { to { transform:rotate(360deg); } }
        @media (prefers-reduced-motion:reduce) { .claim-spinner { animation-duration:1.5s; } }
      `}</style>

      <section style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : 'minmax(0,1.7fr) minmax(240px,.7fr)', gap: 28, alignItems: 'end', marginBottom: 30 }}>
        <div>
          <p className="section-label">Claims support</p>
          <h1 className="section-title" style={{ fontSize: 'clamp(34px,5vw,58px)', maxWidth: 760, marginBottom: 16 }}>Put an experienced claims desk on your side.</h1>
          <p style={{ color: 'var(--slate)', fontSize: 16, lineHeight: 1.8, maxWidth: 720 }}>Download your insurer&apos;s claim form, complete it, and upload the required compensation documents. TIC-Kenya will prepare, submit, and follow up on your travel insurance claim.</p>
        </div>
        <aside className="glass-card" style={{ padding: 24, borderLeft: '4px solid var(--gold)' }}>
          <div style={{ color: 'var(--slate)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Processing fee</div>
          <strong style={{ display: 'block', margin: '8px 0', color: 'var(--white)', fontFamily: 'var(--font-display)', fontSize: 28 }}>{feeLabel}</strong>
          <p style={{ color: 'var(--slate)', fontSize: 12, lineHeight: 1.6 }}>Fixed at submission from the active backend configuration.</p>
        </aside>
      </section>

      <ol aria-label="Claim submission progress" style={{ display: 'grid', gridTemplateColumns: `repeat(${STEPS.length}, minmax(0,1fr))`, gap: 6, listStyle: 'none', padding: mobile ? '16px 4px' : '18px 24px', margin: '0 0 22px', borderBlock: '1px solid var(--glass-border)' }}>
        {STEPS.map((label, index) => (
          <li key={label} className={`claim-step${index === step ? ' is-active' : ''}`} aria-current={index === step ? 'step' : undefined}>
            <span>{index + 1}</span>
            {!mobile && label}
          </li>
        ))}
      </ol>

      {error && <div role="alert" style={{ padding: 16, marginBottom: 20, border: '1px solid rgba(239,68,68,.35)', borderRadius: 8, background: 'rgba(239,68,68,.08)', color: '#fca5a5' }}>{error}</div>}

      <form onSubmit={handleSubmit} className="glass-card" style={{ padding: mobile ? 20 : 34 }}>
        {step === 0 && (
          <section>
            <h2 style={sectionTitle}>Policy &amp; insurer details</h2>
            <p style={{ color: 'var(--slate)', fontSize: 13, marginBottom: 22 }}>Choose an active TIC-Kenya policy or enter an external policy.</p>
            {user && activePolicies.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
              <button type="button" className="btn btn--ghost" onClick={() => { setUseExternalPolicy(false); setError(''); }} style={{ minHeight: 42, opacity: useExternalPolicy ? 0.72 : 1 }}>
                Claim from my DIMP policy
              </button>
              <button type="button" className="btn btn--ghost" onClick={() => { setUseExternalPolicy(true); setSelectedPolicy(''); setError(''); }} style={{ minHeight: 42, opacity: useExternalPolicy ? 1 : 0.72 }}>
                Use a policy not bought through DIMP
              </button>
            </div>
            )}
            <div style={gridStyle}>
            {!useExternalPolicy && user && activePolicies.length > 0 ? (
              <label style={labelStyle}>
                Your active policy
                <select className="claim-field" style={fieldStyle} value={selectedPolicy} onChange={(event) => setSelectedPolicy(event.target.value)}>
                  <option value="">Select a policy</option>
                  {activePolicies.map((policy) => (
                    <option key={policy.id} value={policy.id}>
                      {policy.policyNumber} - {policy.policyInsurerName || policy.policyTitle}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
                <label style={labelStyle}>
                  Policy number
                  <input className="claim-field" style={fieldStyle} name="policy_number" value={formValues.policy_number} onChange={updateValue} />
                </label>
            )}
            {chosenPolicy ? (
              <label style={labelStyle}>
                Insurer
                <input className="claim-field" style={{ ...fieldStyle, opacity: 0.85 }} type="text" value={selectedInsurer} readOnly />
              </label>
            ) : (
              <label style={labelStyle}>
                Insurer
                <select className="claim-field" style={fieldStyle} value={selectedInsurer} onChange={(event) => setSelectedInsurer(event.target.value)}>
                  <option value="">Select insurer</option>
                  {insurerOptions.map((insurer) => <option key={insurer} value={insurer}>{insurer}</option>)}
                </select>
              </label>
            )}
            </div>
            {user && policiesLoading && <p style={{ display: 'flex', gap: 8, marginTop: 12, color: 'var(--slate)', fontSize: 12 }}><span className="claim-spinner" />Loading active policies...</p>}
            {user && !policiesLoading && activePolicies.length === 0 && <p style={{ color: 'var(--slate)', fontSize: 12, marginTop: 12 }}>No active policy was found. Enter the policy number manually and choose the insurer from the list above.</p>}
            {user && activePolicies.length > 0 && useExternalPolicy && <p style={{ color: 'var(--slate)', fontSize: 12, marginTop: 12 }}>Using an external policy lets you file a claim for cover that was not bought through DIMP.</p>}
            {chosenPolicy && <p style={{ color: 'var(--slate)', fontSize: 12, marginTop: 12 }}>The insurer is matched to the selected policy so we can load the correct claim form.</p>}
          </section>
        )}

        {step === 1 && (
          <section>
            <h2 style={sectionTitle}>Claim incident</h2>
            <p style={{ color: 'var(--slate)', fontSize: 13, marginBottom: 22 }}>Tell us what happened with enough detail to begin the claim.</p>
            <div style={gridStyle}>
              <label style={labelStyle}>
                Incident date
                <input className="claim-field" style={fieldStyle} type="date" name="incident_date" max={TODAY} value={formValues.incident_date} onChange={updateValue} />
              </label>
              <label style={labelStyle}>
                Incident type
                <select className="claim-field" style={fieldStyle} name="claim_type" value={formValues.claim_type} onChange={updateValue}>
                  {CLAIM_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label style={{ ...labelStyle, gridColumn: mobile ? 'auto' : '1 / -1' }}>
                What happened?
                <textarea className="claim-field" style={{ ...fieldStyle, minHeight: 150, resize: 'vertical' }} name="description" value={formValues.description} onChange={updateValue} placeholder="Include the location, people involved, treatment or airline response, and any reference numbers." />
              </label>
            </div>
          </section>
        )}

        {step === 2 && (
          <section>
            <h2 style={sectionTitle}>Claim form &amp; required documents</h2>
            <p style={{ color: 'var(--slate)', fontSize: 13, marginBottom: 20 }}>Travel insurance compensation claims require the insurer&apos;s completed claim form, policy copy, loss letter, passport scans, receipts, list of contents, payout details, and proof of residence.</p>
            <div style={{ display: 'grid', gap: 18, marginBottom: 22, padding: 20, border: '1px solid rgba(34,197,94,.22)', borderRadius: 10, background: 'rgba(34,197,94,.06)' }}>
              <div>
                <strong style={{ display: 'block', marginBottom: 6, color: 'var(--white)', fontSize: 16 }}>Step 1: Download the insurer claim form</strong>
                <p style={{ margin: 0, color: 'var(--slate)', fontSize: 13, lineHeight: 1.7 }}>
                  {activeInsurerName
                    ? `We matched this claim to ${activeInsurerName}. Download the insurer's blank form, complete it, then upload the filled copy below.`
                    : 'Choose an insurer first so we can load the correct blank claim form.'}
                </p>
                {config.claimFormUrl ? (
                  <a className="claim-download-link" href={config.claimFormUrl} target="_blank" rel="noopener noreferrer">
                    <span aria-hidden="true">↓</span>
                    Download {config.claimFormLabel || 'claim form'}
                  </a>
                ) : (
                  <div className="claim-pill" style={{ marginTop: 12 }}>
                    <span aria-hidden="true">!</span>
                    No blank claim form uploaded for this insurer yet.
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                <span className="claim-pill">{totalDocuments} / {config.claimDocumentsMax} documents uploaded</span>
                <span className="claim-pill">5 MB max per document</span>
              </div>
            </div>
            <div style={{ display: 'grid', gap: 16 }}>
              {CLAIM_DOCUMENT_FIELDS.map((field) => (
                <ClaimDocumentField
                  key={field.key}
                  field={field}
                  files={claimDocuments[field.key]}
                  onAdd={addDocuments(field)}
                  onRemove={(index) => removeDocument(field.key, index)}
                />
              ))}
            </div>
          </section>
        )}

        {step === 3 && (
          <section>
            <h2 style={sectionTitle}>Payout &amp; contact details</h2>
            <p style={{ color: 'var(--slate)', fontSize: 13, marginBottom: 20 }}>Approved compensation is paid to the M-Pesa number or bank account you provide here. We use your contact details for document queries and insurer updates.</p>
            <fieldset style={{ borderLeft: 0, borderRight: 0, borderTop: 0, borderBottom: '1px solid var(--glass-border)', padding: 0, margin: '0 0 24px' }}>
              <legend style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, marginBottom: 16 }}>Payout method</legend>
              <div style={{ ...gridStyle, marginBottom: 18 }}>
                <label className="refund-method">
                  <input type="radio" name="payout_method" value="MPESA" checked={payoutMethod === 'MPESA'} onChange={() => setPayoutMethod('MPESA')} />
                  <span><strong>M-Pesa</strong><small>Send approved funds to a Safaricom number.</small></span>
                </label>
                <label className="refund-method">
                  <input type="radio" name="payout_method" value="BANK_TRANSFER" checked={payoutMethod === 'BANK_TRANSFER'} onChange={() => setPayoutMethod('BANK_TRANSFER')} />
                  <span><strong>Bank transfer</strong><small>Send approved funds to a Kenyan bank account.</small></span>
                </label>
              </div>
              {payoutMethod === 'MPESA' ? (
                <label style={labelStyle}>
                  Safaricom mobile number
                  <input className="claim-field" style={fieldStyle} type="tel" name="mpesa_phone" autoComplete="tel" placeholder="07XX XXX XXX" value={formValues.mpesa_phone} onChange={updateValue} />
                </label>
              ) : (
                <div style={gridStyle}>
                  <label style={labelStyle}>
                    Bank name
                    <input className="claim-field" style={fieldStyle} type="text" name="bank_name" autoComplete="organization" value={formValues.bank_name} onChange={updateValue} />
                  </label>
                  <label style={labelStyle}>
                    Account name
                    <input className="claim-field" style={fieldStyle} type="text" name="bank_account_name" autoComplete="name" value={formValues.bank_account_name} onChange={updateValue} />
                  </label>
                  <label style={labelStyle}>
                    Account number
                    <input className="claim-field" style={fieldStyle} type="text" name="bank_account_number" inputMode="numeric" value={formValues.bank_account_number} onChange={updateValue} />
                  </label>
                  <label style={labelStyle}>
                    Branch
                    <input className="claim-field" style={fieldStyle} type="text" name="bank_branch" value={formValues.bank_branch} onChange={updateValue} />
                  </label>
                </div>
              )}
            </fieldset>
            <div style={gridStyle}>
              <label style={labelStyle}>
                Full name
                <input className="claim-field" style={fieldStyle} name="client_name" autoComplete="name" value={formValues.client_name} onChange={updateValue} />
              </label>
              <label style={labelStyle}>
                Email address
                <input className="claim-field" style={fieldStyle} type="email" name="client_email" autoComplete="email" value={formValues.client_email} onChange={updateValue} />
              </label>
              <label style={fullWidthLabel}>
                Phone number
                <input className="claim-field" style={fieldStyle} type="tel" name="client_phone" autoComplete="tel" value={formValues.client_phone} onChange={updateValue} />
              </label>
            </div>
          </section>
        )}

        {step === 4 && (
          <section>
            <h2 style={sectionTitle}>Review &amp; submit</h2>
            <p style={{ color: 'var(--slate)', fontSize: 13, marginBottom: 20 }}>Confirm the intake summary before submitting your compensation claim.</p>
            <div style={{ display: 'grid', gap: 1, background: 'var(--glass-border)', border: '1px solid var(--glass-border)', borderRadius: 8, overflow: 'hidden' }}>
              {[
                ['Policy', chosenPolicy?.policyNumber || formValues.policy_number],
                ['Insurer', activeInsurerName],
                ['Claim type', CLAIM_TYPES.find(([value]) => value === formValues.claim_type)?.[1]],
                ['Incident date', formValues.incident_date],
                ['Blank claim form', config.claimFormLabel || 'Available for download'],
                ['Uploaded documents', `${totalDocuments} attached`],
                ['Payout method', payoutMethod === 'MPESA' ? 'M-Pesa' : 'Bank transfer'],
                ['Service fee', feeLabel],
              ].map(([label, value]) => (
                <div key={label} style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : 'minmax(160px,.35fr) 1fr', gap: 8, padding: 14, background: 'var(--field-bg)' }}>
                  <strong style={{ fontSize: 12, color: 'var(--slate)' }}>{label}</strong>
                  <span style={{ color: 'var(--white)', fontSize: 14 }}>{value}</span>
                </div>
              ))}
            </div>
            {config.fee > 0 && <p style={{ marginTop: 18, padding: 14, borderLeft: '3px solid var(--gold)', color: 'var(--slate)', fontSize: 13, lineHeight: 1.7 }}>Submission creates a ticket with payment status Pending. Processing begins after the {feeLabel} service fee is paid.</p>}
            <label style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginTop: 22, color: 'var(--slate)', fontSize: 13, lineHeight: 1.7 }}>
              <input type="checkbox" required style={{ width: 20, height: 20, marginTop: 2, flex: '0 0 auto', accentColor: 'var(--indigo)' }} />
              <span>I confirm the information is accurate and authorize TIC-Kenya to prepare, submit, and follow up on this claim. Insurer approval is not guaranteed.</span>
            </label>
          </section>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 30, paddingTop: 22, borderTop: '1px solid var(--glass-border)' }}>
          <button type="button" className="btn btn--ghost" disabled={step === 0 || submitting} onClick={() => { setError(''); setStep((current) => Math.max(0, current - 1)); }} style={{ minHeight: 48, visibility: step === 0 ? 'hidden' : 'visible' }}>Back</button>
          {step < STEPS.length - 1 ? (
            <button type="button" className="btn btn--primary" onClick={nextStep} style={{ minHeight: 48 }}>Continue</button>
          ) : (
            <button type="submit" className="btn btn--primary" disabled={submitting || !config.nonce} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 48, opacity: submitting || !config.nonce ? 0.65 : 1 }}>
              {submitting && <span className="claim-spinner" />}
              {submitting ? 'Creating ticket...' : config.fee > 0 ? 'Submit & proceed to payment' : 'Submit claim'}
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

export default ClaimSupportPage;
