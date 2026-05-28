const fs = require('fs');

function getPageNum(id) {
  if (id >= 1  && id <= 46)  return id + 6;
  if (id >= 47 && id <= 83)  return id + 7;
  if (id >= 84 && id <= 97)  return id + 8;
  if (id >= 98 && id <= 149) return id + 9;
  return null;
}
function pad(n) { return String(n).padStart(3, '0'); }

const PRODUCTOS = new Function(fs.readFileSync('productos.js', 'utf8') + '\nreturn PRODUCTOS;')();

PRODUCTOS.forEach(p => {
  const page = getPageNum(p.id);
  if (!page) return;
  const pp = pad(page);
  p.imagenes = [
    `assets/catalogos/crops/p${pp}_inner.jpg`,
    `assets/catalogos/crops/p${pp}_v1.jpg`,
    `assets/catalogos/crops/p${pp}_v2.jpg`,
    `assets/catalogos/crops/p${pp}_v3.jpg`,
  ];
  p.colores.forEach((c, i) => { c.img = p.imagenes[Math.min(i, 3)]; });
});

function q(s) { return `'${String(s).replace(/'/g,"\\'")}' `; }

function ser(p) {
  return `  {
    id:${p.id},cat:${q(p.cat)},nombre:${q(p.nombre)},
    desc:${q(p.desc)},
    precio:${p.precio},precioOriginal:${p.precioOriginal},tallas:${JSON.stringify(p.tallas)},
    cardImg:${q(p.cardImg||p.imagenes[0])},
    colores:[
${p.colores.map(c=>`      {nombre:${q(c.nombre)},hex:${q(c.hex)},img:${q(c.img)}},`).join('\n')}
    ],
    imagenes:${JSON.stringify(p.imagenes)},
    rating:${p.rating},reviews:${p.reviews},badge:${q(p.badge)},stock:${q(p.stock)},
  }`;
}

const ninas  = PRODUCTOS.filter(p => p.cat === 'nina');
const ninos  = PRODUCTOS.filter(p => p.cat === 'nino');
const otros  = PRODUCTOS.filter(p => p.cat !== 'nina' && p.cat !== 'nino');

let out = `// Base de datos de productos CreaYoyis\nconst PRODUCTOS = [\n  // ===== NIÑA =====\n`;
out += ninas.map(ser).join(',\n') + (ninos.length ? ',' : '') + '\n';
if (ninos.length) { out += `  // ===== NIÑO =====\n` + ninos.map(ser).join(',\n') + (otros.length?',':'') + '\n'; }
if (otros.length) { out += otros.map(ser).join(',\n') + '\n'; }
out += `];\n`;

fs.writeFileSync('productos.js', out);
console.log(`Actualizados ${PRODUCTOS.length} productos con imágenes limpias.`);
