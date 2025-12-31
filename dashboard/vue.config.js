const config = require('@rancher/shell/vue.config'); // eslint-disable-line @typescript-eslint/no-var-requires

const baseConfig = config(__dirname, {
  excludes: [],
  // excludes: ['fleet', 'example']
});

// Add proxy configuration for backend API
if (baseConfig.devServer) {
  baseConfig.devServer.proxy = {
    '/epinio': {
      target: process.env.API || 'http://localhost:8000',
      changeOrigin: true,
      secure: false,
      ws: true
    }
  };
} else {
  baseConfig.devServer = {
    proxy: {
      '/epinio': {
        target: process.env.API || 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
        ws: true
      }
    }
  };
}

module.exports = baseConfig;
