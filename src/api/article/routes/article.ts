import { factories } from '@strapi/core';

export default factories.createCoreRouter('api::article.article', {
  config: {
    find: { auth: false },
    findOne: { auth: false },
  },
});
