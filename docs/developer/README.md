# Developer Guide

The Epinio UI is currently served via the [Rancher Dashboard](https://github.com/rancher/dashboard) where both the code lives and the build occurs.


## Code

The 'master' branch for the Epinio UI is [epinio-dev](https://github.com/rancher/dashboard/tree/epinio-dev). Epinio specific code can be found in [products/epinio](https://github.com/rancher/dashboard/tree/epinio-dev/products/epinio).


## Developing the UI

As the code lives alongside the Dashboard follow it's guide to run in dev world.

> You will still need an instance of Rancher and the Epinio hosting cluster needs to be added/imported to it.

> Follow the Epinio docs or [this guide](install-epinio.md) to install an Epinio instance locally

## Build/Release

### Built-in / Embedded

Whilst the Epinio UI code lives in the `rancher/dashboard` repo builds are created via the same Dashboard build process and are triggered on..

- Merging code to the `epinio-dev` branch (output served at `https://releases.rancher.com/dashboard/epinio-dev`)
- Tagging one of the epinio branches (output available via `https://releases.rancher.com/dashboard/<tag name>`)

The outputted build (`epinio-dev` or `<tag>`) can then be used in the `ui-dashboard-index` value as described in the root [README](https://github.com/epinio/ui)

### Standalone

#### Build the Frontend (UI)
1. Create a build of the frontend files by the process above, tag it with something like `epinio-standalone-v0.6.1`

#### Build the Backend
1. In `epinio/ui-backend` update the reference to the frontent files to the one from above
   - `github/workflows/release.yml` env.UI_BUNDLE_URL . For example
      ```
      https://github.com/rancher/dashboard/releases/download/epinio-standalone-v0.6.1/rancher-dashboard-epinio-standalone-embed.tar.gz
      ```
2. Create a build of the backend which contains the updated frontend, tag with with something like `v0.6.1`. A github action will be kicked off which will build a ui container (https://github.com/epinio/ui-backend/pkgs/container/epinio-ui)

#### Update the Charts
1. In `epinio/charts` a new PR should be automatically created when the new container from above is created. The PR will update charts that reference this container, specifically the epinio one chart. Once that's merged the standalone UI is available as part of those charts.


## Install the UI (without running it locally)

See root [README](https://github.com/epinio/ui).

