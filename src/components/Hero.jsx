import React, { useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "urql";
import { useAuth } from "../lib/AuthContext";
import { useResponsive } from "../lib/useResponsive";
import GroupQuoteWizard from "./GroupQuoteWizard";

const GET_REGIONS = `
  query GetRegions {
    regions(first: 50) {
      nodes { id databaseId name slug }
    }
  }
`;

const MY_POLICIES = `
  query HeroMyPolicies {
    myPolicySales {
      id
      policyTitle
      policyNumber
      region
      departure
      returnDate
      passengers
      amountPaid
      paymentStatus
      policyStatus
    }
  }
`;

const HERO_POLICIES_BY_REGION = `
  query HeroPoliciesByRegion {
    policies(first: 80) {
      nodes {
        id
        databaseId
        title
        policyCurrency
        policyInsurerName
        policyInsurerLogo
        regions { nodes { slug name } }
        policyDayPremiums { from to premium }
      }
    }
  }
`;

const HERO_POLICY_SALES_COUNT = `
  query HeroPolicySalesCount {
    policySales(first: 1) {
      pageInfo { total }
    }
  }
`;

const PS_MAP = {
  active:      { label: "Active",     color: "#22c55e", bg: "rgba(34,197,94,0.12)" },
  confirmed:   { label: "Confirmed",  color: "#60a5fa", bg: "rgba(96,165,250,0.12)" },
  approved:    { label: "Approved",   color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  unconfirmed: { label: "Pending",    color: "#94a3b8", bg: "rgba(148,163,184,0.1)"  },
  expired:     { label: "Expired",    color: "#f87171", bg: "rgba(248,113,113,0.1)"  },
};
const getPS = (s) => PS_MAP[s] ?? PS_MAP.unconfirmed;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const fmtKES  = (n) => `KES ${Number(n || 0).toLocaleString("en-KE")}`;

const Reassure = ({ children }) => (
  <div style={{
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '6px 10px', borderRadius: 999,
    background: 'rgba(49,99,49,0.15)', border: '1px solid rgba(49,99,49,0.32)',
    fontSize: 11, color: '#86efac', marginBottom: 14,
  }}>
    <span aria-hidden="true">💡</span>{children}
  </div>
);

const SheetHeading = ({ children }) => (
  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--white)', margin: '0 0 8px' }}>
    {children}
  </h3>
);

const fmtShortDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return d.toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' });
};

const tripDaysInclusive = (from, to) => {
  if (!from || !to) return 0;
  const a = new Date(from); const b = new Date(to);
  if (isNaN(a) || isNaN(b)) return 0;
  const diff = Math.round((b - a) / 86400000) + 1;
  return diff > 0 ? diff : 0;
};

const bracketPremiumFor = (brackets, days) => {
  if (!brackets || !brackets.length || !days) return null;
  const hit = brackets.find((b) => days >= b.from && days <= b.to);
  return hit ? Number(hit.premium) : null;
};

const REGION_VISUALS = [
  { match: /schengen|europe/i,        emoji: '🇪🇺', gradient: 'linear-gradient(135deg,#3b82f6,#1e40af)' },
  { match: /east[\s-]*africa/i,       emoji: '🐘', gradient: 'linear-gradient(135deg,#f59e0b,#b45309)' },
  { match: /africa[\s-]*asia/i,       emoji: '🌍', gradient: 'linear-gradient(135deg,#ec4899,#9d174d)' },
  { match: /africa/i,                 emoji: '🦒', gradient: 'linear-gradient(135deg,#f97316,#7c2d12)' },
  { match: /worldwide|global/i,       emoji: '🌐', gradient: 'linear-gradient(135deg,#10b981,#065f46)' },
  { match: /asia/i,                   emoji: '🏯', gradient: 'linear-gradient(135deg,#ef4444,#7f1d1d)' },
  { match: /student/i,                emoji: '🎓', gradient: 'linear-gradient(135deg,#a78bfa,#5b21b6)' },
  { match: /inbound|kenya/i,          emoji: '🇰🇪', gradient: 'linear-gradient(135deg,#059669,#064e3b)' },
  { match: /incountry|domestic/i,     emoji: '🏘️', gradient: 'linear-gradient(135deg,#0ea5e9,#0c4a6e)' },
  { match: /middle[\s-]*east|uae/i,   emoji: '🕌', gradient: 'linear-gradient(135deg,#eab308,#78350f)' },
  { match: /america|usa/i,            emoji: '🗽', gradient: 'linear-gradient(135deg,#6366f1,#312e81)' },
];
const regionMeta = (name) => {
  const s = String(name || '');
  const hit = REGION_VISUALS.find((v) => v.match.test(s));
  return hit || { emoji: '✈️', gradient: 'linear-gradient(135deg,#64748b,#1e293b)' };
};

const RegionAvatar = ({ name, size = 56, selected = false }) => {
  const meta = regionMeta(name);
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: meta.gradient,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: Math.round(size * 0.5), flexShrink: 0,
      boxShadow: selected
        ? '0 0 0 3px var(--gold), 0 6px 18px rgba(246,166,35,0.35)'
        : '0 4px 12px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.15)',
      transition: 'all 0.2s ease',
    }} aria-hidden="true">
      <span>{meta.emoji}</span>
    </div>
  );
};

const FieldIcon = ({ children, gradient }) => (
  <div style={{
    width: 44, height: 44, borderRadius: 14,
    background: gradient,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 22, flexShrink: 0,
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18), 0 4px 10px rgba(0,0,0,0.25)',
  }} aria-hidden="true">
    {children}
  </div>
);

