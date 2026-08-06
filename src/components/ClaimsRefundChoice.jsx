import React from 'react';
import { useResponsive } from '../lib/useResponsive';

const OPTIONS = [
  {
    number: '01',
    eyebrow: 'Insured event',
    title: 'File a claim',
    description: 'Get professional help preparing and following up a travel insurance claim after a medical event, delay, lost luggage, or trip interruption.',
    details: ['Incident details', 'Supporting documents', 'Service fee review'],
    view: 'claim',
    action: 'Start a claim',
  },
  {
    number: '02',
    eyebrow: 'Policy cancellation',
    title: 'Request a refund',
    description: 'Ask for assistance cancelling an eligible policy and requesting a premium refund after a visa rejection, cancelled trip, or duplicate purchase.',
    details: ['Cancellation reason', 'Refund evidence', 'Payout details'],
    view: 'refunds',
    action: 'Request a refund',
  },
];

const ClaimsRefundChoice = ({ onNavigate }) => {
  const { mobile } = useResponsive();

  return (
    <div className="fade-in container support-choice" style={{ paddingTop: mobile ? 104 : 140, paddingBottom: mobile ? 64 : 96 }}>
      <style>{`
        .support-choice__intro { max-width: 760px; margin-bottom: 36px; }
        .support-choice__grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
        .support-choice__option { position: relative; display: flex; flex-direction: column; min-height: 390px; padding: clamp(24px, 3vw, 38px); overflow: hidden; border: 1px solid var(--glass-border); border-radius: 8px; background: var(--glass-bg); text-align: left; }
        .support-choice__option::before { content: ''; position: absolute; inset: 0 0 auto; height: 3px; background: var(--gold); transform: scaleX(.18); transform-origin: left; transition: transform .25s ease; }
        .support-choice__option:hover::before, .support-choice__option:focus-within::before { transform: scaleX(1); }
        .support-choice__number { color: var(--gold); font-family: var(--font-display); font-size: 13px; font-weight: 800; }
        .support-choice__eyebrow { margin: auto 0 8px; color: var(--slate); font-size: 11px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; }
        .support-choice__details { display: flex; flex-wrap: wrap; gap: 8px; padding: 0; margin: 22px 0 28px; list-style: none; }
        .support-choice__details li { padding: 7px 10px; border: 1px solid var(--glass-border); border-radius: 4px; color: var(--slate); font-size: 12px; }
        .support-choice__button { display: flex; align-items: center; justify-content: space-between; width: 100%; min-height: 50px; padding: 0 16px; border: 1px solid var(--gold); border-radius: 6px; background: transparent; color: var(--white); cursor: pointer; font-family: var(--font-body); font-size: 14px; font-weight: 700; transition: background .2s ease, color .2s ease; }
        .support-choice__button:hover { background: var(--gold); color: var(--navy); }
        .support-choice__button:focus-visible { outline: 3px solid rgba(246,166,35,.3); outline-offset: 3px; }
        @media (max-width: 720px) {
          .support-choice__grid { grid-template-columns: 1fr; }
          .support-choice__option { min-height: 340px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .support-choice__option::before, .support-choice__button { transition: none; }
        }
      `}</style>

      <header className="support-choice__intro">
        <p className="section-label">Claims &amp; refunds</p>
        <h1 className="section-title" style={{ color: 'var(--white)', fontSize: 'clamp(2.1rem, 5vw, 4.5rem)', letterSpacing: 0, marginBottom: 18 }}>
          How can we help?
        </h1>
        <p style={{ maxWidth: 650, color: 'var(--slate)', fontSize: mobile ? 15 : 17, lineHeight: 1.75 }}>
          Choose the service you need. We will guide you through the right information, documents, and next steps.
        </p>
      </header>

      <section className="support-choice__grid" aria-label="Choose a support service">
        {OPTIONS.map((option) => (
          <article className="support-choice__option" key={option.view}>
            <span className="support-choice__number" aria-hidden="true">{option.number}</span>
            <p className="support-choice__eyebrow">{option.eyebrow}</p>
            <h2 style={{ color: 'var(--white)', fontSize: 'clamp(1.6rem, 3vw, 2.35rem)', letterSpacing: 0, marginBottom: 12 }}>{option.title}</h2>
            <p style={{ color: 'var(--slate)', fontSize: 14, lineHeight: 1.7, margin: 0 }}>{option.description}</p>
            <ul className="support-choice__details" aria-label={`${option.title} requirements`}>
              {option.details.map((detail) => <li key={detail}>{detail}</li>)}
            </ul>
            <button className="support-choice__button" type="button" onClick={() => onNavigate(option.view)}>
              <span>{option.action}</span>
              <span aria-hidden="true">-&gt;</span>
            </button>
          </article>
        ))}
      </section>
    </div>
  );
};

export default ClaimsRefundChoice;
