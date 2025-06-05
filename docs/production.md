# Developer Guide

## Release Epinio UI

### Built-in / Embedded

Any merge to `main` that changes `dashboard/pkg/epinio/package.json` will kick off a build of the epinio extension with a version matching that from `dashboard/pkg/epinio/package.json`. If there is an existing release with the same name it will overwrite it. This is done via the `Build and Release Extension` gh action. Builds won't be available until the `pages-build-deployment` gh action completes as well.

### Standalone

#### Build the Frontend, Backend and image
1. Create the builds by pushing a tag to `epinio/ui`)
   - It must start with `v`, for example `v0.6.1-0.0.1`.
   - A github [action](https://github.com/epinio/ui/backend/actions) will be kicked off which will..
     - Build the ui frontend
     - Build the ui backend
     - Build a container containing both ui front and backend (output at https://github.com/epinio/ui/backend/pkgs/container/epinio-ui)


#### Update the Charts

These steps will get the image that was just built into the epinio-ui chart, and then those changes into the epinio chart

- Semi-Automated Step - Update epinio-ui helm chart image and versions

   https://github.com/epinio/helm-charts `.github/workflows/updatecli.yml` will, given triggers, run with config from `updatecli/updatecli.d/epinio-ui.yaml`. This will create a PR containing a bump to the epinio-ui chart's image to reference the one just built along with a bump to the chart's versions.

   For example https://github.com/epinio/helm-charts/pull/352.

   The manual step is to review and merge the PR

- Manual Step - Publish epinio-ui helm chart

   The new epinio-ui chart needs to be published to the public epinio repo (https://epinio.github.io/helm-charts). 

   The manual step is to triggering the `release` (?) action in the `helm-chart` repo

- Semi-Automated Step - Build epinio-ui helm chart tgx

   The `.github/workflows/updatecli.yml` job should run again and create another PR containing the new `tgz` and reference it from the root epinio chart. 

   For example https://github.com/epinio/helm-charts/pull/354

   The manual step is to review and merge the PR

## Install the Rancher Extension Flow
1. Create the Rancher Helm Repo for the Epinio UI Extension
   - In Rancher nav to the `local` cluster --> `Apps` / `Repositories` --> `Create`
   - Enter Name: `epinio`, Index URL: `https://epinio.github.io/ui`, click `Create`
2. Install the Epinio UI Extension in Rancher
   - Nav to burger menu --> `Extensions` --> `Available` tab
   - Find `Epinio` and click `Install`
   - Note - If there is a newer version of the UI Extension it can be upgraded to from this page
