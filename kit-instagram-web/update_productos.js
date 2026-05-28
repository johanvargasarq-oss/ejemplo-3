// Reads productos.js, updates cardImg + imagenes + colores[i].img for all 149 products
const fs = require('fs');

function getPageNum(id) {
  if (id >= 1  && id <= 46)  return id + 6;
  if (id >= 47 && id <= 83)  return id + 7;
  if (id >= 84 && id <= 97)  return id + 8;
  if (id >= 98 && id <= 149) return id + 9;
  return null;
}
function pad(n) { return String(n).padStart(3, '0'); }

// Safely eval productos.js using Function() so const/function scoping works
const content = fs.readFileSync('productos.js', 'utf8');
const PRODUCTOS = new Function(content + '\nreturn PRODUCTOS;')();

// Update image fields for every product
PRODUCTOS.forEach(p => {
  const page = getPageNum(p.id);
  if (!page) return;
  const pp = pad(page);

  p.cardImg  = `assets/catalogos/pages/page_${pp}.jpg`;
  p.imagenes = [
    `assets/catalogos/crops/p${pp}_main.jpg`,
    `assets/catalogos/crops/p${pp}_c1.jpg`,
    `assets/catalogos/crops/p${pp}_c2.jpg`,
    `assets/catalogos/crops/p${pp}_c3.jpg`,
  ];

  p.colores.forEach((c, i) => {
    c.img = p.imagenes[Math.min(i, 2)]; // main→c1→c2; c3 stays as 4th imagen
  });
});

// Serialize back to clean JS
function q(s) { return `'${s.replace(/'/g,"\\'")}' `; }

function serProduct(p) {
  const colorLines = p.colores.map(c =>
    `      {nombre:${q(c.nombre)},hex:${q(c.hex)},img:${q(c.img)}},`
  ).join('\n');

  return `  {
    id:${p.id},cat:${q(p.cat)},nombre:${q(p.nombre)},
    desc:${q(p.desc)},
    precio:${p.precio},precioOriginal:${p.precioOriginal},tallas:${JSON.stringify(p.tallas)},
    cardImg:${q(p.cardImg)},
    colores:[
${colorLines}
    ],
    imagenes:${JSON.stringify(p.imagenes)},
    rating:${p.rating},reviews:${p.reviews},badge:${q(p.badge)},stock:${q(p.stock)},
  }`;
}

const ninas   = PRODUCTOS.filter(p => p.cat === 'nina');
const ninos   = PRODUCTOS.filter(p => p.cat === 'nino');
const unisex  = PRODUCTOS.filter(p => p.cat !== 'nina' && p.cat !== 'nino');

let out = `// Base de datos de productos CreaYoyis\nconst PRODUCTOS = [\n`;
out += `  // ===== NIÑA =====\n`;
out += ninas.map(serProduct).join(',\n') + (ninos.length || unisex.length ? ',' : '') + '\n';
if (ninos.length) {
  out += `  // ===== NIÑO =====\n`;
  out += ninos.map(serProduct).join(',\n') + (unisex.length ? ',' : '') + '\n';
}
if (unisex.length) {
  out += unisex.map(serProduct).join(',\n') + '\n';
}
out += `];\n`;

fs.writeFileSync('productos.js', out);
console.log(`Actualizados ${PRODUCTOS.length} productos.`);
