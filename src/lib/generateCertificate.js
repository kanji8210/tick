/**
 * generateCertificate.js
 * Pure frontend certificate builder — no backend required.
 * Produces a printable A4 HTML document with:
 *  - TICK branding
 *  - Policy number + status
 *  - Insured & coverage details
 *  - QR code linking to verify.maljani.co.ke
 *  - Step-by-step authentication instructions
 */

const fmt = (d) =>
  d ? new Date(d).toLocaleDateString('en-KE', { day: '2-digit', month: 'long', year: 'numeric' }) : '—';

const fmtKES = (n) => `KES ${Number(n || 0).toLocaleString('en-KE')}`;

const splitHighlights = (raw) => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(String).map(s => s.trim()).filter(Boolean);
  return String(raw)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .split(/\n|;|\u2022|\.|,/)
    .map(s => s.trim())
    .filter(s => s.length > 6 && s.length < 90);
};

const STATUS_COLOR = {
  active:              '#16a34a',
  confirmed:           '#2563eb',
  approved:            '#d97706',
  verification_ready:  '#2563eb',
  submitted_to_insurer:'#0891b2',
  pending_review:      '#7c3aed',
  unconfirmed:         '#64748b',
  cancelled:           '#dc2626',
  archived:            '#64748b',
};

/**
 * Build the certificate HTML string for a policy record.
 * @param {object} policy — myPolicySales record
 * @returns {string} full HTML document
 */
