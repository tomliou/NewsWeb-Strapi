/** 讓文章 API 回傳時自動帶上 category、image */
export default (_config: any, { strapi }: { strapi: any }) => {
  return async (ctx: any, next: () => Promise<void>) => {
    if (!ctx.query) ctx.query = {};
    ctx.query.populate = { category: true, image: true };
    await next();
  };
};
