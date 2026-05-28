// Renders PDF pages using Playwright + local HTTP server
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 7788;
const BASE = __dirname;
const OUT = path.join(BASE, 'assets', 'catalogos', 'pages');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const PDFS = [
  'assets/catalogos/catalogo-mayorista-1.pdf',
  'assets/catalogos/catalogo-mayorista-2.pdf',
  'assets/catalogos/catalogo-mayorista-3.pdf',
];

// Simple static file server
const server = http.createServer((req, res) => {
  const filePath = path.join(BASE, req.url.split('?')[0]);
  if (!fs.existsSync(filePath)) { res.writeHead(404); res.end(); return; }
  const ext = path.extname(filePath).toLowerCase();
  const mime = ext === '.pdf' ? 'application/pdf' : 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': mime });
  fs.createReadStream(filePath).pipe(res);
});

(async () => {
  await new Promise(r => server.listen(PORT, r));
  console.log(`Server: http://localhost:${PORT}`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  let globalPage = 1;

  for (const pdfRel of PDFS) {
    const pdfUrl = `http://localhost:${PORT}/${pdfRel}`;
    console.log(`\nRenderizando: ${pdfRel}`);

    // Open PDF in viewer
    const ctx = await browser.newContext({ viewport: { width: 900, height: 1200 }, acceptDownloads: false });
    const page = await ctx.newPage();

    // Navigate to PDF
    try {
      await page.goto(pdfUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    } catch (e) { console.log('goto error:', e.message.slice(0,80)); await ctx.close(); continue; }

    await page.waitForTimeout(4000);

    // Try to get page count from Chrome PDF viewer
    let totalPages = 0;
    try {
      // Chrome's built-in PDF viewer
      totalPages = await page.evaluate(() => {
        const embed = document.querySelector('embed[type="application/pdf"]');
        if (embed && embed.contentDocument) return embed.contentDocument.numPages || 0;
        return 0;
      });
    } catch {}

    if (!totalPages) {
      // Try via URL fragment navigation - scroll to end
      try {
        totalPages = await page.evaluate(async () => {
          return new Promise(resolve => {
            // Look for the page count in the PDF viewer UI
            const check = () => {
              const numPagesEl = document.querySelector('#num-pages, [data-l10n-id="pdfjs-num-pages-counter"]');
              if (numPagesEl) {
                const m = numPagesEl.textContent.match(/\d+/);
                if (m) return resolve(parseInt(m[0]));
              }
              setTimeout(check, 300);
            };
            check();
            setTimeout(() => resolve(0), 5000);
          });
        });
      } catch {}
    }

    // Fallback: try navigating by page and see when it stops
    if (!totalPages) {
      console.log('  Detectando páginas por navegación...');
      for (let p = 1; p <= 60; p++) {
        try {
          await page.goto(`${pdfUrl}#page=${p}`, { waitUntil: 'domcontentloaded', timeout: 8000 });
          await page.waitForTimeout(1500);
          const ok = await page.evaluate(() => document.title.includes('pdf') || document.querySelector('embed') !== null || document.querySelector('canvas') !== null || document.body.innerHTML.length > 100);
          if (ok) totalPages = p; else break;
        } catch { break; }
      }
    }

    // Final fallback
    if (!totalPages) totalPages = 52;
    console.log(`  Páginas: ${totalPages}`);

    // Screenshot each page
    for (let p = 1; p <= totalPages; p++) {
      try {
        await page.goto(`${pdfUrl}#page=${p}`, { waitUntil: 'domcontentloaded', timeout: 10000 });
        await page.waitForTimeout(2000);
        const outFile = path.join(OUT, `page_${String(globalPage).padStart(3, '0')}.jpg`);
        await page.screenshot({ path: outFile, type: 'jpeg', quality: 88, fullPage: false });
        process.stdout.write(`${p} `);
        globalPage++;
      } catch (e) {
        process.stdout.write(`[E${p}] `);
      }
    }
    console.log('');
    await ctx.close();
  }

  await browser.close();
  server.close();
  console.log(`\nTotal páginas: ${globalPage - 1}`);
})();
