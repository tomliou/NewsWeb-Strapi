/**
 * 單次用：把指定文章的 category 改為指定 documentId。
 * 使用：STRAPI_URL=... STRAPI_API_TOKEN=... node update-article-category.js <articleDocumentId> <categoryDocumentId>
 */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..', '..');
const envPath = join(projectRoot, '.env');
if (existsSync(envPath)) {
  readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
  });
}
const STRAPI_URL = (process.env.STRAPI_URL || 'http://localhost:1337').replace(/\/$/, '');
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN;
const [articleDocId, categoryDocId] = process.argv.slice(2);
if (!articleDocId || !categoryDocId || !STRAPI_API_TOKEN) {
  console.error('Usage: STRAPI_URL=... STRAPI_API_TOKEN=... node update-article-category.js <articleDocumentId> <categoryDocumentId>');
  process.exit(1);
}
const res = await fetch(`${STRAPI_URL}/api/articles/${articleDocId}`, {
  method: 'PUT',
  headers: { Authorization: `Bearer ${STRAPI_API_TOKEN}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ data: { category: categoryDocId } }),
});
const data = await res.json();
if (!res.ok) {
  console.error(data);
  process.exit(1);
}
console.log('OK:', data?.data?.title || data);
