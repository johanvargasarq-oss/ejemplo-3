// Crops catalog page JPEGs into main product photo + 3 color variant images
const sharp = require('sharp');
const fs = require('fs');

const OUT = 'assets/catalogos/crops';
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

// All pages are 1200x1700
// Main product photo: top section before price text (~850px)
// Color variants strip: starts ~1060px, height ~640px, split into 3 equal columns
const MAIN_H = 800;
const VAR_Y  = 1060;
const VAR_H  = 640;
const VAR_W  = 400; // 1200 / 3

async function crop(pageNum, base) {
  const src = `assets/catalogos/pages/page_${String(pageNum).padStart(3,'0')}.jpg`;
  await sharp(src).extract({ left:0, top:0, width:1200, height:MAIN_H }).jpeg({ quality:88 }).toFile(`${OUT}/${base}_main.jpg`);
  for (let i = 0; i < 3; i++) {
    await sharp(src).extract({ left: i*VAR_W, top:VAR_Y, width:VAR_W, height:VAR_H }).jpeg({ quality:88 }).toFile(`${OUT}/${base}_c${i+1}.jpg`);
  }
  console.log(`✓ ${src}`);
}

(async () => {
  await crop(7, 'p007');
  await crop(8, 'p008');
  await crop(9, 'p009');
  console.log('Done → assets/catalogos/crops/');
})();
