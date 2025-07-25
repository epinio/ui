#!/bin/bash
set -e

# This is pretty much rancher/dashboard .github/workflows/scripts/build-dashboard.sh. Ideally this should come with the app creator

RANCHER_ENV=epinio
EXCLUDES_PKG=rancher-components,harvester
EXCLUDE_OPERATOR_PKG=true
OUTPUT_DIR=dist
RELEASE_DIR=release
ARTIFACT_NAME=rancher-dashboard-epinio-standalone
NODE_OPTIONS="--max-old-space-size=4096"
LOGIN_LOCALE_SELECTOR=false


echo "GITHUB_SHA: $GITHUB_SHA"
echo "GITHUB_REF_NAME: $GITHUB_REF_NAME"
echo "ROUTER_BASE: $ROUTER_BASE"
echo
echo "RANCHER_ENV: $RANCHER_ENV"
echo "EXCLUDES_PKG: $EXCLUDES_PKG"
echo "EXCLUDE_OPERATOR_PKG: $EXCLUDE_OPERATOR_PKG"
echo
echo "RELEASE_DIR: $RELEASE_DIR"
RELEASE_LOCATION="$RELEASE_DIR/$ARTIFACT_NAME"
echo "RELEASE_LOCATION: $RELEASE_LOCATION"
echo
echo "ARTIFACT_NAME: $ARTIFACT_NAME"
ARTIFACT_LOCATION="$OUTPUT_DIR/$ARTIFACT_NAME"
echo "ARTIFACT_LOCATION: $ARTIFACT_LOCATION"
echo
echo "OUTPUT_DIR: $OUTPUT_DIR"
echo
echo "RESOURCE_BASE: $RESOURCE_BASE"
echo "API: $API"
echo
echo "LOGIN_LOCALE_SELECTOR: $LOGIN_LOCALE_SELECTOR"

cd dashboard

echo Creating release directory
mkdir $RELEASE_DIR

echo Installing dependencies
yarn install --immutable --immutable-cache --check-cache

echo Building
COMMIT=$GITHUB_SHA VERSION=$GITHUB_REF_NAME OUTPUT_DIR="$ARTIFACT_LOCATION" ROUTER_BASE="$ROUTER_BASE" RANCHER_ENV=$RANCHER_ENV API=$API RESOURCE_BASE=$RESOURCE_BASE EXCLUDES_PKG=$EXCLUDES_PKG yarn run build

echo Creating tar
tar -czf $RELEASE_LOCATION.tar.gz -C $ARTIFACT_LOCATION .

echo Creating sha
sha512sum $RELEASE_LOCATION.tar.gz > $RELEASE_LOCATION.tar.gz.sha512sum
