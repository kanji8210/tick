import React, { useState, useMemo, useEffect } from 'react';
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
        regions {
          nodes {
            id
            slug
            name
          }
        }
        policyCurrency
        policyDescription
        policyBenefits
        policyCoverDetails
        policyNotCovered
        policyFeatureTags
        policyInsurerName
        policyInsurerLogo
        policyInsurerDatabaseId
        policyInsurerBio
        policyInsurerWebsite
        policyInsurerLinkedin
        policyInsurerFeatureImage
        policyCountries
        policyDayPremiums {
          from
          to
          premium
        }
        policyTypes {
          nodes {
            id
            slug
            name
          }
        }
      }
    }
  }
`;

const GET_REGIONS = `
  query GetRegionsForPolicyFilters($first: Int = 200) {
    regions(first: $first) {
      nodes {
        id
        slug
        name
        parent {
          node {
            id
            slug
            name
          }
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

/** Inclusive trip duration in days from two ISO date strings. Returns 0 if invalid. */
const tripDays = (from, to) => {
  if (!from || !to) return 0;
  const a = new Date(from); const b = new Date(to);
  if (isNaN(a) || isNaN(b)) return 0;
  const diff = Math.round((b - a) / 86400000) + 1;
  return diff > 0 ? diff : 0;
};

/** Premium for an exact day-count from the brackets, or null when none match. */
const bracketPremium = (brackets, days) => {
  if (!brackets || !brackets.length || !days) return null;
  const hit = brackets.find(b => days >= b.from && days <= b.to);
  return hit ? hit.premium : null;
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

const normalizeRegionLabel = (value) => (value || '').toLowerCase().replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();
const regionKey = (region) => normalizeRegionLabel(region?.slug || region?.name || '');

/** Parse the first two columns from a benefits HTML table. */
const parseBenefitTableRows = (html) => {
  if (!html || !/<table/i.test(html)) return [];

  const rows = [];
  const rowRx = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;

  while ((rowMatch = rowRx.exec(html)) !== null) {
    const cols = [];
    const cellRx = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let cellMatch;

    while ((cellMatch = cellRx.exec(rowMatch[1])) !== null) {
      const text = stripHtml(cellMatch[1]);
      if (text) cols.push(text);
    }

    if (cols.length >= 2) rows.push([cols[0], cols[1]]);
  }

  return rows;
};

const parseBenefitAmount = (raw) => {
  if (!raw) return 0;
  const cleaned = String(raw).replace(/,/g, '');
  const matches = cleaned.match(/\d+(?:\.\d+)?/g);
  if (!matches || !matches.length) return 0;
  return Math.max(...matches.map((m) => Number(m) || 0));
};

const benefitPriority = (policy, sortKey) => {
  if (!sortKey || sortKey === 'default') return 0;
  const rows = parseBenefitTableRows(policy.policyBenefits || '');
  if (!rows.length) return 0;

  const matchers = {
    medical: /medical|hospital|health|emergency/i,
    luggage: /luggage|baggage|bag/i,
    delay: /delay|flight delay|travel delay/i,
    cancellation: /cancel|cancellation|trip cancellation/i,
  };

  const rx = matchers[sortKey];
  if (!rx) return 0;

  const hit = rows.find(([name]) => rx.test(name || ''));
  if (!hit) return 0;
  return parseBenefitAmount(hit[1]);
};

const filterSelectStyle = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: 10,
  border: '1px solid var(--glass-border)',
  background: 'rgba(15,23,42,0.92)',
  color: '#fff',
  fontSize: 14,
  fontFamily: 'var(--font-body)',
  outline: 'none',
  colorScheme: 'dark',
};

const filterOptionStyle = {
  backgroundColor: '#0f172a',
  color: '#fff',
};

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

/* ── Large clickable logo banner (~40% card width) ───────────────────────── */
const InsurerLogoBanner = ({ logoUrl, name, onClick }) => {
  const baseStyle = {
    width: '40%',
    aspectRatio: '5 / 3',
    borderRadius: 12,
    background: logoUrl ? 'white' : 'rgba(49,99,49,0.18)',
    border: '1px solid var(--glass-border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: logoUrl ? 10 : 0,
    overflow: 'hidden',
    flexShrink: 0,
    cursor: onClick ? 'pointer' : 'default',
    transition: 'transform 0.18s ease, box-shadow 0.18s ease',
  };
  const initial = (name && name !== NOT_PROVIDED) ? name.charAt(0).toUpperCase() : '?';
  return (
    <button
      type="button"
      onClick={onClick}
      title={name ? `View ${name} profile` : 'View insurer profile'}
      aria-label={name ? `View ${name} profile` : 'View insurer profile'}
      style={baseStyle}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px -12px rgba(0,0,0,0.5)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      {logoUrl ? (
        <img src={logoUrl} alt={name || 'Insurer'} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
      ) : (
        <span style={{ fontSize: 36, fontWeight: 800, color: '#86efac' }}>{initial}</span>
      )}
    </button>
  );
};

/* ── Insurer Profile Modal ──────────────────────────────────────────────────── */
const InsurerProfileModal = ({ policy, onClose }) => {
  const { mobile } = useResponsive();
  if (!policy) return null;
  const name        = policy.policyInsurerName || NOT_PROVIDED;
  const logoUrl     = policy.policyInsurerLogo || '';
  const bio         = (policy.policyInsurerBio || '').trim();
  const website     = (policy.policyInsurerWebsite || '').trim();
  const linkedin    = (policy.policyInsurerLinkedin || '').trim();
  const featureImg  = policy.policyInsurerFeatureImage || '';
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 2000, display: 'flex', alignItems: mobile ? 'flex-end' : 'center', justifyContent: 'center', padding: mobile ? 0 : '2rem' }} onClick={onClose}>
      <div className="glass-card" style={{ maxWidth: mobile ? '100%' : 520, width: '100%', padding: 0, position: 'relative', borderRadius: mobile ? '20px 20px 0 0' : undefined, overflow: 'hidden', maxHeight: mobile ? '92vh' : '85vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        <button type="button" onClick={onClose} aria-label="Close" style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,0.55)', border: '1px solid var(--glass-border)', color: '#fff', fontSize: 18, borderRadius: 8, width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 2 }}>✕</button>

        {featureImg ? (
          <div style={{ width: '100%', height: 160, backgroundImage: `url(${featureImg})`, backgroundSize: 'cover', backgroundPosition: 'center', position: 'relative' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.0) 30%, rgba(0,0,0,0.7) 100%)' }} />
          </div>
        ) : null}

        <div style={{ padding: mobile ? '1.5rem' : '2rem', overflowY: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: '1.2rem', marginTop: featureImg ? '-44px' : 0 }}>
            <div style={{ background: 'white', borderRadius: 12, padding: 6, border: '1px solid var(--glass-border)', boxShadow: featureImg ? '0 10px 25px -10px rgba(0,0,0,0.6)' : 'none' }}>
              <InsurerLogo logoUrl={logoUrl} name={name} size={64} />
            </div>
            <div style={{ minWidth: 0 }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', margin: 0, color: '#fff' }}>{name}</h3>
              <p style={{ color: 'var(--slate)', fontSize: 12, margin: '4px 0 0' }}>Underwriting insurer</p>
            </div>
          </div>

          {bio ? (
            <p style={{ color: 'rgba(255,255,255,0.82)', fontSize: 14, lineHeight: 1.7, marginBottom: '1.2rem' }}>{bio}</p>
          ) : (
            <p style={{ color: 'var(--slate)', fontSize: 13, marginBottom: '1.2rem' }}>No profile description provided.</p>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: '0.5rem' }}>
            {website && (
              <a href={website} target="_blank" rel="noopener noreferrer" className="btn btn--ghost btn--sm" style={{ textDecoration: 'none' }}>Website ↗</a>
            )}
            {linkedin && (
              <a href={linkedin} target="_blank" rel="noopener noreferrer" className="btn btn--ghost btn--sm" style={{ textDecoration: 'none' }}>LinkedIn ↗</a>
            )}
            <button type="button" className="btn btn--ghost btn--sm" style={{ marginLeft: 'auto' }} onClick={onClose}>Close</button>
          </div>
        </div>
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
  const benefitTableRows = parseBenefitTableRows(policy.policyBenefits || '');

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

        {benefitTableRows.length > 0 ? (
          <div style={{ marginBottom: '1rem' }}>
            <p style={{ fontSize: 11, color: 'var(--slate)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Key Benefits</p>
            <div style={{ maxHeight: '50vh', overflow: 'auto', border: '1px solid var(--glass-border)', borderRadius: 10 }}>
              <table style={{ width: '100%', minWidth: 440, borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '10px 12px', color: 'var(--gold)', borderBottom: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.03)' }}>Benefit</th>
                    <th style={{ textAlign: 'left', padding: '10px 12px', color: 'var(--gold)', borderBottom: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.03)' }}>Limit</th>
                  </tr>
                </thead>
                <tbody>
                  {benefitTableRows.map((row, idx) => (
                    <tr key={idx}>
                      <td style={{ padding: '9px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.9)', verticalAlign: 'top' }}>{row[0]}</td>
                      <td style={{ padding: '9px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.82)', verticalAlign: 'top' }}>{row[1]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : benefitLines.length > 0 ? (
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
  const { mobile, tablet } = useResponsive();

  const [selectedPolicy, setSelectedPolicy] = useState(null);
  const [selectedInsurerPolicy, setSelectedInsurerPolicy] = useState(null);
  const [selectedRegion, setSelectedRegion] = useState(searchParams?.region || 'all');
  const [selectedPolicyType, setSelectedPolicyType] = useState('all');
  const [sortBenefitBy, setSortBenefitBy] = useState('default');
  const [departure, setDeparture] = useState(searchParams?.departure || '');
  const [returnDate, setReturnDate] = useState(searchParams?.returnDate || '');

  const days = useMemo(() => tripDays(departure, returnDate), [departure, returnDate]);
  const hasDates = days > 0;

  const [{ data, fetching, error }] = useQuery({ query: GET_POLICIES, variables: {} });
  const [{ data: regionsData }] = useQuery({ query: GET_REGIONS, variables: {} });

  // Random ordering: re-seed only when the underlying data changes. We deliberately
  // call Math.random in an effect (after data loads) and write to state so the
  // shuffled list is stable across re-renders.
  const [shuffleSeed, setShuffleSeed] = useState(1);
  useEffect(() => {
    if (!data?.policies?.nodes) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShuffleSeed(Math.floor(Math.random() * 2 ** 31) || 1);
  }, [data]);

  const destinationOptions = useMemo(() => {
    const backendRegions = regionsData?.regions?.nodes || [];
    const policyNodes = data?.policies?.nodes || [];

    const included = new Map();
    backendRegions.forEach((region) => {
      const key = regionKey(region);
      if (!key || included.has(key)) return;
      included.set(key, region);
    });

    // Safety fallback when region taxonomy query is empty/unavailable.
    if (included.size === 0) {
      policyNodes.forEach((policy) => {
        (policy.regions?.nodes || []).forEach((region) => {
          const key = regionKey(region);
          if (!key || included.has(key)) return;
          included.set(key, { id: region.id, slug: region.slug, name: region.name, parent: null });
        });
      });
    }

    return Array.from(included.values())
      .map((region) => ({
        key: regionKey(region),
        slug: region.slug || region.name,
        name: region.name || region.slug,
        parentKey: regionKey(region.parent?.node),
      }))
      .filter((region) => region.key)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data, regionsData]);

  const parentRegionOptions = useMemo(() => {
    return destinationOptions
      .filter((option) => !option.parentKey || !destinationOptions.some((candidate) => candidate.key === option.parentKey))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [destinationOptions]);

  const policyTypeOptions = useMemo(() => {
    const nodes = data?.policies?.nodes || [];
    const map = new Map();
    nodes.forEach((policy) => {
      (policy.policyTypes?.nodes || []).forEach((type) => {
        if (!type?.slug || !type?.name || map.has(type.slug)) return;
        map.set(type.slug, type.name);
      });
    });
    return Array.from(map.entries()).map(([slug, name]) => ({ slug, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);

  const displayPolicies = useMemo(() => {
    let nodes = [...(data?.policies?.nodes || [])].filter((policy) => {
      const regions = policy.regions?.nodes || [];
      if (selectedRegion !== 'all') {
        const hasRegion = regions.some((region) => region.slug === selectedRegion || region.name === selectedRegion);
        if (!hasRegion) return false;
      }

      if (selectedPolicyType !== 'all') {
        const hasType = (policy.policyTypes?.nodes || []).some((type) => type.slug === selectedPolicyType || type.name === selectedPolicyType);
        if (!hasType) return false;
      }

      return true;
    });

    if (sortBenefitBy !== 'default') {
      nodes.sort((a, b) => benefitPriority(b, sortBenefitBy) - benefitPriority(a, sortBenefitBy));
    } else {
      let s = shuffleSeed | 0;
      const rand = () => {
        s = s + 0x6D2B79F5 | 0;
        let t = Math.imul(s ^ s >>> 15, 1 | s);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
      };
      for (let i = nodes.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [nodes[i], nodes[j]] = [nodes[j], nodes[i]];
      }
    }

    return nodes.slice(0, 20);
  }, [data, selectedRegion, selectedPolicyType, sortBenefitBy, shuffleSeed]);

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

      <div className="container" style={{ maxWidth: mobile ? undefined : 1520 }}>
        {fetching && <p style={{ textAlign: 'center', color: 'var(--slate)', padding: '60px 0' }}>Loading policies…</p>}
        {error   && <p style={{ textAlign: 'center', color: '#f87171', padding: '60px 0' }}>Error: {error.message}</p>}

        {!fetching && !error && destinationOptions.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--slate)', margin: 0 }}>
                Filter by Destination, Type &amp; Benefits
              </p>
              {!mobile && (selectedRegion !== 'all' || selectedPolicyType !== 'all' || sortBenefitBy !== 'default' || departure || returnDate) && (
                <button
                  type="button"
                  onClick={() => { setSelectedRegion('all'); setSelectedPolicyType('all'); setSortBenefitBy('default'); setDeparture(''); setReturnDate(''); }}
                  style={{ fontSize: 12, color: 'var(--gold)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 700 }}
                >
                  Clear Filters
                </button>
              )}
            </div>

            {/* Date range — used to compute real premiums when both dates set */}
            <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr auto', gap: 10, marginBottom: 12, alignItems: 'end' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--slate-dark)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Departure</span>
                <input
                  type="date"
                  value={departure}
                  onChange={(e) => setDeparture(e.target.value)}
                  style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 14, fontFamily: 'var(--font-body)', outline: 'none', colorScheme: 'dark' }}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--slate-dark)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Return</span>
                <input
                  type="date"
                  value={returnDate}
                  min={departure || undefined}
                  onChange={(e) => setReturnDate(e.target.value)}
                  style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 14, fontFamily: 'var(--font-body)', outline: 'none', colorScheme: 'dark' }}
                />
              </label>
              <div style={{ fontSize: 12, color: hasDates ? '#86efac' : 'var(--slate-dark)', fontWeight: 700, whiteSpace: 'nowrap', padding: mobile ? '4px 0' : '0 4px 12px' }}>
                {hasDates ? `${days} day${days > 1 ? 's' : ''} trip — showing exact premium` : 'Pick dates for exact premium'}
              </div>
            </div>

            {mobile ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--slate-dark)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Region</div>
                <select
                  value={selectedRegion}
                  onChange={(e) => { setSelectedRegion(e.target.value); setSelectedPolicyType('all'); }}
                  style={filterSelectStyle}
                >
                  <option value="all" style={filterOptionStyle}>All Regions</option>
                  {parentRegionOptions.map((region) => (
                    <option key={region.slug} value={region.slug} style={filterOptionStyle}>{region.name}</option>
                  ))}
                </select>

                {selectedRegion !== 'all' && policyTypeOptions.length > 0 && (
                  <>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--slate-dark)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Policy Type</div>
                    <select
                      value={selectedPolicyType}
                      onChange={(e) => setSelectedPolicyType(e.target.value)}
                      style={filterSelectStyle}
                    >
                      <option value="all" style={filterOptionStyle}>All Types</option>
                      {policyTypeOptions.map((option) => (
                        <option key={option.slug} value={option.slug} style={filterOptionStyle}>{option.name}</option>
                      ))}
                    </select>
                  </>
                )}

                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--slate-dark)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Sort by Benefit</div>
                <select
                  value={sortBenefitBy}
                  onChange={(e) => setSortBenefitBy(e.target.value)}
                  style={filterSelectStyle}
                >
                  <option value="default" style={filterOptionStyle}>Default</option>
                  <option value="medical" style={filterOptionStyle}>Medical</option>
                  <option value="luggage" style={filterOptionStyle}>Luggage</option>
                  <option value="delay" style={filterOptionStyle}>Delay</option>
                  <option value="cancellation" style={filterOptionStyle}>Cancellation</option>
                </select>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--slate-dark)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Region</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => { setSelectedRegion('all'); setSelectedPolicyType('all'); }}
                    style={{ padding: '6px 12px', borderRadius: 999, border: `1px solid ${selectedRegion === 'all' ? 'rgba(49,99,49,0.7)' : 'var(--glass-border)'}`, background: selectedRegion === 'all' ? 'rgba(49,99,49,0.2)' : 'var(--glass-bg)', color: selectedRegion === 'all' ? '#86efac' : 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                  >
                    All Regions
                  </button>
                  {parentRegionOptions.map((parent) => (
                    <button
                      key={parent.slug}
                      type="button"
                      onClick={() => { setSelectedRegion(parent.slug); setSelectedPolicyType('all'); }}
                      style={{ padding: '6px 12px', borderRadius: 999, border: `1px solid ${selectedRegion === parent.slug ? 'rgba(49,99,49,0.7)' : 'var(--glass-border)'}`, background: selectedRegion === parent.slug ? 'rgba(49,99,49,0.2)' : 'var(--glass-bg)', color: selectedRegion === parent.slug ? '#86efac' : 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                    >
                      {parent.name}
                    </button>
                  ))}
                </div>

                {selectedRegion !== 'all' && policyTypeOptions.length > 0 && (
                  <>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--slate-dark)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Policy Type</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => setSelectedPolicyType('all')}
                        style={{ padding: '6px 12px', borderRadius: 999, border: `1px solid ${selectedPolicyType === 'all' ? 'rgba(49,99,49,0.7)' : 'var(--glass-border)'}`, background: selectedPolicyType === 'all' ? 'rgba(49,99,49,0.2)' : 'var(--glass-bg)', color: selectedPolicyType === 'all' ? '#86efac' : 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                      >
                        All Types
                      </button>
                      {policyTypeOptions.map((option) => (
                        <button
                          key={option.slug}
                          type="button"
                          onClick={() => setSelectedPolicyType(option.slug)}
                          style={{ padding: '6px 12px', borderRadius: 999, border: `1px solid ${selectedPolicyType === option.slug ? 'rgba(49,99,49,0.7)' : 'var(--glass-border)'}`, background: selectedPolicyType === option.slug ? 'rgba(49,99,49,0.2)' : 'var(--glass-bg)', color: selectedPolicyType === option.slug ? '#86efac' : 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                        >
                          {option.name}
                        </button>
                      ))}
                    </div>
                  </>
                )}

                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--slate-dark)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Sort by Benefit</div>
                <select
                  value={sortBenefitBy}
                  onChange={(e) => setSortBenefitBy(e.target.value)}
                  style={{ ...filterSelectStyle, maxWidth: 320, padding: '10px 12px' }}
                >
                  <option value="default" style={filterOptionStyle}>Default</option>
                  <option value="medical" style={filterOptionStyle}>Medical</option>
                  <option value="luggage" style={filterOptionStyle}>Luggage</option>
                  <option value="delay" style={filterOptionStyle}>Delay</option>
                  <option value="cancellation" style={filterOptionStyle}>Cancellation</option>
                </select>
              </div>
            )}
          </div>
        )}

        {!fetching && !error && (
          <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : tablet ? 'repeat(2, minmax(0, 1fr))' : 'repeat(3, minmax(0, 1fr))', gap: mobile ? 16 : 24 }}>
            {displayPolicies.map((policy) => {
              const exactPrice = hasDates ? bracketPremium(policy.policyDayPremiums, days) : null;
              const minPrice   = minPremium(policy.policyDayPremiums);
              const price      = exactPrice ?? minPrice;
              const isExact    = hasDates && exactPrice !== null;
              const tags       = parseTags(policy.policyFeatureTags);
              const checked    = isInCompare(policy.id);

              return (
                <div key={policy.id} className="policy-card" style={{ background: 'var(--glass-bg)', border: `1px solid ${checked ? 'rgba(49,99,49,0.5)' : 'var(--glass-border)'}`, borderRadius: 'var(--radius-lg)', overflow: 'hidden', position: 'relative' }}
                >
                  {/* Card header */}
                  <div style={{ padding: '18px 18px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                      <InsurerLogoBanner
                        logoUrl={policy.policyInsurerLogo}
                        name={policy.policyInsurerName}
                        onClick={() => setSelectedInsurerPolicy(policy)}
                      />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <button type="button" onClick={() => setSelectedInsurerPolicy(policy)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.85)', fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 700, cursor: 'pointer', padding: 0, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%', display: 'block', textDecoration: 'underline', textUnderlineOffset: 3, textDecorationColor: 'rgba(255,255,255,0.25)' }} title="View insurer profile">{policy.policyInsurerName || 'Insurer'}</button>
                        <div style={{ display: 'flex', gap: 2, marginTop: 2 }}>
                          {'★★★★★'.split('').map((s, i) => <span key={i} style={{ color: i < 5 ? '#FBBF24' : 'var(--slate-dark)', fontSize: 11 }}>{s}</span>)}
                          <span style={{ color: 'var(--slate-dark)', fontSize: 11, marginLeft: 3 }}>5.0</span>
                        </div>
                      </div>
                    </div>

                    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: mobile ? 16 : 18, fontWeight: 700, marginBottom: 10, lineHeight: 1.3 }}>{policy.title}</h3>

                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, color: 'var(--slate)', marginBottom: 2 }}>{isExact ? 'price' : 'from'}</span>
                      <span style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 800, color: 'var(--white)' }}>
                        {fmtPrice(price, policy.policyCurrency) || 'N/A'}
                      </span>
                      <span style={{ fontSize: 13, color: 'var(--slate)' }}>{isExact ? `/ ${days}d trip` : '/trip'}</span>
                      {isExact && (
                        <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, color: '#86efac', background: 'rgba(49,99,49,0.18)', border: '1px solid rgba(49,99,49,0.4)', padding: '3px 8px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Exact</span>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                      {tags.slice(0, 3).map(t => (
                        <span key={t} style={{ padding: '4px 10px', borderRadius: 100, background: 'rgba(49,99,49,0.12)', border: '1px solid rgba(49,99,49,0.22)', fontSize: 11, fontWeight: 600, color: '#86efac' }}>{t}</span>
                      ))}
                    </div>

                    {policy.excerpt && (
                      <div style={{ color: 'var(--slate)', fontSize: 13, lineHeight: 1.65, WebkitLineClamp: 2, display: '-webkit-box', WebkitBoxOrient: 'vertical', overflow: 'hidden', marginBottom: 16 }} dangerouslySetInnerHTML={{ __html: policy.excerpt }} />
                    )}
                  </div>

                  {/* Card footer */}
                  <div style={{ borderTop: '1px solid var(--glass-border)', padding: mobile ? '14px 18px' : '16px 22px', display: 'flex', gap: 10, flexWrap: mobile ? 'wrap' : 'nowrap' }}>
                    <button type="button" className="btn btn--primary btn--sm" style={{ flex: 1, justifyContent: 'center' }} onClick={() => onNavigate('policy-detail', policy.databaseId, { ...(searchParams || {}), departure, returnDate })}>Pick This →</button>
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      disabled={compareSelected.length >= 3 && !checked}
                      style={{ opacity: compareSelected.length >= 3 && !checked ? 0.45 : 1, background: checked ? 'rgba(49,99,49,0.2)' : undefined, borderColor: checked ? 'rgba(49,99,49,0.6)' : undefined, color: checked ? '#86efac' : undefined }}
                      onClick={() => toggleCompare(policy)}
                    >{checked ? '✓ Comparing' : 'Compare'}</button>
                    <button type="button" className="btn btn--ghost btn--sm" style={{ justifyContent: 'center' }} onClick={() => setSelectedPolicy(policy)}>
                      Benefits
                    </button>
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
