/**
 * 預設 populate category（與 image），讓 GET /api/articles 與 GET /api/articles/:id 回傳時
 * 每筆都帶 category，前端可直接用於分類篩選與顯示。
 * 若 request 已有 populate 參數則不覆寫。
 */
export default (_config: unknown) => {
  return async (ctx: { query?: { populate?: unknown }; [k: string]: unknown }, next: () => Promise<void>) => {
    if (ctx.query?.populate == null || (Array.isArray(ctx.query.populate) && ctx.query.populate.length === 0)) {
      ctx.query = ctx.query ?? {};
      ctx.query.populate = ['category', 'image'];
    }
    await next();
  };
};
