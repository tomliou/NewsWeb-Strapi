import { factories } from '@strapi/core';

export default factories.createCoreRouter('api::category.category', {
  config: {
    find: { auth: false },
    findOne: { auth: false },
  },
});
