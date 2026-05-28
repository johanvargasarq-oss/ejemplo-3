import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createCanvas, createImageData } from 'canvas';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workerSrc = new URL('./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs', import.meta.url).href;
GlobalWorkerOptions.workerSrc = workerSrc;

const PDFS = [
  'assets/catalogos/catalogo-mayorista-1.pdf',
  'assets/catalogos/catalogo-mayorista-2.pdf',
  'assets/catalogos/catalogo-mayorista-3.pdf',
];
const OUT = path.join(__dirname, 'assets', 'catalogos', 'pages');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

// NodeCanvasFactory for pdfjs
class NodeCanvasFactory {
  create(width, height) {
    const canvas = createCanvas(width, height);
    return { canvas, context: canvas.getContext('2d') };
  }
  reset(canvasAndContext, width, height) {
    canvasAndContext.canvas.width = width;
    canvasAndContext.canvas.height = height;
  }
  destroy(canvasAndContext) {
    canvasAndContext.canvas.width = 0;
    canvasAndContext.canvas.height = 0;
  }
}

// NodeCMapReaderFactory
class NodeCMapReaderFactory {
  constructor({ baseUrl, isCompressed }) { this.baseUrl = baseUrl; this.isCompressed = isCompressed; }
  async fetch({ name }) { return { cMapData: new Uint8Array(0), compressionType: 0 }; }
}

async function renderPDF(pdfPath, startIdx) {
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const canvasFactory = new NodeCanvasFactory();
  const doc = await getDocument({
    data,
    canvasFactory,
    disableFontFace: true,
    useSystemFonts: true,
  }).promise;

  const total = doc.numPages;
  console.log(`  ${path.basename(pdfPath)}: ${total} páginas`);

  for (let i = 1; i <= total; i++) {
    try {
      const pg = await doc.getPage(i);
      const scale = 1.6;
      const vp = pg.getViewport({ scale });
      const cc = canvasFactory.create(Math.round(vp.width), Math.round(vp.height));

      await pg.render({ canvasContext: cc.context, viewport: vp, canvasFactory }).promise;

      const outFile = path.join(OUT, `page_${String(startIdx + i - 1).padStart(3, '0')}.jpg`);
      fs.writeFileSync(outFile, cc.canvas.toBuffer('image/jpeg', { quality: 0.85 }));
      process.stdout.write(`${i} `);
    } catch (e) {
      process.stdout.write(`[ERR:${i}] `);
    }
  }
  console.log('');
  return total;
}

let idx = 1;
for (const pdf of PDFS) {
  console.log(`\nRenderizando: ${pdf}`);
  try { idx += await renderPDF(pdf, idx); }
  catch (e) { console.error('Error:', e.message); }
}
console.log(`\nTotal: ${idx - 1} páginas → assets/catalogos/pages/`);
