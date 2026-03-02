/**
 * 從 Article 的 url 直接抓取該頁的 og:image 與 page description，寫回 Strapi。
 * - og:image → 下載上傳至 Strapi，寫入 Article 的 image 欄位
 * - page description（og:description 或 meta description）→ 寫入 Article 的 description 欄位
 *
 * 使用方式：在專案根目錄或本資料夾執行
 *   node scripts/article-og-image/sync.js
 *   node scripts/article-og-image/sync.js --dry   （只列出會處理的項目，不實際寫入）
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

/** 用 fetch 跟隨重定向，短網址會跳到最終頁再抓 og:image */
async function fetchHtml(url) {
  const res = await fetch(url, {
    redirect: 'follow',
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NewsWeb-OGImage/1.0)' },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  return { html, finalUrl: res.url };
}

function getOgImageUrl(html, pageUrl) {
  const $ = load(html);
  let ogImage = $('meta[property="og:image"]').attr('content') || $('meta[name="og:image"]').attr('content');
  if (!ogImage) return null;
  ogImage = ogImage.trim();
  if (ogImage.startsWith('//')) ogImage = 'https:' + ogImage;
  if (ogImage.startsWith('/')) {
    try {
      const u = new URL(pageUrl);
      ogImage = u.origin + ogImage;
    } catch (_) {}
  }
  return ogImage;
}

/** 從 HTML 抓取 page description：優先 og:description，其次 meta name="description" */
function getPageDescription(html) {
  const $ = load(html);
  const og = $('meta[property="og:description"]').attr('content');
  if (og && og.trim()) return og.trim();
  const meta = $('meta[name="description"]').attr('content');
  if (meta && meta.trim()) return meta.trim();
  return null;
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

function getMimeType(filePath) {
  const name = (filePath.split(/[/\\]/).pop() || '').toLowerCase();
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

/** 更新 Article 欄位（只傳要改的欄位） */
async function strapiPatchArticle(documentId, data) {
  const res = await fetch(`${STRAPI_URL}/api/articles/${documentId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${STRAPI_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ data }),
  });
  if (!res.ok) throw new Error(`PATCH article: ${res.status} ${await res.text()}`);
  return res.json();
}

/** 先上傳檔案（不帶 ref），再 PATCH 文章關聯 image（可一併寫入 description） */
async function strapiUploadAndLink(filePath, documentId, extraData = {}) {
  const form = new FormData();
  const buffer = readFileSync(filePath);
  const name = filePath.split(/[/\\]/).pop() || 'og-image.jpg';
  const mimeType = getMimeType(filePath);
  const blob = new Blob([buffer], { type: mimeType });
  form.append('files', blob, name);

  const uploadRes = await fetch(`${STRAPI_URL}/api/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${STRAPI_API_TOKEN}` },
    body: form,
  });
  if (!uploadRes.ok) throw new Error(`Upload: ${uploadRes.status} ${await uploadRes.text()}`);
  const uploadData = await uploadRes.json();
  const fileId = Array.isArray(uploadData) ? uploadData[0]?.id : uploadData?.id ?? uploadData?.[0]?.id;
  if (fileId == null) throw new Error('Upload 回傳無 file id');

  const payload = { image: fileId, ...extraData };
  const patchRes = await fetch(`${STRAPI_URL}/api/articles/${documentId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${STRAPI_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ data: payload }),
  });
  if (!patchRes.ok) throw new Error(`PATCH article: ${patchRes.status} ${await patchRes.text()}`);
  return patchRes.json();
}

async function main() {
  loadEnv();
  if (!STRAPI_API_TOKEN) {
    console.error('請設定 STRAPI_API_TOKEN（在 .env 或環境變數）');
    process.exit(1);
  }

  const articles = await strapiGetArticles();
  const hasUrl = (a) => a.url && a.url.trim();
  const noImage = (a) => !a.image?.id && !a.image?.documentId;
  const noDescription = (a) => {
    const d = a.description == null ? '' : String(a.description).trim();
    return !d || d === '-';
  };
  const toProcess = articles.filter((a) => hasUrl(a) && (noImage(a) || noDescription(a)));

  console.log(
    `Article 總數: ${articles.length}, 有 url 且缺 image 或 description: ${toProcess.length}`
  );
  if (DRY) {
    toProcess.forEach((a) => {
      const needs = [noImage(a) && 'image', noDescription(a) && 'description'].filter(Boolean);
      console.log(`  - ${a.documentId} ${a.title?.slice(0, 40)}... 缺: ${needs.join(', ')}`);
    });
    return;
  }

  for (const article of toProcess) {
    const { documentId, title, url } = article;
    const needImage = noImage(article);
    const needDesc = noDescription(article);
    let tmpPath;
    try {
      const { html, finalUrl } = await fetchHtml(url);
      const ogUrl = needImage ? getOgImageUrl(html, finalUrl) : null;
      const description = needDesc ? getPageDescription(html) : null;

      if (needImage && ogUrl) {
        tmpPath = await downloadFile(ogUrl);
        await strapiUploadAndLink(tmpPath, documentId, description ? { description } : {});
        console.log(`已更新 image${description ? ' + description' : ''}: ${title?.slice(0, 40)}...`);
      } else if (needDesc && description) {
        await strapiPatchArticle(documentId, { description });
        console.log(`已更新 description: ${title?.slice(0, 40)}...`);
      } else if (needImage && !ogUrl) {
        console.log(`跳過（無 og:image）: ${title?.slice(0, 40)}...`);
      } else {
        console.log(`跳過（無 description）: ${title?.slice(0, 40)}...`);
      }
    } catch (e) {
      console.warn(`失敗 ${title?.slice(0, 40)}...: ${e.message}`);
    } finally {
      if (tmpPath && existsSync(tmpPath)) try { unlinkSync(tmpPath); } catch (_) {}
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
