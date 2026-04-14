import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../lib/AuthContext';
import { useResponsive } from '../lib/useResponsive';
import Hero from './Hero';
import CategoryFilters from './CategoryFilters';
import TrustSection from './TrustSection';
import ProcessSection from './ProcessSection';
import PolicyShowcase from './PolicyShowcase';
import FAQSection from './FAQSection';
import TrustedPartners from './TrustedPartners';

const parseTags = (str) => {
  if (!str) return [];
  return str.split(',').map(t => t.trim()).filter(Boolean);
};

const fmtPrice = (price, currency = 'KES') => {
  if (price === null || price === undefined) return null;
  return `${currency} ${Number(price).toLocaleString('en-KE')}`;
};

const getDisplayFeatures = (p) => {
  if (p.policyFeatureTags) {
    const t = p.policyFeatureTags.split(',').map(s => s.trim()).filter(Boolean);
    if (t.length > 0) return t;
  }
  if (p.policyCoverDetails) {
    const matches = p.policyCoverDetails.match(/<b>(.*?)<\/b>/g) || [];
    return matches.map(m => m.replace(/<\/?b>|:/g, '').trim()).slice(0, 3);
  }
  return [];
};

/* Strip HTML and return individual benefit strings */
const parseBenefits = (html) => {
  if (!html) return [];
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .split(/\n|;/)
    .map(s => s.trim().replace(/^[-\u2013\u2022\u00b7*\u2713\u2717]+\s*/, '').trim())
    .filter(s => s.length > 5 && s.length < 220);
};

const normalizeBenefit = (s) =>
  s.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();

const keyWords = (s) =>
  normalizeBenefit(s).split(' ').filter(w => w.length > 3);

/* Returns subset of refList items that appear in ALL other lists */
const findCommonBenefits = (allLists) => {
  if (allLists.length < 2) return [];
  const [first, ...rest] = allLists;
  return first.filter(benefit => {
    const kw = keyWords(benefit);
    if (kw.length === 0) return false;
    return rest.every(list =>
      list.some(item => {
        const ik = keyWords(item);
        const matches = kw.filter(w => ik.includes(w) || normalizeBenefit(item).includes(w));
        return matches.length >= Math.ceil(kw.length * 0.5);
      })
    );
  });
};

const policyHasBenefit = (policy, benefitStr) => {
  const kw = keyWords(benefitStr);
  if (kw.length === 0) return false;
  const haystack = normalizeBenefit(
    (policy.policyBenefits || '') + ' ' + (policy.policyCoverDetails || '')
  );
  const matches = kw.filter(w => haystack.includes(w));
  return matches.length >= Math.ceil(kw.length * 0.5);
};

/** Days between two YYYY-MM-DD strings (inclusive) */
const tripDays = (dep, ret) => {
  if (!dep || !ret) return 0;
  const ms = new Date(ret) - new Date(dep);
  return Math.max(1, Math.round(ms / 86400000) + 1);
};

/** Find premium for trip length from day-bracket array */
const bracketPremium = (brackets, days) => {
  if (!brackets || !brackets.length) return null;
  const match = brackets.find(b => days >= b.from && days <= b.to);
  return match ? match.premium : null;
};

const fieldStyle = { display: 'flex', flexDirection: 'column', gap: 6 };
const labelStyle = { fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--gold)' };
const inputStyle = { padding: '10px 14px', borderRadius: 8, border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 14, fontFamily: 'var(--font-body)', outline: 'none', width: '100%', boxSizing: 'border-box' };

