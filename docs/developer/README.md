# Developer Guide

The Epinio UI is currently served via the [Rancher Dashboard](https://github.com/rancher/dashboard) where both the code lives and the build occurs.


## Code

The 'master' branch for the Epinio UI is [epinio-dev](https://github.com/rancher/dashboard/tree/epinio-dev). Epinio specific code can be found in [pkg/epinio](https://github.com/rancher/dashboard/tree/epinio-dev/pkg/epinio).


## Developing the UI

### Built-in / Embedded

> You will still need an instance of Rancher and the Epinio hosting cluster needs to be added/imported to it.

> Follow the Epinio docs or [this guide](install-epinio.md) to install an Epinio instance locally

Code can be found in `rancher/dashboard` `epinio-dev`

Run the dashboard as per instructions in `rancher/dashboard`

### Standalone

You will need to run the `rancher/dashboard` from the `epinio-dev`branch and the epinio ui backend.

Follow instructions over at https://github.com/epinio/ui-backend/ (needs updating)

Alterantively follow instructions at https://github.com/epinio/ui/blob/dev/docs/developer/install-latest-standalone-ui.md

## Release Epinio UI

### Built-in / Embedded

While the Epinio UI code lives in the `rancher/dashboard` repo builds are created via the same Dashboard build process and are triggered on..
- Merging code to the `epinio-dev` branch (output served at `https://releases.rancher.com/dashboard/epinio-dev`)
- Tagging one of the epinio branches (output available via `https://releases.rancher.com/dashboard/<tag name>`)

The outputted build (`epinio-dev` or `<tag>`) can then be used in the `ui-dashboard-index` value as described in the root [README](https://github.com/epinio/ui)

So to make a release simply tag with something like `epinio-v0.6.1-0.0.1`.

### Standalone

#### Build the Frontend (UI)
1. Create a build of the frontend files by a pushing a tag to `rancher/dashboard`.
  - It must start with `epinio-standalone-v`, for example `epinio-standalone-v0.6.1.0.0.1`
  - A custom github action (https://github.com/rancher/dashboard/actions/workflows/release-rancher-epinio-standalone.yml) will create a build and upload the bits to a new release (https://github.com/rancher/dashboard/releases)

#### Build the Backend
1. In `epinio/ui-backend` update the reference to the frontend files created from the frontend build above
   - the reference to the frontend files will be the `tar.gz` output by the tag's build at https://github.com/rancher/dashboard/releases. This can be found on the `rancher/dashboard` releases page. An example of the reference is
     ```
     https://github.com/rancher/dashboard/archive/refs/tags/epinio-standalone-v0.7.1-0.0.1.tar.gz
     ``` 
   - The file in `epinio/ui-backend` to update is `github/workflows/release.yml` and the value that needs to be set is `env.UI_BUNDLE_URL`

2. Create a build of the backend by pushing a tag to `epinio/ui-backend`) 
  - It must start with `v`, for example `v0.6.1`.
  - A github action will be kicked off which will build a container for the ui (output at https://github.com/epinio/ui-backend/pkgs/container/epinio-ui)

#### Update the Charts
In `epinio/helm-charts` a new PR should be automatically created when the new container from above is created (title prefixed with something like `[updatecli] Bump epinio ui version`). The PR will update charts that reference this container, specifically the epinio all in one chart. However also make the additional changes, so use that PRs branch as a basis and create a new PR with the following changes.
1. Update `/blob/main/chart/epinio-ui/values.yaml` `epinioVersion` to be something like `v0.6.1`
2. Update `/chart/epinio-ui/Chart.yaml` `appVersion` to be the same as `epinioVersion`
3. Get the PR approved and merged

Once that's merged the standalone UI is available in chart form.


## Install the UI (without running it locally)

See root [README](https://github.com/epinio/ui).

