import React from 'react'
import { Provider } from 'urql'
import { client } from './lib/graphql'
import { AuthProvider, useAuth } from './lib/AuthContext'
import LandingPage from './components/LandingPage'
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
import GroupQuotesPage from './components/GroupQuotesPage'
import PaymentReturn from './components/PaymentReturn'
import { ClaimsPage, ClaimsRefundChoice, ClaimSupportPage } from './components/claims'

const VIEW_PATHS = {
  landing: '/',
  wizard: '/quote',
  login: '/login',
  register: '/register',
  dashboard: '/dashboard',
  catalog: '/catalog',
  verify: '/verify',
  about: '/about',
  agencies: '/agencies',
  'group-quotes': '/group-quotes',
  'payment-return': '/payment/return',
  claims: '/claims-refunds',
  claim: '/claims/new',
  refunds: '/refunds/new',
  'policy-detail': '/policy',
};
const PATH_VIEWS = Object.fromEntries(Object.entries(VIEW_PATHS).map(([view, path]) => [path, view]));

const urlToEntry = () => {
  const path = window.location.pathname === '/' ? '/' : window.location.pathname.replace(/\/+$/, '');
  const view = PATH_VIEWS[path] || 'landing';
  const params = new URLSearchParams(window.location.search);
  const searchData = view === 'catalog'
    ? {
        region: params.get('region') || '',
        departure: params.get('departure') || '',
        returnDate: params.get('returnDate') || '',
      }
    : null;
  return {
    view,
    policyId: null,
    searchData: searchData && Object.values(searchData).some(Boolean) ? searchData : null,
    forceStep: null,
  };
};

function AppContent() {
  const { role } = useAuth();
  const isAgent = role === 'agent' || role === 'administrator';
  const [theme, setTheme] = React.useState(() => {
    if (typeof window === 'undefined') return 'light';
    return window.localStorage.getItem('tic-theme') === 'dark' ? 'dark' : 'light';
  });

  React.useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem('tic-theme', theme);
  }, [theme]);

  const handleThemeToggle = () => {
    setTheme((current) => current === 'light' ? 'dark' : 'light');
  };

  /* ── URL ↔ view mapping ─────────────────────────────────────── */
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
    const path = VIEW_PATHS[view] || '/';
    const params = new URLSearchParams();
    if (view === 'catalog' && searchData) {
      ['region', 'departure', 'returnDate'].forEach((key) => {
        if (searchData[key]) params.set(key, searchData[key]);
      });
    }
    const query = params.toString();
    window.history.pushState({ idx: nextIdx }, '', query ? `${path}?${query}` : path);
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
    const onPop = (event) => {
      const targetIdx = event.state?.idx;
      if (Number.isInteger(targetIdx)) {
        setHistoryIdx(targetIdx);
      } else {
        const entry = urlToEntry();
        setHistory(h => {
          const next = [...h, entry];
          setHistoryIdx(next.length - 1);
          return next;
        });
      }
      window.scrollTo(0, 0);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const renderView = () => {
    switch(activeView) {
      case 'dashboard':
        return <Dashboard onNavigate={handleNavigate} initialTab={history[historyIdx].searchData?.openTab} />;
      case 'wizard':
        return (
          <div className="fade-in container" style={{ paddingTop: 'clamp(5rem, 10vw, 6rem)', paddingBottom: '3rem', maxWidth: '800px' }}>
            <QuoteWizard
              initialPolicyId={history[historyIdx].policyId}
              initialSearchData={history[historyIdx].searchData}
              initialStep={history[historyIdx].forceStep}
              onNavigate={handleNavigate}
              onBack={handleBack}
            />
            <button
              className="btn-luxury"
              style={{
                marginTop: '2rem',
                background: 'transparent',
                border: '1px solid var(--glass-border)',
                color: 'var(--white)',
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
        return <Catalog searchParams={history[historyIdx].searchData} onNavigate={handleNavigate} />;
      case 'verify':
        return <VerifyPolicy onNavigate={handleNavigate} />;
      case 'about':
        return <AboutPage onNavigate={handleNavigate} />;
      case 'agencies':
        return <AgenciesPage onNavigate={handleNavigate} />;
      case 'group-quotes':
        return <GroupQuotesPage onNavigate={handleNavigate} />;
      case 'payment-return':
        return <PaymentReturn onNavigate={handleNavigate} />;
      case 'claims':
        return <ClaimsRefundChoice onNavigate={handleNavigate} />;
      case 'claim':
        return <ClaimSupportPage initialContext={history[historyIdx].searchData} />;
      case 'refunds':
        return <ClaimsPage initialContext={history[historyIdx].searchData} />;
      case 'policy-detail':
        return (
          <PolicyDetail 
            policyId={selectedPolicyId} 
            searchData={history[historyIdx].searchData}
            onBack={() => handleNavigate('landing')} 
            onStartWizard={(id, data, step) => handleNavigate('wizard', id, data, step)}
          />
        );
      case 'landing':
      default:
        return (
          <LandingPage 
            onStartWizard={(id, data, step) => handleNavigate('wizard', id ?? null, data ?? null, step ?? null)} 
            onNavigate={handleNavigate}
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
        theme={theme}
        onToggleTheme={handleThemeToggle}
      />
      <main style={{ position: 'relative', zIndex: 1 }}>
        {renderView()}
      </main>
      <Footer onNavigate={handleNavigate} />

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