/* Compare Bar */
const CompareBar = ({ selected, onRemove, onClear, onCompare }) => {
  const { mobile } = useResponsive();
  if (selected.length < 1) return null;
  const canCompare = selected.length >= 2;
  return (
    <div role="region" aria-label="Policy comparison bar" style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 900, background: 'rgba(8,14,39,0.96)', backdropFilter: 'blur(18px)', borderTop: '1px solid rgba(49,99,49,0.35)', padding: mobile ? '10px 12px' : '14px 24px', display: 'flex', alignItems: 'center', gap: mobile ? 6 : 12, flexWrap: 'wrap', justifyContent: 'center', maxHeight: mobile ? '35vh' : undefined, overflowY: mobile ? 'auto' : undefined }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginRight: 4, ...(mobile ? { width: '100%', justifyContent: 'center' } : {}) }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: canCompare ? '#22c55e' : 'var(--gold)', boxShadow: canCompare ? '0 0 8px #22c55e' : '0 0 8px var(--gold)' }} aria-hidden="true" />
        <span style={{ fontWeight: 700, fontSize: mobile ? 13 : 14 }}>
          {canCompare
            ? `Comparing ${selected.length}/3`
            : `${selected.length} selected — pick ${2 - selected.length} more`
          }
        </span>
      </div>
      {selected.map(p => (
        <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--glass-bg-md)', border: '1px solid var(--glass-border)', borderRadius: 10, padding: mobile ? '6px 10px' : '8px 14px', fontSize: mobile ? 12 : 13, fontWeight: 600, flex: mobile ? '1 1 0' : undefined, minWidth: 0 }}>
          {p.policyInsurerLogo && (
            <img src={p.policyInsurerLogo} alt="" style={{ width: mobile ? 16 : 20, height: mobile ? 16 : 20, objectFit: 'contain', borderRadius: 4, flexShrink: 0 }} />
          )}
          <span style={{ maxWidth: mobile ? 100 : 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>{p.title}</span>
          <button onClick={() => onRemove(p.id)} aria-label={`Remove ${p.title} from comparison`} style={{ background: 'none', border: 'none', color: 'var(--slate)', fontSize: 16, cursor: 'pointer', lineHeight: 1, padding: '0 2px', flexShrink: 0 }}>&times;</button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8, ...(mobile ? { width: '100%' } : { marginLeft: 'auto' }) }}>
        <button className="btn btn--ghost btn--sm" onClick={onClear} style={mobile ? { flex: 1 } : undefined}>Clear</button>
        <button className="btn btn--primary btn--sm" onClick={onCompare} disabled={!canCompare} style={{ ...(mobile ? { flex: 2 } : {}), opacity: canCompare ? 1 : 0.45, cursor: canCompare ? 'pointer' : 'not-allowed' }}>Compare Now</button>
      </div>
    </div>
  );
};

/* Section divider row */
const SectionRow = ({ label, cols, accent }) => (
  <tr>
    <td colSpan={cols + 1} style={{
      padding: '10px 16px 8px',
      background: accent ? 'rgba(49,99,49,0.10)' : 'rgba(255,255,255,0.03)',
      borderTop: '1px solid rgba(255,255,255,0.08)',
      borderBottom: '1px solid rgba(255,255,255,0.08)',
    }}>
      <span style={{
        fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase',
        color: accent ? '#86efac' : 'var(--slate)',
      }}>{label}</span>
    </td>
  </tr>
);

