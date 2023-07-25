#!/usr/bin/env bash

# Build back-end Jetstream

# Use tmp folder as our GOPATH for the build

DEV=${STRATOS_BACKEND_DEV:-false}
ACTION=${1:-build}
NO_DEP=${STRATOS_USE_VENDOR_AS_IS:-false}
VERSION=${stratos_version:-dev}

set -euo pipefail

# Script folder
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null && pwd )"
STRATOS="`cd "${DIR}/..";pwd`"

echo DIR: $DIR
echo STRATOS: $STRATOS

pushd "${STRATOS}" > /dev/null

# Determine the build version from the package file if not already set
if [ "${VERSION}" == "dev" ]; then
  PACKAGE_VERSION=$(cat package.json | grep "version")
  REGEX="\"version\": \"([0-9\.]*)\""
  if [[ $PACKAGE_VERSION =~ $REGEX ]]; then
    VERSION=${BASH_REMATCH[1]}
  fi
fi

# Build backend or run tests
pushd "${STRATOS}/src/jetstream" > /dev/null

# Show go env
go env

if [ "${ACTION}" == "build" ]; then
  echo "Building backend ..."
  echo "Building version: ${VERSION}"
  go build -ldflags -X=main.appVersion=${VERSION}
  echo "Build complete ..."
else
  echo "Running backend tests ..."
  go test ./... -v -count=1 -coverprofile=coverage.txt -covermode=atomic
fi

popd > /dev/null

popd > /dev/null
