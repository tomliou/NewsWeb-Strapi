import { factories } from '@strapi/core';

/** 從 HTML 抓取 meta content，支援 property 或 name 在前/在後 */
function getMetaContent(html: string, propertyOrName: string): string | null {
  const escaped = propertyOrName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']*)["']`,
    'i'
  );
  const re2 = new RegExp(
    `<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${escaped}["']`,
    'i'
  );
  const value = html.match(re)?.[1] ?? html.match(re2)?.[1] ?? null;
  return value != null ? value.trim() || null : null;
}

/** 從給定的頁面 URL 抓取 og:image 並回傳圖片 URL（不存進 Strapi） */
function getOgImageUrlFromHtml(html: string, pageUrl: string): string | null {
  let ogImage = getMetaContent(html, 'og:image');
  if (!ogImage) return null;
  if (ogImage.startsWith('//')) ogImage = 'https:' + ogImage;
  if (ogImage.startsWith('/')) {
    try {
      const u = new URL(pageUrl);
      ogImage = u.origin + ogImage;
    } catch (_) {
      return null;
    }
  }
  return ogImage;
}

/** 從 HTML 抓取 page description：優先 og:description，其次 meta name="description" */
function getPageDescriptionFromHtml(html: string): string | null {
  return getMetaContent(html, 'og:description') ?? getMetaContent(html, 'description');
}

export default factories.createCoreController('api::article.article', ({ strapi }) => {
  const { find, findOne } = strapi.controller('api::article.article');

  return {
    // 覆寫 find，自動帶 category 和 image
    async find(ctx: any) {
      ctx.query = { ...ctx.query, populate: { category: true, image: true } };
      return find(ctx);
    },

    // 覆寫 findOne，自動帶 category 和 image
    async findOne(ctx: any) {
      ctx.query = { ...ctx.query, populate: { category: true, image: true } };
      return findOne(ctx);
    },

    async getOgFromUrl(ctx: any) {
    const url = ctx.query?.url;
    if (!url || typeof url !== 'string') {
      return ctx.badRequest('請提供 query 參數 url');
    }
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch (_) {
      return ctx.badRequest('無效的 URL');
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return ctx.badRequest('僅支援 http/https');
    }
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NewsWeb-OGImage/1.0)' },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) {
        return ctx.badRequest(`無法取得頁面: HTTP ${res.status}`);
      }
      const html = await res.text();
      const ogImage = getOgImageUrlFromHtml(html, url);
      const description = getPageDescriptionFromHtml(html);
      if (!ogImage && !description) {
        return ctx.notFound('該頁面沒有 og:image 或 description');
      }
      return { data: { ogImage: ogImage ?? undefined, description: description ?? undefined } };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return ctx.badRequest(`讀取 URL 失敗: ${msg}`);
    }
  },
}});
