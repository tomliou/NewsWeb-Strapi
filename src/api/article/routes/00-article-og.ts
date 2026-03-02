/** 自訂路由：從 URL 抓取 og:image 與 page description */
export default {
  routes: [
    {
      method: 'GET',
      path: '/articles/og-from-url',
      handler: 'api::article.article.getOgFromUrl',
      config: {
        auth: false,
      },
    },
  ],
};
