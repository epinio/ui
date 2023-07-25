#!/usr/bin/env bash

set -euo pipefail

# the user is set to avoid permission issue during the creation of the 'dist' folder.
# It has to be also into the docker group or it won't be able to use /var/run/docker.sock.
docker run \
    -v /var/run/docker.sock:/var/run/docker.sock \
    -v $HOME/.docker/config.json:/root/.docker/config.json \
    -v $(pwd):/go/src/ui-backend \
    -w /go/src/ui-backend \
    -e CGO_ENABLED=1 \
    -e UI_BUNDLE_URL=$UI_BUNDLE_URL \
    -e GITHUB_TOKEN=$GITHUB_TOKEN \
    -e ACTIONS_ID_TOKEN_REQUEST_URL=$ACTIONS_ID_TOKEN_REQUEST_URL \
    -e ACTIONS_ID_TOKEN_REQUEST_TOKEN=$ACTIONS_ID_TOKEN_REQUEST_TOKEN \
    goreleaser/goreleaser-cross:v1.20.0 $@