export function generateCertificateHTML(policy) {
  const {
    policyNumber, policyTitle, insuredNames, passportNumber,
    region, departure, returnDate, days, amountPaid,
    policyStatus, createdAt, passengers,
    policyBenefits, policyInsurerName, insuredPhone,
  } = policy;

  const statusLabel  = (policyStatus || 'unknown').toUpperCase().replace(/_/g, ' ');
  const statusColor  = STATUS_COLOR[policyStatus] ?? '#64748b';
  const issueDate    = fmt(createdAt);
  const today        = new Date().toLocaleDateString('en-KE', { day: '2-digit', month: 'long', year: 'numeric' });

  const policyNo = policyNumber || '—';
  const names    = Array.isArray(insuredNames) ? insuredNames.join(', ') : (insuredNames || '—');
  const insurer  = policyInsurerName || 'Partner Insurer';

  const coverageHighlights = (() => {
    const extracted = splitHighlights(policyBenefits).slice(0, 7);
    if (extracted.length) return extracted;
    return [
      'Medical Expenses and Emergency Care',
      'Medical Transportation and Repatriation',
      'Personal Liability Protection',
      'Baggage and Personal Effects Cover',
      'Trip Delay and Interruption Support',
      'Emergency Assistance Services',
    ];
  })();

  /* QR encodes the verify route on THIS site, pre-filled with the policy number.
   * When scanned the browser opens /verify?policy_no=TICK-XXX,
   * the VerifyPolicy component reads the param and pre-fills the form. */
  const verifyURL = `${window.location.origin}/verify?policy_no=${encodeURIComponent(policyNo)}`;
  const qrSrc     = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(verifyURL)}&size=160x160&color=1a3a1a&bgcolor=ffffff&margin=8&format=png`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Certificate of Travel Insurance - ${policyNo}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; background: #efefef; color: #122038; }
  @page { size: A4 portrait; margin: 0; }
  @media print {
    body { background: #fff; }
    .no-print { display: none !important; }
    .page { box-shadow: none !important; }
  }

  .page {
    width: 210mm; min-height: 297mm;
    margin: 0 auto;
    background: #fff;
    box-shadow: 0 0 60px rgba(0,0,0,0.18);
    display: flex;
    flex-direction: column;
    position: relative;
    overflow: hidden;
  }
  .page::before {
    content: '';
    position: absolute;
    inset: 0;
    background:
      radial-gradient(circle at 10% 18%, rgba(20,43,92,0.05), transparent 34%),
      radial-gradient(circle at 82% 16%, rgba(180,136,54,0.06), transparent 36%),
      linear-gradient(180deg, rgba(245,247,252,0.65) 0%, rgba(255,255,255,0) 28%);
    pointer-events: none;
    z-index: 0;
  }

  .content {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    min-height: 297mm;
  }

  .top {
    padding: 22px 26px 0;
    display: grid;
    grid-template-columns: 1fr 1fr;
    align-items: start;
  }
  .logo-left {
    display: flex;
    flex-direction: column;
    gap: 2px;
    align-items: flex-start;
  }
  .logo-left .name {
    font-size: 34px;
    font-weight: 900;
    letter-spacing: -0.04em;
    color: #0f172a;
  }
  .logo-left .sub {
    font-size: 12px;
    letter-spacing: 0.2em;
    color: #1e3a8a;
    font-weight: 700;
  }
  .logo-left .country {
    margin-top: 4px;
    font-size: 10px;
    letter-spacing: 0.2em;
    color: #b48836;
    font-weight: 700;
  }

  .logo-right {
    justify-self: end;
    text-align: right;
  }
  .logo-right .tick {
    font-size: 54px;
    font-weight: 900;
    letter-spacing: -0.04em;
    color: #0b2e6f;
    line-height: 1;
  }
  .logo-right .tick-sub {
    font-size: 10px;
    letter-spacing: 0.12em;
    color: #4b5563;
    text-transform: uppercase;
  }

  .title-block {
    text-align: center;
    padding: 8px 26px 0;
  }
  .title-block h1 {
    font-family: 'Times New Roman', Georgia, serif;
    font-size: 60px;
    line-height: 0.95;
    letter-spacing: 0.04em;
    color: #0b2e6f;
    text-transform: uppercase;
  }
  .title-block .subline {
    margin-top: 10px;
    font-family: 'Times New Roman', Georgia, serif;
    font-size: 14px;
    color: #b48836;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .title-block .desc {
    margin: 10px auto 0;
    max-width: 640px;
    font-size: 14px;
    color: #1f2f46;
    line-height: 1.5;
  }

  .primary-grid {
    margin: 18px 26px 0;
    display: grid;
    grid-template-columns: 0.92fr 2fr;
    gap: 10px;
  }

  .card {
    border: 1.6px solid #d6c08f;
    border-radius: 10px;
    background: #fff;
    overflow: hidden;
  }

  .card-head {
    background: #0b2e6f;
    color: #fff;
    text-align: center;
    font-family: 'Times New Roman', Georgia, serif;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    font-size: 16px;
    padding: 8px 10px;
  }

  .traveller {
    padding: 16px 14px;
    min-height: 212px;
  }
  .avatar {
    width: 72px;
    height: 72px;
    border-radius: 50%;
    background: #0b2e6f;
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 34px;
    margin-bottom: 10px;
    border: 4px solid #e9d8ad;
  }
  .traveller .name {
    font-size: 22px;
    font-weight: 700;
    color: #101f3a;
    line-height: 1.2;
    margin-bottom: 10px;
  }
  .traveller .meta {
    font-size: 12px;
    color: #374151;
    line-height: 1.55;
  }

  .details {
    border-left: 1px solid #e3e7ef;
    border-right: 1px solid #e3e7ef;
    border-bottom: 1px solid #e3e7ef;
    display: grid;
    grid-template-columns: 1fr 1fr;
  }
  .cell {
    padding: 11px 12px;
    border-right: 1px solid #e3e7ef;
    border-bottom: 1px solid #e3e7ef;
    min-height: 58px;
  }
  .cell:nth-child(2n) { border-right: none; }
  .cell .k {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #4b5563;
    font-weight: 700;
    margin-bottom: 4px;
  }
  .cell .v {
    font-size: 16px;
    font-weight: 800;
    color: #111827;
    line-height: 1.25;
  }
  .cell .v.small {
    font-size: 13px;
    font-weight: 700;
  }

  .secondary-grid {
    margin: 10px 26px 0;
    display: grid;
    grid-template-columns: 1fr 1.5fr 0.52fr;
    gap: 10px;
    align-items: stretch;
  }

  .highlights {
    padding: 12px 14px 10px;
    min-height: 218px;
  }
  .highlights ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .highlights li {
    font-size: 14px;
    color: #10203b;
    line-height: 1.35;
    padding-left: 22px;
    position: relative;
  }
  .highlights li::before {
    content: '✦';
    position: absolute;
    left: 0;
    top: 0;
    color: #0b2e6f;
    font-size: 14px;
    font-weight: 800;
  }
  .highlights .note {
    margin-top: 10px;
    font-size: 11px;
    color: #4b5563;
    font-style: italic;
    line-height: 1.4;
  }

  .cert-note {
    border: 1.6px solid #d4dbe8;
    border-radius: 10px;
    padding: 16px;
    display: grid;
    grid-template-columns: 88px 1fr;
    gap: 12px;
    background: linear-gradient(180deg, #ffffff 0%, #fafcff 100%);
  }
  .shield {
    width: 88px;
    height: 88px;
    border-radius: 12px;
    background: radial-gradient(circle at 50% 35%, #f9e6a7, #b48836);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #0b2e6f;
    font-size: 44px;
  }
  .cert-note p {
    font-size: 17px;
    color: #1f2937;
    line-height: 1.45;
  }

  .qr-card {
    border: 1.6px solid #d6c08f;
    border-radius: 10px;
    background: #fff;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 10px;
    gap: 8px;
  }
  .qr-card img {
    width: 120px;
    height: 120px;
    border: 2px solid #d1d5db;
    border-radius: 8px;
    display: block;
  }
  .qr-card .cap {
    font-size: 12px;
    color: #334155;
    text-align: center;
    line-height: 1.35;
    font-weight: 700;
  }
  .qr-card .url {
    font-size: 10px;
    color: #64748b;
    letter-spacing: 0.04em;
  }

  .bottom {
    margin-top: auto;
    padding: 10px 26px 0;
  }
  .assist {
    border: 1.6px solid #d6c08f;
    border-radius: 10px;
    background: #fff;
    padding: 10px 14px;
    display: grid;
    grid-template-columns: 70px 1fr;
    gap: 10px;
    align-items: center;
  }
  .assist .icon {
    width: 58px;
    height: 58px;
    border-radius: 50%;
    border: 3px solid #0b2e6f;
    color: #0b2e6f;
    font-weight: 900;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
  }
  .assist .ttl {
    font-family: 'Times New Roman', Georgia, serif;
    color: #0b2e6f;
    font-size: 22px;
    text-transform: uppercase;
    line-height: 1;
    margin-bottom: 5px;
  }
  .assist .line {
    font-size: 14px;
    color: #1f2937;
    line-height: 1.35;
  }

  .auth-row {
    margin-top: 8px;
    display: grid;
    grid-template-columns: 1fr 240px;
    gap: 10px;
    align-items: end;
  }
  .signature {
    border-top: 1px solid #cdd4e2;
    padding-top: 8px;
    min-height: 74px;
  }
  .signature .mark {
    font-family: 'Brush Script MT', cursive;
    font-size: 40px;
    color: #6474b4;
    line-height: 0.9;
  }
  .signature .lbl {
    font-size: 13px;
    color: #1f2937;
    line-height: 1.35;
    font-weight: 700;
  }
  .company-box {
    border: 1.6px solid #6b7280;
    border-radius: 6px;
    padding: 8px;
    text-align: center;
    font-size: 10px;
    color: #374151;
    line-height: 1.3;
    font-weight: 700;
    background: #fff;
  }

  .legal {
    margin-top: 8px;
    background: #0b2e6f;
    color: rgba(255,255,255,0.92);
    border-radius: 8px;
    padding: 10px 14px;
    text-align: center;
    font-size: 12px;
    line-height: 1.4;
  }

  .status-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-top: 5px;
    border-radius: 999px;
    padding: 4px 10px;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    border: 1px solid ${statusColor};
    color: ${statusColor};
    background: ${statusColor}1A;
  }

  .print-btn {
    display: block; margin: 16px auto; padding: 10px 32px;
    background: #0b2e6f; color: #fff; border: none; border-radius: 8px;
    font-size: 14px; font-weight: 700; cursor: pointer; font-family: inherit;
  }
</style>
</head>
<body>

<div class="no-print" style="text-align:center;padding:12px 0;background:#f0ede8;">
  <button class="print-btn" onclick="window.print()">Print / Save as PDF</button>
</div>

<div class="page">

  <div class="content">
    <div class="top">
      <div class="logo-left">
        <div class="name">${insurer}</div>
        <div class="sub">INSURANCE</div>
        <div class="country">KENYA</div>
      </div>
      <div class="logo-right">
        <div class="tick">TICK</div>
        <div class="tick-sub">Travel Insurance Center Kenya</div>
      </div>
    </div>

    <div class="title-block">
      <h1>Certificate of<br/>Travel Insurance</h1>
      <div class="subline">Official Proof of Insurance Coverage</div>
      <p class="desc">
        This certifies that the person named below is insured under a travel insurance policy issued by ${insurer},
        subject to the stated terms, conditions and exclusions.
      </p>
    </div>

    <div class="primary-grid">
      <div class="card">
        <div class="card-head">Traveller</div>
        <div class="traveller">
          <div class="avatar">👤</div>
          <div class="name">${names}</div>
          <div class="meta">Passport: ${passportNumber || '—'}</div>
          <div class="meta">Passengers: ${passengers || 1}</div>
          <div class="meta">Issued: ${issueDate}</div>
          <div class="status-badge">${statusLabel}</div>
        </div>
      </div>

      <div class="card">
        <div class="card-head">Policy Details</div>
        <div class="details">
          <div class="cell"><div class="k">Certificate No.</div><div class="v">${policyNo}</div></div>
          <div class="cell"><div class="k">Coverage Period</div><div class="v small">${fmt(departure)} to ${fmt(returnDate)}</div></div>

          <div class="cell"><div class="k">Policy Number</div><div class="v">${policyNo}</div></div>
          <div class="cell"><div class="k">Policy Duration</div><div class="v">${days || '—'} Day(s)</div></div>

          <div class="cell"><div class="k">Product</div><div class="v small">${policyTitle || 'Travel Insurance Plan'}</div></div>
          <div class="cell"><div class="k">Number of Passengers</div><div class="v">${passengers || 1}</div></div>

          <div class="cell"><div class="k">Country of Origin</div><div class="v small">Kenya</div></div>
          <div class="cell"><div class="k">Issue Date</div><div class="v">${issueDate}</div></div>

          <div class="cell" style="grid-column: 1 / -1;"><div class="k">Destination Area</div><div class="v small">${region || '—'}</div></div>
        </div>
      </div>
    </div>

    <div class="secondary-grid">
      <div class="card">
        <div class="card-head">Coverage Highlights</div>
        <div class="highlights">
          <ul>
            ${coverageHighlights.map(item => `<li>${item}</li>`).join('')}
          </ul>
          <div class="note">Full details of cover are as per schedule attached to policy number ${policyNo}.</div>
        </div>
      </div>

      <div class="cert-note">
        <div class="shield">✓</div>
        <p>
          This certifies that the above-named insured is covered under the referenced travel insurance policy for
          the stated period and destination, subject to policy terms, conditions and exclusions.
        </p>
      </div>

      <div class="qr-card">
        <img src="${qrSrc}" alt="Verification QR Code" />
        <div class="cap">Scan to verify certificate online</div>
        <div class="url">${window.location.hostname}/verify</div>
      </div>
    </div>

    <div class="bottom">
      <div class="assist">
        <div class="icon">24/7</div>
        <div>
          <div class="ttl">24-Hour Emergency Assistance</div>
          <div class="line">Assistance Number: +216 71 104 597</div>
          <div class="line">WhatsApp Number: +216 29 67 72 76</div>
        </div>
      </div>

      <div class="auth-row">
        <div class="signature">
          <div class="mark">S</div>
          <div class="lbl">Authorized Representative<br/>${insurer}</div>
        </div>
        <div class="company-box">
          ${insurer}<br/>
          P.O. BOX 46680 - 00100<br/>
          NAIROBI, KENYA
        </div>
      </div>

      <div class="legal">
        This certificate is issued as a matter of information only and confers no rights upon the certificate holder.
        It does not amend, extend or alter the coverage afforded by the policy. Amount paid: <strong>${fmtKES(amountPaid)}</strong>.
      </div>
    </div>
  </div>

</div>
</body>
</html>`;
}

/**
 * openCertificate — opens the certificate in a new tab and triggers the print dialog.
 * @param {object} policy — myPolicySales record (full object, not just id)
 */
export function openCertificate(policy) {
  const html = generateCertificateHTML(policy);
  const win  = window.open('', '_blank');
  if (!win) {
    alert('Pop-up blocked. Please allow pop-ups for this site and try again.');
    return;
  }
  win.document.write(html);
  win.document.close();
  /* Wait for QR image to load before opening print dialog */
  win.addEventListener('load', () => setTimeout(() => win.print(), 600));
}
