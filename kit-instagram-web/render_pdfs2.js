// Renders PDF pages to JPEG using pdfjs-dist + canvas
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const PDFS = [
  'assets/catalogos/catalogo-mayorista-1.pdf',
  'assets/catalogos/catalogo-mayorista-2.pdf',
  'assets/catalogos/catalogo-mayorista-3.pdf',
];

const OUT = path.join(__dirname, 'assets', 'catalogos', 'pages');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

// pdfjs needs a worker — in Node we disable it
pdfjsLib.GlobalWorkerOptions.workerSrc = '';

async function renderPDF(pdfPath, startIndex) {
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const doc = await pdfjsLib.getDocument({
    data,
    disableFontFace: true,
    nativeImageDecoderSupport: 'none',
  }).promise;

  const total = doc.numPages;
  console.log(`  ${path.basename(pdfPath)}: ${total} páginas`);

  for (let i = 1; i <= total; i++) {
    const pg = await doc.getPage(i);
    const scale = 1.8;
    const vp = pg.getViewport({ scale });

    const canvas = createCanvas(vp.width, vp.height);
    const ctx = canvas.getContext('2d');

    await pg.render({
      canvasContext: ctx,
      viewport: vp,
      // node-canvas compatible context
    }).promise;

    const outFile = path.join(OUT, `page_${String(startIndex + i - 1).padStart(3, '0')}.jpg`);
    const buf = canvas.toBuffer('image/jpeg', { quality: 0.88 });
    fs.writeFileSync(outFile, buf);
    process.stdout.write(`${i} `);
  }

  console.log('');
  return total;
}

(async () => {
  let idx = 1;
  for (const pdf of PDFS) {
    console.log(`\nRenderizando: ${pdf}`);
    try {
      const n = await renderPDF(pdf, idx);
      idx += n;
    } catch (e) {
      console.error('Error:', e.message);
    }
  }
  console.log(`\nTotal páginas: ${idx - 1} → assets/catalogos/pages/`);
})();
