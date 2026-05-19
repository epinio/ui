const config = require("@rancher/shell/vue.config"); // eslint-disable-line @typescript-eslint/no-var-requires

const baseConfig = config(__dirname, {
  excludes: [],
});

module.exports = {
  ...baseConfig,
  chainWebpack: (config) => {
    config.module
      .rule("vue")
      .use("vue-loader")
      .tap((options) => ({
        ...options,
        compilerOptions: {
          ...(options.compilerOptions || {}),
          isCustomElement: (tag) => tag.startsWith("trailhand-"),
        },
      }));

    config.resolve.alias.set(
      '@codemirror/state',
      require.resolve('@codemirror/state')
    );
  },
};