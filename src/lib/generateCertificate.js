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
  } = policy;

  const statusLabel  = (policyStatus || 'unknown').toUpperCase().replace(/_/g, ' ');
  const statusColor  = STATUS_COLOR[policyStatus] ?? '#64748b';
  const issueDate    = fmt(createdAt);
  const today        = new Date().toLocaleDateString('en-KE', { day: '2-digit', month: 'long', year: 'numeric' });

  const policyNo = policyNumber || '—';
  const names    = Array.isArray(insuredNames) ? insuredNames.join(', ') : (insuredNames || '—');

  /* QR encodes the verify route on THIS site, pre-filled with the policy number.
   * When scanned the browser opens /verify?policy_no=TICK-XXX,
   * the VerifyPolicy component reads the param and pre-fills the form. */
  const verifyURL = `${window.location.origin}/verify?policy_no=${encodeURIComponent(policyNo)}`;
  const qrSrc     = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(verifyURL)}&size=160x160&color=1a3a1a&bgcolor=ffffff&margin=8&format=png`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Insurance Certificate — ${policyNo}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; background: #f0ede8; color: #1a1a1a; }
  @page { size: A4 portrait; margin: 0; }
  @media print {
    body { background: #fff; }
    .no-print { display: none !important; }
    .page { box-shadow: none !important; }
  }

  .page {
    width: 210mm; min-height: 297mm;
    margin: 0 auto; background: #fff;
    box-shadow: 0 0 60px rgba(0,0,0,0.18);
    display: flex; flex-direction: column;
  }

  /* ── Header ── */
  .hdr {
    background: linear-gradient(135deg, #132b13 0%, #1e4a1e 55%, #316331 100%);
    padding: 26px 40px 22px;
    display: flex; justify-content: space-between; align-items: flex-start;
  }
  .hdr-brand-name { font-size: 36px; font-weight: 900; color: #F6A623; letter-spacing: -1.5px; }
  .hdr-brand-sub  { font-size: 10px; letter-spacing: 0.14em; color: rgba(255,255,255,0.55); text-transform: uppercase; margin-top: 3px; }
  .hdr-right { text-align: right; }
  .hdr-right h1 { font-size: 17px; font-weight: 700; color: #fff; letter-spacing: 0.03em; }
  .hdr-right p  { font-size: 11px; color: rgba(255,255,255,0.55); margin-top: 4px; }

  /* ── Policy number banner ── */
  .pn-bar {
    background: #f7f4ef; border-bottom: 2px solid #e4ddd0;
    padding: 16px 40px; display: flex; justify-content: space-between; align-items: center;
  }
  .pn-lbl { font-size: 9px; font-weight: 700; letter-spacing: 0.14em; color: #999; text-transform: uppercase; }
  .pn-val { font-size: 28px; font-weight: 900; color: #132b13; letter-spacing: 0.05em; margin-top: 2px; font-family: 'Courier New', monospace; }
  .status-pill {
    display: inline-block; padding: 6px 18px; border-radius: 999px;
    font-size: 11px; font-weight: 800; letter-spacing: 0.08em;
    border: 2px solid ${statusColor}; color: ${statusColor};
    background: ${statusColor}18;
  }

  /* ── Details grid ── */
  .grid-wrap { padding: 24px 40px 0; }
  .grid {
    display: grid; grid-template-columns: 1fr 1fr;
    border: 1px solid #e4ddd0; border-radius: 10px; overflow: hidden;
  }
  .grid-col { padding: 22px 24px; }
  .grid-col:first-child { border-right: 1px solid #e4ddd0; background: #faf8f5; }
  .col-hd { font-size: 9px; font-weight: 800; letter-spacing: 0.16em; color: #316331; text-transform: uppercase; margin-bottom: 14px; }
  .row { margin-bottom: 13px; }
  .row:last-child { margin-bottom: 0; }
  .row-lbl { font-size: 9px; font-weight: 600; color: #999; letter-spacing: 0.09em; text-transform: uppercase; margin-bottom: 3px; }
  .row-val { font-size: 13px; font-weight: 700; color: #1a1a1a; }
  .mono { font-family: 'Courier New', monospace; letter-spacing: 0.04em; }

  /* ── QR / Verify block ── */
  .verify {
    margin: 22px 40px 0;
    border: 2px dashed #c4dfc4; border-radius: 10px;
    background: #f7fbf7; padding: 20px 24px;
    display: flex; gap: 24px; align-items: flex-start;
  }
  .qr-wrap img { display: block; width: 110px; height: 110px; border: 2px solid #dde8dd; border-radius: 8px; }
  .qr-cap { font-size: 8px; color: #888; text-align: center; margin-top: 5px; letter-spacing: 0.06em; text-transform: uppercase; }
  .vfy-hd { font-size: 11px; font-weight: 800; color: #132b13; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 10px; }
  .steps { list-style: none; padding: 0; }
  .steps li { font-size: 11px; color: #333; margin-bottom: 7px; padding-left: 18px; position: relative; line-height: 1.55; }
  .steps li::before { content: attr(data-n); position: absolute; left: 0; font-weight: 800; color: #316331; }
  .vfy-url { font-size: 12px; font-weight: 700; color: #316331; font-family: 'Courier New', monospace; margin-top: 10px; }
  .expected {
    margin-top: 10px; padding: 7px 12px; border-radius: 6px;
    background: #e8f4e8; border: 1px solid #b8ddb8;
    font-size: 10px; color: #1e4a1e; font-weight: 600; line-height: 1.5;
  }

  /* ── Declaration ── */
  .decl {
    margin: 18px 40px 0; padding: 16px 22px; border-radius: 8px;
    background: #faf8f5; border: 1px solid #e4ddd0;
    font-size: 10.5px; color: #555; line-height: 1.7; font-style: italic;
  }
  .decl strong { color: #1a1a1a; font-style: normal; }

  /* ── Footer ── */
  .ftr {
    margin-top: auto; background: #132b13; color: rgba(255,255,255,0.65);
    padding: 14px 40px; display: flex; justify-content: space-between; align-items: center;
  }
  .ftr-brand { font-size: 12px; font-weight: 800; color: #F6A623; }
  .ftr-note  { font-size: 10px; }

  /* ── Print button (hidden on print) ── */
  .print-btn {
    display: block; margin: 16px auto; padding: 10px 32px;
    background: #316331; color: #fff; border: none; border-radius: 8px;
    font-size: 14px; font-weight: 700; cursor: pointer; font-family: inherit;
  }
</style>
</head>
<body>

<div class="no-print" style="text-align:center;padding:12px 0;background:#f0ede8;">
  <button class="print-btn" onclick="window.print()">🖨&nbsp; Print / Save as PDF</button>
</div>

<div class="page">

  <!-- HEADER -->
  <div class="hdr">
    <div>
      <div class="hdr-brand-name">TICK</div>
      <div class="hdr-brand-sub">Travel Insurance Comparison Kenya</div>
    </div>
    <div class="hdr-right">
      <h1>Insurance Certificate</h1>
      <p>Issued: ${issueDate}</p>
    </div>
  </div>

  <!-- POLICY NUMBER BANNER -->
  <div class="pn-bar">
    <div>
      <div class="pn-lbl">Policy Number</div>
      <div class="pn-val">${policyNo}</div>
    </div>
    <div class="status-pill">${statusLabel}</div>
  </div>

  <!-- DETAILS GRID -->
  <div class="grid-wrap">
    <div class="grid">
      <div class="grid-col">
        <div class="col-hd">Insured Details</div>
        <div class="row">
          <div class="row-lbl">Full Name(s)</div>
          <div class="row-val">${names}</div>
        </div>
        ${passportNumber ? `
        <div class="row">
          <div class="row-lbl">Passport Number</div>
          <div class="row-val mono">${passportNumber}</div>
        </div>` : ''}
        <div class="row">
          <div class="row-lbl">Number of Travellers</div>
          <div class="row-val">${passengers || 1}</div>
        </div>
        <div class="row">
          <div class="row-lbl">Amount Paid</div>
          <div class="row-val">${fmtKES(amountPaid)}</div>
        </div>
      </div>
      <div class="grid-col">
        <div class="col-hd">Coverage Details</div>
        <div class="row">
          <div class="row-lbl">Policy</div>
          <div class="row-val">${policyTitle || '—'}</div>
        </div>
        <div class="row">
          <div class="row-lbl">Destination Region</div>
          <div class="row-val">${region || '—'}</div>
        </div>
        <div class="row">
          <div class="row-lbl">Departure Date</div>
          <div class="row-val">${fmt(departure)}</div>
        </div>
        <div class="row">
          <div class="row-lbl">Return Date</div>
          <div class="row-val">${fmt(returnDate)}</div>
        </div>
        <div class="row">
          <div class="row-lbl">Duration</div>
          <div class="row-val">${days || '—'} day${Number(days) !== 1 ? 's' : ''}</div>
        </div>
      </div>
    </div>
  </div>

  <!-- VERIFY / QR -->
  <div class="verify">
    <div class="qr-wrap">
      <img src="${qrSrc}" alt="Verification QR Code" />
      <div class="qr-cap">Scan to verify</div>
    </div>
    <div style="flex:1">
      <div class="vfy-hd">🔐 Verify Authenticity</div>
      <ol class="steps">
        <li data-n="1.">Scan the QR code with your phone camera, <strong>OR</strong></li>
        <li data-n="2.">Open your browser and visit <strong>${window.location.origin}/verify</strong></li>
        <li data-n="3.">Enter policy number <strong>${policyNo}</strong> and the traveller's passport number</li>
        <li data-n="4.">Submit — the system will display full policy details, insured names, validity dates and coverage status</li>
      </ol>
      <div class="vfy-url">${window.location.hostname}/verify</div>
      <div class="expected">
        ✓ Expected result: Insured name(s), travel dates, destination region, insurer, and policy status will be displayed. Any tampered or fictitious certificate will return "Not Found".
      </div>
    </div>
  </div>

  <!-- DECLARATION -->
  <div class="decl">
    <strong>Declaration:</strong> This certificate confirms that the above-named traveller(s) purchased a valid travel insurance policy through <strong>TICK</strong>, a licensed travel insurance comparison platform operated by <strong>Maljani Insurance Hub</strong>. This policy was issued in accordance with applicable insurance regulations. For claims or emergencies, contact the insurer directly quoting the policy number above. To confirm this document's authenticity, use the QR code or verification portal above — genuine certificates will display matching records instantly.
  </div>

  <!-- FOOTER -->
  <div class="ftr">
    <div class="ftr-brand">TICK™ — Maljani Insurance Hub</div>
    <div class="ftr-note">Generated: ${today} &nbsp;|&nbsp; Verify online before accepting</div>
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
