import type { Core } from '@strapi/strapi';

const CATEGORIES = [
  { name: '科技', slug: 'tech', sourceLabel: 'yahoo 科技新聞' },
  { name: '財經', slug: 'finance', sourceLabel: '東森新聞雲 財經新聞' },
  { name: '社會', slug: 'social', sourceLabel: 'Google 社會新聞' },
  { name: '討論', slug: 'discussion', sourceLabel: 'Dcard 討論新聞' },
] as const;

const SAMPLE_ARTICLES: Array<{
  title: string;
  description: string;
  source: string;
  url: string;
  categorySlug: (typeof CATEGORIES)[number]['slug'];
}> = [
  {
    title: 'AI 新突破：語言模型可即時翻譯 100 種語言',
    description: '研究團隊發表最新多語言模型，支援即時語音與文字翻譯，準確率較前代提升 20%，預計將改變跨國溝通方式。',
    source: 'yahoo 科技新聞',
    url: 'https://example.com/tech-1',
    categorySlug: 'tech',
  },
  {
    title: '電動車電池技術革新，續航力突破 1000 公里',
    description: '固態電池量產在即，多家車廠宣布新車型將搭載下一代電池，單次充電續航可達 1000 公里以上。',
    source: 'yahoo 科技新聞',
    url: 'https://example.com/tech-2',
    categorySlug: 'tech',
  },
  {
    title: '央行宣布利率維持不變，市場反應平穩',
    description: '央行今日召開理監事會議，決議政策利率維持不變，符合市場預期。分析師指出下半年仍有降息空間。',
    source: '東森新聞雲 財經新聞',
    url: 'https://example.com/finance-1',
    categorySlug: 'finance',
  },
  {
    title: '台股站穩兩萬點，外資連五買',
    description: '加權指數今日收盤站穩兩萬點關卡，外資連續五個交易日買超，法人看好資金行情延續。',
    source: '東森新聞雲 財經新聞',
    url: 'https://example.com/finance-2',
    categorySlug: 'finance',
  },
  {
    title: '全台多處大雨特報，山區慎防坍方',
    description: '氣象署發布大雨特報，北部、東北部及山區有局部大雨機率，民眾外出請攜帶雨具，山區注意坍方落石。',
    source: 'Google 社會新聞',
    url: 'https://example.com/social-1',
    categorySlug: 'social',
  },
  {
    title: '社區共讀站啟用，居民踴躍參與',
    description: '地方圖書館與社區合作設置共讀站，提供親子閱讀與自修空間，開幕首日即吸引不少家庭前往。',
    source: 'Google 社會新聞',
    url: 'https://example.com/social-2',
    categorySlug: 'social',
  },
  {
    title: '網友熱議：遠距工作是否該納入勞基法',
    description: 'Dcard 職場版發起討論，多數網友支持遠距工作權益法制化，也有聲音認為彈性與保障之間需取得平衡。',
    source: 'Dcard 討論新聞',
    url: 'https://example.com/discussion-1',
    categorySlug: 'discussion',
  },
  {
    title: '開箱文爆紅：平價耳機 CP 值引發討論',
    description: '網友分享某款平價耳機開箱心得，音質與降噪表現獲好評，貼文引發大量留言與購買連結分享。',
    source: 'Dcard 討論新聞',
    url: 'https://example.com/discussion-2',
    categorySlug: 'discussion',
  },
];

export default {
  register(/* { strapi }: { strapi: Core.Strapi } */) {},

  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    const docService = strapi.documents('api::category.category');
    const articleService = strapi.documents('api::article.article');

    // 1. 確保四個 Category 存在，並取得 documentId
    const categoryMap: Record<string, string> = {};
    for (const cat of CATEGORIES) {
      const existing = await docService.findMany({
        filters: { slug: cat.slug },
        limit: 1,
      });
      if (existing && existing.length > 0) {
        categoryMap[cat.slug] = (existing[0] as { documentId: string }).documentId;
      } else {
        const created = await docService.create({
          data: {
            name: cat.name,
            slug: cat.slug,
            sourceLabel: cat.sourceLabel,
          },
        });
        categoryMap[cat.slug] = (created as { documentId: string }).documentId;
      }
    }

    // 2. 若沒有任何 Article，則建立範例文章（避免重複種子）
    const existingArticles = await articleService.findMany({ limit: 1 });
    if (existingArticles && existingArticles.length === 0) {
      const publishedAt = new Date().toISOString();
      for (const art of SAMPLE_ARTICLES) {
        const categoryDocumentId = categoryMap[art.categorySlug];
        if (!categoryDocumentId) continue;
        await articleService.create({
          data: {
            title: art.title,
            description: art.description,
            source: art.source,
            url: art.url,
            category: categoryDocumentId,
            publishedAt,
          },
        });
      }
    }
  },
};