/* Date picker shown before opening Compare Modal */
const CompareDatePicker = ({ onConfirm, onSkip, onClose }) => {
  const { mobile } = useResponsive();
  const today = new Date().toISOString().split('T')[0];
  const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
  const [dep, setDep] = useState(today);
  const [ret, setRet] = useState(nextWeek);
  const [pax, setPax] = useState(1);
  const days = tripDays(dep, ret);
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(16px)', zIndex: 1010, display: 'flex', alignItems: mobile ? 'flex-end' : 'center', justifyContent: 'center', padding: mobile ? 0 : '1rem' }}
      onClick={onClose}
    >
      <div
        style={{ background: 'var(--navy-mid)', border: '1px solid var(--glass-border-bright)', borderRadius: mobile ? '20px 20px 0 0' : 'var(--radius-xl)', padding: mobile ? '1.5rem 1.25rem' : '2rem', width: '100%', maxWidth: mobile ? '100%' : 400, position: 'relative' }}
        onClick={e => e.stopPropagation()}
      >
        <button onClick={onClose} style={{ position: 'absolute', top: 14, right: 16, background: 'none', border: 'none', color: 'var(--slate)', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>x</button>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800, marginBottom: 6, marginTop: 0 }}>
          Your <span style={{ color: 'var(--gold)' }}>Trip</span>
        </h3>
        <p style={{ fontSize: 12, color: 'var(--slate)', marginBottom: 22, marginTop: 0 }}>Enter dates to see exact pricing for your trip duration.</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Departure</label>
              <input type="date" style={inputStyle} min={today} value={dep} onChange={e => setDep(e.target.value)} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Return</label>
              <input type="date" style={inputStyle} min={dep} value={ret} onChange={e => setRet(e.target.value)} />
            </div>
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Travellers</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button style={{ ...inputStyle, width: 40, textAlign: 'center', cursor: 'pointer', flexShrink: 0, padding: '10px 0' }}
                onClick={() => setPax(p => Math.max(1, p - 1))}>-</button>
              <span style={{ fontSize: 18, fontWeight: 800, minWidth: 24, textAlign: 'center', flex: 1 }}>{pax}</span>
              <button style={{ ...inputStyle, width: 40, textAlign: 'center', cursor: 'pointer', flexShrink: 0, padding: '10px 0' }}
                onClick={() => setPax(p => p + 1)}>+</button>
            </div>
          </div>
        </div>

        {days > 0 && (
          <div style={{ margin: '16px 0 0', padding: '10px 14px', background: 'rgba(49,99,49,0.12)', border: '1px solid rgba(49,99,49,0.3)', borderRadius: 8, fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>
            Trip: <strong style={{ color: 'var(--gold)' }}>{days} day{days !== 1 ? 's' : ''}</strong> &nbsp;&middot;&nbsp; {pax} traveller{pax !== 1 ? 's' : ''}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 20 }}>
          <button
            className="btn btn--primary"
            style={{ width: '100%', justifyContent: 'center' }}
            disabled={!dep || !ret}
            onClick={() => onConfirm({ departure: dep, returnDate: ret, passengers: pax })}
          >
            Compare Plans &rarr;
          </button>
          <button
            className="btn btn--ghost btn--sm"
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={onSkip}
          >
            Skip &mdash; compare without dates
          </button>
        </div>
      </div>
    </div>
  );
};

/* Compare Modal */
const CompareModal = ({ selected, onClose, onPickPolicy, onKeepComparing, compareDates }) => {
  const { mobile } = useResponsive();
  if (!selected.length) return null;

  const allBenefitLists = selected.map(p => parseBenefits(p.policyBenefits));
  const commonBenefits  = findCommonBenefits(allBenefitLists);

  const uniqueBenefits = allBenefitLists.map(list =>
    list.filter(b => !commonBenefits.some(c => {
      const ck = keyWords(c), bk = keyWords(b);
      return ck.filter(w => bk.includes(w)).length >= Math.ceil(ck.length * 0.5);
    })).slice(0, 8)
  );

  const priceRange = (p) => {
    const prem = p.policyDayPremiums;
    if (!prem || prem.length === 0) return 'N/A';
    const cur = p.policyCurrency || 'KES';
    if (compareDates?.departure && compareDates?.returnDate) {
      const d = tripDays(compareDates.departure, compareDates.returnDate);
      const perPerson = bracketPremium(prem, d);
      if (perPerson !== null) {
        const total = perPerson * (compareDates.passengers || 1);
        return (
          <div>
            <div style={{ fontWeight: 700, fontSize: mobile ? 16 : 15, color: '#86efac' }}>
              {cur} {total.toLocaleString('en-KE')} total
            </div>
            <div style={{ fontSize: 11, color: 'var(--slate)', marginTop: 2 }}>
              {cur} {perPerson.toLocaleString('en-KE')}/person &middot; {d} days
            </div>
          </div>
        );
      }
    }
    const prices = prem.map(b => Number(b.premium)).filter(n => !isNaN(n));
    if (prices.length === 0) return 'N/A';
    const min = Math.min(...prices), max = Math.max(...prices);
    if (min === max) return fmtPrice(min, cur);
    return `${cur} ${min.toLocaleString('en-KE')} \u2013 ${max.toLocaleString('en-KE')}`;
  };

  /* ── Mobile: stacked card layout ─────────────────────────────── */
  const MobileLayout = () => (
    <div style={{ padding: '16px 16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {selected.map((p, idx) => {
        const regions = p.regions?.nodes?.map(r => r.name).filter(Boolean) || [];
        const tags = getDisplayFeatures(p);
        const uBenefits = uniqueBenefits[idx] || [];
        return (
          <div key={p.id} style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border-bright)', borderRadius: 16, padding: '20px 16px', width: '100%', boxSizing: 'border-box' }}>
            {/* Policy header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              {p.policyInsurerLogo && (
                <img src={p.policyInsurerLogo} alt={p.policyInsurerName || ''} style={{ height: 32, maxWidth: 60, objectFit: 'contain', flexShrink: 0, filter: 'brightness(1.1)' }} />
              )}
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, lineHeight: 1.3, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</div>
                {p.policyInsurerName && <div style={{ fontSize: 11, color: 'var(--slate)' }}>{p.policyInsurerName}</div>}
              </div>
            </div>

            {/* Price */}
            <div style={{ marginBottom: 14, padding: '10px 12px', background: 'rgba(49,99,49,0.08)', borderRadius: 10, border: '1px solid rgba(49,99,49,0.2)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--slate)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Price</div>
              <div style={{ fontWeight: 700, fontSize: 16, color: '#86efac' }}>{priceRange(p)}</div>
            </div>

            {/* Destinations */}
            {regions.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--slate)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Destinations</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {regions.map(r => <span key={r} style={{ background: 'rgba(49,99,49,0.18)', border: '1px solid rgba(49,99,49,0.3)', borderRadius: 6, padding: '3px 8px', fontSize: 11, fontWeight: 600 }}>{r}</span>)}
                </div>
              </div>
            )}

            {/* Coverage tags */}
            {tags.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--slate)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Coverage</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {tags.map(t => <span key={t} style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 6, padding: '3px 8px', fontSize: 11, fontWeight: 600, color: '#86efac' }}>{t}</span>)}
                </div>
              </div>
            )}

            {/* Unique benefits */}
            {uBenefits.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--slate)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Unique Benefits</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {uBenefits.map((b, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                      <span style={{ color: '#60a5fa', fontSize: 12, lineHeight: 1.5, flexShrink: 0 }}>{'\u25c6'}</span>
                      <span style={{ color: 'rgba(255,255,255,0.75)', lineHeight: 1.5, fontSize: 12 }}>{b}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Coverage checks */}
            {commonBenefits.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--slate)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Coverage Check</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {commonBenefits.slice(0, 8).map((benefit, i) => {
                    const has = policyHasBenefit(p, benefit);
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                        <span style={{ color: has ? '#22c55e' : 'rgba(255,255,255,0.18)', fontSize: 14, flexShrink: 0 }}>{has ? '\u2713' : '\u2717'}</span>
                        <span style={{ color: 'rgba(255,255,255,0.7)', lineHeight: 1.4 }}>{benefit.length > 50 ? benefit.slice(0, 47) + '\u2026' : benefit}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn--primary btn--sm" onClick={() => onPickPolicy(p)} style={{ flex: 1, justifyContent: 'center', fontWeight: 700 }}>
                Get a Quote &rarr;
              </button>
              <button className="btn btn--ghost btn--sm" onClick={() => onKeepComparing(p)} style={{ flex: 1, justifyContent: 'center', fontSize: 11 }}>
                Keep Comparing
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );

  /* ── Desktop: side-by-side table layout ──────────────────────── */
  const colW = `${Math.floor(85 / selected.length)}%`;
  const cellBase = { padding: '11px 16px', verticalAlign: 'top', fontSize: 13, borderBottom: '1px solid rgba(255,255,255,0.05)' };
  const labelCell = { ...cellBase, width: '15%', color: 'var(--slate)', fontWeight: 600, whiteSpace: 'nowrap', fontSize: 12 };

  const DesktopLayout = () => (
    <div style={{ overflowX: 'auto', padding: '20px 0 28px' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid rgba(49,99,49,0.4)' }}>
            <th style={{ width: '15%', padding: '14px 16px' }} />
            {selected.map(p => (
              <th key={p.id} style={{ width: colW, padding: '14px 16px', textAlign: 'left', verticalAlign: 'bottom' }}>
                {p.policyInsurerLogo && (
                  <img src={p.policyInsurerLogo} alt={p.policyInsurerName || ''} style={{ height: 28, maxWidth: 80, objectFit: 'contain', display: 'block', marginBottom: 8, filter: 'brightness(1.1)' }} />
                )}
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, lineHeight: 1.3, marginBottom: 4 }}>{p.title}</div>
                {p.policyInsurerName && <div style={{ fontSize: 11, color: 'var(--slate)' }}>{p.policyInsurerName}</div>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <SectionRow label="At a Glance" cols={selected.length} />
          <tr>
            <td style={labelCell}>Price Range</td>
            {selected.map(p => (
              <td key={p.id} style={{ ...cellBase, width: colW }}>
                <span style={{ fontWeight: 700, fontSize: 14, color: '#86efac' }}>{priceRange(p)}</span>
              </td>
            ))}
          </tr>
          <tr>
            <td style={labelCell}>Destinations</td>
            {selected.map(p => {
              const regions = p.regions?.nodes?.map(r => r.name).filter(Boolean) || [];
              return (
                <td key={p.id} style={{ ...cellBase, width: colW }}>
                  {regions.length > 0
                    ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {regions.map(r => <span key={r} style={{ background: 'rgba(49,99,49,0.18)', border: '1px solid rgba(49,99,49,0.3)', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>{r}</span>)}
                      </div>
                    : <span style={{ color: 'var(--slate)' }}>{'\u2014'}</span>
                  }
                </td>
              );
            })}
          </tr>
          <tr>
            <td style={labelCell}>Coverage</td>
            {selected.map(p => {
              const tags = getDisplayFeatures(p);
              return (
                <td key={p.id} style={{ ...cellBase, width: colW }}>
                  {tags.length > 0
                    ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {tags.map(t => <span key={t} style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600, color: '#86efac' }}>{t}</span>)}
                      </div>
                    : <span style={{ color: 'var(--slate)' }}>{'\u2014'}</span>
                  }
                </td>
              );
            })}
          </tr>

          {uniqueBenefits.some(l => l.length > 0) && (() => {
            const maxRows = Math.max(...uniqueBenefits.map(l => l.length), 1);
            return (
              <>
                <SectionRow label="Unique Coverage" cols={selected.length} />
                {Array.from({ length: maxRows }, (_, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <td style={labelCell} />
                    {selected.map((p, pi) => {
                      const item = uniqueBenefits[pi]?.[i];
                      return (
                        <td key={p.id} style={{ ...cellBase, width: colW }}>
                          {item && (
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7 }}>
                              <span style={{ color: '#60a5fa', fontSize: 14, lineHeight: 1.4, flexShrink: 0 }}>{'\u25c6'}</span>
                              <span style={{ color: 'rgba(255,255,255,0.75)', lineHeight: 1.5, fontSize: 12 }}>{item}</span>
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </>
            );
          })()}

          {commonBenefits.length > 0 && selected.length > 1 && (() => {
            const checkItems = commonBenefits.slice(0, 10);
            return (
              <>
                <SectionRow label="Coverage Presence Check" cols={selected.length} />
                {checkItems.map((benefit, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <td style={{ ...labelCell, fontSize: 11, whiteSpace: 'normal', lineHeight: 1.4 }}>
                      {benefit.length > 40 ? benefit.slice(0, 37) + '\u2026' : benefit}
                    </td>
                    {selected.map(p => {
                      const has = policyHasBenefit(p, benefit);
                      return (
                        <td key={p.id} style={{ ...cellBase, width: colW, textAlign: 'center' }}>
                          {has
                            ? <span style={{ color: '#22c55e', fontSize: 16 }} title="Covered">{'\u2713'}</span>
                            : <span style={{ color: 'rgba(255,255,255,0.18)', fontSize: 16 }} title="Not mentioned">{'\u2717'}</span>
                          }
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </>
            );
          })()}

          <tr style={{ borderTop: '2px solid rgba(49,99,49,0.3)', background: 'rgba(8,14,39,0.5)' }}>
            <td style={{ ...labelCell, verticalAlign: 'middle', paddingTop: 20, paddingBottom: 20, fontSize: 11, color: 'var(--slate)' }}>Actions</td>
            {selected.map(p => (
              <td key={p.id} style={{ ...cellBase, width: colW, paddingTop: 20, paddingBottom: 20, verticalAlign: 'middle' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <button className="btn btn--primary btn--sm" onClick={() => onPickPolicy(p)} style={{ width: '100%', justifyContent: 'center', fontWeight: 700 }}>
                    Get a Quote &rarr;
                  </button>
                  <button className="btn btn--ghost btn--sm" onClick={() => onKeepComparing(p)} style={{ width: '100%', justifyContent: 'center', fontSize: 11 }}>
                    Keep Comparing with this
                  </button>
                </div>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(16px)', zIndex: 1000, display: 'flex', alignItems: mobile ? 'flex-end' : 'flex-start', justifyContent: 'center', padding: mobile ? 0 : '2rem', overflowY: 'auto' }}
      onClick={onClose}
    >
      <div
        style={{ background: 'var(--navy-mid)', border: '1px solid var(--glass-border-bright)', borderRadius: mobile ? '20px 20px 0 0' : 'var(--radius-xl)', width: '100%', maxWidth: mobile ? '100%' : 920, position: 'relative', marginTop: mobile ? 0 : 20, marginBottom: mobile ? 0 : 40, maxHeight: mobile ? '94vh' : undefined, overflowY: mobile ? 'auto' : undefined }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: mobile ? '20px 16px 12px' : '24px 28px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: mobile ? 'sticky' : undefined, top: 0, background: mobile ? 'var(--navy-mid)' : undefined, zIndex: mobile ? 2 : undefined, borderRadius: mobile ? '20px 20px 0 0' : undefined }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: mobile ? '1.1rem' : '1.5rem', marginBottom: 4 }}>Policy Comparison</h2>
            <p style={{ fontSize: 12, color: 'var(--slate)' }}>
              {compareDates?.departure
                ? `${compareDates.departure} \u2192 ${compareDates.returnDate} \u00b7 ${tripDays(compareDates.departure, compareDates.returnDate)} days \u00b7 ${compareDates.passengers || 1} traveller${(compareDates.passengers || 1) !== 1 ? 's' : ''}`
                : `Comparing ${selected.length} ${selected.length === 1 ? 'policy' : 'policies'} side by side`
              }
            </p>
          </div>
          <button onClick={onClose} aria-label="Close comparison" style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', color: 'var(--slate)', fontSize: 18, borderRadius: 8, padding: '4px 12px', cursor: 'pointer', flexShrink: 0 }}>&times;</button>
        </div>

        {mobile ? <MobileLayout /> : <DesktopLayout />}

        <div style={{ padding: mobile ? '0 16px 20px' : '0 28px 20px' }}>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', lineHeight: 1.6, textAlign: 'center' }}>
            <strong style={{ color: 'rgba(255,255,255,0.45)' }}>Get a Quote</strong> proceeds to the purchase wizard.
            {' '}<strong style={{ color: 'rgba(255,255,255,0.45)' }}>Keep Comparing</strong> pre-selects that policy so you can pick others.
          </p>
        </div>
      </div>
    </div>
  );
};
const TESTIMONIALS = [
  { quote: 'I applied for a Schengen visa and had my Maljani certificate within 4 minutes. The embassy accepted it without question. Absolutely seamless.', name: 'Amina K.', title: 'Nairobi, Kenya', emoji: '\uD83D\uDC69\uD83C\uDFFE' },
  { quote: 'As a travel agency, we issue 50\u201380 policies a month. The agency dashboard has cut our paperwork time by 90%. Commission is tracked in real time.', name: 'James M.', title: 'Managing Director, Safara Travels', emoji: '\uD83D\uDC68\uD83C\uDFFF\u200D\uD83D\uDCBC' },
  { quote: 'Had a medical emergency in Dubai. Filed a claim through the insurer portal using my policy number. KES 420,000 was approved within 48 hours. Incredible.', name: 'Patricia W.', title: 'Kampala, Uganda', emoji: '\uD83D\uDC69\uD83C\uDFFE\u200D\u2695\uFE0F' },
];

const LandingPage = ({ onStartWizard, onNavigate }) => {
  const { user, role } = useAuth();
  const { mobile } = useResponsive();
  const isAgent = role === 'agent' || role === 'administrator';
  const [searchParams, setSearchParams] = useState(null);
  const [compareSelected, setCompareSelected] = useState([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareDates, setCompareDates] = useState(null);
  const [activeTestimonial, setActiveTestimonial] = useState(0);
  const touchStartX = useRef(null);

  // Auto-rotate testimonials
  useEffect(() => {
    const timer = setInterval(() => setActiveTestimonial(i => (i + 1) % TESTIMONIALS.length), 6000);
    return () => clearInterval(timer);
  }, []);

  const handleTestimonialSwipe = useCallback((e) => {
    if (e.type === 'touchstart') {
      touchStartX.current = e.touches[0].clientX;
    } else if (e.type === 'touchend' && touchStartX.current !== null) {
      const diff = e.changedTouches[0].clientX - touchStartX.current;
      if (Math.abs(diff) > 40) {
        setActiveTestimonial(i => diff < 0 ? (i + 1) % TESTIMONIALS.length : (i - 1 + TESTIMONIALS.length) % TESTIMONIALS.length);
      }
      touchStartX.current = null;
    }
  }, []);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const onAddCompare    = (p)   => setCompareSelected(prev => prev.length < 3 && !prev.find(x => x.id === p.id) ? [...prev, p] : prev);
  const onRemoveCompare = (id)  => setCompareSelected(prev => prev.filter(p => p.id !== id));

  /* Intersection Observer for reveal animations */
  useEffect(() => {
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
    }, { threshold: 0.12 });
    document.querySelectorAll('.reveal').forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  return (
    <div>
      {!isAgent && showDatePicker && (
        <CompareDatePicker
          onConfirm={(dates) => { setCompareDates(dates); setShowDatePicker(false); setCompareOpen(true); }}
          onSkip={() => { setCompareDates(null); setShowDatePicker(false); setCompareOpen(true); }}
          onClose={() => setShowDatePicker(false)}
        />
      )}
      {!isAgent && compareOpen && (
        <CompareModal
          selected={compareSelected}
          onClose={() => setCompareOpen(false)}
          compareDates={compareDates}
          onPickPolicy={(p) => {
            setCompareOpen(false);
            onStartWizard(p.databaseId, compareDates, null);
          }}
          onKeepComparing={(p) => {
            setCompareSelected([p]);
            setCompareOpen(false);
            setTimeout(() => document.getElementById('policy-showcase')?.scrollIntoView({ behavior: 'smooth' }), 80);
          }}
        />
      )}
      {!isAgent && (
        <CompareBar
          selected={compareSelected}
          onRemove={onRemoveCompare}
          onClear={() => setCompareSelected([])}
          onCompare={() => setShowDatePicker(true)}
        />
      )}

      <Hero onStart={(data) => {
        console.log('LandingPage onStart:', data);
        setSearchParams(data);
        document.getElementById('policy-showcase')?.scrollIntoView({ behavior: 'smooth' });
      }} onNavigate={onNavigate} />

      {!isAgent && <TrustSection />}

      {user && !isAgent && (
        <div style={{ position: 'relative', zIndex: 1, padding: '0 0 20px' }}>
          <div className="container">
            <div style={{ background: 'linear-gradient(135deg,rgba(49,99,49,0.18),rgba(49,99,49,0.08))', border: '1px solid rgba(49,99,49,0.35)', borderRadius: 'var(--radius-lg)', padding: mobile ? '20px 16px' : '28px 36px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, flexDirection: mobile ? 'column' : 'row', textAlign: mobile ? 'center' : 'left' }}>
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: '#86efac', marginBottom: 6 }}>Welcome back, {user.name}</p>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700 }}>Ready to issue a new policy? <span style={{ color: 'var(--gold)' }}>You're logged in as {role}.</span></h3>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button className="btn btn--ghost btn--sm" onClick={() => onNavigate('dashboard')}>Dashboard</button>
                <button className="btn btn--primary btn--sm" onClick={onStartWizard}>New Quote</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {!isAgent && (
        <CategoryFilters onSelect={(slug) => {
          setSearchParams({ region: slug });
          document.getElementById('policy-showcase')?.scrollIntoView({ behavior: 'smooth' });
        }} />
      )}

      {!isAgent && <ProcessSection />}

      {!isAgent && <PolicyShowcase
        onNavigate={onNavigate}
        searchParams={searchParams}
        compareSelected={compareSelected}
        onAddCompare={onAddCompare}
        onRemoveCompare={onRemoveCompare}
      />}

      {/* Agency CTA */}
      {!isAgent && (
      <section id="agencies" style={{ position: 'relative', zIndex: 1, padding: mobile ? '0 0 60px' : '0 0 110px' }}>
        <div className="container">
          <div style={{ background: 'linear-gradient(135deg,var(--navy-light) 0%,rgba(49,99,49,0.14) 100%)', border: '1px solid var(--glass-border-bright)', borderRadius: mobile ? 'var(--radius-lg)' : 'var(--radius-xl)', padding: mobile ? '40px 20px' : '72px 60px', display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 400px', gap: mobile ? 32 : 60, alignItems: 'center' }}>
            <div>
              <p className="section-label">For Insurance Agencies</p>
              <h2 className="section-title reveal" style={{ fontSize: 'clamp(28px,3vw,46px)', marginBottom: 18 }}>
                Issue Policies in Bulk.<br />From One Dashboard.
              </h2>
              <p className="reveal reveal-delay-1" style={{ color: 'var(--slate)', fontSize: 16, lineHeight: 1.8, marginBottom: 28 }}>
                Join 200+ agencies already issuing travel insurance certificates through Maljani. Branded certificates, commission tracking, and team management — all included.
              </p>
              <div className="reveal reveal-delay-2" style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 32 }}>
                {['\u2713 White-labelled PDF certificates', '\u2713 Commission dashboard (real-time)', '\u2713 Sub-agent accounts & role controls', '\u2713 API access for system integrations'].map(f => (
                  <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15 }}>
                    <span style={{ color: '#22c55e', fontSize: 16 }}>{f[0]}</span>
                    <span style={{ color: 'rgba(255,255,255,0.8)' }}>{f.slice(1)}</span>
                  </div>
                ))}
              </div>
              <div className="reveal reveal-delay-3" style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                <button className="btn btn--primary btn--lg" onClick={() => onNavigate('register')}>Apply for Agency Account</button>
                <button className="btn btn--ghost btn--lg" onClick={() => onNavigate('login')}>Agent Login</button>
              </div>
            </div>
            {/* Dashboard preview mockup */}
            <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-lg)', padding: 20, fontFamily: 'var(--font-body)' }} aria-hidden="true">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
                {['#ff5f57','#febc2e','#28c840'].map(c => <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />)}
                <span style={{ fontSize: 11, color: 'var(--slate)', marginLeft: 8 }}>Agency Dashboard</span>
              </div>
              {[['Policies Issued', '1,247', '#86efac'],['Monthly Revenue', 'KES 384K', 'var(--gold)'],['Active Sub-agents', '12', '#6ee7b7'],['Pending Commissions', 'KES 48K', '#f87171']].map(([k,v,c]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 12px', background: 'rgba(0,0,0,0.2)', borderRadius: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: 'var(--slate)' }}>{k}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: c }}>{v}</span>
                </div>
              ))}
              <div style={{ marginTop: 14, padding: '10px 14px', background: 'rgba(49,99,49,0.18)', border: '1px solid rgba(49,99,49,0.3)', borderRadius: 8, fontSize: 12, color: '#86efac', textAlign: 'center' }}>
                🔔 3 policies pending approval
              </div>
            </div>
          </div>
        </div>
      </section>
      )}

      <TrustedPartners />

      {/* Testimonials — swipeable carousel */}
      <section style={{ position: 'relative', zIndex: 1, padding: mobile ? '0 0 60px' : '0 0 110px' }}>
        <div className="container">
          <div className="section-header">
            <p className="section-label">Customer Stories</p>
            <h2 className="section-title reveal">Trusted by 50,000+ Travelers</h2>
            <p className="reveal reveal-delay-1">Real experiences from real policyholders across Africa and beyond.</p>
          </div>

          <div
            style={{ position: 'relative', overflow: 'hidden', maxWidth: 640, margin: '0 auto' }}
            onTouchStart={handleTestimonialSwipe}
            onTouchEnd={handleTestimonialSwipe}
          >
            {TESTIMONIALS.map((t, idx) => (
              <blockquote
                key={t.name}
                className="reveal"
                style={{
                  background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
                  borderRadius: 'var(--radius-lg)', padding: mobile ? '24px 20px 20px' : '36px 36px 28px',
                  margin: 0, display: idx === activeTestimonial ? 'flex' : 'none', flexDirection: 'column',
                  animation: 'fadeIn 0.5s ease',
                }}
              >
                <div style={{ fontSize: 28, color: 'var(--indigo-glow)', marginBottom: 14, lineHeight: 1 }}>"</div>
                <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: mobile ? 15 : 17, lineHeight: 1.85, flex: 1, marginBottom: 24 }}>{t.quote}</p>
                <footer style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 46, height: 46, borderRadius: '50%', background: 'var(--glass-bg-md)', border: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>{t.emoji}</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{t.name}</div>
                    <div style={{ fontSize: 13, color: 'var(--slate)' }}>{t.title}</div>
                  </div>
                </footer>
              </blockquote>
            ))}

            {/* Dots */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 24 }}>
              {TESTIMONIALS.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveTestimonial(idx)}
                  aria-label={`Testimonial ${idx + 1}`}
                  style={{
                    width: idx === activeTestimonial ? 28 : 10, height: 10, borderRadius: 100, border: 'none',
                    background: idx === activeTestimonial ? 'var(--gold)' : 'rgba(255,255,255,0.15)',
                    cursor: 'pointer', transition: 'all 0.3s ease', padding: 0,
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      <FAQSection />

      {/* Final CTA */}
      <section style={{ position: 'relative', zIndex: 1, padding: mobile ? '0 0 60px' : '0 0 120px' }}>
        <div className="container">
          <div style={{ background: 'linear-gradient(135deg,var(--indigo) 0%,var(--indigo-glow) 100%)', borderRadius: mobile ? 'var(--radius-lg)' : 'var(--radius-xl)', padding: mobile ? '48px 20px' : '80px 60px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: -40, right: -40, width: 300, height: 300, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', pointerEvents: 'none' }} aria-hidden="true" />
            <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', opacity: 0.7, marginBottom: 14 }}>Ready to travel?</p>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px,3.5vw,52px)', fontWeight: 800, marginBottom: 18, lineHeight: 1.1 }}>Get Covered in 3 Minutes.</h2>
            <p style={{ opacity: 0.85, fontSize: 17, marginBottom: 36, maxWidth: 480, margin: '0 auto 36px' }}>Compare Africa's best travel insurance policies and receive your certificate instantly.</p>
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
              {isAgent
                ? <button className="btn btn--gold btn--lg" onClick={() => onNavigate('dashboard')}>Open Dashboard →</button>
                : <button className="btn btn--gold btn--lg" onClick={() => document.getElementById('policy-showcase')?.scrollIntoView({ behavior: 'smooth' })}>Compare Policies Now →</button>
              }
              <button className="btn btn--ghost btn--lg" onClick={() => onNavigate('verify')}>Verify a Certificate</button>
            </div>
          </div>
        </div>
      </section>

      {/* Chat bubble */}
      <button
        aria-label="Open live chat"
        onClick={() => onNavigate('catalog')}
        style={{ position: 'fixed', bottom: compareSelected.length >= 1 ? 88 : 28, right: 28, zIndex: 800, width: 52, height: 52, borderRadius: '50%', background: 'var(--indigo)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, cursor: 'pointer', boxShadow: '0 4px 20px rgba(49,99,49,0.5)', transition: 'bottom 0.3s ease, transform 0.2s' }}
        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
        onMouseLeave={e => e.currentTarget.style.transform = 'none'}
      >💬</button>
    </div>
  );
};

export default LandingPage;
