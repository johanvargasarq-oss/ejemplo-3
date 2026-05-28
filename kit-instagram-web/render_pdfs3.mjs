import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createCanvas } from 'canvas';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Point to the bundled worker so Node can run it
const workerPath = new URL('./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs', import.meta.url).href;
GlobalWorkerOptions.workerSrc = workerPath;

const PDFS = [
  'assets/catalogos/catalogo-mayorista-1.pdf',
  'assets/catalogos/catalogo-mayorista-2.pdf',
  'assets/catalogos/catalogo-mayorista-3.pdf',
];

const OUT = path.join(__dirname, 'assets', 'catalogos', 'pages');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

async function renderPDF(pdfPath, startIdx) {
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const doc = await getDocument({ data, disableFontFace: true }).promise;
  const total = doc.numPages;
  console.log(`  ${path.basename(pdfPath)}: ${total} páginas`);

  for (let i = 1; i <= total; i++) {
    const pg = await doc.getPage(i);
    const vp = pg.getViewport({ scale: 1.8 });
    const canvas = createCanvas(Math.round(vp.width), Math.round(vp.height));
    const ctx = canvas.getContext('2d');

    await pg.render({ canvasContext: ctx, viewport: vp }).promise;

    const outFile = path.join(OUT, `page_${String(startIdx + i - 1).padStart(3, '0')}.jpg`);
    fs.writeFileSync(outFile, canvas.toBuffer('image/jpeg', { quality: 0.88 }));
    process.stdout.write(`${i} `);
  }
  console.log('');
  return total;
}

let idx = 1;
for (const pdf of PDFS) {
  console.log(`\nRenderizando: ${pdf}`);
  try {
    idx += await renderPDF(pdf, idx);
  } catch (e) {
    console.error('Error:', e.message);
  }
}
console.log(`\nTotal: ${idx - 1} páginas → assets/catalogos/pages/`);
