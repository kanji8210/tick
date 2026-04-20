import React, { useState } from 'react';
import PolicyShowcase from './PolicyShowcase';
import { CompareBar, CompareModal, CompareDatePicker } from './LandingPage';
import { useResponsive } from '../lib/useResponsive';

const Catalog = ({ onNavigate }) => {
  const { mobile } = useResponsive();
  const [compareSelected, setCompareSelected] = useState([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareDates, setCompareDates] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const onAddCompare    = (p) => setCompareSelected(prev => prev.length < 3 && !prev.find(x => x.id === p.id) ? [...prev, p] : prev);
  const onRemoveCompare = (id) => setCompareSelected(prev => prev.filter(p => p.id !== id));

  return (
    <div className="fade-in" style={{ padding: mobile ? '5rem 0 2rem' : '6rem 0' }}>

      <PolicyShowcase
        onNavigate={onNavigate}
        compareSelected={compareSelected}
        onAddCompare={onAddCompare}
        onRemoveCompare={onRemoveCompare}
      />

      <CompareBar
        selected={compareSelected}
        onRemove={onRemoveCompare}
        onClear={() => setCompareSelected([])}
        onCompare={() => setShowDatePicker(true)}
      />

      {showDatePicker && (
        <CompareDatePicker
          onConfirm={(dates) => { setCompareDates(dates); setShowDatePicker(false); setCompareOpen(true); }}
          onSkip={() => { setCompareDates(null); setShowDatePicker(false); setCompareOpen(true); }}
          onClose={() => setShowDatePicker(false)}
        />
      )}

      {compareOpen && compareSelected.length >= 2 && (
        <CompareModal
          selected={compareSelected}
          compareDates={compareDates}
          onClose={() => setCompareOpen(false)}
          onPickPolicy={(p) => {
            setCompareOpen(false);
            onNavigate('policy-detail', p.databaseId, compareDates);
          }}
          onKeepComparing={(p) => {
            setCompareSelected([p]);
            setCompareOpen(false);
          }}
        />
      )}

      <div style={{ textAlign: 'center', marginTop: '6rem', padding: '4rem', background: 'rgba(255,255,255,0.02)', borderRadius: '24px' }}>
        <h3 className="serif" style={{ fontSize: '2rem' }}>Need a <span className="gold-text">Custom Quote?</span></h3>
        <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>Input your exact travel dates for precision-engineered pricing.</p>
        <button className="btn-luxury" onClick={() => onNavigate('wizard')}>START SEARCH WIZARD</button>
      </div>
    </div>
  );
};

export default Catalog;
