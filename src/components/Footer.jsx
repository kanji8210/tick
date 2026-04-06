import React from 'react';
import { useResponsive } from '../lib/useResponsive';

const Footer = ({ onNavigate }) => {
  const { mobile, tablet } = useResponsive();

  const productLinks = [
    { label: 'Travel Insurance',   view: 'catalog' },
    { label: 'Group Policies',     view: 'catalog' },
    { label: 'Annual Multi-Trip',  view: 'catalog' },
    { label: 'Embassy Letters',    view: 'catalog' },
  ];

  const agencyLinks = [
    { label: 'Partner Portal',       view: 'login' },
    { label: 'Commission Structure', view: 'agencies' },
    { label: 'Onboarding Guide',     view: 'agencies' },
    { label: 'API Access',           view: 'about' },
  ];

  const supportLinks = [
    { label: 'Verify a Policy', view: 'verify' },
    { label: 'File a Claim',    view: 'catalog' },
    { label: 'Contact Us',      view: 'about' },
    { label: 'FAQ',             view: 'about' },
  ];

  const LinkColumn = ({ title, links }) => (
    <div>
      <h4 style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, marginBottom: mobile ? 12 : 18, color: 'rgba(255,255,255,0.9)', letterSpacing: '0.04em' }}>{title}</h4>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: mobile ? 9 : 11 }}>
        {links.map((l) => (
          <li key={l.label}>
            <button className="footer-link" onClick={() => onNavigate(l.view)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--slate)', fontSize: 14, padding: 0, fontFamily: 'var(--font-body)' }}>
              {l.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <footer style={{ position: 'relative', zIndex: 1, borderTop: '1px solid var(--glass-border)', padding: mobile ? '36px 0 24px' : '64px 0 36px' }}>
      <div className="container">

        {mobile ? (
          /* ── Mobile footer layout ── */
          <div style={{ marginBottom: 32 }}>
            {/* Brand */}
            <div style={{ marginBottom: 28 }}>
              <button onClick={() => onNavigate('landing')} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: 12 }}>
                <img
                  src="https://mtj.ivk.mybluehost.me/website_e48ea083/wp-content/uploads/2026/03/logo-type.png"
                  alt="TIC-Kenya"
                  style={{ width: 32, height: 32, objectFit: 'contain', borderRadius: 8, flexShrink: 0 }}
                />
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 17, color: '#fff' }}>TIC<span style={{ color: 'var(--gold)' }}>-Kenya</span></span>
              </button>
              <p style={{ color: 'var(--slate)', fontSize: 13, lineHeight: 1.7, marginBottom: 14, maxWidth: 280 }}>
                Kenya's trusted travel insurance aggregator. Compare, buy, and travel protected.
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                {['𝕏', 'in', 'f', '◻'].map((s, i) => (
                  <a key={i} href="#" style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: 'var(--slate)', textDecoration: 'none' }} aria-label="Social">{s}</a>
                ))}
              </div>
            </div>

            {/* Products + Agencies side by side */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
              <LinkColumn title="Products" links={productLinks} />
              <LinkColumn title="For Agencies" links={agencyLinks} />
            </div>

            {/* Support — inline row */}
            <div>
              <h4 style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, marginBottom: 10, color: 'rgba(255,255,255,0.9)', letterSpacing: '0.04em' }}>Support</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {supportLinks.map((l) => (
                  <button
                    key={l.label}
                    className="footer-link"
                    onClick={() => onNavigate(l.view)}
                    style={{
                      background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
                      borderRadius: 100, padding: '7px 14px',
                      cursor: 'pointer', color: 'var(--slate)', fontSize: 13, fontFamily: 'var(--font-body)',
                      transition: 'all 0.2s',
                    }}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* ── Desktop / Tablet footer layout ── */
          <div style={{ display: 'grid', gridTemplateColumns: tablet ? '1fr 1fr' : '2fr 1fr 1fr 1fr', gap: tablet ? 36 : 56, marginBottom: 48 }}>
            {/* Brand */}
            <div>
              <button onClick={() => onNavigate('landing')} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: 16 }}>
                <img
                  src="https://mtj.ivk.mybluehost.me/website_e48ea083/wp-content/uploads/2026/03/logo-type.png"
                  alt="TIC-Kenya"
                  style={{ width: 36, height: 36, objectFit: 'contain', borderRadius: 9, flexShrink: 0 }}
                />
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 19, color: '#fff' }}>TIC<span style={{ color: 'var(--gold)' }}>-Kenya</span></span>
              </button>
              <p style={{ color: 'var(--slate)', fontSize: 14, lineHeight: 1.75, maxWidth: 270, marginBottom: 20 }}>
                Kenya's trusted travel insurance aggregator. Compare, buy, and travel protected.
              </p>
              <div style={{ display: 'flex', gap: 9 }}>
                {['𝕏', 'in', 'f', '◻'].map((s, i) => (
                  <a key={i} href="#" style={{ width: 35, height: 35, borderRadius: 8, background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: 'var(--slate)', textDecoration: 'none', transition: 'all 0.2s' }} aria-label="Social">{s}</a>
                ))}
              </div>
            </div>

            <LinkColumn title="Products" links={productLinks} />
            <LinkColumn title="For Agencies" links={agencyLinks} />

            <div>
              <h4 style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, marginBottom: 18, color: 'rgba(255,255,255,0.9)', letterSpacing: '0.04em' }}>Support</h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 11 }}>
                {supportLinks.map((l) => (
                  <li key={l.label}>
                    <button className="footer-link" onClick={() => onNavigate(l.view)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--slate)', fontSize: 14, padding: 0, fontFamily: 'var(--font-body)' }}>
                      {l.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Bottom bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: mobile ? 'center' : 'space-between', paddingTop: mobile ? 20 : 28, borderTop: '1px solid var(--glass-border)', flexWrap: 'wrap', gap: mobile ? 10 : 14, textAlign: mobile ? 'center' : 'left', flexDirection: mobile ? 'column' : 'row' }}>
          <p style={{ fontSize: mobile ? 12 : 13, color: 'var(--slate-dark)' }}>© 2026 Travel Insurance Center-Kenya. All rights reserved.</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: mobile ? 6 : 10, flexWrap: 'wrap', justifyContent: 'center' }}>
            {['✓ IRA Compliant', '✓ SSL Secured', '✓ GDPR Ready'].map((b) => (
              <span key={b} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: mobile ? '4px 9px' : '5px 11px', background: 'rgba(34,197,94,0.10)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 100, fontSize: mobile ? 10 : 11, fontWeight: 600, color: '#6ee7b7' }}>{b}</span>
            ))}
          </div>
        </div>

      </div>
    </footer>
  );
};

export default Footer;
