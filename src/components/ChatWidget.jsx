import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../lib/AuthContext';
import { useResponsive } from '../lib/useResponsive';

const WP_REST_BASE = '/wp-json';

/* ── Icons (inline SVG — no library dependency) ─────────────────── */
const IconChat    = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;
const IconClose   = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const IconSend    = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>;
const IconPin     = ({ filled }) => <svg width="13" height="13" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>;
const IconUnpin   = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const IconChevron = ({ up }) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: up ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}><polyline points="6 9 12 15 18 9"/></svg>;

/* ── Pre-chat form for guest users ──────────────────────────────── */
const GuestForm = ({ onSubmit }) => {
  const [name,  setName]  = useState('');
  const [email, setEmail] = useState('');
  const [err,   setErr]   = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim())  { setErr('Please enter your name.'); return; }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErr('Please enter a valid email address.'); return;
    }
    onSubmit({ name: name.trim(), email: email.trim() });
  };

  return (
    <div style={{ padding: '28px 24px', display: 'flex', flexDirection: 'column', gap: 0 }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: 36, marginBottom: 10 }}>👋</div>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800, margin: '0 0 6px', color: '#fff' }}>
          Chat with us
        </h3>
        <p style={{ fontSize: 13, color: 'var(--slate)', margin: 0, lineHeight: 1.6 }}>
          Our team typically replies in a few minutes.
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }} noValidate>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)' }}>
            Your Name
          </label>
          <input
            type="text"
            value={name}
            onChange={e => { setName(e.target.value); setErr(''); }}
            placeholder="Jane Doe"
            autoComplete="name"
            style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 14, fontFamily: 'var(--font-body)', outline: 'none', width: '100%', boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)' }}>
            Email Address
          </label>
          <input
            type="email"
            value={email}
            onChange={e => { setEmail(e.target.value); setErr(''); }}
            placeholder="jane@example.com"
            autoComplete="email"
            inputMode="email"
            style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 14, fontFamily: 'var(--font-body)', outline: 'none', width: '100%', boxSizing: 'border-box' }}
          />
        </div>
        {err && (
          <p style={{ fontSize: 12, color: '#f87171', margin: 0 }}>{err}</p>
        )}
        <button
          type="submit"
          style={{ marginTop: 4, padding: '12px', borderRadius: 10, border: 'none', background: 'var(--indigo)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-body)', letterSpacing: '0.02em' }}
        >
          Start Chat →
        </button>
      </form>

      <p style={{ marginTop: 18, fontSize: 11, color: 'var(--slate)', textAlign: 'center', lineHeight: 1.7 }}>
        🔒 Your information is kept private and used only to identify your support request.
      </p>
    </div>
  );
};

