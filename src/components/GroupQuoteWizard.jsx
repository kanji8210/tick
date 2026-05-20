import React, { useState, useMemo } from 'react';
import { useQuery } from 'urql';
import { useAuth } from '../lib/AuthContext';

const WP_REST_BASE = '/wp-json';

const GET_REGIONS = `
  query GetRegionsGQ {
    regions(first: 50) {
      nodes { id databaseId name slug }
    }
  }
`;

const GET_POLICIES_FOR_QUOTE = `
  query GetPoliciesForGroupQuote {
    policies(first: 100) {
      nodes {
        id databaseId title
        policyCurrency policyInsurerName policyInsurerLogo
        policyFeatureTags
        policyBenefits policyCoverDetails policyNotCovered
        regions { nodes { slug name } }
        policyDayPremiums { from to premium }
      }
    }
  }
`;

const tripDays = (dep, ret) => {
  if (!dep || !ret) return 0;
  const ms = new Date(ret) - new Date(dep);
  return Math.max(1, Math.round(ms / 86400000) + 1);
};

const bracketPremium = (brackets, days) => {
  if (!brackets?.length) return null;
  const m = brackets.find(b => days >= b.from && days <= b.to);
  return m ? m.premium : null;
};

const TRAVELER_FACTORS = {
  adults: 1,
  seniors: 1.3,
  children: 0.85,
};

