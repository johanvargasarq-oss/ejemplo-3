const { chromium } = require('playwright');
const fs = require('fs');
const https = require('https');
const http = require('http');
const path = require('path');

const DIR = path.join(__dirname, 'assets', 'creayoyis');

function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(filepath);
    proto.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close(); fs.unlink(filepath, () => {});
        return downloadImage(res.headers.location, filepath).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) { file.close(); fs.unlink(filepath, () => {}); return reject(new Error('Status ' + res.statusCode)); }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', (err) => { fs.unlink(filepath, () => {}); reject(err); });
  });
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 200 });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });

  console.log('Abriendo Instagram...');
  await page.goto('https://www.instagram.com/creayoyis/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(5000);

  for (const text of ['Ahora no', 'Not now', 'Rechazar', 'Decline']) {
    try { const b = page.getByText(text, { exact: false }).first(); if (await b.isVisible({ timeout: 1500 })) { await b.click(); await page.waitForTimeout(800); } } catch {}
  }
  try { if (await page.locator('[role=dialog]').isVisible({ timeout: 2000 })) { await page.keyboard.press('Escape'); await page.waitForTimeout(800); } } catch {}

  await page.waitForTimeout(2000);
  console.log('Haciendo scroll...');

  for (let i = 0; i < 6; i++) {
    await page.evaluate(() => window.scrollBy(0, 1000));
    await page.waitForTimeout(2000);
    process.stdout.write('.');
  }
  console.log('\nExtrayendo URLs...');

  const urls = await page.evaluate(() => {
    const seen = new Set();
    const result = [];
    document.querySelectorAll('img').forEach(img => {
      const src = img.src || '';
      if ((src.includes('cdninstagram') || src.includes('fbcdn')) && img.width > 100 && !src.includes('profile') && !seen.has(src)) {
        seen.add(src);
        result.push(src);
      }
    });
    return result.slice(0, 30);
  });

  console.log('URLs encontradas:', urls.length);

  let saved = 0;
  for (let i = 0; i < urls.length && saved < 20; i++) {
    const dest = path.join(DIR, `extra_${saved + 1}.jpg`);
    try {
      await downloadImage(urls[i], dest);
      console.log(`extra_${saved + 1}.jpg descargada`);
      saved++;
    } catch (e) {
      console.log(`skip url ${i + 1}:`, e.message);
    }
  }

  await browser.close();
  console.log('\nTotal descargadas:', saved);
})();
