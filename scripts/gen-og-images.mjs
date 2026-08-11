// Generate the Open-Graph social-share images (1200×630 PNG) in the Qlisted
// teal→navy brand, using Playwright to screenshot a branded HTML card.
// Run: node scripts/gen-og-images.mjs   (needs `npx playwright install chromium`)
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

// The Q mark (ring + cloche + hotel building), drawn in white for the gradient card.
const mark = (px) => `
<svg width="${px}" height="${px}" viewBox="0 0 512 512" fill="none">
  <circle cx="256" cy="240" r="166" fill="none" stroke="#fff" stroke-width="40"/>
  <path d="M373 357 L440 424" stroke="#fff" stroke-width="40" stroke-linecap="round"/>
  <path d="M138 286 Q138 210 212 210 Q286 210 286 286 Z" fill="#fff"/>
  <circle cx="212" cy="203" r="9" fill="#fff"/>
  <rect x="130" y="286" width="164" height="14" rx="7" fill="#fff"/>
  <rect x="300" y="168" width="66" height="132" rx="4" fill="#fff"/>
</svg>`;

const PAGES = [
  {
    file: 'og-image.png',
    title: 'The operating system for hospitality',
    sub: 'QR ordering · payments · inventory · staff · guests · hotels · an AI copilot that acts',
  },
  {
    file: 'og-restaurants.png',
    title: 'Qlisted for Restaurants',
    sub: 'QR ordering, pay-at-table, real-time kitchen, staff and analytics — no app for your guests.',
  },
  {
    file: 'og-hotels.png',
    title: 'Qlisted for Hotels',
    sub: 'Rooms, housekeeping, reservations, check-in, room service and the guest folio — plus AI forecasting.',
  },
];

const html = (p) => `<!doctype html><html><head><meta charset="utf-8"><style>
  * { margin:0; box-sizing:border-box; }
  body { width:1200px; height:630px; overflow:hidden;
    font-family: -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
  .card { position:relative; width:1200px; height:630px; padding:84px 96px;
    display:flex; flex-direction:column; justify-content:space-between; color:#fff;
    background: linear-gradient(135deg, #14b8a6 0%, #0f766e 46%, #1e3a5f 100%); }
  .blob { position:absolute; border-radius:9999px; filter:blur(60px); }
  .b1 { width:520px; height:520px; top:-160px; right:-120px; background:rgba(255,255,255,0.12); }
  .b2 { width:460px; height:460px; bottom:-200px; left:-120px; background:rgba(255,255,255,0.07); }
  .brand { position:relative; display:flex; align-items:center; gap:22px; }
  .brand .word { font-size:60px; font-weight:800; letter-spacing:-0.02em; }
  .content { position:relative; max-width:940px; }
  .content h1 { font-size:76px; line-height:1.05; font-weight:800; letter-spacing:-0.02em; }
  .content p { margin-top:28px; font-size:32px; line-height:1.4; color:rgba(255,255,255,0.86); font-weight:500; }
  .foot { position:relative; display:flex; align-items:center; gap:14px;
    font-size:27px; font-weight:600; color:rgba(255,255,255,0.82); letter-spacing:0.02em; }
  .dot { width:12px; height:12px; border-radius:9999px; background:rgba(255,255,255,0.6); }
</style></head><body>
  <div class="card">
    <div class="blob b1"></div><div class="blob b2"></div>
    <div class="brand">${mark(72)}<span class="word">Qlisted</span></div>
    <div class="content"><h1>${p.title}</h1><p>${p.sub}</p></div>
    <div class="foot">qlisted.com<span class="dot"></span>restaurants &amp; hotels</div>
  </div>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
for (const p of PAGES) {
  await page.setContent(html(p), { waitUntil: 'networkidle' });
  await page.screenshot({ path: join(OUT, p.file), type: 'png' });
  console.log('wrote', p.file);
}
await browser.close();
