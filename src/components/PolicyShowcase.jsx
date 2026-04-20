import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery } from 'urql';
import { useResponsive } from '../lib/useResponsive';

const NOT_PROVIDED = 'Not provided';

const GET_POLICIES = `
  query GetPolicies($first: Int = 100) {
    policies(first: $first) {
      nodes {
        id
        databaseId
        title
        excerpt
        link
        regions { nodes { slug name } }
        policyCurrency
        policyDescription
        policyBenefits
        policyCoverDetails
        policyNotCovered
        policyFeatureTags
        policyInsurerName
        policyInsurerLogo
        policyCountries
        policyDayPremiums {
          from
          to
          premium
        }
      }
    }
  }
`;

/** Lowest premium across all day brackets, or null if none defined. */
const minPremium = (brackets) => {
  if (!brackets || !brackets.length) return null;
  return Math.min(...brackets.map(b => b.premium));
};

/** Days between two YYYY-MM-DD strings (inclusive) */
const tripDays = (dep, ret) => {
  if (!dep || !ret) return 0;
  const ms = new Date(ret) - new Date(dep);
  return Math.max(1, Math.round(ms / 86400000) + 1);
};

/** Find premium for trip length from day-bracket array */
const bracketPremium = (brackets, days) => {
  if (!brackets || !brackets.length || !days) return null;
  const match = brackets.find(b => days >= b.from && days <= b.to);
  return match ? match.premium : null;
};

/** Split comma-separated feature tag string into an array. */
const parseTags = (raw) => {
  if (!raw || typeof raw !== 'string' || !raw.trim()) return [];
  return raw.split(',').map(s => s.trim()).filter(Boolean);
};

