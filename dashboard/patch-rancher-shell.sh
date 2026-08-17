#!/bin/bash

# This patch script is meant to prevent Rancher Shell from looking for schemas
# that are not yet available in the standalone application mode. Since these
# are the only issues with Rancher Shell and Epinio Standalone this script
# suffices.

# Grab node command for usage after patch
context=$1

# Currently Rancher Shell looks for schemas that have yet to be loaded, we replace
# the logic safely as we can assume a few things.
#
# 1. During the setup process the user has already completed the first login.
# 2. Epinio does not require the banner as there is not one in the application.
# 3. Epinio does not require custom errors as of now.
file_path='./node_modules/@rancher/shell/store/auth.js'

old_string="scopes = \[joinStringList(scopes\[0\], opt.scopes)\];"
new_string="scopes = opt.scopes;"

sed -i "s|$old_string|$new_string|g" "$file_path"

file_path='./node_modules/@rancher/shell/pages/auth/login.vue'

old_string="const { value } = await this.\$store.dispatch('management/find', { type: MANAGEMENT.SETTING, id: SETTING.BANNERS });"
new_string=""

sed -i "s|$old_string|$new_string|g" "$file_path"

old_string='this.customLoginError = JSON.parse(value).loginError;'
new_string=''

sed -i "s|$old_string|$new_string|g" "$file_path"

old_string="this.firstLogin = firstLoginSetting?.value === 'true';"
new_string='this.firstLogin = false;'

sed -i "s|$old_string|$new_string|g" "$file_path"

file_path='./node_modules/@rancher/shell/plugins/plugin.js'

old_string="let loadPlugins = true;"
new_string="let loadPlugins = false;"

sed -i "s|$old_string|$new_string|g" "$file_path"

file_path='./node_modules/@rancher/shell/config/uiplugins.js'

start="/let parsedVersion = semver\.coerce/"
end="/return parsedVersion;/"
replacement='  return "2.13.2";'

# GNU sed
sed -i "${start},${end}c\\
${replacement}
" "$file_path"


# Patch NamespaceFilter.vue so the navbar namespace dropdown supports
# server-side search for products that set customNamespaceFilter (Epinio).
# Rancher shell only filters the namespace list client-side and never forwards
# the typed query to the product's namespaceFilterOptions getter. This adds a
# `filter` watcher that dispatches the store's searchNamespaces action and
# passes the live filter + current selection into the getter. Idempotent.
# TODO: drop once upstream shell forwards the filter into the getter.
node <<'NODE'
const fs = require('fs');
const p = './node_modules/@rancher/shell/components/nav/NamespaceFilter.vue';

let s = fs.readFileSync(p, 'utf8');

const call1 = `          divider,
          notFilterNamespaces
        });`;
const call1New = `          divider,
          notFilterNamespaces,
          filter:   this.filter,
          selected: this.value
        });`;

if (!s.includes('filter:   this.filter')) {
  if (!s.includes(call1)) {
    throw new Error('NamespaceFilter patch: getter-call anchor not found');
  }
  s = s.replace(call1, call1New);
}

const watch2 = `  watch: {
    value(neu) {`;
const watch2New = `  watch: {
    filter(q) {
      if (this.currentProduct?.customNamespaceFilter && this.currentProduct?.inStore) {
        this.$store.dispatch(\`\${ this.currentProduct.inStore }/searchNamespaces\`, q);
      }
    },

    value(neu) {`;

if (!s.includes('/searchNamespaces`, q)')) {
  if (!s.includes(watch2)) {
    throw new Error('NamespaceFilter patch: watch-block anchor not found');
  }
  s = s.replace(watch2, watch2New);
}

fs.writeFileSync(p, s);
console.log('Patched NamespaceFilter.vue for server-side namespace search');
NODE

# Patch default.vue so the Epinio product renders our own EpinioDock (backed by
# the trailhand-ui dock component) instead of Rancher Shell's WindowManager.
# Other products keep WindowManager unchanged. Idempotent.
node <<'NODE'
const fs = require('fs');
const p = './node_modules/@rancher/shell/components/templates/default.vue';

let s = fs.readFileSync(p, 'utf8');

const importAnchor = `import WindowManager from '@shell/components/nav/WindowManager';`;
const importNew = `import WindowManager from '@shell/components/nav/WindowManager';
import EpinioDock from '../../../../../pkg/epinio/components/EpinioDock.vue';`;

if (!s.includes('EpinioDock')) {
  if (!s.includes(importAnchor)) {
    throw new Error('default.vue patch: import anchor not found');
  }
  s = s.replace(importAnchor, importNew);

  const componentsAnchor = `    WindowManager,
    FixedBanner,`;
  const componentsNew = `    WindowManager,
    EpinioDock,
    FixedBanner,`;

  if (!s.includes(componentsAnchor)) {
    throw new Error('default.vue patch: components anchor not found');
  }
  s = s.replace(componentsAnchor, componentsNew);

  const templateAnchor = `        <WindowManager @draggable="draggable=$event" />`;
  const templateNew = `        <EpinioDock v-if="currentProduct?.name === 'epinio'" />
        <WindowManager v-else @draggable="draggable=$event" />`;

  if (!s.includes(templateAnchor)) {
    throw new Error('default.vue patch: template anchor not found');
  }
  s = s.replace(templateAnchor, templateNew);

  fs.writeFileSync(p, s);
  console.log('Patched default.vue to render EpinioDock for the Epinio product');
}
NODE


# Run the yarn command the user was expecting to run.
if [ "$context" == "dev" ]; then
  NODE_ENV=dev ./node_modules/.bin/vue-cli-service serve
fi

if [ "$context" == "build" ]; then
  ./node_modules/.bin/vue-cli-service build
fi

if [ "$context" == "build-pkg" ]; then
  ./node_modules/@rancher/shell/scripts/build-pkg.sh epinio
fi

if [ "$context" == "serve-pkgs" ]; then
  ./node_modules/@rancher/shell/scripts/serve-pkgs $@
fi


