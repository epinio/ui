This is the Rancher Application Shell (created via https://rancher.github.io/dashboard/extensions/extensions-getting-started#creating-the-application)

The Epinio UI is an extension of Rancher and can be in `pkg/epinio`. This one extension powers both embedded and standalone forms of the UI. For more information see root README.


## Getting Started - Run in Standalone Mode

### UI Backend
Run the UI backend as per https://github.com/epinio/ui-backend#development

### UI Frontend

#### Dependencies
Node 16.15.0 or lower, `yarn`

#### Run
1) UI Dev Only Step - Setup the Rancher Dashboard repo
   - Clone https://github.com/rancher/dashboard and checkout `epinio-dev`
   - Run `cd shell && yarn link`
1) Clone https://github.com/epinio/ui and checkout `main`
1) UI Dev Only Step - Link in Rancher Dashboard packages
   - Run `cd <epini/ui root>/dashboard && yarn link @rancher/shell`
1) Run `yarn install`
1) Run `EXCLUDES_PKG=harvester,rancher-components EXCLUDE_OPERATOR_PKG=true RANCHER_ENV=epinio API=https://localhost:5443 yarn dev`

## Getting Started - Run in embedded Mode
Update to follow