/**
 * 從 Article 的 url 抓取該頁的 og:image，上傳至 Strapi 並寫回 Article 的 image 欄位。
 * 使用方式：在專案根目錄或本資料夾執行
 *   node scripts/article-og-image/sync.js
 *   node scripts/article-og-image/sync.js --dry   （只列出會處理的項目，不實際上傳）
 *
 * 環境變數（可放在專案根目錄 .env 或本資料夾 .env）：
 *   STRAPI_URL=http://localhost:1337
 *   STRAPI_API_TOKEN=你的 API Token（需有 article 的 update、upload 權限）
 */

import { load } from 'cheerio';
import { createWriteStream, readFileSync, unlinkSync, existsSync } from 'fs';
import { get as httpsGet } from 'https';
import { get as httpGet } from 'http';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const projectRoot = join(__dirname, '..', '..');
  const roots = [
    join(projectRoot, '.env'),
    join(process.cwd(), '.env'),
    join(__dirname, '.env'),
  ];
  for (const p of roots) {
    if (existsSync(p)) {
      const content = readFileSync(p, 'utf8');
      for (const line of content.split('\n')) {
        const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
      }
      break;
    }
  }
}

loadEnv();
const STRAPI_URL = (process.env.STRAPI_URL || 'http://localhost:1337').replace(/\/$/, '');
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN;
const DRY = process.argv.includes('--dry');

function fetchHtml(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? httpsGet : httpGet;
    const req = lib(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NewsWeb-OGImage/1.0)' }, timeout: 15000 }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function getOgImageUrl(html, pageUrl) {
  const $ = load(html);
  let ogImage = $('meta[property="og:image"]').attr('content') || $('meta[name="og:image"]').attr('content');
  if (!ogImage) return null;
  if (ogImage.startsWith('//')) ogImage = 'https:' + ogImage;
  if (ogImage.startsWith('/')) {
    try {
      const u = new URL(pageUrl);
      ogImage = u.origin + ogImage;
    } catch (_) {}
  }
  return ogImage;
}

function downloadFile(url) {
  return new Promise((resolve, reject) => {
    const ext = url.includes('.png') ? '.png' : url.includes('.webp') ? '.webp' : '.jpg';
    const tmpPath = join(tmpdir(), `og-image-${Date.now()}${ext}`);
    const lib = url.startsWith('https') ? httpsGet : httpGet;
    const file = createWriteStream(tmpPath);
    lib(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 10000 }, (res) => {
      if (res.statusCode !== 200) {
        file.close();
        try { unlinkSync(tmpPath); } catch (_) {}
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(tmpPath); });
    }).on('error', (err) => { file.close(); existsSync(tmpPath) && unlinkSync(tmpPath); reject(err); });
  });
}

async function strapiGetArticles() {
  const res = await fetch(`${STRAPI_URL}/api/articles?pagination[pageSize]=100&populate=image`, {
    headers: { Authorization: `Bearer ${STRAPI_API_TOKEN}` },
  });
  if (!res.ok) throw new Error(`Strapi articles: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return Array.isArray(data.data) ? data.data : data.data ? [data.data] : [];
}

async function strapiUploadAndLink(filePath, documentId, field = 'image') {
  const form = new FormData();
  const blob = new Blob([readFileSync(filePath)]);
  const name = filePath.split(/[/\\]/).pop() || 'og-image.jpg';
  form.append('files', blob, name);
  form.append('ref', 'api::article.article');
  form.append('refId', documentId);
  form.append('field', field);

  const res = await fetch(`${STRAPI_URL}/api/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${STRAPI_API_TOKEN}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Upload: ${res.status} ${await res.text()}`);
  return res.json();
}

async function main() {
  loadEnv();
  if (!STRAPI_API_TOKEN) {
    console.error('請設定 STRAPI_API_TOKEN（在 .env 或環境變數）');
    process.exit(1);
  }

  const articles = await strapiGetArticles();
  const withoutImage = articles.filter((a) => !a.image?.id && !a.image?.documentId);
  const withUrl = withoutImage.filter((a) => a.url);

  console.log(`Article 總數: ${articles.length}, 無 image: ${withoutImage.length}, 有 url 可處理: ${withUrl.length}`);
  if (DRY) {
    withUrl.forEach((a) => console.log(`  - ${a.documentId} ${a.title?.slice(0, 40)}... ${a.url}`));
    return;
  }

  for (const article of withUrl) {
    const { documentId, title, url } = article;
    let tmpPath;
    try {
      const html = await fetchHtml(url);
      const ogUrl = getOgImageUrl(html, url);
      if (!ogUrl) {
        console.log(`跳過（無 og:image）: ${title?.slice(0, 40)}...`);
        continue;
      }
      tmpPath = await downloadFile(ogUrl);
      await strapiUploadAndLink(tmpPath, documentId);
      console.log(`已更新 image: ${title?.slice(0, 40)}...`);
    } catch (e) {
      console.warn(`失敗 ${title?.slice(0, 40)}...: ${e.message}`);
    } finally {
      if (tmpPath && existsSync(tmpPath)) try { unlinkSync(tmpPath); } catch (_) {}
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
