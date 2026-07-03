import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import QRCode from 'qrcode';
import { getBrowser } from './browser.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// logo (base64, una sola vez)
let LOGO = '';
function logo() {
  if (LOGO) return LOGO;
  try {
    const p = path.join(__dirname, '../public/LaAuroraLogo.png');
    LOGO = 'data:image/png;base64,' + fs.readFileSync(p).toString('base64');
  } catch { LOGO = ''; }
  return LOGO;
}

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function certificateHTML(cert, qr) {
  const SERIF = "'Didot','Bodoni 72','Hoefler Text','Baskerville',Georgia,serif";
  const SANS = "'Optima','Avenir Next','Gill Sans',Helvetica,sans-serif";
  const BURG = '#6d1a1f', GOLD = '#b8912f', INK = '#1c1c22', GRAY = '#8a8a93';
  const date = cert.completionDate
    ? new Date(cert.completionDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
    : '';
  const hours = cert.hours ? `${cert.hours} horas` : '—';
  return `<!doctype html><html><head><meta charset="utf-8"><style>
   *{margin:0;padding:0;box-sizing:border-box;}
   @page{size:A4 landscape;margin:0;}
   body{width:297mm;height:210mm;background:#faf7f1;font-family:${SANS};color:${INK};display:flex;align-items:center;justify-content:center;}
   .sheet{position:relative;width:281mm;height:194mm;background:radial-gradient(120% 90% at 50% 0%,#fffdf9 0%,#faf6ee 70%,#f6f0e4 100%);border:2.5px solid ${BURG};box-shadow:inset 0 0 0 1px #fff;}
   .gold{position:absolute;inset:5mm;border:1px solid ${GOLD};}
   .corner{position:absolute;width:9mm;height:9mm;border:1px solid ${GOLD};}
   .corner.tl{top:-1px;left:-1px;border-right:none;border-bottom:none;}
   .corner.tr{top:-1px;right:-1px;border-left:none;border-bottom:none;}
   .corner.bl{bottom:-1px;left:-1px;border-right:none;border-top:none;}
   .corner.br{bottom:-1px;right:-1px;border-left:none;border-top:none;}
   .inner{position:absolute;top:11mm;left:16mm;right:16mm;display:flex;flex-direction:column;align-items:center;text-align:center;}
   .logo{height:25mm;object-fit:contain;}
   .kicker{font-size:8.5px;letter-spacing:.42em;color:${GRAY};margin-top:2mm;font-weight:600;}
   .title{font-family:${SERIF};font-size:33px;color:${BURG};letter-spacing:.10em;margin-top:6mm;}
   .divider{display:flex;align-items:center;gap:5mm;margin:5mm 0 4mm;}
   .divider .l{width:44mm;height:1px;background:linear-gradient(90deg,transparent,${GOLD});}
   .divider .r{width:44mm;height:1px;background:linear-gradient(90deg,${GOLD},transparent);}
   .divider .d{color:${GOLD};font-size:11px;}
   .lead{font-size:12.5px;color:${GRAY};letter-spacing:.02em;}
   .name{font-family:${SERIF};font-size:50px;color:${INK};margin:3mm 0 2mm;}
   .name-rule{width:108mm;height:1px;background:${GOLD};opacity:.5;margin-bottom:6mm;}
   .course{font-family:${SERIF};font-size:20px;color:${BURG};font-style:italic;max-width:200mm;line-height:1.35;margin-top:2mm;}
   .facts{display:flex;gap:16mm;margin-top:8mm;}
   .fact .v{font-family:${SERIF};font-size:17px;color:${INK};}
   .fact .k{font-size:8.5px;letter-spacing:.22em;color:${GRAY};margin-top:2px;text-transform:uppercase;}
   .band{position:absolute;bottom:9mm;left:16mm;right:16mm;display:flex;justify-content:space-between;align-items:flex-end;}
   .cred .k{font-size:8px;letter-spacing:.22em;color:${GRAY};text-transform:uppercase;}
   .cred .v{font-family:${SERIF};font-size:13px;color:${INK};margin-top:1mm;letter-spacing:.04em;}
   .cred .em{font-size:8.5px;color:${GRAY};margin-top:2mm;}
   .qr{display:flex;flex-direction:column;align-items:center;gap:1.5mm;}
   .qr img{width:22mm;height:22mm;padding:1.5mm;background:#fff;border:1px solid ${GOLD};}
   .qr .lbl{font-size:8px;letter-spacing:.14em;color:${GRAY};text-transform:uppercase;}
  </style></head><body>
   <div class="sheet">
    <div class="gold"></div>
    <span class="corner tl"></span><span class="corner tr"></span><span class="corner bl"></span><span class="corner br"></span>
    <div class="inner">
     ${logo() ? `<img class="logo" src="${logo()}"/>` : ''}
     <div class="kicker">LASA ACADEMY · FIRST DOMINICAN CIGAR FACTORY · EST. 1903</div>
     <div class="title">CERTIFICADO DE FINALIZACIÓN</div>
     <div class="divider"><span class="l"></span><span class="d">◆</span><span class="r"></span></div>
     <div class="lead">Se otorga el presente certificado a</div>
     <div class="name">${esc(cert.studentName)}</div>
     <div class="name-rule"></div>
     <div class="lead">por completar exitosamente el curso</div>
     <div class="course">${esc(cert.courseName)}</div>
     <div class="facts">
       <div class="fact"><div class="v">${esc(hours)}</div><div class="k">Carga horaria</div></div>
       <div class="fact"><div class="v">${esc(date)}</div><div class="k">Fecha de finalización</div></div>
     </div>
    </div>
    <div class="band">
     <div class="cred">
       <div class="k">N.º de certificado</div>
       <div class="v">${esc(cert.credentialId)}</div>
       <div class="em">Emitido por Lasa Academy · La Aurora</div>
     </div>
     <div class="qr"><img src="${qr}"/><div class="lbl">Escanea para verificar</div></div>
    </div>
   </div>
  </body></html>`;
}

// Genera el PDF (Buffer) del certificado con su QR de verificación.
export async function renderCertificatePdf(cert) {
  const base = (process.env.FRONTEND_URL || 'https://lasaacademy.cloudteco.com').replace(/\/+$/, '');
  const verifyUrl = `${base}/verify/${cert.credentialId}`;
  const qr = await QRCode.toDataURL(verifyUrl, { margin: 1, width: 420, color: { dark: '#1c1c22', light: '#ffffff' }, errorCorrectionLevel: 'M' });
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(certificateHTML(cert, qr), { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({ format: 'A4', landscape: true, printBackground: true });
    return Buffer.from(pdf);
  } finally {
    await page.close().catch(() => {});
  }
}