const Hero = ({ onStart, onNavigate, compareSelected = [], onAddCompare, onRemoveCompare }) => {
  const { user, role } = useAuth();
  const { mobile } = useResponsive();
  const isAgent = role === "agent" || role === "administrator";
  const [showQuote, setShowQuote] = useState(false);
  const [activeSheet, setActiveSheet] = useState(null); // null | 'destination' | 'dates' | 'travelers'
  const quoteCardRef = useRef(null);
  const [activeTab, setActiveTab] = useState(0);
  const [today] = useState(() => new Date().toISOString().split("T")[0]);
  const [nextWeek] = useState(() => new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0]);
  const [form, setForm] = useState({
    destinations: [],   // Array<{ slug, name }>
    departure: "",
    returnDate: "",
    adults: 1,
    children: 0,
  });
  const [{ data }] = useQuery({ query: GET_REGIONS });
  const allRegions = React.useMemo(() => data?.regions?.nodes || [], [data]);

  const [{ data: heroPolData, fetching: heroPolFetching }] = useQuery({
    query: HERO_POLICIES_BY_REGION,
  });
  const [{ data: heroCountData }] = useQuery({ query: HERO_POLICY_SALES_COUNT });
  const liveCount = heroCountData?.policySales?.pageInfo?.total ?? null;
  const regionSlugsWithPolicies = React.useMemo(() => {
    const set = new Set();
    (heroPolData?.policies?.nodes || []).forEach((p) => {
      (p.regions?.nodes || []).forEach((r) => {
        if (r?.slug) set.add(String(r.slug).toLowerCase());
        if (r?.name) set.add(String(r.name).toLowerCase());
      });
    });
    return set;
  }, [heroPolData]);
  const regions = React.useMemo(() => {
    if (regionSlugsWithPolicies.size === 0) return allRegions;
    return allRegions.filter((r) =>
      regionSlugsWithPolicies.has(String(r.slug || '').toLowerCase()) ||
      regionSlugsWithPolicies.has(String(r.name || '').toLowerCase())
    );
  }, [allRegions, regionSlugsWithPolicies]);
  const matchingPolicies = React.useMemo(() => {
    if (!form.destinations.length) return [];
    const nodes = heroPolData?.policies?.nodes || [];
    const targets = form.destinations
      .map((d) => String(d.slug || d.name || '').toLowerCase())
      .filter(Boolean);
    if (!targets.length) return [];
    return nodes
      .filter((p) => (p.regions?.nodes || []).some((r) =>
        targets.includes(String(r.slug || '').toLowerCase()) ||
        targets.includes(String(r.name || '').toLowerCase())
      ))
      .slice(0, 8);
  }, [heroPolData, form.destinations]);
  const cheapest = (brackets) => {
    if (!brackets || !brackets.length) return null;
    const nums = brackets.map((b) => Number(b.premium)).filter((n) => Number.isFinite(n) && n > 0);
    return nums.length ? Math.min(...nums) : null;
  };

  const days = React.useMemo(() => tripDaysInclusive(form.departure, form.returnDate), [form.departure, form.returnDate]);
  const hasDates = days > 0;

  const totalTravelers = form.adults + form.children;

  const toggleDestination = (r) => {
    const key = String(r.slug || r.name || '').toLowerCase();
    if (!key) return;
    setForm((f) => {
      const exists = f.destinations.some((d) => String(d.slug || d.name || '').toLowerCase() === key);
      if (exists) {
        return { ...f, destinations: f.destinations.filter((d) => String(d.slug || d.name || '').toLowerCase() !== key) };
      }
      return { ...f, destinations: [...f.destinations, { slug: r.slug || r.name, name: r.name || r.slug }] };
    });
  };
  const isDestSelected = (r) => {
    const key = String(r.slug || r.name || '').toLowerCase();
    return form.destinations.some((d) => String(d.slug || d.name || '').toLowerCase() === key);
  };
  const isInCompare = (id) => compareSelected.some((p) => p.id === id);
  const toggleCompare = (e, policy) => {
    e.stopPropagation();
    if (isInCompare(policy.id)) onRemoveCompare?.(policy.id);
    else if (compareSelected.length < 3) onAddCompare?.(policy);
  };

  const [{ data: polData, fetching: polFetching }, reexecutePolicies] = useQuery({ query: MY_POLICIES, pause: !user?.token, requestPolicy: "network-only" });
  const policies = polData?.myPolicySales || [];
  const activePolicies = policies.filter(p => ["active", "confirmed", "approved"].includes(p.policyStatus));
  const totalPaid = policies.reduce((sum, p) => sum + Number(p.amountPaid || 0), 0);

  // Refetch policies on window focus and every 60 s to catch status changes
  React.useEffect(() => {
    if (!user?.token) return;
    const refetch = () => reexecutePolicies({ requestPolicy: "network-only" });
    window.addEventListener("focus", refetch);
    const timer = setInterval(refetch, 60_000);
    return () => { window.removeEventListener("focus", refetch); clearInterval(timer); };
  }, [user?.token, reexecutePolicies]);

  // Lock body scroll + close on ESC while the focused onboarding modal is open
  React.useEffect(() => {
    if (!showQuote) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') setShowQuote(false); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [showQuote]);
  const tabs = ["Individual", "Group", "Agency"];

  const openSheet = (name) => setActiveSheet(name);
  const closeSheet = () => setActiveSheet(null);
  const canSubmit = form.destinations.length > 0 && form.departure && form.returnDate && totalTravelers > 0;
  const handleSubmit = () => {
    if (!canSubmit) return;
    const first = form.destinations[0];
    const data = {
      region: first.slug || first.name || "",
      departure: form.departure,
      returnDate: form.returnDate,
      passengers: totalTravelers,
    };
    onStart?.(data);
  };

  return (
    <section id="hero-top" className="hero-full-bleed" style={{ position: "relative", zIndex: 1, minHeight: mobile ? "auto" : "100vh", display: "flex", alignItems: "center", padding: mobile ? "90px 0 48px" : "128px 0 80px" }}>
      <div style={{
        position: "absolute", right: "-8%", top: "50%", transform: "translateY(-50%)",
        width: mobile ? 0 : 560, height: mobile ? 0 : 560, border: mobile ? "none" : "1px dashed rgba(49,99,49,0.18)", borderRadius: "50%",
        pointerEvents: "none", animation: mobile ? "none" : "spin-slow 80s linear infinite",
      }} aria-hidden="true" />
      <style>{`@keyframes spin-slow { to { transform: translateY(-50%) rotate(360deg); } } @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} } @keyframes pulse-dot { 0%,100%{box-shadow:0 0 0 4px rgba(34,197,94,0.25)} 50%{box-shadow:0 0 0 8px rgba(34,197,94,0.10)} }`}</style>

      <div className="hero-content" style={{ width: '100%', maxWidth: '100%', padding: mobile ? '0 16px' : '0 32px' }}>
        <div style={{ width: '100%', display: 'flex', flexDirection: (isAgent && user && !mobile) ? 'row' : 'column', gap: 32, alignItems: 'stretch' }}>

          {/* ── Left column ── */}
          {isAgent ? (
            /* Agent copy */
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: (isAgent && user && !mobile) ? 'center' : undefined, alignItems: (isAgent && user && !mobile) ? 'center' : undefined, textAlign: (isAgent && user && !mobile) ? 'center' : undefined }}>
              <p className="section-label">For Insurance Agencies</p>
              <h1 className="reveal" style={{ fontFamily: "var(--font-display)", fontSize: "clamp(36px,4vw,58px)", fontWeight: 800, lineHeight: 1.05, letterSpacing: "-0.025em", marginBottom: 18 }}>
                Issue Policies in Bulk.<br />
                <em style={{ fontStyle: 'normal', color: 'var(--gold)' }}>From One Dashboard.</em>
              </h1>
              {user?.name && (
                <div style={{ fontSize: 13, color: "#86efac", marginBottom: 14, fontWeight: 600 }}>Welcome back, {user.name}</div>
              )}
              <p className="reveal reveal-delay-1" style={{ color: "var(--slate)", fontSize: 16, lineHeight: 1.8, marginBottom: 28, maxWidth: 520 }}>
                Join 200+ agencies already issuing travel insurance certificates through Maljani.
                Branded certificates, commission tracking, and team management &mdash; all included.
              </p>
              <div className="reveal reveal-delay-2" style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 32 }}>
                {["\u2713 White-labelled PDF certificates", "\u2713 Commission dashboard (real-time)", "\u2713 Sub-agent accounts & role controls", "\u2713 API access for system integrations"].map(f => (
                  <div key={f} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 15 }}>
                    <span style={{ color: "#22c55e", fontSize: 16 }}>{f[0]}</span>
                    <span style={{ color: "var(--white)" }}>{f.slice(1)}</span>
                  </div>
                ))}
              </div>
              <div className="reveal reveal-delay-3" style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                {user ? (
                  <>
                    <button className="btn btn--primary btn--lg" onClick={() => onNavigate?.("dashboard")}>Open Dashboard &rarr;</button>
                    <button className="btn btn--ghost btn--lg" onClick={() => onStart?.({ region: "", departure: today, returnDate: nextWeek, passengers: 1 })}>New Quote</button>
                  </>
                ) : (
                  <>
                    <button className="btn btn--primary btn--lg" onClick={() => onNavigate?.("register")}>Apply for Agency Account</button>
                    <button className="btn btn--ghost btn--lg" onClick={() => onNavigate?.("login")}>Agent Login</button>
                  </>
                )}
              </div>
            </div>
          ) : (
            /* Consumer copy */
            <div>
              {/* Live social-proof pill */}
              <div className="reveal" style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '6px 14px', borderRadius: 999,
                  background: 'rgba(34,197,94,0.10)', border: '1px solid rgba(34,197,94,0.35)',
                  fontSize: 12, fontWeight: 700, color: '#86efac', letterSpacing: '0.02em',
                }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 0 4px rgba(34,197,94,0.25)', animation: 'pulse-dot 2s ease-in-out infinite' }} aria-hidden="true" />
                  <span style={{ color: 'var(--white)' }}>{liveCount !== null ? `${liveCount.toLocaleString('en-KE')}+` : '50,000+'}</span> certificates issued &middot; embassy-accepted
                </span>
              </div>

              <h1 className="reveal reveal-delay-1" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(38px,5vw,68px)', fontWeight: 800, lineHeight: 1.05, letterSpacing: '-0.025em', marginBottom: 18, width: '100%', textAlign: 'center', color: 'var(--white)' }}>
                Real travel insurance.<br />
                Issued in <span style={{ color: 'var(--gold)' }}>minutes</span>.<br />
                Accepted at <span style={{ color: '#86efac' }}>embassies</span>.
              </h1>

              <p className="reveal reveal-delay-2" style={{ fontSize: mobile ? 15 : 17, color: 'var(--slate)', lineHeight: 1.65, margin: '0 auto 28px', width: '100%', maxWidth: 640, textAlign: 'center' }}>
                Compare 15+ licensed insurers. Buy in three taps. Receive your <strong style={{ color: 'var(--white)', fontWeight: 700 }}>cryptographically-verified certificate</strong> by email &mdash; before you finish your visa form.
              </p>

              {/* CTA row: primary dominant, secondary compact */}
              <div className="reveal reveal-delay-3" style={{ display: 'flex', gap: 12, marginBottom: 20, width: '100%', flexWrap: 'wrap', justifyContent: mobile ? 'stretch' : 'center', alignItems: 'center' }}>
                <button
                  className="btn btn--primary btn--lg"
                  style={{ flex: mobile ? '1 1 100%' : '0 0 auto', padding: '16px 34px', fontSize: 16, justifyContent: 'center', boxShadow: '0 12px 32px rgba(246,166,35,0.35)' }}
                  onClick={() => {
                    setShowQuote(true);
                    setActiveTab(0);
                    setActiveSheet(null);
                  }}
                >
                  Get Covered &rarr;
                </button>
                <button
                  style={{
                    flex: mobile ? '1 1 100%' : '0 0 auto',
                    background: 'transparent', border: 'none', color: 'var(--slate)',
                    fontSize: 14, fontWeight: 600, cursor: 'pointer',
                    padding: '14px 18px', textDecoration: 'underline', textUnderlineOffset: 4,
                  }}
                  onClick={() => {
                    setShowQuote(true);
                    setActiveTab(1);
                    setActiveSheet(null);
                  }}
                >
                  Or start a group quote &rsaquo;
                </button>
              </div>

              {/* Rating + trust row */}
              <div className="reveal reveal-delay-4" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: mobile ? 10 : 20, flexWrap: 'wrap', marginBottom: 22 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--white)', fontWeight: 600 }}>
                  <span style={{ letterSpacing: 1, fontSize: 14 }}>★★★★★</span>
                  <span style={{ color: 'var(--gold)', fontWeight: 800 }}>4.9</span>
                  <span style={{ color: 'var(--slate)', fontWeight: 500 }}>from 2,100+ travellers</span>
                </span>
                <span aria-hidden="true" style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--slate-dark)' }} />
                <a
                  href="#verify"
                  onClick={(e) => { e.preventDefault(); onNavigate?.('verify'); }}
                  style={{ fontSize: 13, color: 'var(--gold)', fontWeight: 700, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                >
                  🛡️ Verify a certificate &rarr;
                </a>
              </div>

              {/* How it works — 3-step micro-strip */}
              <div className="reveal reveal-delay-4" style={{
                display: 'grid',
                gridTemplateColumns: mobile ? '1fr' : 'repeat(3, minmax(0, 1fr))',
                gap: 10,
                maxWidth: 760, margin: '0 auto',
                padding: '12px 14px',
                background: 'rgba(0,0,0,0.20)',
                border: '1px solid var(--glass-border)',
                borderRadius: 14,
              }}>
                {[
                  { n: '1', label: 'Pick your trip', hint: 'Region &amp; dates' },
                  { n: '2', label: 'Compare & buy', hint: 'Best insurer for you' },
                  { n: '3', label: 'Certificate in email', hint: 'Embassy-ready PDF' },
                ].map((s) => (
                  <div key={s.n} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                      background: 'rgba(246,166,35,0.12)', border: '1px solid rgba(246,166,35,0.4)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, fontWeight: 800, color: 'var(--gold)',
                    }}>{s.n}</div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--white)', lineHeight: 1.2 }}>{s.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--slate)' }} dangerouslySetInnerHTML={{ __html: s.hint }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Right column ── */}
          {isAgent ? (
            /* Agency dashboard mockup */
            <div className="reveal reveal-delay-2" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)", borderRadius: "var(--radius-lg)", padding: 24, fontFamily: "var(--font-body)", animation: "float 7s ease-in-out infinite", display: mobile ? 'none' : undefined, flex: (isAgent && user && !mobile) ? '0 0 33.333%' : undefined }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 16 }}>
                {["#ff5f57","#febc2e","#28c840"].map(c => <div key={c} style={{ width: 10, height: 10, borderRadius: "50%", background: c }} />)}
                <span style={{ fontSize: 11, color: "var(--slate)", marginLeft: 8 }}>Agency Dashboard</span>
              </div>
              {[["Policies Issued","1,247","#86efac"],["Monthly Revenue","KES 384K","var(--gold)"],["Active Sub-agents","12","#6ee7b7"],["Pending Commissions","KES 48K","#f87171"]].map(([k,v,c]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "rgba(0,0,0,0.25)", borderRadius: 8, marginBottom: 10 }}>
                  <span style={{ fontSize: 12, color: "var(--slate)" }}>{k}</span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: c }}>{v}</span>
                </div>
              ))}
              <div style={{ marginTop: 14, padding: "10px 14px", background: "rgba(49,99,49,0.18)", border: "1px solid rgba(49,99,49,0.3)", borderRadius: 8, fontSize: 12, color: "#86efac", textAlign: "center" }}>
                🔔 3 policies pending approval
              </div>
            </div>
          ) : (
            /* Consumer quote wizard card — hidden on mobile when closed; opens as full-screen modal otherwise */
            <div className="reveal reveal-delay-2" ref={quoteCardRef} style={{ display: showQuote ? 'contents' : (mobile ? 'none' : undefined) }}>

              {/* ── Client dashboard card ── */}
              {!showQuote && (
                user ? (
                  /* Logged-in: real live dashboard preview */
                  <div style={{
                    background: "var(--glass-bg)", border: "1px solid var(--glass-border)",
                    borderRadius: "var(--radius-lg)", padding: 24, fontFamily: "var(--font-body)",
                    animation: "float 7s ease-in-out infinite",
                  }}>
                    {/* Window chrome */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        {["#ff5f57", "#febc2e", "#28c840"].map(c => <div key={c} style={{ width: 10, height: 10, borderRadius: "50%", background: c }} />)}
                        <span style={{ fontSize: 11, color: "var(--slate)", marginLeft: 8 }}>{user.name || user.email || "My Dashboard"}</span>
                      </div>
                      <span style={{ fontSize: 11, color: "#22c55e", fontWeight: 600 }}>● Live</span>
                    </div>

                    {polFetching && (
                      <div style={{ textAlign: "center", padding: "24px 0", color: "var(--slate)", fontSize: 12 }}>
                        Loading your policies…
                      </div>
                    )}

                    {!polFetching && policies.slice(0, 2).map((p, i) => {
                      const ps = getPS(p.policyStatus);
                      return (
                        <div key={p.id} style={{ background: "rgba(0,0,0,0.25)", borderRadius: 10, padding: "12px 14px", marginBottom: 10, border: i === 0 ? "1px solid rgba(49,99,49,0.28)" : undefined }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>{p.policyTitle || p.region || "Policy"}</span>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20, background: ps.bg, color: ps.color }}>{ps.label}</span>
                          </div>
                          <div style={{ fontSize: 11, color: "var(--slate)", marginBottom: 5 }}>
                            {p.policyNumber} · {p.passengers || 1} traveler{p.passengers !== 1 ? "s" : ""}
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--slate)" }}>
                            <span>{fmtDate(p.departure)} – {fmtDate(p.returnDate)}</span>
                            <span style={{ color: "var(--gold)", fontWeight: 700 }}>{fmtKES(p.amountPaid)}</span>
                          </div>
                        </div>
                      );
                    })}

                    {!polFetching && policies.length === 0 && (
                      <div style={{ textAlign: "center", padding: "20px 0", color: "var(--slate)", fontSize: 12, lineHeight: 1.7 }}>
                        No policies yet.<br />
                        <span style={{ color: "var(--gold)", fontWeight: 600, cursor: "pointer" }} onClick={() => { setShowQuote(true); setActiveSheet('destination'); }}>Get your first quote →</span>
                      </div>
                    )}

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
                      {[
                        ["Active Policies", String(activePolicies.length), "#22c55e"],
                        ["Total Paid", totalPaid > 0 ? fmtKES(totalPaid) : "KES 0", "var(--gold)"],
                      ].map(([k, v, c]) => (
                        <div key={k} style={{ padding: "10px 12px", background: "rgba(0,0,0,0.2)", borderRadius: 8, textAlign: "center" }}>
                          <div style={{ fontSize: 15, fontWeight: 700, color: c, marginBottom: 3 }}>{v}</div>
                          <div style={{ fontSize: 10, color: "var(--slate)" }}>{k}</div>
                        </div>
                      ))}
                    </div>

                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => onNavigate?.("dashboard")} style={{ flex: 1, padding: "9px", borderRadius: 8, border: "none", background: "var(--indigo)", color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                        📄 View Document Status
                      </button>
                      <button onClick={() => onNavigate?.("dashboard")} style={{ padding: "9px 14px", borderRadius: 8, border: "1px solid var(--glass-border)", background: "transparent", color: "var(--slate)", fontSize: 11, cursor: "pointer" }}>
                        View All
                      </button>
                    </div>
                  </div>
                ) : null /* Logged-out: CTA removed on desktop */
              )}

              {/* ── Focused onboarding modal (opens on Get Covered / group / agency CTAs) ── */}
              {showQuote && typeof document !== 'undefined' && createPortal(
                <div
                  onClick={() => setShowQuote(false)}
                  role="dialog"
                  aria-modal="true"
                  aria-label="Get insurance coverage"
                  style={{
                    position: 'fixed', inset: 0, zIndex: 2147483000,
                    background: 'rgba(4,7,20,0.94)', backdropFilter: 'blur(22px)', WebkitBackdropFilter: 'blur(22px)',
                    display: 'flex', alignItems: mobile ? 'stretch' : 'center', justifyContent: 'center',
                    padding: mobile ? 0 : 'clamp(12px, 3vw, 32px)',
                    animation: 'onboarding-fade 0.22s ease-out',
                  }}
                >
                  <style>{`@keyframes onboarding-fade { from { opacity: 0 } to { opacity: 1 } } @keyframes onboarding-rise { from { opacity: 0; transform: translateY(20px) } to { opacity: 1; transform: translateY(0) } }`}</style>

                  <div
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: mobile ? '1fr' : 'minmax(0, 0.7fr) minmax(0, 1fr)',
                      width: '100%',
                      maxWidth: mobile ? '100%' : 1080,
                      maxHeight: mobile ? '100%' : '92vh',
                      height: mobile ? '100%' : 'auto',
                      background: 'var(--navy-mid, #0b1230)',
                      borderRadius: mobile ? 0 : 'var(--radius-xl)',
                      border: mobile ? 'none' : '1px solid var(--glass-border-bright)',
                      boxShadow: '0 30px 80px rgba(0,0,0,0.5)',
                      overflow: 'hidden',
                      animation: 'onboarding-rise 0.28s ease-out',
                    }}
                  >
                    {/* ── LEFT: hero image + trust copy (desktop only) ── */}
                    {!mobile && (
                      <div style={{
                        position: 'relative', overflowY: 'auto',
                        background: `#0b1230 linear-gradient(180deg, rgba(6,10,26,0.35) 0%, rgba(6,10,26,0.94) 100%),
                                     url('https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=1000&q=80&auto=format&fit=crop')`,
                        backgroundSize: 'cover', backgroundPosition: 'center',
                        padding: '28px 26px', display: 'flex', flexDirection: 'column', gap: 18,
                        maxHeight: '92vh',
                      }}>
                        {/* Brand pill */}
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 800, color: 'var(--white)', letterSpacing: '0.02em' }}>
                          <span style={{ width: 26, height: 26, borderRadius: 8, background: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }} aria-hidden="true">M</span>
                          Maljani
                        </div>

                        <div>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 12px', borderRadius: 999, background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.35)', fontSize: 11, fontWeight: 700, color: '#86efac', marginBottom: 14 }}>
                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e' }} aria-hidden="true" />
                            LIVE · {liveCount !== null ? liveCount.toLocaleString('en-KE') : '50,000'}+ issued
                          </div>

                          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(22px, 2.2vw, 30px)', fontWeight: 800, color: 'var(--white)', lineHeight: 1.15, margin: '0 0 8px' }}>
                            Travel worry-free <span style={{ color: 'var(--gold)' }}>from KES 950/day*</span>
                          </h2>
                          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.75)', margin: '0 0 22px', lineHeight: 1.55 }}>
                            Instant quotes. Global coverage. Embassy-accepted certificates. Easy claims.
                          </p>

                          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--slate)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
                            Why smart travellers choose insurance
                          </div>
                          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {[
                              { icon: '🏥', label: 'Medical emergencies abroad',  tint: 'rgba(34,197,94,0.15)',  ring: 'rgba(34,197,94,0.4)' },
                              { icon: '✈️', label: 'Flight delays or cancellations', tint: 'rgba(249,115,22,0.15)', ring: 'rgba(249,115,22,0.4)' },
                              { icon: '🧳', label: 'Lost baggage & passport',      tint: 'rgba(234,179,8,0.15)',  ring: 'rgba(234,179,8,0.4)'  },
                              { icon: '🛡️', label: 'Theft or personal loss',        tint: 'rgba(59,130,246,0.15)', ring: 'rgba(59,130,246,0.4)' },
                            ].map((row) => (
                              <li key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--white)', fontSize: 14 }}>
                                <span style={{
                                  width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                  background: row.tint, border: `1px solid ${row.ring}`, fontSize: 17,
                                }} aria-hidden="true">{row.icon}</span>
                                {row.label}
                              </li>
                            ))}
                          </ul>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 22, fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
                            <span style={{ letterSpacing: 1, color: 'var(--gold)' }}>★★★★★</span>
                            <span><strong style={{ color: 'var(--white)', fontWeight: 800 }}>4.9</strong> from 2,100+ travellers</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ── RIGHT: wizard form ── */}
                    <div style={{
                      background: 'var(--glass-bg-md, rgba(11,18,48,0.75))',
                      padding: mobile ? '52px 16px 20px' : '52px 28px 28px',
                      position: 'relative', overflowY: 'auto',
                      maxHeight: mobile ? '100%' : '92vh',
                    }} role="form" aria-label="Get an insurance quote">
                      <div style={{ position: 'absolute', top: 0, left: 20, right: 20, height: 2, background: 'linear-gradient(90deg,transparent,var(--indigo-glow),transparent)', borderRadius: 2 }} />
                      <button onClick={() => setShowQuote(false)} aria-label="Close" style={{ position: 'absolute', top: 12, right: 14, background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', color: 'var(--slate)', cursor: 'pointer', fontSize: 16, lineHeight: 1, width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, borderRadius: 999, zIndex: 3 }}>✕</button>

                  {/* ── Tabs — always visible ── */}
                  <div role="tablist" style={{ display: "flex", background: "rgba(0,0,0,0.3)", borderRadius: "var(--radius-md)", padding: 4, marginBottom: 20, gap: 4 }}>
                    {tabs.map((t, i) => (
                      <button key={t} role="tab" aria-selected={activeTab === i}
                        onClick={() => { setActiveTab(i); setActiveSheet(null); }}
                        style={{ flex: 1, padding: "9px 10px", borderRadius: 10, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "var(--font-body)", transition: "all 0.2s",
                          background: activeTab === i ? "var(--indigo)" : "transparent",
                          color: activeTab === i ? "#fff" : "var(--slate)",
                        }}>{t}</button>
                    ))}
                  </div>

                  {/* ── Individual flow ── */}
                  {activeTab === 0 && (
                    <div style={{ position: 'relative' }}>
                      {/* ─── HOME PANEL ─── */}
                      <div style={{ display: activeSheet ? 'none' : 'block' }}>
                        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--white)', margin: '0 0 6px' }}>
                          Where are you travelling to?
                        </h3>
                        <p style={{ fontSize: 12, color: 'var(--slate)', margin: '0 0 16px' }}>
                          Fill the three fields below to see instant quotes from licensed insurers.
                        </p>

                        {/* Field row: Destination */}
                        <button
                          type="button"
                          onClick={() => openSheet('destination')}
                          style={{
                            width: '100%', display: 'flex', alignItems: 'center', gap: 14,
                            padding: '14px 16px', marginBottom: 10, borderRadius: 14,
                            background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
                            color: 'var(--white)', cursor: 'pointer', textAlign: 'left', minHeight: 68,
                          }}
                        >
                          <FieldIcon gradient="linear-gradient(135deg,#10b981,#065f46)">🌍</FieldIcon>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--slate)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Destination</div>
                            {form.destinations.length > 0 ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, minWidth: 0 }}>
                                <div style={{ display: 'flex', flexShrink: 0 }}>
                                  {form.destinations.slice(0, 3).map((d, i) => (
                                    <div key={d.slug || d.name} style={{ marginLeft: i === 0 ? 0 : -8, border: '2px solid var(--glass-bg)', borderRadius: '50%' }}>
                                      <RegionAvatar name={d.name} size={22} />
                                    </div>
                                  ))}
                                </div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--white)', overflow: 'hidden', display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, lineHeight: 1.35, wordBreak: 'break-word' }}>
                                  {form.destinations.map((d) => d.name).slice(0, 2).join(', ')}
                                  {form.destinations.length > 2 && ` +${form.destinations.length - 2} more`}
                                </div>
                              </div>
                            ) : (
                              <div style={{ fontSize: 14, color: 'var(--slate)' }}>Add destination(s)</div>
                            )}
                          </div>
                          <span aria-hidden="true" style={{ color: 'var(--slate)', fontSize: 16 }}>›</span>
                        </button>

                        {/* Field row: Dates */}
                        <button
                          type="button"
                          onClick={() => openSheet('dates')}
                          style={{
                            width: '100%', display: 'flex', alignItems: 'center', gap: 14,
                            padding: '14px 16px', marginBottom: 10, borderRadius: 14,
                            background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
                            color: 'var(--white)', cursor: 'pointer', textAlign: 'left', minHeight: 68,
                          }}
                        >
                          <FieldIcon gradient="linear-gradient(135deg,#f59e0b,#b45309)">📅</FieldIcon>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--slate)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Travel dates</div>
                            {hasDates ? (
                              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--white)', display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: 6, lineHeight: 1.35 }}>
                                <span>{fmtShortDate(form.departure)} → {fmtShortDate(form.returnDate)}</span>
                                <span style={{ color: '#86efac', fontWeight: 600, fontSize: 12 }}>· {days}d</span>
                              </div>
                            ) : (
                              <div style={{ fontSize: 14, color: 'var(--slate)' }}>Add start &amp; end dates</div>
                            )}
                          </div>
                          <span aria-hidden="true" style={{ color: 'var(--slate)', fontSize: 16 }}>›</span>
                        </button>

                        {/* Field row: Travellers */}
                        <button
                          type="button"
                          onClick={() => openSheet('travelers')}
                          style={{
                            width: '100%', display: 'flex', alignItems: 'center', gap: 14,
                            padding: '14px 16px', marginBottom: 14, borderRadius: 14,
                            background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
                            color: 'var(--white)', cursor: 'pointer', textAlign: 'left', minHeight: 68,
                          }}
                        >
                          <FieldIcon gradient="linear-gradient(135deg,#6366f1,#312e81)">👥</FieldIcon>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--slate)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Travellers</div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--white)', lineHeight: 1.35, wordBreak: 'break-word' }}>
                              {form.adults} Adult{form.adults === 1 ? '' : 's'}
                              {form.children > 0 && `, ${form.children} Child${form.children === 1 ? '' : 'ren'}`}
                            </div>
                          </div>
                          <span aria-hidden="true" style={{ color: 'var(--slate)', fontSize: 16 }}>›</span>
                        </button>

                        {/* Primary CTA — always visible */}
                        <button
                          className="btn btn--primary"
                          style={{ width: '100%', justifyContent: 'center', marginBottom: 14 }}
                          onClick={handleSubmit}
                          disabled={!canSubmit}
                        >
                          Explore Plans &rsaquo;
                        </button>

                        {/* Available policies preview — updates as fields fill */}
                        {form.destinations.length > 0 && (
                          <div style={{ marginTop: 4 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--slate)' }}>
                                Available Policies
                              </span>
                              {matchingPolicies.length > 0 && (
                                <span style={{ fontSize: 11, color: 'var(--slate-dark)' }}>
                                  {matchingPolicies.length} match{matchingPolicies.length === 1 ? '' : 'es'}{hasDates ? ` · ${days}d trip` : ''}
                                </span>
                              )}
                            </div>
                            {heroPolFetching && (
                              <div style={{ fontSize: 12, color: 'var(--slate)', padding: '10px 0' }}>Loading policies…</div>
                            )}
                            {!heroPolFetching && matchingPolicies.length === 0 && (
                              <div style={{ fontSize: 12, color: 'var(--slate)', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--glass-border)', borderRadius: 10, padding: '10px 12px' }}>
                                No policies found for these destinations — pick another region or continue to talk to an agent.
                              </div>
                            )}
                            {!heroPolFetching && matchingPolicies.length > 0 && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 240, overflowY: 'auto', paddingRight: 4 }}>
                                {matchingPolicies.map((p) => {
                                  const exact = hasDates ? bracketPremiumFor(p.policyDayPremiums, days) : null;
                                  const price = exact ?? cheapest(p.policyDayPremiums);
                                  const inCompare = isInCompare(p.id);
                                  return (
                                    <div
                                      key={p.id}
                                      onClick={() => onNavigate?.('policy-detail', p.databaseId)}
                                      role="button"
                                      tabIndex={0}
                                      onKeyDown={(e) => { if (e.key === 'Enter') onNavigate?.('policy-detail', p.databaseId); }}
                                      style={{
                                        display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left',
                                        padding: '10px 12px', borderRadius: 10,
                                        background: inCompare ? 'rgba(49,99,49,0.18)' : 'rgba(255,255,255,0.04)',
                                        border: `1px solid ${inCompare ? 'rgba(49,99,49,0.55)' : 'var(--glass-border)'}`,
                                        color: 'var(--white)', cursor: 'pointer', transition: 'all 0.15s',
                                      }}
                                    >
                                      {p.policyInsurerLogo ? (
                                        <img src={p.policyInsurerLogo} alt="" style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'contain', background: '#fff', flexShrink: 0 }} />
                                      ) : (
                                        <div style={{ width: 32, height: 32, borderRadius: 6, background: 'var(--glass-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'var(--slate)', flexShrink: 0 }}>
                                          {(p.policyInsurerName || '?').charAt(0)}
                                        </div>
                                      )}
                                      <div style={{ minWidth: 0, flex: 1 }}>
                                        <div style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                          {p.title}
                                        </div>
                                        <div style={{ fontSize: 11, color: 'var(--slate)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                          {p.policyInsurerName || 'Insurer'}
                                        </div>
                                      </div>
                                      <div style={{ textAlign: 'right', flexShrink: 0, marginRight: 4 }}>
                                        {price !== null ? (
                                          <>
                                            <div style={{ fontSize: 10, color: exact ? '#86efac' : 'var(--slate-dark)', lineHeight: 1, fontWeight: exact ? 700 : 500 }}>
                                              {exact ? 'exact' : 'from'}
                                            </div>
                                            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--gold)' }}>
                                              {p.policyCurrency || 'KES'} {price.toLocaleString('en-KE')}
                                            </div>
                                          </>
                                        ) : (
                                          <div style={{ fontSize: 11, color: 'var(--slate)' }}>Quote</div>
                                        )}
                                      </div>
                                      <button
                                        type="button"
                                        onClick={(e) => toggleCompare(e, p)}
                                        disabled={!inCompare && compareSelected.length >= 3}
                                        aria-label={inCompare ? 'Remove from comparison' : 'Add to comparison'}
                                        title={inCompare ? 'Remove from comparison' : (compareSelected.length >= 3 ? 'Max 3 policies' : 'Add to compare')}
                                        style={{
                                          flexShrink: 0, padding: '5px 9px', borderRadius: 999,
                                          border: `1px solid ${inCompare ? 'rgba(49,99,49,0.7)' : 'var(--glass-border)'}`,
                                          background: inCompare ? 'rgba(49,99,49,0.28)' : 'transparent',
                                          color: inCompare ? '#86efac' : 'var(--slate)',
                                          fontSize: 10, fontWeight: 700, cursor: (!inCompare && compareSelected.length >= 3) ? 'not-allowed' : 'pointer',
                                          opacity: (!inCompare && compareSelected.length >= 3) ? 0.4 : 1,
                                        }}
                                      >
                                        {inCompare ? '✓ Compare' : '+ Compare'}
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Why smart travellers choose insurance */}
                        <div style={{ marginTop: 18, padding: '14px 16px', background: 'rgba(0,0,0,0.15)', borderRadius: 12, border: '1px solid var(--glass-border)' }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--slate)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                            Why smart travellers choose insurance
                          </div>
                          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 6, fontSize: 12, color: 'var(--white)' }}>
                            {['🏥 Medical emergencies abroad', '✈️ Flight delays &amp; cancellations', '🧳 Lost baggage &amp; passport', '🛡️ Theft or personal loss'].map((line) => (
                              <li key={line} dangerouslySetInnerHTML={{ __html: line }} />
                            ))}
                          </ul>
                        </div>

                        <p style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 14, fontSize: 12, color: 'var(--slate-dark)' }}>
                          🔒 100% secure &middot; Best Price Guarantee
                        </p>
                      </div>

                      {/* ─── SHEET: DESTINATION ─── */}
                      {activeSheet === 'destination' && (
                        <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', minHeight: 420 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                            <button type="button" onClick={closeSheet} aria-label="Back" style={{ background: 'transparent', border: 'none', color: 'var(--slate)', cursor: 'pointer', fontSize: 22, lineHeight: 1, padding: 4 }}>‹</button>
                            <SheetHeading>Where are you travelling to?</SheetHeading>
                          </div>
                          <Reassure>You can pick more than one region</Reassure>

                          {form.destinations.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                              {form.destinations.map((d) => (
                                <span key={d.slug || d.name} style={{
                                  display: 'inline-flex', alignItems: 'center', gap: 8,
                                  padding: '4px 10px 4px 4px', borderRadius: 999,
                                  background: 'rgba(246,166,35,0.12)', border: '1px solid var(--gold)',
                                  color: 'var(--gold)', fontSize: 12, fontWeight: 700,
                                }}>
                                  <RegionAvatar name={d.name} size={22} />
                                  {d.name}
                                  <button
                                    type="button"
                                    onClick={() => toggleDestination(d)}
                                    aria-label={`Remove ${d.name}`}
                                    style={{ background: 'none', border: 'none', color: 'var(--gold)', cursor: 'pointer', padding: 0, fontSize: 15, lineHeight: 1 }}
                                  >×</button>
                                </span>
                              ))}
                            </div>
                          )}

                          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--slate)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
                            Popular choices
                          </div>
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(84px, 1fr))',
                            gap: 12, marginBottom: 20,
                          }}>
                            {(regions.length > 0 ? regions : [
                              { name: 'East Africa', slug: 'east-africa' },
                              { name: 'Schengen', slug: 'schengen' },
                              { name: 'Worldwide', slug: 'worldwide' },
                              { name: 'Asia', slug: 'asia' },
                            ]).map((r) => {
                              const selected = isDestSelected(r);
                              return (
                                <button
                                  key={r.slug || r.name}
                                  type="button"
                                  onClick={() => toggleDestination(r)}
                                  aria-pressed={selected}
                                  style={{
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                                    padding: '10px 6px', borderRadius: 14, cursor: 'pointer',
                                    background: selected ? 'rgba(246,166,35,0.08)' : 'transparent',
                                    border: `1px solid ${selected ? 'rgba(246,166,35,0.35)' : 'transparent'}`,
                                    transition: 'all 0.18s ease',
                                  }}
                                >
                                  <RegionAvatar name={r.name || r.slug} size={56} selected={selected} />
                                  <span style={{
                                    fontSize: 12, fontWeight: 600, lineHeight: 1.2,
                                    color: selected ? 'var(--gold)' : 'var(--white)',
                                    textAlign: 'center',
                                    maxWidth: '100%',
                                    overflow: 'hidden', textOverflow: 'ellipsis',
                                  }}>{r.name}</span>
                                </button>
                              );
                            })}
                          </div>

                          <button
                            className="btn btn--primary"
                            style={{ width: '100%', justifyContent: 'center', marginTop: 'auto' }}
                            onClick={closeSheet}
                            disabled={form.destinations.length === 0}
                          >
                            Continue &rarr;
                          </button>
                        </div>
                      )}

                      {/* ─── SHEET: DATES ─── */}
                      {activeSheet === 'dates' && (
                        <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', minHeight: 420 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                            <button type="button" onClick={closeSheet} aria-label="Back" style={{ background: 'transparent', border: 'none', color: 'var(--slate)', cursor: 'pointer', fontSize: 22, lineHeight: 1, padding: 4 }}>‹</button>
                            <SheetHeading>When are you planning to travel?</SheetHeading>
                          </div>
                          <Reassure>Don&apos;t worry, you can update dates later</Reassure>

                          <div style={{ display: 'flex', alignItems: 'stretch', gap: 0, marginBottom: 12, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--glass-border)' }}>
                            <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3, padding: '10px 14px', background: 'var(--glass-bg)', cursor: 'pointer' }}>
                              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--slate)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Start date</span>
                              <input
                                type="date"
                                min={today}
                                value={form.departure}
                                onChange={(e) => setForm((f) => ({ ...f, departure: e.target.value, returnDate: f.returnDate && f.returnDate < e.target.value ? '' : f.returnDate }))}
                                style={{ background: 'transparent', border: 'none', color: 'var(--white)', fontSize: 14, fontFamily: 'var(--font-body)', outline: 'none', padding: 0, colorScheme: 'dark' }}
                              />
                            </label>
                            <div style={{ display: 'flex', alignItems: 'center', padding: '0 8px', color: 'var(--slate)', background: 'rgba(0,0,0,0.15)' }} aria-hidden="true">→</div>
                            <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3, padding: '10px 14px', background: 'var(--glass-bg)', cursor: 'pointer' }}>
                              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--slate)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>End date</span>
                              <input
                                type="date"
                                min={form.departure || today}
                                value={form.returnDate}
                                onChange={(e) => setForm((f) => ({ ...f, returnDate: e.target.value }))}
                                style={{ background: 'transparent', border: 'none', color: 'var(--white)', fontSize: 14, fontFamily: 'var(--font-body)', outline: 'none', padding: 0, colorScheme: 'dark' }}
                              />
                            </label>
                          </div>

                          {hasDates && (
                            <div style={{ fontSize: 13, color: 'var(--slate)', marginBottom: 14 }}>
                              Trip duration: <strong style={{ color: '#86efac' }}>{days} day{days === 1 ? '' : 's'}</strong>
                            </div>
                          )}

                          <button
                            className="btn btn--primary"
                            style={{ width: '100%', justifyContent: 'center', marginTop: 'auto' }}
                            onClick={closeSheet}
                            disabled={!form.departure || !form.returnDate}
                          >
                            Continue &rarr;
                          </button>
                        </div>
                      )}

                      {/* ─── SHEET: TRAVELLERS ─── */}
                      {activeSheet === 'travelers' && (
                        <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', minHeight: 420 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                            <button type="button" onClick={closeSheet} aria-label="Back" style={{ background: 'transparent', border: 'none', color: 'var(--slate)', cursor: 'pointer', fontSize: 22, lineHeight: 1, padding: 4 }}>‹</button>
                            <SheetHeading>How many travellers?</SheetHeading>
                          </div>
                          <Reassure>You can edit traveller details later</Reassure>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
                            {[
                              { key: 'adults', label: 'Adults', hint: '18+ yrs', min: 1 },
                              { key: 'children', label: 'Children', hint: 'Under 18 yrs', min: 0 },
                            ].map((row) => (
                              <div key={row.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderRadius: 12, background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}>
                                <div>
                                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--white)' }}>{row.label}</div>
                                  <div style={{ fontSize: 11, color: 'var(--slate)' }}>{row.hint}</div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                  <button
                                    type="button"
                                    aria-label={`Decrease ${row.label}`}
                                    onClick={() => setForm((f) => ({ ...f, [row.key]: Math.max(row.min, (f[row.key] || 0) - 1) }))}
                                    disabled={(form[row.key] || 0) <= row.min}
                                    style={{ width: 36, height: 36, borderRadius: '50%', border: '1px solid var(--glass-border)', background: 'transparent', color: 'var(--white)', fontSize: 18, cursor: 'pointer', opacity: (form[row.key] || 0) <= row.min ? 0.4 : 1 }}
                                  >−</button>
                                  <span style={{ minWidth: 22, textAlign: 'center', fontSize: 15, fontWeight: 700, color: 'var(--white)' }}>{form[row.key] || 0}</span>
                                  <button
                                    type="button"
                                    aria-label={`Increase ${row.label}`}
                                    onClick={() => setForm((f) => ({ ...f, [row.key]: (f[row.key] || 0) + 1 }))}
                                    style={{ width: 36, height: 36, borderRadius: '50%', border: '1px solid var(--glass-border)', background: 'var(--indigo)', color: '#fff', fontSize: 18, cursor: 'pointer' }}
                                  >+</button>
                                </div>
                              </div>
                            ))}
                          </div>

                          {compareSelected.length > 0 && (
                            <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(49,99,49,0.15)', border: '1px solid rgba(49,99,49,0.4)', fontSize: 12, color: '#86efac', marginBottom: 12 }}>
                              🔍 {compareSelected.length} polic{compareSelected.length === 1 ? 'y' : 'ies'} queued for side-by-side comparison
                            </div>
                          )}

                          <button
                            className="btn btn--primary"
                            style={{ width: '100%', justifyContent: 'center', marginTop: 'auto' }}
                            onClick={closeSheet}
                          >
                            Done
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── Group flow ── */}
                  {activeTab === 1 && (
                    <GroupQuoteWizard
                      key="group"
                      onClose={() => setShowQuote(false)}
                      isAgency={false}
                    />
                  )}

                  {/* ── Agency flow ── */}
                  {activeTab === 2 && (
                    <GroupQuoteWizard
                      key="agency"
                      onClose={() => setShowQuote(false)}
                      isAgency
                    />
                  )}
                    </div>
                  </div>
                </div>,
                document.body
              )}
            </div>

          )}

        </div>
      </div>
    </section>
  );
};

export default Hero;