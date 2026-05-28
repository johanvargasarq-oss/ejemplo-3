// Crop ALL catalog pages into main + 3 color variant images
const sharp = require('sharp');
const fs = require('fs');

const OUT = 'assets/catalogos/crops';
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const MAIN_H = 800;
const VAR_Y  = 1060;
const VAR_H  = 640;
const VAR_W  = 400;

async function crop(pageNum) {
  const pp = String(pageNum).padStart(3, '0');
  const src = `assets/catalogos/pages/page_${pp}.jpg`;
  if (!fs.existsSync(src)) { process.stdout.write(`[SKIP:${pageNum}] `); return; }
  const base = `p${pp}`;
  await sharp(src).extract({ left:0, top:0, width:1200, height:MAIN_H }).jpeg({ quality:88 }).toFile(`${OUT}/${base}_main.jpg`);
  for (let i = 0; i < 3; i++) {
    await sharp(src).extract({ left: i*VAR_W, top:VAR_Y, width:VAR_W, height:VAR_H }).jpeg({ quality:88 }).toFile(`${OUT}/${base}_c${i+1}.jpg`);
  }
  process.stdout.write(`${pageNum} `);
}

(async () => {
  console.log('Recortando páginas...');
  // Niña: pages 7-52
  for (let p = 7;   p <= 52;  p++) await crop(p);
  // Niña cont: 54-90 (skip 53 = duplicate)
  for (let p = 54;  p <= 90;  p++) await crop(p);
  // Niño: 92-105
  for (let p = 92;  p <= 105; p++) await crop(p);
  // Niño cont: 107-158 (skip 106 = duplicate)
  for (let p = 107; p <= 158; p++) await crop(p);
  console.log('\nListo!');
})();
