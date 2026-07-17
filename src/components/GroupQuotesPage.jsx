import React from 'react';
import GroupQuoteWizard from './GroupQuoteWizard';

const GroupQuotesPage = ({ onNavigate }) => {
  return (
    <div className="fade-in container" style={{ paddingTop: 'clamp(6rem, 12vw, 7rem)', paddingBottom: '4rem', maxWidth: '860px' }}>
      <div className="section-header" style={{ textAlign: 'left', marginBottom: 28 }}>
        <p className="section-label">Custom Quote Desk</p>
        <h1 className="section-title" style={{ fontSize: 'clamp(30px,4vw,44px)', color: 'var(--white)', marginBottom: 14 }}>
          Group Travel & Agency Quotes
        </h1>
        <p style={{ color: 'var(--slate)', fontSize: 16, maxWidth: 620, margin: 0 }}>
          Request a custom group travel or agency travel insurance quotation. Fill in the details below and our team will send you a tailored quote.
        </p>
      </div>
      <GroupQuoteWizard onClose={() => onNavigate('landing')} onNavigate={onNavigate} />
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
