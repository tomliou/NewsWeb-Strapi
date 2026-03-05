/** 讓文章 API 回傳時自動帶上 category、image */
export default () => async (ctx: any, next: () => Promise<void>) => {
  if (!ctx.query) ctx.query = {};
  ctx.query.populate = { category: true, image: true };
  await next();
};
