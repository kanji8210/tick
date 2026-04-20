import React from 'react'
import { Provider } from 'urql'
import { client } from './lib/graphql'
import { AuthProvider, useAuth } from './lib/AuthContext'
import LandingPage, { CompareBar, CompareModal, CompareDatePicker } from './components/LandingPage'
import ChatWidget from './components/ChatWidget'
import QuoteWizard from './components/QuoteWizard'
import Header from './components/Header'
import Footer from './components/Footer'
import Login from './components/Login'
import Register from './components/Register'
import Dashboard from './components/Dashboard'
import PolicyDetail from './components/PolicyDetail'
import Catalog from './components/Catalog'
import VerifyPolicy from './components/VerifyPolicy'
import AboutPage from './components/AboutPage'
import AgenciesPage from './components/AgenciesPage'

function AppContent() {
  const { user, role } = useAuth();
  const isAgent = role === 'agent' || role === 'administrator';

  /* ── Global compare state ─────────────────────────────────── */
  const [compareSelected,  setCompareSelected]  = React.useState([]);
  const [compareOpen,      setCompareOpen]      = React.useState(false);
  const [compareDates,     setCompareDates]     = React.useState(null);
  const [showDatePicker,   setShowDatePicker]   = React.useState(false);

  const onAddCompare    = (p)   => setCompareSelected(prev => prev.length < 3 && !prev.find(x => x.id === p.id) ? [...prev, p] : prev);
  const onRemoveCompare = (id)  => setCompareSelected(prev => prev.filter(p => p.id !== id));

  const compareProps = { compareSelected, onAddCompare, onRemoveCompare };
  /* ── URL ↔ view mapping ─────────────────────────────────────── */
  const VIEW_PATHS = {
    landing:       '/',
    wizard:        '/quote',
    login:         '/login',
    register:      '/register',
    dashboard:     '/dashboard',
    catalog:       '/catalog',
    verify:        '/verify',
    about:         '/about',
    agencies:      '/agencies',
    'policy-detail': '/policy',
  };
  const PATH_VIEWS = Object.fromEntries(Object.entries(VIEW_PATHS).map(([v, p]) => [p, v]));

  const urlToEntry = () => {
    const path = window.location.pathname;
    const view = PATH_VIEWS[path] || 'landing';
    return { view, policyId: null, searchData: null, forceStep: null };
  };

  const [history, setHistory] = React.useState([urlToEntry()]);
  const [historyIdx, setHistoryIdx] = React.useState(0);

  const activeView       = history[historyIdx].view;
  const selectedPolicyId = history[historyIdx].policyId;
  const canGoBack        = historyIdx > 0;
  const canGoForward     = historyIdx < history.length - 1;

  const handleNavigate = (view, policyId = null, searchData = null, forceStep = null) => {
    const entry = { view, policyId, searchData, forceStep };
    const nextHistory = [...history.slice(0, historyIdx + 1), entry];
    const nextIdx = historyIdx + 1;

    setHistory(nextHistory);
    setHistoryIdx(nextIdx);
    window.history.pushState({ idx: nextIdx }, '', VIEW_PATHS[view] || '/');
    window.scrollTo(0, 0);
  };

  const handleBack = () => {
    if (!canGoBack) return;
    window.history.back();
  };

  const handleForward = () => {
    if (!canGoForward) return;
    window.history.forward();
  };

  // Listen to browser back/forward buttons
  React.useEffect(() => {
    const onPop = () => {
      const entry = urlToEntry();
      setHistory(h => {
        const next = [...h, entry];
        setHistoryIdx(next.length - 1);
        return next;
      });
      window.scrollTo(0, 0);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  });

  const renderView = () => {
    switch(activeView) {
      case 'dashboard':
        return <Dashboard onNavigate={handleNavigate} initialTab={history[historyIdx].searchData?.openTab} />;
      case 'wizard':
        return (
          <div className="fade-in" style={{ padding: '4rem 0', maxWidth: '800px', margin: '0 auto' }}>
            <QuoteWizard
              initialPolicyId={history[historyIdx].policyId}
              initialSearchData={history[historyIdx].searchData}
              initialStep={history[historyIdx].forceStep}
              onNavigate={handleNavigate}
            />
            <button
              className="btn-luxury"
              style={{
                marginTop: '2rem',
                background: 'transparent',
                border: '1px solid var(--glass-border)',
                color: 'white',
                width: '100%'
              }}
              onClick={() => handleNavigate('landing')}
            >
              Back to Home
            </button>
          </div>
        );
      case 'login':
        return <Login onNavigate={handleNavigate} />;
      case 'register':
        return <Register onNavigate={handleNavigate} />;
      case 'catalog':
        return <Catalog onNavigate={handleNavigate} {...compareProps} />;
      case 'verify':
        return <VerifyPolicy onNavigate={handleNavigate} />;
      case 'about':
        return <AboutPage onNavigate={handleNavigate} />;
      case 'agencies':
        return <AgenciesPage onNavigate={handleNavigate} />;
      case 'policy-detail':
        return (
          <PolicyDetail 
            policyId={selectedPolicyId} 
            searchData={history[historyIdx].searchData}
            onBack={() => handleNavigate('landing')} 
            onStartWizard={(id, data, step) => handleNavigate('wizard', id, data, step)}
            {...compareProps}
          />
        );
      case 'landing':
      default:
        return (
          <LandingPage 
            onStartWizard={(id, data, step) => handleNavigate('wizard', id ?? null, data ?? null, step ?? null)} 
            onNavigate={handleNavigate}
            {...compareProps}
          />
        );
    }
  }

  return (
    <div className="app-container">
      <div className="bg-mesh" aria-hidden="true" />
      <div className="bg-grid" aria-hidden="true" />
      <Header
        onNavigate={handleNavigate}
        activeView={activeView}
        canGoBack={canGoBack}
        canGoForward={canGoForward}
        onBack={handleBack}
        onForward={handleForward}
      />
      <main style={{ position: 'relative', zIndex: 1 }}>
        {renderView()}
      </main>
      <Footer onNavigate={handleNavigate} />

      {/* ── Global compare UI — persists across all views ── */}
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
            handleNavigate('policy-detail', p.databaseId, compareDates);
          }}
          onKeepComparing={(p) => {
            setCompareSelected([p]);
            setCompareOpen(false);
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
      {/* Persistent chat widget — works for all users, all views */}
      <ChatWidget />
    </div>
  )
}

function App() {
  return (
    <Provider value={client}>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </Provider>
  )
}

export default App
