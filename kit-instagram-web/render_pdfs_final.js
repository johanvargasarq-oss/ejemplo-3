// Render PDFs using Playwright + PDF.js running IN the browser
// Uses local pdfjs-dist .mjs files served as ES modules — no node-canvas needed
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 7799;
const BASE = __dirname;
const PDFJS_DIR = path.join(BASE, 'node_modules', 'pdfjs-dist', 'build');
const OUT = path.join(BASE, 'assets', 'catalogos', 'pages');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const PDFS = [
  'assets/catalogos/catalogo-mayorista-1.pdf',
  'assets/catalogos/catalogo-mayorista-2.pdf',
  'assets/catalogos/catalogo-mayorista-3.pdf',
];

function makeViewerHtml(port) {
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>body{margin:0;background:#fff}canvas{display:block}</style>
</head><body>
<canvas id="c"></canvas>
<script type="module">
import * as pdfjsLib from 'http://localhost:${port}/pdfjs/pdf.mjs';
pdfjsLib.GlobalWorkerOptions.workerSrc = 'http://localhost:${port}/pdfjs/pdf.worker.mjs';
window.__ready = false;
window.__numPages = 0;
window.__error = null;
const p = new URLSearchParams(location.search);
const pdfUrl = p.get('pdf');
const pageNum = parseInt(p.get('page') || '1');
try {
  const pdf = await pdfjsLib.getDocument({ url: pdfUrl, disableFontFace: true }).promise;
  window.__numPages = pdf.numPages;
  const page = await pdf.getPage(pageNum);
  const vp = page.getViewport({ scale: 1.8 });
  const canvas = document.getElementById('c');
  canvas.width = Math.round(vp.width);
  canvas.height = Math.round(vp.height);
  document.body.style.minHeight = canvas.height + 'px';
  await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
  window.__ready = true;
} catch(e) {
  window.__error = e.message;
  window.__ready = true;
}
</script></body></html>`;
}

const MIME = {
  '.mjs': 'application/javascript',
  '.js':  'application/javascript',
  '.pdf': 'application/pdf',
  '.html':'text/html',
};

const server = http.createServer((req, res) => {
  const urlPath = req.url.split('?')[0];

  // Viewer HTML
  if (urlPath === '/viewer') {
    res.writeHead(200, { 'Content-Type': 'text/html', 'Access-Control-Allow-Origin': '*' });
    res.end(makeViewerHtml(PORT));
    return;
  }

  // pdfjs files
  if (urlPath.startsWith('/pdfjs/')) {
    const fname = urlPath.slice(7); // strip /pdfjs/
    const fpath = path.join(PDFJS_DIR, fname);
    if (!fs.existsSync(fpath)) { res.writeHead(404); res.end(); return; }
    const ext = path.extname(fpath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Access-Control-Allow-Origin': '*' });
    fs.createReadStream(fpath).pipe(res);
    return;
  }

  // Static files (PDFs etc.)
  const fpath = path.join(BASE, decodeURIComponent(urlPath));
  if (!fs.existsSync(fpath) || !fs.statSync(fpath).isFile()) { res.writeHead(404); res.end(); return; }
  const ext = path.extname(fpath);
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Access-Control-Allow-Origin': '*' });
  fs.createReadStream(fpath).pipe(res);
});

(async () => {
  await new Promise(r => server.listen(PORT, r));
  console.log(`Server: http://localhost:${PORT}`);

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-web-security'] });
  let globalIdx = 1;

  for (const pdfRel of PDFS) {
    console.log(`\nRenderizando: ${pdfRel}`);
    const pdfUrl = encodeURIComponent(`http://localhost:${PORT}/${pdfRel}`);
    const pg = await browser.newPage();
    await pg.setViewportSize({ width: 1200, height: 1700 });

    // Load page 1 first to discover numPages
    await pg.goto(`http://localhost:${PORT}/viewer?pdf=${pdfUrl}&page=1`, { waitUntil: 'networkidle', timeout: 30000 });
    await pg.waitForFunction(() => window.__ready === true, { timeout: 25000 });

    const err1 = await pg.evaluate(() => window.__error);
    if (err1) { console.error('  Error página 1:', err1); await pg.close(); continue; }

    const numPages = await pg.evaluate(() => window.__numPages);
    console.log(`  Páginas detectadas: ${numPages}`);

    const out1 = path.join(OUT, `page_${String(globalIdx).padStart(3,'0')}.jpg`);
    await pg.screenshot({ path: out1, type: 'jpeg', quality: 88 });
    process.stdout.write(`1 `);
    globalIdx++;

    for (let i = 2; i <= numPages; i++) {
      try {
        await pg.goto(`http://localhost:${PORT}/viewer?pdf=${pdfUrl}&page=${i}`, { waitUntil: 'networkidle', timeout: 20000 });
        await pg.waitForFunction(() => window.__ready === true, { timeout: 18000 });
        const errMsg = await pg.evaluate(() => window.__error);
        if (errMsg) { process.stdout.write(`[E${i}] `); globalIdx++; continue; }
        const outFile = path.join(OUT, `page_${String(globalIdx).padStart(3,'0')}.jpg`);
        await pg.screenshot({ path: outFile, type: 'jpeg', quality: 88 });
        process.stdout.write(`${i} `);
        globalIdx++;
      } catch(e) {
        process.stdout.write(`[Err${i}] `);
        globalIdx++;
      }
    }

    await pg.close();
    console.log('');
  }

  await browser.close();
  server.close();
  console.log(`\nDone! ${globalIdx - 1} páginas en assets/catalogos/pages/`);
})();
