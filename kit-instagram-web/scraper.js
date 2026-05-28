const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const https = require('https');

const HANDLE = 'cafetopiacol';
const OUT_DIR = path.join(__dirname, 'assets', 'instagram');

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

function downloadImage(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        return downloadImage(res.headers.location, dest).then(resolve).catch(reject);
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', (err) => { fs.unlink(dest, () => {}); reject(err); });
  });
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 500 });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
    locale: 'es-ES',
  });

  const page = await context.newPage();

  console.log(`Abriendo Instagram: @${HANDLE}...`);
  await page.goto(`https://www.instagram.com/${HANDLE}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(4000);

  // Close cookie/login dialogs if they appear
  const closeSelectors = [
    'button[type="button"]:has-text("Rechazar")',
    'button[type="button"]:has-text("Decline")',
    'button[type="button"]:has-text("Allow")',
    'button[type="button"]:has-text("Permitir")',
    '[role="dialog"] button:last-child',
  ];
  for (const sel of closeSelectors) {
    try {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 1000 })) {
        await btn.click();
        await page.waitForTimeout(1000);
      }
    } catch {}
  }

  // Try to dismiss login popup
  try {
    const loginDialog = page.locator('[role="dialog"]');
    if (await loginDialog.isVisible({ timeout: 2000 })) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(1000);
    }
  } catch {}

  await page.waitForTimeout(2000);

  // Extract profile data
  const data = await page.evaluate(() => {
    const getText = (sel) => {
      const el = document.querySelector(sel);
      return el ? el.textContent.trim() : '';
    };

    // Name
    const nameEl = document.querySelector('h2, header h1, header h2, [data-testid="user-name"]');
    const name = nameEl ? nameEl.textContent.trim() : '';

    // Bio
    const bioEl = document.querySelector('header section > div > span, ._aa_c, [data-testid="user-description"]');
    const bio = bioEl ? bioEl.textContent.trim() : '';

    // Stats (posts, followers, following)
    const statEls = document.querySelectorAll('header ul li, header section ul li');
    const stats = Array.from(statEls).map(el => el.textContent.trim());

    // Profile image
    const imgEl = document.querySelector('header img, [data-testid="user-avatar"] img');
    const profileImg = imgEl ? imgEl.src : '';

    // Website link
    const linkEl = document.querySelector('header a[href*="http"]:not([href*="instagram"])');
    const website = linkEl ? linkEl.href : '';

    // Verified badge
    const verified = !!document.querySelector('[aria-label="Verificado"], [aria-label="Verified"], svg[aria-label*="erif"]');

    // Post images (grid)
    const postImgs = Array.from(document.querySelectorAll('article img, main article img, [data-testid="post-image"] img'))
      .slice(0, 9)
      .map(img => ({ src: img.src, alt: img.alt || '' }));

    // All images on page (fallback)
    const allImgs = Array.from(document.querySelectorAll('img'))
      .filter(img => img.src && img.src.includes('cdninstagram') && img.width > 100)
      .slice(0, 20)
      .map(img => ({ src: img.src, alt: img.alt || '', w: img.width, h: img.height }));

    return { name, bio, stats, profileImg, website, verified, postImgs, allImgs };
  });

  console.log('Datos extraídos:', JSON.stringify({ name: data.name, bio: data.bio, stats: data.stats }, null, 2));

  // Take screenshot for manual inspection
  await page.screenshot({ path: path.join(OUT_DIR, 'screenshot.png'), fullPage: false });

  // Download profile image
  if (data.profileImg) {
    try {
      await downloadImage(data.profileImg, path.join(OUT_DIR, 'profile.jpg'));
      console.log('Foto de perfil descargada.');
    } catch (e) {
      console.log('No se pudo descargar foto de perfil:', e.message);
    }
  }

  // Download post images
  const postImages = data.postImgs.length > 0 ? data.postImgs : data.allImgs.slice(1);
  const savedPosts = [];
  for (let i = 0; i < Math.min(postImages.length, 9); i++) {
    const img = postImages[i];
    if (!img.src || !img.src.startsWith('http')) continue;
    const dest = path.join(OUT_DIR, `post_${i + 1}.jpg`);
    try {
      await downloadImage(img.src, dest);
      savedPosts.push({ file: `assets/instagram/post_${i + 1}.jpg`, alt: img.alt });
      console.log(`Post ${i + 1} descargado.`);
    } catch (e) {
      console.log(`Post ${i + 1} error:`, e.message);
    }
  }

  // Parse stats
  const parseNum = (str) => {
    if (!str) return 0;
    const m = str.match(/([\d,.]+[KkMm]?)/);
    if (!m) return 0;
    let n = m[1].replace(',', '.');
    if (n.endsWith('K') || n.endsWith('k')) return Math.round(parseFloat(n) * 1000);
    if (n.endsWith('M') || n.endsWith('m')) return Math.round(parseFloat(n) * 1000000);
    return parseInt(n.replace(/\./g, '')) || 0;
  };

  const result = {
    handle: HANDLE,
    name: data.name || 'Sole Essentials',
    bio: data.bio,
    verified: data.verified,
    website: data.website,
    stats: {
      posts: parseNum(data.stats[0]),
      followers: parseNum(data.stats[1]),
      following: parseNum(data.stats[2]),
      raw: data.stats,
    },
    profileImg: data.profileImg ? 'assets/instagram/profile.jpg' : null,
    posts: savedPosts,
    scrapedAt: new Date().toISOString(),
  };

  fs.writeFileSync(path.join(__dirname, 'instagram_data.json'), JSON.stringify(result, null, 2));
  console.log('\n✅ Datos guardados en instagram_data.json');
  console.log('Nombre:', result.name);
  console.log('Bio:', result.bio);
  console.log('Seguidores:', result.stats.followers);
  console.log('Posts descargados:', result.posts.length);

  await browser.close();
})();
