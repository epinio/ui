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


