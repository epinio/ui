This is the Rancher Application Shell (created via https://rancher.github.io/dashboard/extensions/extensions-getting-started#creating-the-application)

The Epinio UI is an extension of Rancher and can be in `pkg/epinio`. This one extension powers both embedded and standalone forms of the UI. For more information see root README.


## Getting Started - Run in Standalone Mode

### UI Backend
Run the UI backend as per https://github.com/epinio/ui-backend#development

### UI Frontend

#### Dependencies
Node 16.15.0 or lower, `yarn`

#### Run
1) ** Setup the Rancher Dashboard repo
   - Clone https://github.com/rancher/dashboard and checkout `epinio-dev`
   - Run `cd shell`
   - Run `yarn link`
2) Clone https://github.com/epinio/ui and checkout `main`
3) Run `cd dashboard`
3) ** Run `yarn link @rancher/shell`
5) Run `yarn install`
5) Run `EXCLUDES_PKG=harvester,rancher-components EXCLUDE_OPERATOR_PKG=true RANCHER_ENV=epinio API=https://localhost:5443 yarn dev`

> ** Denotes steps only required until https://github.com/epinio/ui/issues/204 and a new `shell` package created

## Getting Started - Run in embedded Mode
Update to follow