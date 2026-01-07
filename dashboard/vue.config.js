// Set API environment variable to point to backend on port 8000 if not already set
// Force HTTP (not HTTPS) since backend runs on HTTP port 8000
if (!process.env.API && !process.env.RANCHER_ENV) {
  process.env.API = 'http://localhost:8000';
} else if (process.env.API && process.env.API.includes('localhost:8000') && process.env.API.startsWith('https://')) {
  // Fix if user set API=https://localhost:8000 - backend is HTTP, not HTTPS
  process.env.API = process.env.API.replace('https://', 'http://');
}

const config = require('@rancher/shell/vue.config'); // eslint-disable-line @typescript-eslint/no-var-requires

module.exports = config(__dirname, {
  excludes: [],
  // excludes: ['fleet', 'example']
});
