const config = require('@rancher/shell/vue.config'); // eslint-disable-line @typescript-eslint/no-var-requires

const baseConfig = config(__dirname, {
  excludes: [],
  // excludes: ['fleet', 'example']
});

// custom element configuration for web components
baseConfig.chainWebpack = (config) => {
  config.module
    .rule('vue')
    .use('vue-loader')
    .tap(options => ({
      ...options,
      compilerOptions: {
        ...(options.compilerOptions || {}),
        isCustomElement: tag => tag === 'data-table' || tag === 'action-menu' || tag === 'iconify-icon'
      }
    }));
};

module.exports = baseConfig;
