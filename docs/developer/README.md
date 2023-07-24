# Developer Guide

The Epinio UI is currently served via the [Rancher Dashboard](https://github.com/rancher/dashboard) where both the code lives and the build occurs.

## Developing the UI

### Running the UI
#### Built-in / Embedded

> You will still need an instance of Rancher and the Epinio hosting cluster needs to be added/imported to it.

> Follow the Epinio docs or [this guide](install-epinio.md) to install an Epinio instance locally

##### Developer Flow
1. Build and serve the epinio extension
   - `cd dashboard`
   - `yarn build-pkg epinio`
   - `yarn serve-pkgs`
2. Install the dev epinio extension in Rancher
   - Nav to burger menu --> `Extensions`
   - Click three dot menu top right --> `Developer Load`
      - If this is not visible, go to user avatar top right --> Preferences. Check the `Advanced Features` / `Enable Extension developer features` option
   - Extension URL: Copy & Paste the value output when running `yarn serve-pkgs` above
   - Extension module name: This should auto populate after entering the url
   - Check the `Persist extension by creating custom resource` option (otherwise after each page refresh you'll need to load the extension)

##### Production Flow
> This isn't supported yet, but to use the pending bits...
1. Create the pending epinio extension repo
   - In Rancher nav to the `local` cluster --> `Apps` / `Repositories` --> `Create`
   - Enter Name: `epinio`, Index URL: `https://epinio.github.io/ui`, click `Create`
2. Install the pending epinio extension in Rancher
   - Nav to burger menu --> `Extensions` --> `Available` tab
   - Find `Epinio` and click `Install`

#### Standalone

You will need to run the `epinio/ui` `dashboard` and the epinio ui backend.

See instructions [here](../../dashboard/README.md).

### Best Practises

In order to assist Epinio UI end-to-end tests we should ensure that it's easy to locate html elements. The best way is via the `data-testid` attribute. In some places this is automatically provided via Dashboard components. We should ensure new, custom epinio components also have a way use this attribute.

## Release Epinio UI

### Built-in / Embedded

Any merge to `main` will kick off a build of the epinio extension with a version matching that from `dashboard/pkg/epinio/package.json. If there is an existing release with the same name it will overwrite it.

### Standalone

> The below instructions are obsolete and will be updated as part of https://github.com/epinio/ui/issues/248

#### Tag the Frontend (UI)
1. Push a tag for the release to `epinio/ui`
   - It should be from the `main` branch
   - It should be in the same standard format used through out this process, for example `v0.6.1-0.0.1`
   - The tag won't kick anything off. It's used to mark the ui files used in the associated build. This should eventually be automated as part of the backend build job

#### Build the Frontend, Backend and image
1. Create the builds by pushing a tag to `epinio/ui-backend`)
   - It must start with `v`, for example `v0.6.1-0.0.1`.
   - A github [action](https://github.com/epinio/ui-backend/actions) will be kicked off which will..
     - Fetch and build the ui frontend with the same tag
     - Build the ui backend
     - Build a container containing both ui front and backend (output at https://github.com/epinio/ui-backend/pkgs/container/epinio-ui)


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


## Install the UI (without running it locally)

See root [README](https://github.com/epinio/ui).

