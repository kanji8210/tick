import React from 'react';
import GroupQuoteWizard from './GroupQuoteWizard';

const GroupQuotesPage = ({ onNavigate }) => {
  return (
    <div className="fade-in container" style={{ paddingTop: 'clamp(5rem, 10vw, 6rem)', paddingBottom: '3rem', maxWidth: '800px' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 32, marginBottom: 24, color: 'var(--gold)' }}>
        Group & Agency Quotes
      </h1>
      <p style={{ color: 'var(--slate)', fontSize: 16, marginBottom: 32, maxWidth: 600 }}>
        Request a custom group or agency travel insurance quotation. Fill in the details below and our team will send you a tailored quote.
      </p>
      <GroupQuoteWizard onClose={() => onNavigate('landing')} />
      <button
        className="btn-luxury"
        style={{ marginTop: '2rem', background: 'transparent', border: '1px solid var(--glass-border)', color: 'white', width: '100%' }}
        onClick={() => onNavigate('landing')}
      >
        Back to Home
      </button>
    </div>
  );
};

export default GroupQuotesPage;
