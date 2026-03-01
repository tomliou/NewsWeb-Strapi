'use strict';

module.exports = (strapi) => {
  const { createCoreRouter } = require('@strapi/core').factories;
  return createCoreRouter('api::article.article');
};
