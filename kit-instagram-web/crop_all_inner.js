// Extracts clean inner photo (no tetero background) from all catalog pages
const sharp = require('sharp');
const fs = require('fs');

const OUT = 'assets/catalogos/crops';

// Zone 2 inner — square crop centered on garment, avoids price/REF/teteros
const INNER = { left: 206, top: 200, width: 435, height: 435 };
// Variant strips — tightest clean crop possible
const V1 = { left: 60,  top: 1060, width: 325, height: 340 };
const V2 = { left: 420, top: 1060, width: 300, height: 340 };
const V3 = { left: 820, top: 1060, width: 240, height: 320 };

async function cropPage(pageNum) {
  const pp = String(pageNum).padStart(3, '0');
  const src = `assets/catalogos/pages/page_${pp}.jpg`;
  if (!fs.existsSync(src)) { process.stdout.write(`[skip:${pageNum}] `); return; }
  await sharp(src).extract(INNER).jpeg({ quality: 90 }).toFile(`${OUT}/p${pp}_inner.jpg`);
  await sharp(src).extract(V1).jpeg({ quality: 88 }).toFile(`${OUT}/p${pp}_v1.jpg`);
  await sharp(src).extract(V2).jpeg({ quality: 88 }).toFile(`${OUT}/p${pp}_v2.jpg`);
  await sharp(src).extract(V3).jpeg({ quality: 88 }).toFile(`${OUT}/p${pp}_v3.jpg`);
  process.stdout.write(`${pageNum} `);
}

(async () => {
  console.log('Recortando zona interna de todas las páginas...');
  for (let p = 7;   p <= 52;  p++) await cropPage(p);
  for (let p = 54;  p <= 90;  p++) await cropPage(p);
  for (let p = 92;  p <= 105; p++) await cropPage(p);
  for (let p = 107; p <= 158; p++) await cropPage(p);
  console.log('\nListo!');
})();