/** Format a KES price; returns null if price unavailable. */
const fmtPrice = (price, currency) => {
  if (price === null || price === undefined) return null;
  return `${currency || 'KES'} ${Number(price).toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

/** Strip HTML tags from a string. */
const stripHtml = (s) => (s || '').replace(/<[^>]*>/g, ' ').replace(/\s{2,}/g, ' ').trim();



/* ── Insurer logo ────────────────────────────────────────────────────────────────── */
const InsurerLogo = ({ logoUrl, name, size = 44 }) => {
  if (logoUrl) {
    return (
      <div style={{ width: size, height: size, borderRadius: 10, background: 'white', border: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 6, flexShrink: 0, overflow: 'hidden' }}>
        <img src={logoUrl} alt={name || 'Insurer'} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
      </div>
    );
  }
  const initial = (name && name !== NOT_PROVIDED) ? name.charAt(0).toUpperCase() : '?';
  return (
    <div style={{ width: size, height: size, borderRadius: 10, background: 'rgba(49,99,49,0.2)', border: '1px solid rgba(49,99,49,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: Math.round(size * 0.38), fontWeight: 800, color: '#86efac' }}>
      {initial}
    </div>
  );
};

/* ── Insurer Profile Modal ──────────────────────────────────────────────────── */
const InsurerProfileModal = ({ policy, onClose }) => {
  const { mobile } = useResponsive();
  if (!policy) return null;
  const name    = policy.policyInsurerName || NOT_PROVIDED;
  const logoUrl = policy.policyInsurerLogo || '';
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 2000, display: 'flex', alignItems: mobile ? 'flex-end' : 'center', justifyContent: 'center', padding: mobile ? 0 : '2rem' }} onClick={onClose}>
      <div className="glass-card" style={{ maxWidth: mobile ? '100%' : 400, width: '100%', padding: mobile ? '2rem 1.5rem' : '2.5rem', position: 'relative', textAlign: 'center', borderRadius: mobile ? '20px 20px 0 0' : undefined }} onClick={e => e.stopPropagation()}>
        <button type="button" onClick={onClose} aria-label="Close" style={{ position: 'absolute', top: 10, right: 10, background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', color: 'var(--slate)', fontSize: 18, borderRadius: 8, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>✕</button>
        <div style={{ width: 80, height: 80, margin: '0 auto 1.5rem' }}>
          <InsurerLogo logoUrl={logoUrl} name={name} size={80} />
        </div>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', marginBottom: '0.4rem' }}>{name}</h3>
        <p style={{ color: 'var(--slate)', fontSize: 13, marginBottom: '1.5rem' }}>Underwriting insurer for this policy</p>
        <button type="button" className="btn btn--ghost" style={{ width: '100%', justifyContent: 'center' }} onClick={onClose}>Close</button>
      </div>
    </div>
  );
};

/* ── Benefit Detail Modal ───────────────────────────────────────────────────── */
const BenefitModal = ({ policy, onClose, onNavigate }) => {
  const { mobile } = useResponsive();
  if (!policy) return null;
  const tags        = parseTags(policy.policyFeatureTags);
  const price       = minPremium(policy.policyDayPremiums);
  const currency    = policy.policyCurrency || 'KES';
  const insurerName = policy.policyInsurerName || NOT_PROVIDED;
  const logoUrl     = policy.policyInsurerLogo || '';
  const regionNames = (policy.regions?.nodes || []).map(r => r.name).join(', ') || NOT_PROVIDED;

  const benefitLines = policy.policyBenefits
    ? stripHtml(policy.policyBenefits).split(/[\n\r]+/).map(s => s.trim()).filter(Boolean)
    : [];

  const coverLines = policy.policyCoverDetails
    ? stripHtml(policy.policyCoverDetails).split(/[\n\r]+/).map(s => s.trim()).filter(Boolean)
    : [];

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(12px)', zIndex: 2000, display: 'flex', alignItems: mobile ? 'flex-end' : 'center', justifyContent: 'center', padding: mobile ? '0' : '2rem' }} onClick={onClose}>
      <div className="glass-card" style={{ maxWidth: 620, width: '100%', padding: mobile ? '1.5rem' : '2.5rem', position: 'relative', maxHeight: mobile ? '92vh' : '80vh', overflowY: 'auto', borderRadius: mobile ? '20px 20px 0 0' : undefined }} onClick={e => e.stopPropagation()}>
        <button type="button" onClick={onClose} aria-label="Close" style={{ position: 'absolute', top: 10, right: 10, background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', color: 'var(--slate)', fontSize: 18, borderRadius: 8, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>✕</button>
        <span className="badge badge--indigo" style={{ marginBottom: 14 }}>Plan Details</span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '1rem' }}>
          <InsurerLogo logoUrl={logoUrl} name={insurerName} size={48} />
          <div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', marginBottom: 2 }}>{policy.title}</h2>
            <p style={{ color: 'var(--slate)', fontSize: 13, margin: 0 }}>by {insurerName}</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: '1.2rem' }}>
          {[
            ['Starting Price', fmtPrice(price, currency) || NOT_PROVIDED],
            ['Currency',       currency],
            ['Region(s)',      regionNames],
            ['Plan',          policy.title],
          ].map(([k, v]) => (
            <div key={k} style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-sm)', padding: '12px 14px' }}>
              <div style={{ fontSize: 10, color: 'var(--slate-dark)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>{k}</div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{v}</div>
            </div>
          ))}
        </div>

        {tags.length > 0 && (
          <div style={{ marginBottom: '1rem' }}>
            <p style={{ fontSize: 11, color: 'var(--slate)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Features</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {tags.map(t => (
                <span key={t} style={{ padding: '4px 10px', borderRadius: 100, background: 'rgba(49,99,49,0.12)', border: '1px solid rgba(49,99,49,0.22)', fontSize: 11, fontWeight: 600, color: '#86efac' }}>{t}</span>
              ))}
            </div>
          </div>
        )}

        {benefitLines.length > 0 ? (
          <div style={{ marginBottom: '1rem' }}>
            <p style={{ fontSize: 11, color: 'var(--slate)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>What’s Covered</p>
            <ul style={{ margin: 0, paddingLeft: 18, color: 'rgba(255,255,255,0.8)', fontSize: 13, lineHeight: 2 }}>
              {benefitLines.map((b, i) => <li key={i}>{b}</li>)}
            </ul>
          </div>
        ) : coverLines.length > 0 ? (
          <div style={{ marginBottom: '1rem' }}>
            <p style={{ fontSize: 11, color: 'var(--slate)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Coverage Details</p>
            <ul style={{ margin: 0, paddingLeft: 18, color: 'rgba(255,255,255,0.8)', fontSize: 13, lineHeight: 2 }}>
              {coverLines.map((b, i) => <li key={i}>{b}</li>)}
            </ul>
          </div>
        ) : (
          <p style={{ color: 'var(--slate)', fontSize: 13, marginBottom: '1rem' }}>Coverage details: {NOT_PROVIDED}</p>
        )}

        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          <button className="btn btn--primary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => { onClose(); onNavigate('policy-detail', policy.databaseId); }}>View Full Policy ↗</button>
          <button type="button" className="btn btn--ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

const PolicyShowcase = ({ onNavigate, searchParams = null, compareSelected = [], onAddCompare, onRemoveCompare }) => {
  const { mobile } = useResponsive();
  const activeFilterRef = useRef(null);

  useEffect(() => { if (searchParams?.region) activeFilterRef.current = searchParams.region; }, [searchParams?.region]);
  const [activeFilter, setActiveFilter] = useState(() => searchParams?.region ?? null);
  const [selectedPolicy, setSelectedPolicy] = useState(null);
  const [selectedInsurerPolicy, setSelectedInsurerPolicy] = useState(null);

  /* ── Local travel dates (used when no searchParams, or to override) ── */
  const [today] = useState(() => new Date().toISOString().split('T')[0]);
  const [localDates, setLocalDates] = useState({
    departure: searchParams?.departure || '',
    returnDate: searchParams?.returnDate || '',
    passengers: searchParams?.passengers || 1,
  });

  const hasDates = localDates.departure && localDates.returnDate;
  const localDays = hasDates ? tripDays(localDates.departure, localDates.returnDate) : 0;
  const localPax = localDates.passengers || 1;

  const effectiveRegion = activeFilter;
  const [{ data, fetching, error }] = useQuery({ query: GET_POLICIES, variables: {} });

  const displayPolicies = useMemo(() => {
    const nodes = data?.policies?.nodes || [];
    const filtered = effectiveRegion
      ? nodes.filter(p => p.regions?.nodes?.some(r => r.slug === effectiveRegion))
      : nodes;
    return filtered.slice(0, 9);
  }, [data, effectiveRegion]);

  /* Derive filter chips from loaded policies — only show regions that have ≥1 policy. */
  const filterChips = useMemo(() => {
    const nodes = data?.policies?.nodes || [];
    const map = new Map(); // slug → name
    nodes.forEach(p => {
      (p.regions?.nodes || []).forEach(r => {
        if (r.slug && r.name && !map.has(r.slug)) map.set(r.slug, r.name);
      });
    });
    return [
      { label: 'All Policies', slug: null },
      ...Array.from(map.entries()).map(([slug, name]) => ({ label: name, slug })),
    ];
  }, [data]);

  const isInCompare = (id) => compareSelected.some(p => p.id === id);

  const toggleCompare = (policy) => {
    if (isInCompare(policy.id)) {
      onRemoveCompare?.(policy.id);
    } else if (compareSelected.length < 3) {
      onAddCompare?.(policy);
    }
  };

  return (
    <section id="policy-showcase" style={{ position: 'relative', zIndex: 1, padding: mobile ? '48px 0 60px' : '80px 0 110px' }}>
      <BenefitModal
        policy={selectedPolicy}
        onClose={() => setSelectedPolicy(null)}
        onNavigate={onNavigate}
      />
      <InsurerProfileModal policy={selectedInsurerPolicy} onClose={() => setSelectedInsurerPolicy(null)} />

      <div className="container">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: mobile ? 12 : 20, flexDirection: mobile ? 'column' : 'row', alignItems: mobile ? 'stretch' : 'flex-end' }}>
          <div>
            <p className="section-label">Compare & Buy</p>
            <h2 className="section-title" style={{ fontSize: 'clamp(28px,3vw,44px)' }}>
              Available Policies
            </h2>
          </div>
          <span style={{ fontSize: 13, color: 'var(--slate)' }}>Select up to 3 to compare side-by-side</span>
        </div>

        {/* ── Travel dates bar ── */}
        <div style={{
          background: 'var(--glass-bg)', border: '1px solid var(--glass-border-bright)', borderRadius: 'var(--radius-md)',
          padding: mobile ? '14px 16px' : '14px 24px', marginBottom: mobile ? 24 : 32,
          display: 'flex', alignItems: mobile ? 'stretch' : 'center', flexDirection: mobile ? 'column' : 'row',
          gap: mobile ? 12 : 16, flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--slate)', textTransform: 'uppercase', letterSpacing: '0.1em', whiteSpace: 'nowrap' }}>
            {hasDates ? '\u2713 Prices calculated' : 'Enter dates for exact prices'}
          </span>
          <div style={{ display: 'flex', gap: 10, flex: 1, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="date" className="form-input"
              value={localDates.departure} min={today}
              onChange={e => setLocalDates(d => ({ ...d, departure: e.target.value }))}
              style={{ flex: 1, minWidth: 130, padding: '8px 12px', fontSize: 13 }}
              aria-label="Departure date"
            />
            <span style={{ color: 'var(--slate)', fontSize: 13 }}>to</span>
            <input
              type="date" className="form-input"
              value={localDates.returnDate} min={localDates.departure || today}
              onChange={e => setLocalDates(d => ({ ...d, returnDate: e.target.value }))}
              style={{ flex: 1, minWidth: 130, padding: '8px 12px', fontSize: 13 }}
              aria-label="Return date"
            />
            <select
              className="form-input"
              value={localDates.passengers}
              onChange={e => setLocalDates(d => ({ ...d, passengers: Number(e.target.value) }))}
              style={{ width: mobile ? '100%' : 100, padding: '8px 12px', fontSize: 13 }}
              aria-label="Number of travellers"
            >
              {[1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n} {n === 1 ? 'traveller' : 'travellers'}</option>)}
            </select>
          </div>
          {hasDates && (
            <div style={{ fontSize: 12, color: '#86efac', fontWeight: 600, whiteSpace: 'nowrap' }}>
              {localDays} day{localDays !== 1 ? 's' : ''} &middot; {localPax} traveller{localPax !== 1 ? 's' : ''}
            </div>
          )}
        </div>

        {/* Filter chips — derived from policies that are actually in the system */}
        {filterChips.length > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: mobile ? 8 : 10, flexWrap: 'wrap', marginBottom: mobile ? 28 : 40 }}>
            {filterChips.map(chip => (
              <button key={chip.label} onClick={() => setActiveFilter(chip.slug)}
                style={{ padding: mobile ? '8px 14px' : '9px 20px', borderRadius: 100, border: `1px solid ${activeFilter === chip.slug ? 'rgba(49,99,49,0.5)' : 'var(--glass-border)'}`, background: activeFilter === chip.slug ? 'rgba(49,99,49,0.18)' : 'var(--glass-bg)', color: activeFilter === chip.slug ? '#86efac' : 'rgba(255,255,255,0.6)', fontFamily: 'var(--font-body)', fontSize: mobile ? 12 : 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
              >{chip.label}</button>
            ))}
          </div>
        )}

        {fetching && <p style={{ textAlign: 'center', color: 'var(--slate)', padding: '60px 0' }}>Loading policies…</p>}
        {error   && <p style={{ textAlign: 'center', color: '#f87171', padding: '60px 0' }}>Error: {error.message}</p>}

        {!fetching && !error && (
          <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : 'repeat(auto-fill,minmax(340px,1fr))', gap: 24 }}>
            {displayPolicies.map((policy) => {
              const price    = minPremium(policy.policyDayPremiums);
              const tags     = parseTags(policy.policyFeatureTags);
              const checked  = isInCompare(policy.id);

              return (
                <div key={policy.id} className="policy-card" style={{ background: 'var(--glass-bg)', border: `1px solid ${checked ? 'rgba(49,99,49,0.5)' : 'var(--glass-border)'}`, borderRadius: 'var(--radius-lg)', overflow: 'hidden', position: 'relative' }}
                >
                  {/* Card header */}
                  <div style={{ padding: '18px 18px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                      <InsurerLogo logoUrl={policy.policyInsurerLogo} name={policy.policyInsurerName} size={mobile ? 38 : 44} />
                      <div style={{ minWidth: 0 }}>
                        <button type="button" onClick={() => setSelectedInsurerPolicy(policy)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.75)', fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 0, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%', display: 'block' }} title="View insurer profile">{policy.policyInsurerName || 'Insurer'}</button>
                        <div style={{ display: 'flex', gap: 2, marginTop: 2 }}>
                          {'★★★★★'.split('').map((s, i) => <span key={i} style={{ color: i < 5 ? '#FBBF24' : 'var(--slate-dark)', fontSize: 11 }}>{s}</span>)}
                          <span style={{ color: 'var(--slate-dark)', fontSize: 11, marginLeft: 3 }}>5.0</span>
                        </div>
                      </div>
                    </div>

                    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: mobile ? 16 : 18, fontWeight: 700, marginBottom: 10, lineHeight: 1.3 }}>{policy.title}</h3>

                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 16 }}>
                      {hasDates ? (
                        <>
                          <span style={{ fontSize: 11, color: 'var(--slate)', marginBottom: 2 }}>your trip</span>
                          <span style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 800, color: '#86efac' }}>
                            {(() => {
                              const p = bracketPremium(policy.policyDayPremiums, localDays);
                              return p ? fmtPrice(p * localPax, policy.policyCurrency) : 'N/A';
                            })()}
                          </span>
                          <span style={{ fontSize: 13, color: 'var(--slate)' }}>
                            /{localDays} days{localPax > 1 ? ` · ${localPax} pax` : ''}
                          </span>
                        </>
                      ) : (
                        <>
                          <span style={{ fontSize: 11, color: 'var(--slate)', marginBottom: 2 }}>from</span>
                          <span style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 800, color: 'var(--white)' }}>
                            {fmtPrice(price, policy.policyCurrency) || 'N/A'}
                          </span>
                          <span style={{ fontSize: 13, color: 'var(--slate)' }}>/trip</span>
                        </>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                      {tags.slice(0, 3).map(t => (
                        <span key={t} style={{ padding: '4px 10px', borderRadius: 100, background: 'rgba(49,99,49,0.12)', border: '1px solid rgba(49,99,49,0.22)', fontSize: 11, fontWeight: 600, color: '#86efac' }}>{t}</span>
                      ))}
                    </div>

                    {policy.excerpt && (
                      <div style={{ color: 'var(--slate)', fontSize: 13, lineHeight: 1.65, WebkitLineClamp: 2, display: '-webkit-box', WebkitBoxOrient: 'vertical', overflow: 'hidden', marginBottom: 16 }} dangerouslySetInnerHTML={{ __html: policy.excerpt }} />
                    )}
                  </div>

                  {/* Card footer */}
                  <div style={{ borderTop: '1px solid var(--glass-border)', padding: mobile ? '14px 18px' : '16px 22px', display: 'flex', gap: 10 }}>
                    <button type="button" className="btn btn--primary btn--sm" style={{ flex: 1, justifyContent: 'center' }} onClick={() => onNavigate('policy-detail', policy.databaseId, searchParams)}>Pick This →</button>
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      disabled={compareSelected.length >= 3 && !checked}
                      style={{ opacity: compareSelected.length >= 3 && !checked ? 0.45 : 1, background: checked ? 'rgba(49,99,49,0.2)' : undefined, borderColor: checked ? 'rgba(49,99,49,0.6)' : undefined, color: checked ? '#86efac' : undefined }}
                      onClick={() => toggleCompare(policy)}
                    >{checked ? '✓ Comparing' : 'Compare'}</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!fetching && displayPolicies.length === 0 && (
          <p style={{ textAlign: 'center', color: 'var(--slate)', padding: '60px 0' }}>No policies found for this filter. Try selecting "All Policies".</p>
        )}
      </div>
    </section>
  );
};

export default PolicyShowcase;
