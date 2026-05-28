const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const HANDLE = 'creayoyis';
const ASSETS_DIR = path.join(__dirname, 'assets', 'creayoyis');

if (!fs.existsSync(ASSETS_DIR)) fs.mkdirSync(ASSETS_DIR, { recursive: true });

function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(filepath);
    proto.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' } }, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        file.close();
        fs.unlink(filepath, () => {});
        return downloadImage(res.headers.location, filepath).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        file.close();
        fs.unlink(filepath, () => {});
        return reject(new Error('Status ' + res.statusCode));
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(filepath); });
    }).on('error', (err) => { fs.unlink(filepath, () => {}); reject(err); });
  });
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 300 });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
    locale: 'es-ES',
  });
  const page = await context.newPage();

  console.log(`Abriendo Instagram: @${HANDLE}...`);
  await page.goto(`https://www.instagram.com/${HANDLE}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(5000);

  // Cerrar dialogs
  for (const text of ['Ahora no', 'Not now', 'Rechazar', 'Decline']) {
    try {
      const btn = page.getByText(text, { exact: false }).first();
      if (await btn.isVisible({ timeout: 1500 })) { await btn.click(); await page.waitForTimeout(800); }
    } catch {}
  }
  try {
    const dialog = page.locator('[role="dialog"]');
    if (await dialog.isVisible({ timeout: 2000 })) { await page.keyboard.press('Escape'); await page.waitForTimeout(1000); }
  } catch {}

  await page.waitForTimeout(2000);

  console.log('Extrayendo datos...');
  const data = await page.evaluate(() => {
    const result = {
      fullName: '',
      bio: '',
      followers: '',
      posts: '',
      following: '',
      isVerified: false,
      profilePicUrl: '',
      postImages: [],
    };

    // Nombre completo
    const h2 = document.querySelector('header h2, header h1');
    if (h2) result.fullName = h2.textContent.trim();

    // Bio
    const bioEl = document.querySelector('header section span, ._aa_c span, header div span');
    if (bioEl) result.bio = bioEl.textContent.trim();

    // Stats
    const statEls = document.querySelectorAll('header ul li, header section ul li');
    const statsArr = Array.from(statEls).map(el => el.textContent.trim());
    if (statsArr[0]) result.posts = statsArr[0];
    if (statsArr[1]) result.followers = statsArr[1];
    if (statsArr[2]) result.following = statsArr[2];

    // Fallback seguidores del texto de la página
    if (!result.followers) {
      const bodyText = document.body.innerText;
      const m = bodyText.match(/([\d.,]+[KkMm]?)\s*(seguidores|Seguidores|followers|Followers)/);
      if (m) result.followers = m[1];
    }

    // Verificado
    const verEl = document.querySelector('[aria-label="Verificado"],[aria-label="Verified"],svg[aria-label*="erif"]');
    if (verEl) result.isVerified = true;

    // Foto de perfil
    const profileImg = document.querySelector('header img');
    if (profileImg) result.profilePicUrl = profileImg.src;

    // Imágenes de posts
    const allImgs = Array.from(document.querySelectorAll('img'))
      .filter(img => img.src && (img.src.includes('cdninstagram') || img.src.includes('fbcdn')) && img.width > 150);
    allImgs.forEach(img => {
      if (!img.src.includes('profile') && result.postImages.length < 12) {
        result.postImages.push(img.src);
      }
    });

    return result;
  });

  console.log('Nombre:', data.fullName);
  console.log('Bio:', data.bio);
  console.log('Seguidores:', data.followers);
  console.log('Posts:', data.posts);
  console.log('Imágenes encontradas:', data.postImages.length);

  // Screenshot
  await page.screenshot({ path: path.join(ASSETS_DIR, 'screenshot.png') });

  // Descargar foto de perfil
  if (data.profilePicUrl) {
    try {
      await downloadImage(data.profilePicUrl, path.join(ASSETS_DIR, 'profile.jpg'));
      data.profilePicLocal = 'assets/creayoyis/profile.jpg';
      console.log('Foto de perfil descargada.');
    } catch (e) {
      console.log('Error foto de perfil:', e.message);
    }
  }

  // Descargar fotos de posts
  data.postImagesLocal = [];
  for (let i = 0; i < Math.min(data.postImages.length, 9); i++) {
    try {
      const dest = path.join(ASSETS_DIR, `post_${i + 1}.jpg`);
      await downloadImage(data.postImages[i], dest);
      data.postImagesLocal.push(`assets/creayoyis/post_${i + 1}.jpg`);
      console.log(`Post ${i + 1} descargado.`);
    } catch (e) {
      console.log(`Error post ${i + 1}:`, e.message);
    }
  }

  await browser.close();

  const result = { handle: HANDLE, ...data, scrapedAt: new Date().toISOString() };
  fs.writeFileSync(path.join(__dirname, 'creayoyis_data.json'), JSON.stringify(result, null, 2));
  console.log('\n✅ Datos guardados en creayoyis_data.json');
})();
