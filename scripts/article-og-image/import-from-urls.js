/**
 * 從「新聞 URL」抓取 og:title、og:description、og:image，並在 Strapi 建立新 Article。
 *
 * 使用方式（在專案根目錄執行）：
 *   node scripts/article-og-image/import-from-urls.js "https://url1" "https://url2"
 *   node scripts/article-og-image/import-from-urls.js --dry "https://url1"   （只預覽，不寫入）
 *   node scripts/article-og-image/import-from-urls.js --file urls.txt         （從檔案讀 URL，一行一個）
 *
 * 環境變數（.env）：
 *   STRAPI_URL=https://active-trust-e46c30f868.strapiapp.com
 *   STRAPI_API_TOKEN=你的 API Token（需有 article 的 create、upload 權限）
 *   DEFAULT_CATEGORY_SLUG=tech   （選填，需能 GET /api/categories 時才有效）
 *   CATEGORY_DOCUMENT_ID=xxx     （選填，若 /api/categories 404 可改設此值，從現有文章 populate=category 取得）
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
const DEFAULT_CATEGORY_SLUG = process.env.DEFAULT_CATEGORY_SLUG || '';
const CATEGORY_DOCUMENT_ID = process.env.CATEGORY_DOCUMENT_ID || '';
const DRY = process.argv.includes('--dry');

function getArgUrls() {
  const fileIdx = process.argv.indexOf('--file');
  if (fileIdx !== -1 && process.argv[fileIdx + 1]) {
    const path = join(process.cwd(), process.argv[fileIdx + 1]);
    if (!existsSync(path)) {
      console.error('找不到檔案:', path);
      process.exit(1);
    }
    return readFileSync(path, 'utf8')
      .split('\n')
      .map((u) => u.trim())
      .filter((u) => u && (u.startsWith('http://') || u.startsWith('https://')));
  }
  return process.argv.filter((a) => a.startsWith('http://') || a.startsWith('https://'));
}

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

function getOgTitle(html) {
  const $ = load(html);
  const og = $('meta[property="og:title"]').attr('content');
  if (og && og.trim()) return og.trim();
  const title = $('title').first().text();
  if (title && title.trim()) return title.trim();
  return null;
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

function getPageDescription(html) {
  const $ = load(html);
  const og = $('meta[property="og:description"]').attr('content');
  if (og && og.trim()) return og.trim();
  const meta = $('meta[name="description"]').attr('content');
  if (meta && meta.trim()) return meta.trim();
  return null;
}

/** 從 URL host 推一個簡短來源名稱 */
function deriveSourceFromUrl(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    if (host.includes('yahoo')) return 'yahoo 新聞';
    if (host.includes('ettoday')) return '東森新聞';
    if (host.includes('newtalk')) return '新頭殼';
    if (host.includes('reurl')) return '轉址連結';
    return host;
  } catch (_) {
    return '未知來源';
  }
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

async function strapiGetCategories() {
  const res = await fetch(`${STRAPI_URL}/api/categories`, {
    headers: { Authorization: `Bearer ${STRAPI_API_TOKEN}` },
  });
  if (!res.ok) throw new Error(`Strapi categories: ${res.status} ${await res.text()}`);
  const data = await res.json();
  const list = Array.isArray(data.data) ? data.data : data.data ? [data.data] : [];
  return list;
}

function getMimeType(filePath) {
  const name = (filePath.split(/[/\\]/).pop() || '').toLowerCase();
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

/** 上傳檔案到 Strapi，回傳 file id */
async function strapiUploadFile(filePath) {
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
  return fileId;
}

/** 建立 Article（含 category、可選 image），並直接發布 */
async function strapiCreateArticle(payload) {
  const res = await fetch(`${STRAPI_URL}/api/articles`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${STRAPI_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ data: payload }),
  });
  if (!res.ok) throw new Error(`Create article: ${res.status} ${await res.text()}`);
  return res.json();
}

async function main() {
  loadEnv();
  if (!STRAPI_API_TOKEN) {
    console.error('請設定 STRAPI_API_TOKEN（在 .env 或環境變數）');
    process.exit(1);
  }

  const urls = getArgUrls();
  if (urls.length === 0) {
    console.error('請提供 URL：');
    console.error('  node scripts/article-og-image/import-from-urls.js "https://..." "https://..."');
    console.error('  node scripts/article-og-image/import-from-urls.js --file urls.txt');
    process.exit(1);
  }

  let categoryId = CATEGORY_DOCUMENT_ID;
  if (!categoryId && !DRY) {
    let categories = [];
    try {
      categories = await strapiGetCategories();
    } catch (e) {
      console.warn('無法取得 /api/categories（' + e.message + '）');
    }
    if (categories.length === 0) {
      console.error('無法取得分類。請在 .env 設定 CATEGORY_DOCUMENT_ID（到 Strapi 後台 Content Manager → Category 點進任一筆，網址或欄位可見 documentId），或開放 API Token 的 category find 權限。');
      process.exit(1);
    }
    const defaultCategory = DEFAULT_CATEGORY_SLUG
      ? categories.find((c) => c.slug === DEFAULT_CATEGORY_SLUG) || categories[0]
      : categories[0];
    categoryId = defaultCategory.documentId ?? defaultCategory.id;
    console.log(`使用分類: ${defaultCategory.name} (${defaultCategory.slug})\n`);
  } else if (categoryId) {
    console.log(`使用分類 documentId: ${categoryId}\n`);
  } else if (DRY) {
    console.log('--dry 模式，略過分類檢查。\n');
  }

  if (DRY) {
    console.log('--dry 模式，只預覽不寫入。共', urls.length, '個 URL\n');
  }

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    let tmpPath;
    try {
      const { html, finalUrl } = await fetchHtml(url);
      const title = getOgTitle(html);
      const description = getPageDescription(html);
      const ogImageUrl = getOgImageUrl(html, finalUrl);
      const source = deriveSourceFromUrl(finalUrl);

      if (!title || !description) {
        console.warn(`[${i + 1}/${urls.length}] 跳過（缺 title 或 description）: ${url}`);
        continue;
      }

      if (DRY) {
        console.log(`[${i + 1}/${urls.length}] ${title.slice(0, 50)}... | ${source} | ${ogImageUrl ? '有圖' : '無圖'}`);
        continue;
      }

      let imageId = null;
      if (ogImageUrl) {
        try {
          tmpPath = await downloadFile(ogImageUrl);
          imageId = await strapiUploadFile(tmpPath);
        } catch (uploadErr) {
          console.warn(`    封面圖上傳失敗（${uploadErr.message}），改為不帶圖建立`);
        }
        if (tmpPath && existsSync(tmpPath)) try { unlinkSync(tmpPath); } catch (_) {}
      }

      const payload = {
        title: title.slice(0, 255),
        description: description.slice(0, 2000) || '-',
        source,
        url: finalUrl,
        category: categoryId,
        ...(imageId && { image: imageId }),
        publishedAt: new Date().toISOString(),
      };
      await strapiCreateArticle(payload);
      console.log(`[${i + 1}/${urls.length}] 已建立: ${title.slice(0, 45)}...`);
    } catch (e) {
      console.warn(`[${i + 1}/${urls.length}] 失敗 ${url}: ${e.message}`);
    } finally {
      if (tmpPath && existsSync(tmpPath)) try { unlinkSync(tmpPath); } catch (_) {}
    }
  }

  console.log('\n完成。');
}

main().catch((e) => { console.error(e); process.exit(1); });
