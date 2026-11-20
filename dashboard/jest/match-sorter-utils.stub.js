// @tanstack/match-sorter-utils is ESM-only and is only reached through vue-query's
// devtools plugin, which the dashboard never installs. Stub it so jest can load vue-query.
module.exports = { rankItem: () => ({ passed: false }) };
