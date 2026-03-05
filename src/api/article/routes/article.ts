import { factories } from '@strapi/core';

export default factories.createCoreRouter('api::article.article', {
  config: {
    find: {
      auth: false,
      middlewares: ['api::article.default-populate'],
    },
    findOne: {
      auth: false,
      middlewares: ['api::article.default-populate'],
    },
  },
});