const fmtKES = (n, currency = 'KES') =>
  `${currency} ${Number(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const stripHtml = (value) => (value || '').replace(/<[^>]*>/g, ' ').replace(/\s{2,}/g, ' ').trim();

const quoteRef = () => 'QT-' + Date.now().toString(36).toUpperCase();

const addDaysToISO = (isoDate, daysToAdd) => {
  if (!isoDate || !daysToAdd) return isoDate;
  const date = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return isoDate;
  date.setDate(date.getDate() + daysToAdd);
  return date.toISOString().split('T')[0];
};

/* ── Sub-components ─────────────────────────────────────── */
const StepDots = ({ total, current }) => (
  <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 20 }}>
    {Array.from({ length: total }).map((_, i) => (
      <div key={i} style={{
        height: 6, borderRadius: 100, transition: 'all 0.3s ease',
        width: i === current ? 22 : 6,
        background: i < current ? 'var(--gold)' : i === current ? 'var(--indigo)' : 'rgba(255,255,255,0.15)',
      }} />
    ))}
  </div>
);

const inputSt = {
  width: '100%', padding: '10px 14px', borderRadius: 8,
  border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.28)',
  color: '#fff', fontSize: 14, fontFamily: 'var(--font-body)', outline: 'none',
  transition: 'border-color 0.2s', boxSizing: 'border-box',
};
const labelSt = {
  display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
  textTransform: 'uppercase', color: 'var(--slate)', marginBottom: 5,
};

const Field = ({ label, error, children }) => (
  <div style={{ marginBottom: 12 }}>
    <label style={labelSt}>{label}</label>
    {children}
    {error && <div style={{ fontSize: 11, color: '#f87171', marginTop: 3 }}>{error}</div>}
  </div>
);

const ChipButton = ({ label, active, onClick, color = 'gold' }) => {
  const colors = {
    gold:   { border: 'rgba(246,166,35,0.6)',  bg: 'rgba(246,166,35,0.12)',  text: 'var(--gold)' },
    green:  { border: 'rgba(49,99,49,0.6)',    bg: 'rgba(49,99,49,0.18)',    text: '#86efac' },
  };
  const c = colors[color];
  return (
    <button type="button" onClick={onClick} style={{
      padding: '6px 12px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer',
      border: `1px solid ${active ? c.border : 'var(--glass-border)'}`,
      background: active ? c.bg : 'var(--glass-bg)',
      color: active ? c.text : 'rgba(255,255,255,0.75)', transition: 'all 0.2s',
    }}>{label}</button>
  );
};

/* ── Main component ─────────────────────────────────────── */
const GroupQuoteWizard = ({ onClose, isAgency = false }) => {
  const { user } = useAuth();
  const [ref] = useState(quoteRef);
  const [step, setStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [selectedPolicyId, setSelectedPolicyId] = useState(null);
  const [selectedQuotePolicy, setSelectedQuotePolicy] = useState(null);
  const [benefitPolicy, setBenefitPolicy] = useState(null);
  const [compareIds, setCompareIds] = useState(() => new Set());
  const [compareOpen, setCompareOpen] = useState(false);
  const [travelerPromptOpen, setTravelerPromptOpen] = useState(false);
  const [travelerProfiles, setTravelerProfiles] = useState([]);

  const today    = new Date().toISOString().split('T')[0];
  const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
  const defaultTripDays = String(tripDays(today, nextWeek));

  const [form, setForm] = useState({
    orgName:            '',
    contactName:        user?.name  || '',
    contactEmail:       user?.email || '',
    contactPhone:       '',
    groupSize:          '',
    adults:             '',
    seniors:            '',
    children:           '',
    region:             '',
    departure:          today,
    returnDate:         nextWeek,
    tripDays:           defaultTripDays,
    purpose:            'Tourism',
    specialRequirements:'',
    // agency extras
    clientName:         '',
    discountPct:        0,
    agencyRef:          '',
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const err = k => errors[k];

  const [{ data: rData }] = useQuery({ query: GET_REGIONS });
  const regions = rData?.regions?.nodes || [];

  const [{ data: pData }] = useQuery({ query: GET_POLICIES_FOR_QUOTE });
  const allPolicies = pData?.policies?.nodes || [];

  const daysFromDates = tripDays(form.departure, form.returnDate);
  const daysInput = Math.max(0, parseInt(form.tripDays, 10) || 0);
  const days = daysInput || daysFromDates;
  const groupSize = Math.max(1, parseInt(form.groupSize) || 0);
  const adults    = Math.max(0, parseInt(form.adults) || 0);
  const seniors   = Math.max(0, parseInt(form.seniors) || 0);
  const children  = Math.max(0, parseInt(form.children) || 0);
  const enteredBreakdown = adults + seniors + children;
  const normalizedAdults = enteredBreakdown > groupSize ? adults : adults + Math.max(0, groupSize - enteredBreakdown);
  const travelerMix = {
    adults: normalizedAdults,
    seniors,
    children,
  };
  const coverageMultiplier = 1;
  const APP_SECRET = import.meta.env.VITE_APP_SECRET ?? '';

  const restHeaders = () => {
    const headers = { Accept: 'application/json' };
    if (APP_SECRET) headers['X-Maljani-App-Secret'] = APP_SECRET;
    if (user?.token) headers.Authorization = `Bearer ${user.token}`;
    return headers;
  };

  const quotedPolicies = useMemo(() => {
    const base = form.region
      ? allPolicies.filter(p => p.regions?.nodes?.some(r =>
          r.slug === form.region || r.name.toLowerCase().includes(form.region.toLowerCase())
        ))
      : allPolicies;
    return base
      .map(p => {
        const basePerTraveler = bracketPremium(p.policyDayPremiums, days);
        if (!basePerTraveler) return null;
        const tierAdjustedRate = basePerTraveler;
        const lineItems = [
          { key: 'adults', label: 'Adults', count: travelerMix.adults, factor: TRAVELER_FACTORS.adults },
          { key: 'seniors', label: 'Seniors', count: travelerMix.seniors, factor: TRAVELER_FACTORS.seniors },
          { key: 'children', label: 'Children', count: travelerMix.children, factor: TRAVELER_FACTORS.children },
        ]
          .filter(item => item.count > 0)
          .map(item => ({
            ...item,
            rate: tierAdjustedRate * item.factor,
            total: tierAdjustedRate * item.factor * item.count,
          }));
        const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
        const discount = isAgency ? subtotal * (form.discountPct / 100) : 0;
        const total    = subtotal - discount;
        return {
          ...p,
          basePerTraveler,
          tierAdjustedRate,
          lineItems,
          subtotal,
          discount,
          total,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.total - b.total);
  }, [allPolicies, form.region, form.discountPct, days, groupSize, coverageMultiplier, travelerMix, isAgency]);

  const comparedPolicies = useMemo(
    () => quotedPolicies.filter((policy) => compareIds.has(policy.id)),
    [quotedPolicies, compareIds],
  );

  const STEPS = isAgency
    ? ['Client Info', 'Trip Details', 'Additional Notes', 'Quotation']
    : ['Corporate Travel Info', 'Trip Details', 'Additional Notes', 'Your Quote'];

  const quoteSubmissionPayload = useMemo(() => ({
    reference: ref,
    requestType: isAgency ? 'agency' : 'group',
    submittedAt: new Date().toISOString(),
    contact: {
      organizationName: form.orgName,
      name: form.contactName,
      email: form.contactEmail,
      phone: form.contactPhone,
      agencyReference: form.agencyRef || '',
    },
    trip: {
      region: form.region,
      departure: form.departure,
      returnDate: form.returnDate,
      daysCovered: days,
      purpose: form.purpose,
      coverageMultiplier,
      specialRequirements: form.specialRequirements,
    },
    travelers: {
      total: groupSize,
      mix: travelerMix,
      manifest: travelerProfiles,
      factors: TRAVELER_FACTORS,
    },
    pricing: {
      preferredPolicyId: selectedPolicyId ? Number(selectedPolicyId) : null,
      agencyDiscountPct: isAgency ? Number(form.discountPct) || 0 : 0,
      options: quotedPolicies.slice(0, 5).map((policy, index) => ({
        rank: index + 1,
        policyId: policy.databaseId,
        title: policy.title,
        insurer: policy.policyInsurerName,
        currency: policy.policyCurrency || 'KES',
        basePerTraveler: Number(policy.basePerTraveler || 0),
        tierAdjustedRate: Number(policy.tierAdjustedRate || 0),
        subtotal: Number(policy.subtotal || 0),
        discount: Number(policy.discount || 0),
        total: Number(policy.total || 0),
        lineItems: policy.lineItems.map(item => ({
          travelerType: item.key,
          label: item.label,
          count: item.count,
          factor: item.factor,
          rate: Number(item.rate || 0),
          total: Number(item.total || 0),
        })),
      })),
    },
  }), [
    ref,
    isAgency,
    form.orgName,
    form.contactName,
    form.contactEmail,
    form.contactPhone,
    form.agencyRef,
    form.region,
    form.departure,
    form.returnDate,
    form.purpose,
    form.specialRequirements,
    form.discountPct,
    days,
    coverageMultiplier,
    groupSize,
    travelerMix,
    travelerProfiles,
    quotedPolicies,
    selectedPolicyId,
  ]);

  const toggleCompare = (policyId) => {
    setCompareIds(prev => {
      const next = new Set(prev);
      if (next.has(policyId)) {
        next.delete(policyId);
      } else if (next.size < 3) {
        next.add(policyId);
      }
      return next;
    });
  };

  const choosePolicy = (policy) => {
    setSelectedPolicyId(policy.id);
    setForm(f => {
      const preferredLine = `Preferred policy: ${policy.title}`;
      if ((f.specialRequirements || '').includes(preferredLine)) return f;
      return {
        ...f,
        specialRequirements: f.specialRequirements
          ? `${f.specialRequirements}\n${preferredLine}`
          : preferredLine,
      };
    });
  };

  const openSelectedQuote = (policy) => {
    choosePolicy(policy);
    setSelectedQuotePolicy(policy);
  };

  const openTravelerPrompt = () => {
    const count = Math.max(1, parseInt(form.groupSize, 10) || 1);
    setTravelerProfiles((prev) => {
      const next = Array.from({ length: count }).map((_, idx) => ({
        fullName: prev[idx]?.fullName || '',
      }));
      return next;
    });
    setTravelerPromptOpen(true);
  };

  const saveTravelerProfiles = () => {
    const named = travelerProfiles.filter((t) => (t.fullName || '').trim());
    if (named.length > 0) {
      setForm((f) => {
        const summary = `Traveler names captured (${named.length}/${travelerProfiles.length})`;
        if ((f.specialRequirements || '').includes(summary)) return f;
        return {
          ...f,
          specialRequirements: f.specialRequirements ? `${f.specialRequirements}\n${summary}` : summary,
        };
      });
    }
    setTravelerPromptOpen(false);
    setSelectedQuotePolicy(null);
  };

  const validate = () => {
    const e = {};
    if (step === 0) {
      if (!form.orgName.trim())         e.orgName      = 'Required';
      if (!form.contactName.trim())     e.contactName  = 'Required';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail))
                                        e.contactEmail = 'Valid email required';
      if (!form.groupSize || parseInt(form.groupSize) < 5)
                                        e.groupSize    = 'Minimum 5 travelers for corporate travel';
      if (enteredBreakdown > groupSize)
                                        e.groupSize    = 'Traveler breakdown cannot exceed total travelers';
    }
    if (step === 1) {
      if (!form.region)                          e.region     = 'Select a destination';
      if (!form.tripDays || parseInt(form.tripDays, 10) < 1)
                                                e.tripDays   = 'Enter number of days';
      if (form.returnDate < form.departure)      e.returnDate = 'Must be after departure';
    }
    setErrors(e);
    return !Object.keys(e).length;
  };

  const handleNext = () => { if (validate()) setStep(s => s + 1); };

  const handleSend = async () => {
    setSending(true);
    setSubmitError('');
    try {
      const discoverRoutes = async () => {
        const res = await fetch(`${WP_REST_BASE}`);
        const data = await res.json().catch(() => null);
        const routes = data?.routes || {};

        const discovered = Object.entries(routes)
          .filter(([path, config]) => {
            const p = String(path || '').toLowerCase();
            const looksLikeQuoteRoute =
              p.includes('quote') && (p.includes('group') || p.includes('corporate') || p.includes('travel'));
            if (!looksLikeQuoteRoute) return false;

            const endpoints = Array.isArray(config?.endpoints) ? config.endpoints : [];
            return endpoints.some((ep) => {
              if (Array.isArray(ep?.methods)) return ep.methods.includes('POST');
              if (ep?.methods && typeof ep.methods === 'object') return Object.keys(ep.methods).includes('POST');
              return false;
            });
          })
          .map(([path]) => String(path));

        return discovered;
      };

      const discoveredRoutes = await discoverRoutes().catch(() => []);

      const candidateRoutes = [
        ...discoveredRoutes,
        '/maljani/v1/group-quote',
        '/maljani/v1/corporate-travel-quote',
        '/maljani/v1/quote-request',
        '/tick/v1/group-quote',
        '/tick/v1/corporate-travel-quote',
        '/tick/v1/quote-request',
      ].filter((route, idx, arr) => {
        const normalized = route.startsWith('/') ? route : `/${route}`;
        return arr.findIndex((r) => (r.startsWith('/') ? r : `/${r}`) === normalized) === idx;
      });

      let lastRouteError = null;
      let submittedOk = false;

      for (const route of candidateRoutes) {
        const normalizedRoute = route.startsWith('/') ? route : `/${route}`;
        const res = await fetch(`${WP_REST_BASE}${normalizedRoute}`, {
          method: 'POST',
          headers: { ...restHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify(quoteSubmissionPayload),
        });

        const data = await res.json().catch(() => null);
        if (res.ok) {
          submittedOk = true;
          break;
        }

        const apiCode = data?.code || '';
        const apiMessage = data?.message || data?.error || '';
        const isMissingRoute = res.status === 404 || apiCode === 'rest_no_route' || /no route/i.test(apiMessage);

        if (!isMissingRoute) {
          throw new Error(apiMessage || `Unable to submit quote request (${res.status}).`);
        }

        lastRouteError = apiMessage;
      }

      if (!submittedOk) {
        throw new Error(lastRouteError || 'No corporate travel quote POST route found in /wp-json.');
      }

      setSubmitted(true);
    } catch (error) {
      setSubmitError(error.message || 'Unable to submit your quote request right now.');
    } finally {
      setSending(false);
    }
  };

  /* ── Submitted screen ── */
  if (submitted) return (
    <div style={{ textAlign: 'center', padding: '4px 0' }}>
      <div style={{
        width: 52, height: 52, borderRadius: '50%',
        background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 14px', fontSize: 22,
      }}>✓</div>
      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800, marginBottom: 8 }}>
        {isAgency ? 'Quotation Created!' : 'Quote Request Sent!'}
      </h3>
      <p style={{ color: 'var(--slate)', fontSize: 13, lineHeight: 1.7, marginBottom: 14 }}>
        {isAgency
          ? <>Quotation <strong style={{ color: 'var(--gold)' }}>{ref}</strong> is ready and has been sent to <strong>{form.contactEmail}</strong>.</>
          : <>We've received your corporate travel request for <strong>{form.orgName}</strong>. Our team will respond to <strong>{form.contactEmail}</strong> within 48 hours.</>
        }
      </p>
      <div style={{ padding: '10px 14px', background: 'rgba(246,166,35,0.08)', border: '1px solid rgba(246,166,35,0.2)', borderRadius: 8, fontSize: 12, marginBottom: 16 }}>
        Reference: <strong style={{ color: 'var(--gold)' }}>{ref}</strong>
      </div>
      {isAgency && quotedPolicies[0] && (
        <div style={{ padding: '10px 14px', background: 'rgba(49,99,49,0.1)', border: '1px solid rgba(49,99,49,0.3)', borderRadius: 8, fontSize: 12, color: '#86efac', marginBottom: 16 }}>
          Best price: <strong>{fmtKES(quotedPolicies[0].total, quotedPolicies[0].policyCurrency)}</strong> for {groupSize} travelers
          {form.discountPct > 0 && <span style={{ color: 'var(--slate)', marginLeft: 4 }}>({form.discountPct}% discount applied)</span>}
        </div>
      )}
      <button onClick={onClose} className="btn btn--primary" style={{ width: '100%', justifyContent: 'center' }}>Done</button>
    </div>
  );

  return (
    <div>
      <StepDots total={STEPS.length} current={step} />
      <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--slate)', textAlign: 'center', marginBottom: 16 }}>
        Step {step + 1} of {STEPS.length} — {STEPS[step]}
      </p>

      {/* ── Step 0: Group / Client Info ── */}
      {step === 0 && (
        <div className="fade-in">
          <Field label={isAgency ? 'Client / Company Name' : 'Organisation / Group Name'} error={err('orgName')}>
            <input
              style={{ ...inputSt, borderColor: err('orgName') ? '#f87171' : 'var(--glass-border)' }}
              value={form.orgName}
              onChange={e => set('orgName', e.target.value)}
              placeholder={isAgency ? 'e.g. Safari Ventures Ltd' : 'e.g. USIU Students Association'}
            />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="Contact Person" error={err('contactName')}>
              <input
                style={{ ...inputSt, borderColor: err('contactName') ? '#f87171' : 'var(--glass-border)' }}
                value={form.contactName} onChange={e => set('contactName', e.target.value)}
                placeholder="Full name"
              />
            </Field>
            <Field label="Phone">
              <input type="tel" style={inputSt} value={form.contactPhone}
                onChange={e => set('contactPhone', e.target.value)} placeholder="+254 7xx xxx xxx" />
            </Field>
          </div>

          <Field label="Contact Email" error={err('contactEmail')}>
            <input type="email"
              style={{ ...inputSt, borderColor: err('contactEmail') ? '#f87171' : 'var(--glass-border)' }}
              value={form.contactEmail} onChange={e => set('contactEmail', e.target.value)}
              placeholder="email@example.com"
            />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
            <Field label="Total Travelers" error={err('groupSize')}>
              <input type="number" min="5" max="500"
                style={{ ...inputSt, borderColor: err('groupSize') ? '#f87171' : 'var(--glass-border)' }}
                value={form.groupSize} onChange={e => set('groupSize', e.target.value)} placeholder="0"
              />
            </Field>
            <Field label="Adults (18–65)">
              <input type="number" min="0" style={inputSt} value={form.adults}
                onChange={e => set('adults', e.target.value)} placeholder="0" />
            </Field>
            <Field label="Seniors (65+)">
              <input type="number" min="0" style={inputSt} value={form.seniors}
                onChange={e => set('seniors', e.target.value)} placeholder="0" />
            </Field>
            <Field label="Children (<18)">
              <input type="number" min="0" style={inputSt} value={form.children}
                onChange={e => set('children', e.target.value)} placeholder="0" />
            </Field>
          </div>

          <div style={{ fontSize: 11, color: 'var(--slate)', marginTop: 2, lineHeight: 1.6 }}>
            Corporate travel quotations are available for 5+ travelers. If traveler types have different premiums, the quote is weighted by member mix.
          </div>
          <div style={{ fontSize: 11, color: 'var(--slate)', marginTop: 4, lineHeight: 1.6 }}>
            For senior travelers, enter their count in the Seniors field.
          </div>

          {isAgency && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 4 }}>
              <Field label="Agency Reference (optional)">
                <input style={inputSt} value={form.agencyRef}
                  onChange={e => set('agencyRef', e.target.value)} placeholder="e.g. AGT-2026-001" />
              </Field>
              <Field label="Discount (0–30 %)">
                <div style={{ position: 'relative' }}>
                  <input type="number" min="0" max="30" style={{ ...inputSt, paddingRight: 32 }}
                    value={form.discountPct}
                    onChange={e => set('discountPct', Math.min(30, Math.max(0, Number(e.target.value))))}
                  />
                  <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--gold)', fontWeight: 800, fontSize: 13, pointerEvents: 'none' }}>%</span>
                </div>
              </Field>
            </div>
          )}
        </div>
      )}

      {/* ── Step 1: Trip Details ── */}
      {step === 1 && (
        <div className="fade-in">
          <Field label="Destination / Region" error={err('region')}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: err('region') ? 4 : 0 }}>
              {(regions.length ? regions : [
                { name: 'East Africa', slug: 'east-africa' },
                { name: 'Schengen',    slug: 'schengen' },
                { name: 'Worldwide',   slug: 'worldwide' },
                { name: 'Asia',        slug: 'asia' },
              ]).map(r => (
                <ChipButton
                  key={r.slug || r.name}
                  label={r.name}
                  active={form.region === (r.slug || r.name)}
                  onClick={() => { set('region', r.slug || r.name); setErrors(e => ({ ...e, region: '' })); }}
                />
              ))}
            </div>
            {err('region') && <div style={{ fontSize: 11, color: '#f87171' }}>{err('region')}</div>}
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="Departure Date">
              <input type="date" style={inputSt} min={today} value={form.departure}
                onChange={e => {
                  const departure = e.target.value;
                  set('departure', departure);
                  const enteredDays = Math.max(1, parseInt(form.tripDays, 10) || 0);
                  if (enteredDays > 0) {
                    set('returnDate', addDaysToISO(departure, enteredDays - 1));
                  }
                }} />
            </Field>
            <Field label="Return Date" error={err('returnDate')}>
              <input type="date"
                style={{ ...inputSt, borderColor: err('returnDate') ? '#f87171' : 'var(--glass-border)' }}
                min={form.departure} value={form.returnDate}
                onChange={e => {
                  const returnDate = e.target.value;
                  set('returnDate', returnDate);
                  set('tripDays', String(tripDays(form.departure, returnDate)));
                }}
              />
            </Field>
          </div>

          <Field label="Number of Days" error={err('tripDays')}>
            <input
              type="number"
              min="1"
              style={{ ...inputSt, borderColor: err('tripDays') ? '#f87171' : 'var(--glass-border)' }}
              value={form.tripDays}
              onChange={e => {
                const raw = e.target.value;
                set('tripDays', raw);
                const enteredDays = Math.max(0, parseInt(raw, 10) || 0);
                if (enteredDays > 0) {
                  set('returnDate', addDaysToISO(form.departure, enteredDays - 1));
                }
              }}
              placeholder="e.g. 7"
            />
          </Field>

          {days > 0 && (
            <div style={{ padding: '8px 12px', background: 'rgba(246,166,35,0.08)', border: '1px solid rgba(246,166,35,0.2)', borderRadius: 8, fontSize: 12, color: 'var(--gold)', fontWeight: 600, marginBottom: 10 }}>
              ✈ {days} day{days !== 1 ? 's' : ''} · {groupSize} traveler{groupSize !== 1 ? 's' : ''}
            </div>
          )}

          {enteredBreakdown > 0 && (
            <div style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--glass-border)', borderRadius: 8, fontSize: 11, color: 'var(--slate)', marginBottom: 10 }}>
              Pricing mix: {travelerMix.adults} adult{travelerMix.adults !== 1 ? 's' : ''}, {travelerMix.seniors} senior{travelerMix.seniors !== 1 ? 's' : ''}, {travelerMix.children} child{travelerMix.children !== 1 ? 'ren' : ''}
            </div>
          )}

          <Field label="Purpose of Travel">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {['Tourism', 'Corporate', 'School Trip', 'Sports / Events', 'Medical', 'Other'].map(p => (
                <ChipButton key={p} label={p} active={form.purpose === p} color="green"
                  onClick={() => set('purpose', p)} />
              ))}
            </div>
          </Field>
        </div>
      )}

      {/* ── Step 2: Additional Notes ── */}
      {step === 2 && (
        <div className="fade-in">
          {isAgency && (
            <Field label="Agency Discount (0–30 %)">
              <div style={{ position: 'relative' }}>
                <input type="number" min="0" max="30"
                  style={{ ...inputSt, paddingRight: 32 }}
                  value={form.discountPct}
                  onChange={e => set('discountPct', Math.min(30, Math.max(0, Number(e.target.value))))}
                />
                <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--gold)', fontWeight: 800, fontSize: 13, pointerEvents: 'none' }}>%</span>
              </div>
              {form.discountPct > 0 && (
                <div style={{ fontSize: 11, color: '#86efac', marginTop: 4 }}>
                  Discount of {form.discountPct}% will be applied to all policy totals.
                </div>
              )}
            </Field>
          )}

          <Field label="Special Requirements / Notes">
            <textarea rows={3} style={{ ...inputSt, resize: 'vertical', lineHeight: 1.6 }}
              value={form.specialRequirements}
              onChange={e => set('specialRequirements', e.target.value)}
              placeholder="Any required cover details, destinations, special handling, etc."
            />
          </Field>
        </div>
      )}

      {/* ── Step 3: Quote Result ── */}
      {step === 3 && (
        <div className="fade-in">
          {/* Summary strip */}
          <div style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--glass-border)', borderRadius: 10, marginBottom: 12, fontSize: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
              {[
                [isAgency ? 'Client' : 'Group', form.orgName],
                ['Travelers', `${groupSize} people`],
                ['Destination', form.region],
                ['Duration', `${days} days`],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ color: 'var(--slate)' }}>{k}</span>
                  <strong style={{ color: 'var(--white)' }}>{v}</strong>
                </div>
              ))}
            </div>
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: 11, color: 'var(--slate)', lineHeight: 1.6 }}>
                Premium basis: {travelerMix.adults} adult{travelerMix.adults !== 1 ? 's' : ''}, {travelerMix.seniors} senior{travelerMix.seniors !== 1 ? 's' : ''}, {travelerMix.children} child{travelerMix.children !== 1 ? 'ren' : ''} · {days} day{days !== 1 ? 's' : ''}
              </div>
            {isAgency && form.discountPct > 0 && (
              <div style={{ marginTop: 6, padding: '4px 8px', background: 'rgba(134,239,172,0.1)', borderRadius: 6, textAlign: 'center', fontSize: 11, color: '#86efac', fontWeight: 700 }}>
                Agency discount: {form.discountPct}% applied
              </div>
            )}
          </div>

          {/* Policy options */}
          <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--slate)', marginBottom: 8 }}>
            {quotedPolicies.length > 0 ? 'Matching Policies' : 'No Exact Pricing Found'}
          </p>

          {quotedPolicies.length > 0 && (
            <div style={{ marginBottom: 10, fontSize: 11, color: 'var(--slate)' }}>
              Compare selected: <strong style={{ color: '#86efac' }}>{compareIds.size}</strong>/3
              {selectedPolicyId && <span style={{ marginLeft: 10, color: 'var(--gold)' }}>Preferred policy selected</span>}
              {comparedPolicies.length >= 2 && (
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  style={{ marginLeft: 10 }}
                  onClick={() => setCompareOpen(true)}
                >
                  Compare {comparedPolicies.length} Plans
                </button>
              )}
            </div>
          )}

          {quotedPolicies.length === 0 ? (
            <div style={{ padding: '14px', background: 'rgba(246,166,35,0.06)', border: '1px solid rgba(246,166,35,0.2)', borderRadius: 10, fontSize: 12, color: 'var(--slate)', lineHeight: 1.6 }}>
              No bracket pricing found for this region/duration — our team will prepare a custom quote for you.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, maxHeight: 320, overflowY: 'auto', paddingRight: 2 }}>
              {quotedPolicies.slice(0, 5).map((p, i) => {
                const inCompare = compareIds.has(p.id);
                const compareFull = compareIds.size >= 3 && !inCompare;
                const selected = selectedPolicyId === p.id;
                const benefitLines = stripHtml(p.policyBenefits || p.policyCoverDetails)
                  .split(/[\n\r]+/)
                  .map(line => line.trim())
                  .filter(Boolean)
                  .slice(0, 8);

                return (
                  <div key={p.id} style={{
                    padding: '10px 12px', borderRadius: 10,
                    background: selected ? 'rgba(246,166,35,0.10)' : i === 0 ? 'rgba(49,99,49,0.14)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${selected ? 'rgba(246,166,35,0.45)' : i === 0 ? 'rgba(49,99,49,0.4)' : 'var(--glass-border)'}`,
                    display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', cursor: 'pointer',
                  }} onClick={() => choosePolicy(p)}>
                    {i === 0 && (
                      <span style={{ fontSize: 9, background: 'var(--indigo)', color: '#fff', padding: '2px 7px', borderRadius: 100, fontWeight: 800, whiteSpace: 'nowrap', flexShrink: 0 }}>
                        BEST
                      </span>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#fff' }}>{p.title}</div>
                      <div style={{ fontSize: 10, color: 'var(--slate)', marginTop: 1 }}>
                        {p.policyInsurerName} · Base {fmtKES(p.basePerTraveler, p.policyCurrency)}/traveler
                      </div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)', marginTop: 4, lineHeight: 1.5 }}>
                        {p.lineItems.map(item => `${item.label}: ${item.count} x ${fmtKES(item.rate, p.policyCurrency)}`).join(' · ')}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      {p.discount > 0 && (
                        <div style={{ fontSize: 10, color: 'var(--slate)', textDecoration: 'line-through' }}>
                          {fmtKES(p.subtotal, p.policyCurrency)}
                        </div>
                      )}
                      <div style={{ fontWeight: 800, fontSize: 14, color: i === 0 ? '#86efac' : 'var(--white)' }}>
                        {fmtKES(p.total, p.policyCurrency)}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--slate)' }}>group total</div>
                    </div>

                    <div style={{ width: '100%', display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="btn btn--primary btn--sm"
                        style={{ flex: 1, justifyContent: 'center' }}
                        onClick={(e) => { e.stopPropagation(); openSelectedQuote(p); }}
                      >
                        {selected ? '✓ Get This' : 'Get This'}
                      </button>
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        disabled={compareFull}
                        style={{
                          opacity: compareFull ? 0.45 : 1,
                          background: inCompare ? 'rgba(49,99,49,0.2)' : undefined,
                          borderColor: inCompare ? 'rgba(49,99,49,0.6)' : undefined,
                          color: inCompare ? '#86efac' : undefined,
                        }}
                        onClick={(e) => { e.stopPropagation(); toggleCompare(p.id); }}
                      >
                        {inCompare ? '✓ Comparing' : 'Compare'}
                      </button>
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        onClick={(e) => { e.stopPropagation(); setBenefitPolicy({ ...p, benefitLines }); }}
                      >
                        Benefits View
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {selectedQuotePolicy && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(8px)', zIndex: 1310, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
          onClick={() => setSelectedQuotePolicy(null)}
        >
          <div
            style={{ width: '100%', maxWidth: 620, maxHeight: '85vh', overflowY: 'auto', background: 'var(--navy-mid)', border: '1px solid var(--glass-border-bright)', borderRadius: 14, padding: '1.2rem' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
              <h4 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 18, color: '#fff' }}>Selected Trip Quote</h4>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setSelectedQuotePolicy(null)}>Close</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              {[
                ['Policy', selectedQuotePolicy.title],
                ['Insurer', selectedQuotePolicy.policyInsurerName || 'N/A'],
                ['Destination', form.region || 'N/A'],
                ['Departure', form.departure || 'N/A'],
                ['Return', form.returnDate || 'N/A'],
                ['Duration', `${days} day${days !== 1 ? 's' : ''}`],
              ].map(([k, v]) => (
                <div key={k} style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: 10, padding: '10px 12px' }}>
                  <div style={{ fontSize: 10, color: 'var(--slate-dark)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>{k}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{v}</div>
                </div>
              ))}
            </div>

            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--glass-border)', borderRadius: 10, padding: '10px 12px', marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: 'var(--slate-dark)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Premium Breakdown</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', lineHeight: 1.7 }}>
                {selectedQuotePolicy.lineItems.map(item => (
                  <div key={`${selectedQuotePolicy.id}-${item.key}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                    <span>{item.label}: {item.count} x {fmtKES(item.rate, selectedQuotePolicy.policyCurrency)}</span>
                    <strong style={{ color: '#fff' }}>{fmtKES(item.total, selectedQuotePolicy.policyCurrency)}</strong>
                  </div>
                ))}
              </div>
              {selectedQuotePolicy.discount > 0 && (
                <div style={{ marginTop: 8, fontSize: 12, color: 'var(--slate)' }}>
                  Discount: -{fmtKES(selectedQuotePolicy.discount, selectedQuotePolicy.policyCurrency)}
                </div>
              )}
              <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--slate)' }}>Total Premium</span>
                <strong style={{ fontSize: 16, color: '#86efac' }}>{fmtKES(selectedQuotePolicy.total, selectedQuotePolicy.policyCurrency)}</strong>
              </div>
            </div>

            <button type="button" className="btn btn--primary btn--sm" style={{ width: '100%', justifyContent: 'center' }} onClick={openTravelerPrompt}>
              Use This Quote
            </button>
            <p style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--slate)' }}>
              You will add traveler names now. Passport/ID/KRA can be captured during payment.
            </p>
          </div>
        </div>
      )}

      {compareOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.84)', backdropFilter: 'blur(8px)', zIndex: 1320, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
          onClick={() => setCompareOpen(false)}
        >
          <div
            style={{ width: '100%', maxWidth: 860, maxHeight: '86vh', overflowY: 'auto', background: 'var(--navy-mid)', border: '1px solid var(--glass-border-bright)', borderRadius: 14, padding: '1.2rem' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
              <h4 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 18, color: '#fff' }}>Corporate Quote Comparator</h4>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setCompareOpen(false)}>Close</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 10 }}>
              {comparedPolicies.map((p) => (
                <div key={`cmp-${p.id}`} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--glass-border)', borderRadius: 10, padding: '10px 12px' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{p.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--slate)', marginBottom: 8 }}>{p.policyInsurerName}</div>
                  <div style={{ fontSize: 12, color: '#86efac', fontWeight: 800, marginBottom: 8 }}>{fmtKES(p.total, p.policyCurrency)}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', lineHeight: 1.6, marginBottom: 10 }}>
                    {p.lineItems.map((item) => `${item.label}: ${item.count}`).join(' · ')}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="btn btn--primary btn--sm"
                      style={{ flex: 1, justifyContent: 'center' }}
                      onClick={() => { setCompareOpen(false); openSelectedQuote(p); }}
                    >
                      Pick This
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={() => { setCompareOpen(false); setBenefitPolicy({ ...p, benefitLines: stripHtml(p.policyBenefits || p.policyCoverDetails).split(/[\n\r]+/).map((line) => line.trim()).filter(Boolean).slice(0, 8) }); }}
                    >
                      Benefits
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {travelerPromptOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.84)', backdropFilter: 'blur(8px)', zIndex: 1330, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
          onClick={() => setTravelerPromptOpen(false)}
        >
          <div
            style={{ width: '100%', maxWidth: 640, maxHeight: '86vh', overflowY: 'auto', background: 'var(--navy-mid)', border: '1px solid var(--glass-border-bright)', borderRadius: 14, padding: '1.2rem' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
              <h4 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 18, color: '#fff' }}>Traveler Details</h4>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setTravelerPromptOpen(false)}>Close</button>
            </div>
            <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--slate)' }}>
              Enter traveler names now. Passport number, ID number, and KRA PIN can be captured during payment.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
              {travelerProfiles.map((traveler, idx) => (
                <div key={`traveler-${idx}`} style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: 10, padding: '10px 12px' }}>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--slate)', marginBottom: 5 }}>
                    Traveler {idx + 1} Full Name
                  </label>
                  <input
                    style={inputSt}
                    value={traveler.fullName}
                    onChange={(e) => {
                      const value = e.target.value;
                      setTravelerProfiles((prev) => prev.map((t, i) => i === idx ? { ...t, fullName: value } : t));
                    }}
                    placeholder="Full name as on travel document"
                  />
                </div>
              ))}
            </div>

            <button type="button" className="btn btn--primary btn--sm" style={{ width: '100%', justifyContent: 'center' }} onClick={saveTravelerProfiles}>
              Save Travelers & Continue
            </button>
          </div>
        </div>
      )}

      {benefitPolicy && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(8px)', zIndex: 1300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
          onClick={() => setBenefitPolicy(null)}
        >
          <div
            style={{ width: '100%', maxWidth: 560, maxHeight: '80vh', overflowY: 'auto', background: 'var(--navy-mid)', border: '1px solid var(--glass-border-bright)', borderRadius: 14, padding: '1.2rem' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
              <h4 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 18, color: '#fff' }}>{benefitPolicy.title}</h4>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setBenefitPolicy(null)}>Close</button>
            </div>
            <p style={{ margin: '0 0 10px', color: 'var(--slate)', fontSize: 12 }}>Benefits overview</p>
            {benefitPolicy.benefitLines?.length ? (
              <ul style={{ margin: 0, paddingLeft: 18, color: 'rgba(255,255,255,0.86)', fontSize: 13, lineHeight: 1.8 }}>
                {benefitPolicy.benefitLines.map((line, idx) => <li key={`${benefitPolicy.id}-${idx}`}>{line}</li>)}
              </ul>
            ) : (
              <p style={{ margin: 0, color: 'var(--slate)', fontSize: 13 }}>No benefit details available for this policy.</p>
            )}
          </div>
        </div>
      )}

      {/* ── Navigation ── */}
      {submitError && (
        <div style={{ marginTop: 14, padding: '10px 12px', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.24)', borderRadius: 8, color: '#fca5a5', fontSize: 12, lineHeight: 1.6 }}>
          {submitError}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        {step > 0 && (
          <button className="btn btn--ghost btn--sm" onClick={() => setStep(s => s - 1)} style={{ flex: '0 0 auto', padding: '10px 16px' }}>
            ← Back
          </button>
        )}
        {step < STEPS.length - 1 ? (
          <button className="btn btn--primary btn--sm" onClick={handleNext} style={{ flex: 1, justifyContent: 'center' }}>
            {step === STEPS.length - 2 ? 'See Quote →' : 'Continue →'}
          </button>
        ) : (
          <button className="btn btn--primary btn--sm" onClick={handleSend} disabled={sending}
            style={{ flex: 1, justifyContent: 'center', opacity: sending ? 0.7 : 1 }}>
            {sending ? 'Sending…' : isAgency ? '📋 Send Quotation to Client' : '📨 Request Full Quote'}
          </button>
        )}
      </div>

      <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--slate-dark)', marginTop: 10 }}>
        🔒 Secure · No commitment required
      </p>
    </div>
  );
};

export default GroupQuoteWizard;