/* ── Pinned messages bar ─────────────────────────────────────────── */
const PinnedBar = ({ messages, onUnpin, onScrollTo }) => {
  const [expanded, setExpanded] = useState(true);
  if (!messages.length) return null;

  return (
    <div style={{ borderBottom: '1px solid rgba(212,175,55,0.25)', background: 'rgba(212,175,55,0.06)' }}>
      <button
        onClick={() => setExpanded(e => !e)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gold)', fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' }}
        aria-expanded={expanded}
      >
        <span>📌 {messages.length} Pinned</span>
        <IconChevron up={expanded} />
      </button>
      {expanded && (
        <div style={{ padding: '0 14px 10px', display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 120, overflowY: 'auto' }}>
          {messages.map(msg => (
            <div key={msg.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                onClick={() => onScrollTo(msg.id)}
                style={{ flex: 1, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', borderRadius: 6, color: 'rgba(255,255,255,0.8)', fontSize: 12, textAlign: 'left', fontFamily: 'var(--font-body)', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                title={msg.message}
              >
                {msg.message.length > 60 ? msg.message.slice(0, 57) + '…' : msg.message}
              </button>
              <button
                onClick={() => onUnpin(msg.id)}
                aria-label="Unpin message"
                style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--slate)', padding: 4, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 28, minHeight: 28 }}
              >
                <IconUnpin />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* ── Main ChatWidget ─────────────────────────────────────────────── */
const ChatWidget = () => {
  const { user, role } = useAuth();
  const { mobile }     = useResponsive();
  const isAgent = role === 'agent' || role === 'administrator';

  const [open,        setOpen]        = useState(false);
  const [guestInfo,   setGuestInfo]   = useState(null);   // { name, email }
  const [convId,      setConvId]      = useState(null);
  const [chatToken,   setChatToken]   = useState(null);
  const [messages,    setMessages]    = useState([]);
  const [input,       setInput]       = useState('');
  const [sending,     setSending]     = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [startError,  setStartError]  = useState(null);
  const [sendError,   setSendError]   = useState(null);
  const [pinnedIds,   setPinnedIds]   = useState([]);
  const [unread,      setUnread]      = useState(0);
  const [hoveredMsg,  setHoveredMsg]  = useState(null);

  const scrollRef  = useRef(null);
  const inputRef   = useRef(null);
  const lastIdRef  = useRef(0);
  const msgRefs    = useRef({});
  const panelRef   = useRef(null);

  const sessionIdentity = user ? { token: user.token, email: user.email, name: user.name } : guestInfo;
  const needsGuestForm  = !user && !guestInfo;
  const displayName     = user?.name || guestInfo?.name || 'You';

  /* ── Close on Escape ──── */
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  /* ── Start / resume session ──── */
  useEffect(() => {
    if (!open || needsGuestForm || convId || loading) return;
    setLoading(true);
    setStartError(null);

    const headers = { 'Content-Type': 'application/json' };
    if (user?.token) headers['Authorization'] = `Bearer ${user.token}`;

    fetch(`${WP_REST_BASE}/maljani-chat/v1/start`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        email:     user?.email     || guestInfo?.email,
        name:      user?.name      || guestInfo?.name,
        policy_id: null,
      }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setConvId(data.conversation_id);
          setChatToken(data.token);
        } else {
          setStartError(data.message || 'Could not start chat session.');
        }
      })
      .catch(() => setStartError('Network error. Please try again.'))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, needsGuestForm, convId]);

  /* ── Poll for new messages ──── */
  useEffect(() => {
    if (!convId || !chatToken) return;
    lastIdRef.current = 0;
    setMessages([]);

    const poll = () => {
      fetch(`${WP_REST_BASE}/maljani-chat/v1/poll?conversation_id=${convId}&token=${chatToken}&last_id=${lastIdRef.current}`)
        .then(r => r.json())
        .then(data => {
          if (data.success && data.messages?.length > 0) {
            setMessages(prev => {
              const existingIds = new Set(prev.map(m => Number(m.id)));
              const newMsgs = data.messages
                .map(m => ({ ...m, id: Number(m.id) }))
                .filter(m => !existingIds.has(m.id));
              if (!newMsgs.length) return prev;
              const combined = [...prev, ...newMsgs];
              lastIdRef.current = Math.max(...combined.map(m => Number(m.id) || 0));
              const incomingSupport = newMsgs.filter(m => m.sender_type !== 'user');
              if (!open && incomingSupport.length) setUnread(c => c + incomingSupport.length);
              return combined;
            });
          }
        })
        .catch(() => {});
    };

    const interval = setInterval(poll, 4000);
    poll();
    return () => clearInterval(interval);
  }, [convId, chatToken, open]);

  /* ── Scroll to bottom on new messages ──── */
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  /* ── Clear unread when opened ──── */
  useEffect(() => { if (open) setUnread(0); }, [open]);

  /* ── Auto-focus input when chat opens ──── */
  useEffect(() => {
    if (open && !needsGuestForm && convId) {
      setTimeout(() => inputRef.current?.focus(), 120);
    }
  }, [open, needsGuestForm, convId]);

  /* ── Send message ──── */
  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || sending || !convId) return;
    setSendError(null);
    const text = input;
    const optimisticKey = `opt-${Date.now()}`;
    setSending(true);
    setMessages(prev => [...prev, {
      id:          optimisticKey,
      sender_type: 'user',
      message:     text,
      created_at:  new Date().toISOString(),
      isOptimistic: true,
    }]);
    setInput('');

    const headers = { 'Content-Type': 'application/json' };
    if (user?.token) headers['Authorization'] = `Bearer ${user.token}`;

    try {
      const res  = await fetch(`${WP_REST_BASE}/maljani-chat/v1/message`, {
        method: 'POST', headers,
        body: JSON.stringify({ conversation_id: convId, token: chatToken, message: text }),
      });
      const data = await res.json();
      if (data.success) {
        const realId = data.message_id ? Number(data.message_id) : null;
        if (realId) {
          setMessages(prev => prev.map(m => m.id === optimisticKey ? { ...m, id: realId, isOptimistic: false } : m));
          if (realId > lastIdRef.current) lastIdRef.current = realId;
        } else {
          setMessages(prev => prev.filter(m => m.id !== optimisticKey));
        }
      } else {
        setMessages(prev => prev.filter(m => m.id !== optimisticKey));
        setSendError(data.message || 'Failed to send. Please try again.');
        setInput(text);
      }
    } catch {
      setMessages(prev => prev.filter(m => m.id !== optimisticKey));
      setSendError('Network error. Please try again.');
      setInput(text);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const togglePin = useCallback((msgId) => {
    setPinnedIds(prev => prev.includes(msgId) ? prev.filter(id => id !== msgId) : [...prev, msgId]);
  }, []);

  const scrollToMsg = useCallback((msgId) => {
    msgRefs.current[msgId]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  const pinnedMessages = messages.filter(m => pinnedIds.includes(m.id));

  /* Agents use the full dashboard messaging — no floating widget */
  if (isAgent) return null;

  /* ── Layout measurements ──── */
  // CompareBar is z-index 900 and ~66px tall; sit above it
  // Mobile: bottom sheet full-screen
  // Desktop: 380px × 560px panel, 24px from right/bottom

  const BUBBLE_SIZE  = 52;
  const BUBBLE_RIGHT = 24;
  const BUBBLE_BOT   = 24;

  const panelRight  = BUBBLE_RIGHT;
  const panelBot    = BUBBLE_BOT + BUBBLE_SIZE + 12; // just above bubble

  /* ── Render ──── */
  return (
    <>
      {/* ── Floating panel ─────────────────────────────────────── */}
      {open && (
        <>
          {/* Mobile backdrop */}
          {mobile && (
            <div
              onClick={() => setOpen(false)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 958, backdropFilter: 'blur(4px)' }}
              aria-hidden="true"
            />
          )}

          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Live Support Chat"
            style={{
              position: 'fixed',
              zIndex: 959,
              ...(mobile ? {
                /* Mobile: bottom sheet */
                left: 0, right: 0, bottom: 0,
                height: '92dvh',
                borderRadius: '20px 20px 0 0',
                paddingBottom: 'env(safe-area-inset-bottom)',
              } : {
                /* Desktop: bottom-right panel */
                right: panelRight,
                bottom: panelBot,
                width: 380,
                height: 560,
                borderRadius: 'var(--radius-xl)',
                boxShadow: '0 24px 64px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.06)',
              }),
              background: 'var(--navy-mid, #0d1a2d)',
              border: '1px solid var(--glass-border-bright, rgba(255,255,255,0.12))',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              animation: 'chatSlideUp 0.25s cubic-bezier(0.34,1.56,0.64,1)',
            }}
          >
            {/* ── Panel header ──── */}
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, background: 'rgba(255,255,255,0.025)' }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: convId ? '#22c55e' : '#94a3b8', boxShadow: convId ? '0 0 8px #22c55e' : 'none', flexShrink: 0 }} aria-hidden="true" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>Live Support</h3>
                <p style={{ margin: 0, fontSize: 11, color: convId ? 'var(--gold)' : 'var(--slate)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {convId ? 'Agent online' : loading ? 'Connecting…' : 'Support team'}
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close chat"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--glass-border)', borderRadius: 8, color: 'var(--slate)', cursor: 'pointer', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
              >
                <IconClose />
              </button>
            </div>

            {/* ── Guest form ──── */}
            {needsGuestForm ? (
              <div style={{ flex: 1, overflowY: 'auto' }}>
                <GuestForm onSubmit={(info) => setGuestInfo(info)} />
              </div>
            ) : (
              <>
                {/* ── Pinned messages bar ──── */}
                <PinnedBar
                  messages={pinnedMessages}
                  onUnpin={togglePin}
                  onScrollTo={scrollToMsg}
                />

                {/* ── Messages area ──── */}
                <div
                  ref={scrollRef}
                  style={{ flex: 1, padding: '16px 14px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, background: 'rgba(0,0,0,0.08)' }}
                >
                  {/* Loading spinner */}
                  {loading && (
                    <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--slate)', fontSize: 12 }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid var(--indigo)', borderTopColor: 'transparent', animation: 'spin 0.7s linear infinite', margin: '0 auto 12px' }} />
                      Connecting to support…
                    </div>
                  )}

                  {/* Start error */}
                  {startError && !loading && (
                    <div style={{ textAlign: 'center', padding: '24px 0' }}>
                      <p style={{ fontSize: 13, color: '#f87171', marginBottom: 12 }}>⚠ {startError}</p>
                      <button
                        className="btn btn--ghost btn--sm"
                        onClick={() => { setStartError(null); setLoading(true); setConvId(null); setChatToken(null); }}
                      >
                        Retry
                      </button>
                    </div>
                  )}

                  {/* Empty state */}
                  {!loading && !startError && messages.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--slate)' }}>
                      <div style={{ fontSize: 32, marginBottom: 12 }}>👋</div>
                      <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)', marginBottom: 4 }}>
                        Hi {displayName.split(' ')[0]}!
                      </p>
                      <p style={{ fontSize: 12, opacity: 0.7, lineHeight: 1.6 }}>
                        How can we help you today?<br />Our team typically replies in minutes.
                      </p>
                    </div>
                  )}

                  {/* Messages */}
                  {messages.map((msg, i) => {
                    const isMe    = msg.sender_type === 'user';
                    const isPinned = pinnedIds.includes(msg.id);
                    const isHovered = hoveredMsg === msg.id;

                    return (
                      <div
                        key={msg.id || i}
                        ref={el => { if (el) msgRefs.current[msg.id] = el; }}
                        style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '82%', display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', position: 'relative' }}
                        onMouseEnter={() => setHoveredMsg(msg.id)}
                        onMouseLeave={() => setHoveredMsg(null)}
                      >
                        {/* Pin button — shows on hover */}
                        {(isHovered || isPinned) && !msg.isOptimistic && (
                          <button
                            onClick={() => togglePin(msg.id)}
                            aria-label={isPinned ? 'Unpin message' : 'Pin message'}
                            title={isPinned ? 'Unpin' : 'Pin message'}
                            style={{
                              position: 'absolute',
                              top: -6,
                              [isMe ? 'left' : 'right']: -6,
                              background: isPinned ? 'rgba(212,175,55,0.2)' : 'rgba(255,255,255,0.1)',
                              border: `1px solid ${isPinned ? 'rgba(212,175,55,0.5)' : 'var(--glass-border)'}`,
                              borderRadius: 6, cursor: 'pointer',
                              color: isPinned ? 'var(--gold)' : 'var(--slate)',
                              width: 24, height: 24,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              zIndex: 2, transition: 'all 0.15s',
                            }}
                          >
                            <IconPin filled={isPinned} />
                          </button>
                        )}

                        {/* Bubble */}
                        <div style={{
                          padding: '10px 14px',
                          borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                          background: isMe ? 'var(--indigo)' : 'rgba(255,255,255,0.08)',
                          border: isPinned
                            ? `1px solid rgba(212,175,55,0.4)`
                            : isMe ? '1px solid rgba(255,255,255,0.08)' : '1px solid var(--glass-border)',
                          color: '#fff',
                          fontSize: 13,
                          lineHeight: 1.55,
                          opacity: msg.isOptimistic ? 0.7 : 1,
                          transition: 'border-color 0.2s',
                          wordBreak: 'break-word',
                        }}>
                          {msg.message}
                        </div>

                        {/* Timestamp */}
                        <span style={{ fontSize: 10, color: 'var(--slate)', marginTop: 3, padding: '0 3px' }}>
                          {msg.isOptimistic ? '…' : new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* ── Input area ──── */}
                <div style={{ borderTop: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.02)', flexShrink: 0 }}>
                  {sendError && (
                    <div style={{ padding: '6px 14px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontSize: 11, color: '#f87171' }}>⚠ {sendError}</span>
                      <button onClick={() => setSendError(null)} style={{ background: 'none', border: 'none', color: 'var(--slate)', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 2 }}>✕</button>
                    </div>
                  )}
                  {!convId && !startError && !loading && (
                    <div style={{ padding: '6px 14px 0', fontSize: 11, color: '#f59e0b' }}>⏳ Connecting…</div>
                  )}
                  <form
                    onSubmit={handleSend}
                    style={{ padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'flex-end' }}
                  >
                    <input
                      ref={inputRef}
                      type="text"
                      value={input}
                      onChange={e => { setInput(e.target.value); setSendError(null); }}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) handleSend(e); }}
                      placeholder={convId ? 'Type a message…' : 'Waiting for connection…'}
                      autoComplete="off"
                      disabled={sending || !convId}
                      style={{
                        flex: 1,
                        padding: '10px 14px',
                        borderRadius: 12,
                        border: `1px solid ${sendError ? '#f87171' : 'var(--glass-border)'}`,
                        background: 'rgba(0,0,0,0.2)',
                        color: '#fff',
                        fontSize: 13,
                        fontFamily: 'var(--font-body)',
                        outline: 'none',
                        resize: 'none',
                        minHeight: 44,
                      }}
                    />
                    <button
                      type="submit"
                      aria-label="Send message"
                      disabled={sending || !input.trim() || !convId}
                      style={{
                        width: 44, height: 44, borderRadius: 12, border: 'none', flexShrink: 0,
                        background: sending || !input.trim() || !convId ? 'rgba(49,99,49,0.3)' : 'var(--indigo)',
                        color: '#fff', cursor: sending || !input.trim() || !convId ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'background 0.2s',
                      }}
                    >
                      {sending
                        ? <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', animation: 'spin 0.7s linear infinite' }} />
                        : <IconSend />
                      }
                    </button>
                  </form>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* ── Chat bubble ────────────────────────────────────────── */}
      <button
        aria-label={open ? 'Close chat' : 'Open live chat'}
        onClick={() => setOpen(o => !o)}
        style={{
          position: 'fixed',
          bottom: BUBBLE_BOT,
          right: BUBBLE_RIGHT,
          zIndex: 960,
          width:  BUBBLE_SIZE,
          height: BUBBLE_SIZE,
          borderRadius: '50%',
          background: open ? 'rgba(49,99,49,0.85)' : 'var(--indigo)',
          border: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 4px 20px rgba(49,99,49,0.45)',
          transition: 'transform 0.2s, background 0.2s',
          color: '#fff',
        }}
        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
        onMouseLeave={e => e.currentTarget.style.transform = 'none'}
      >
        {open ? <IconClose /> : <IconChat />}

        {/* Unread badge */}
        {!open && unread > 0 && (
          <span style={{
            position: 'absolute', top: 0, right: 0,
            background: '#f87171', color: '#fff',
            fontSize: 10, fontWeight: 800,
            width: 18, height: 18, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid var(--navy-mid, #0d1a2d)',
            lineHeight: 1,
          }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* ── Keyframe animations ──── */}
      <style>{`
        @keyframes chatSlideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)   scale(1);    }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
};

export default ChatWidget;
