const config = require("@rancher/shell/vue.config"); // eslint-disable-line @typescript-eslint/no-var-requires
const fs = require("fs");

const baseConfig = config(__dirname, {
  excludes: [],
});

const packageJson = fs.readFileSync("./package.json");
const version = JSON.parse(packageJson).version;

module.exports = {
  ...baseConfig,
  chainWebpack: (config) => {
    config.plugin("define").tap((args) => {
      args[0]["process.env"].UI_VERSION = JSON.stringify(version);
      return args;
    });
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