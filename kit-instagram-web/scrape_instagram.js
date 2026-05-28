const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const HANDLE = 'orbitkidscol';
const ASSETS_DIR = path.join(__dirname, 'assets');

if (!fs.existsSync(ASSETS_DIR)) fs.mkdirSync(ASSETS_DIR, { recursive: true });

function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(filepath);
    proto.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        file.close();
        return downloadImage(res.headers.location, filepath).then(resolve).catch(reject);
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(filepath); });
    }).on('error', (err) => { fs.unlink(filepath, () => {}); reject(err); });
  });
}

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 }
  });
  const page = await context.newPage();

  console.log('Abriendo Instagram...');
  await page.goto(`https://www.instagram.com/${HANDLE}/`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);

  // Cerrar popup de cookies/login si aparece
  try {
    const closeBtn = page.locator('[aria-label="Close"], [aria-label="Cerrar"]').first();
    if (await closeBtn.isVisible({ timeout: 3000 })) await closeBtn.click();
  } catch {}

  try {
    const notNow = page.getByText('Ahora no').or(page.getByText('Not now')).first();
    if (await notNow.isVisible({ timeout: 3000 })) await notNow.click();
  } catch {}

  await page.waitForTimeout(2000);

  console.log('Extrayendo datos del perfil...');

  const data = await page.evaluate((handle) => {
    const result = { handle, username: handle, bio: '', followers: '', following: '', posts: '', fullName: '', profilePicUrl: '', isVerified: false, postImages: [] };

    // Nombre completo
    const h1 = document.querySelector('h1, header h2, [data-testid="user-name"]');
    if (h1) result.fullName = h1.textContent.trim();

    // Bio
    const bioEl = document.querySelector('h1 ~ div, header ~ section div span, .-vDIg span, .rhpdm span');
    if (bioEl) result.bio = bioEl.textContent.trim();

    // Stats (followers, following, posts)
    const statItems = document.querySelectorAll('header li, header [role="link"] span span, header section ul li');
    statItems.forEach(item => {
      const txt = item.textContent.toLowerCase();
      const numMatch = item.querySelector('span[title], span span');
      const num = numMatch ? numMatch.getAttribute('title') || numMatch.textContent : '';
      if (txt.includes('publicacion') || txt.includes('post')) result.posts = num;
      else if (txt.includes('seguidor') || txt.includes('follower')) result.followers = num;
      else if (txt.includes('seguido') || txt.includes('following')) result.following = num;
    });

    // Fallback stats from text
    if (!result.followers) {
      const allText = document.body.innerText;
      const followerMatch = allText.match(/([\d,.]+[KkMm]?)\s*(seguidores|followers)/i);
      if (followerMatch) result.followers = followerMatch[1];
    }

    // Verificado
    const verified = document.querySelector('[aria-label="Verificado"], [title="Verified"], svg[aria-label*="verif"]');
    if (verified) result.isVerified = true;

    // Foto de perfil
    const profileImg = document.querySelector('header img, [data-testid="user-avatar"] img');
    if (profileImg) result.profilePicUrl = profileImg.src;

    // Imágenes de posts
    const imgs = document.querySelectorAll('article img, main img[srcset], ._aagv img');
    imgs.forEach(img => {
      if (img.src && !img.src.includes('profile') && result.postImages.length < 12) {
        result.postImages.push(img.src);
      }
    });

    return result;
  }, HANDLE);

  // Screenshot del perfil
  await page.screenshot({ path: path.join(ASSETS_DIR, 'profile_screenshot.png'), fullPage: false });

  // Descargar foto de perfil
  if (data.profilePicUrl) {
    console.log('Descargando foto de perfil...');
    try {
      await downloadImage(data.profilePicUrl, path.join(ASSETS_DIR, 'profile_pic.jpg'));
      data.profilePicLocal = 'assets/profile_pic.jpg';
    } catch (e) {
      console.log('No se pudo descargar foto de perfil:', e.message);
    }
  }

  // Descargar imágenes de posts
  console.log(`Descargando ${data.postImages.length} imágenes de posts...`);
  data.postImagesLocal = [];
  for (let i = 0; i < Math.min(data.postImages.length, 9); i++) {
    try {
      const localPath = path.join(ASSETS_DIR, `post_${i + 1}.jpg`);
      await downloadImage(data.postImages[i], localPath);
      data.postImagesLocal.push(`assets/post_${i + 1}.jpg`);
      console.log(`  Post ${i + 1} descargado`);
    } catch (e) {
      console.log(`  Error post ${i + 1}:`, e.message);
    }
  }

  await browser.close();

  fs.writeFileSync(path.join(__dirname, 'instagram_data.json'), JSON.stringify(data, null, 2));
  console.log('\n✅ Datos guardados en instagram_data.json');
  console.log(JSON.stringify(data, null, 2));
})();
