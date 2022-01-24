# Developer Guide

The Epinio UI is currently served via the [Rancher Dashboard](https://github.com/rancher/dashboard) where both the code lives and the build occurs.


## Code

The 'master' branch for the Epinio UI is [epinio-dev](https://github.com/rancher/dashboard/tree/epinio-dev). Epinio specific code can be found in [products/epinio](https://github.com/rancher/dashboard/tree/epinio-dev/products/epinio).


## Developing the UI

As the code lives alongside the Dashboard follow it's guide to run in dev world.

> You will still need an instance of Rancher and the Epinio hosting cluster needs to be added/imported to it.

> Follow the Epinio docs or [this guide](install-epinio.md) to install an Epinio instance locally

## Build/Release

Whilst the Epinio UI code lives in the `rancher/dashboard` repo builds are created via the same Dashboard build process and are triggered on..

- Merging code to the `epinio-dev` branch (output served at `https://releases.rancher.com/dashboard/epinio-dev`)
- Tagging one of the epinio branches (output available via `https://releases.rancher.com/dashboard/<tag name>`)

## Install the UI

See root [README](https://github.com/epinio/ui).
