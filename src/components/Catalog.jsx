import React from 'react';
import PolicyShowcase from './PolicyShowcase';
import { useResponsive } from '../lib/useResponsive';

const Catalog = ({ onNavigate, compareSelected = [], onAddCompare, onRemoveCompare }) => {
  const { mobile } = useResponsive();

  const handleAddCompare    = (p)   => onAddCompare?.(p);
  const handleRemoveCompare = (id)  => onRemoveCompare?.(id);

  return (
    <div className="fade-in" style={{ padding: mobile ? '5rem 0 2rem' : '6rem 0' }}>

      <PolicyShowcase
        onNavigate={onNavigate}
        compareSelected={compareSelected}
        onAddCompare={handleAddCompare}
        onRemoveCompare={handleRemoveCompare}
      />

      <div style={{ textAlign: 'center', marginTop: '6rem', padding: '4rem', background: 'rgba(255,255,255,0.02)', borderRadius: '24px' }}>
        <h3 className="serif" style={{ fontSize: '2rem' }}>Need a <span className="gold-text">Custom Quote?</span></h3>
        <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>Input your exact travel dates for precision-engineered pricing.</p>
        <button className="btn-luxury" onClick={() => onNavigate('wizard')}>START SEARCH WIZARD</button>
      </div>
    </div>
  );
};

export default Catalog;
