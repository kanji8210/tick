import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from 'urql';
import { useResponsive } from '../lib/useResponsive';

/* ── Fetch total policy sales count (public, no auth required) ── */
const POLICY_SALES_COUNT = `
  query PublicPolicySalesCount {
    policySales(first: 1) {
      pageInfo { total }
    }
  }
`;

const CHIPS = ['🏛️ Embassy-accepted', '⚡ 4-min issuance', '🔒 Fraud-proof'];

/* ── Animated count-up hook ── */
const useCountUp = (target, { duration = 1800, startOnMount = false } = {}) => {
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(startOnMount);
  const rafRef = useRef(null);

  useEffect(() => {
    if (!started || !target) return;
    const start = performance.now();
    const from = 0;
    const easeOut = (t) => 1 - Math.pow(1 - t, 3);

    const tick = (now) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      setCount(Math.round(from + (target - from) * easeOut(progress)));
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [started, target, duration]);

  return { count, start: () => setStarted(true) };
};

/* ── Individual animated stat cell ── */
const StatCell = ({ value, suffix, label, mobile, isLast, isOddRight }) => {
  const ref = useRef(null);
  const { count, start } = useCountUp(value, { duration: 1600 });

  useEffect(() => {
    if (!value) return; // static string stat — no animation
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { start(); obs.disconnect(); } },
      { threshold: 0.4 }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div
      ref={ref}
      className="reveal"
      style={{
        padding: mobile ? '18px 12px' : '26px 24px',
        textAlign: 'center',
        borderRight: mobile
          ? (!isOddRight ? '1px solid var(--glass-border)' : 'none')
          : (!isLast ? '1px solid var(--glass-border)' : 'none'),
        borderBottom: mobile && isOddRight === false ? '1px solid var(--glass-border)' : 'none',
      }}
    >
      <div style={{
        fontFamily: 'var(--font-display)', fontWeight: 800,
        fontSize: 'clamp(24px,2.8vw,36px)', lineHeight: 1.1, marginBottom: 5,
        background: 'linear-gradient(135deg,#fff 30%,var(--gold))',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
      }}>
        {value ? `${count.toLocaleString()}${suffix}` : label === 'loading' ? '…' : value}
      </div>
      <div style={{ fontSize: 12, color: 'var(--slate)', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 }}>
        {label}
      </div>
    </div>
  );
};

const TrustSection = ({ onNavigate }) => {
  const { mobile } = useResponsive();

  const [{ data: countData }] = useQuery({ query: POLICY_SALES_COUNT });
  const liveCount = countData?.policySales?.pageInfo?.total ?? null;

  /* Static stats — numeric value drives animation, suffix appended */
  const STATS = [
    {
      value: liveCount !== null ? liveCount : 50000,
      suffix: liveCount !== null ? '+' : '+',
      label: 'Policies Issued',
    },
    { value: 40,  suffix: '+', label: 'Countries Covered' },
    { value: 200, suffix: '+', label: 'Agency Partners'   },
    { value: 15,  suffix: '+', label: 'Insurer Partners'  },
  ];

  return (
  <section style={{ position: 'relative', zIndex: 1 }}>

    {/* Stats bar */}
    <div style={{
      borderTop: '1px solid var(--glass-border)',
      borderBottom: '1px solid var(--glass-border)',
      background: 'rgba(8,14,39,0.65)',
      backdropFilter: 'blur(12px)',
    }}>
      <div className="container">
        <div style={{ display: 'grid', gridTemplateColumns: mobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)' }}>
          {STATS.map((s, i) => (
            <StatCell
              key={s.label}
              value={s.value}
              suffix={s.suffix}
              label={s.label}
              mobile={mobile}
              isLast={i === STATS.length - 1}
              isOddRight={mobile ? i % 2 !== 0 : false}
            />
          ))}
        </div>
      </div>
    </div>

    {/* Anti-fraud banner */}
    <div style={{
      background: 'linear-gradient(135deg,rgba(49,99,49,0.12),rgba(246,166,35,0.05))',
      borderBottom: '1px solid rgba(49,99,49,0.18)',
    }}>
      <div className="container">
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexDirection: mobile ? 'column' : 'row',
          flexWrap: 'wrap', gap: mobile ? 16 : 20, padding: '20px 0',
        }}>

          {/* Left: shield + message */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
              background: 'rgba(34,197,94,0.1)', border: '1.5px solid rgba(34,197,94,0.35)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
            }}>
              🛡️
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#86efac', marginBottom: 2 }}>
                Cryptographically Verified Certificates
              </div>
              <p style={{ fontSize: 13, color: 'var(--slate)', margin: 0, lineHeight: 1.5 }}>
                Every Maljani certificate has a unique code embassies and hotels can check in 3 seconds.
              </p>
            </div>
          </div>

          {/* Right: chips + CTA */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            {CHIPS.map(chip => (
              <span key={chip} style={{
                fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.6)',
                background: 'rgba(255,255,255,0.04)', border: '1px solid var(--glass-border)',
                borderRadius: 999, padding: '5px 12px', whiteSpace: 'nowrap',
              }}>
                {chip}
              </span>
            ))}
            <button
              onClick={() => onNavigate ? onNavigate('verify') : undefined}
              style={{
                fontSize: 13, fontWeight: 700, color: 'var(--gold)',
                background: 'none', border: 'none', cursor: 'pointer',
                padding: 0, textDecoration: 'underline', textUnderlineOffset: 3,
                whiteSpace: 'nowrap',
              }}
            >
              Verify a certificate →
            </button>
          </div>

        </div>
      </div>
    </div>

  </section>
  );
};

export default TrustSection;
