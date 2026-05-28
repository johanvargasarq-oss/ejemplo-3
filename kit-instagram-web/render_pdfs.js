// Renders each page of the 3 catalog PDFs as JPEG images using Playwright
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const PDFS = [
  'assets/catalogos/catalogo-mayorista-1.pdf',
  'assets/catalogos/catalogo-mayorista-2.pdf',
  'assets/catalogos/catalogo-mayorista-3.pdf',
];

const OUT = path.join(__dirname, 'assets', 'catalogos', 'pages');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 800, height: 1100 } });
  const page = await ctx.newPage();

  let globalPage = 1;

  for (const pdfFile of PDFS) {
    const absPath = path.resolve(__dirname, pdfFile);
    const url = 'file:///' + absPath.replace(/\\/g, '/');
    console.log(`\nAbriendo: ${pdfFile}`);

    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Get total pages from PDF viewer
    let totalPages = 1;
    try {
      // Chromium PDF viewer shows page count
      const pageCountEl = await page.$('#num-pages, [id="num-pages"]');
      if (pageCountEl) {
        const text = await pageCountEl.textContent();
        const match = text.match(/\d+/);
        if (match) totalPages = parseInt(match[0]);
      }
      // Try alternate selector
      if (totalPages === 1) {
        const txt = await page.evaluate(() => {
          const el = document.querySelector('#num-pages') ||
                     document.querySelector('[data-l10n-id="pdfjs-num-pages-counter"]') ||
                     document.querySelector('.pageNumber') ;
          return el ? el.textContent : '';
        });
        const m = txt.match(/\d+/);
        if (m) totalPages = parseInt(m[0]);
      }
    } catch (e) {}

    console.log(`  Páginas detectadas: ${totalPages}`);

    // Navigate and screenshot each page
    for (let p = 1; p <= Math.max(totalPages, 1); p++) {
      try {
        // Navigate to specific page using hash
        const pageUrl = url + `#page=${p}`;
        await page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 15000 });
        await page.waitForTimeout(2500);

        const outFile = path.join(OUT, `page_${String(globalPage).padStart(3, '0')}.jpg`);
        await page.screenshot({ path: outFile, type: 'jpeg', quality: 85 });
        process.stdout.write(`  p${p}(${globalPage}) `);
        globalPage++;

        if (p >= 60) { // safety limit per PDF
          console.log('\n  (límite de seguridad alcanzado)');
          break;
        }
      } catch (e) {
        console.log(`\n  Error en página ${p}: ${e.message.slice(0, 60)}`);
        break;
      }
    }
  }

  await browser.close();
  console.log(`\n\nTotal páginas renderizadas: ${globalPage - 1}`);
  console.log('Guardadas en: assets/catalogos/pages/');
})();
