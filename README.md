# Epinio UI

> Please note the UI is still in development and has not yet been fully released

# Install

The first distribution of the UI will be alongside the Rancher Dashboard. A [build process](./docs/developer/build-install.md) automatically makes a version of the Dashboard that contains the new Epinio UI.

## Pre-Requisites

### Configure Epinio
Epinio must be informed of the domain the UI is served on. This can be set by the access controll allow origin property  
* when installing epinio (`helm install epinio-installer epinio/epinio-installer --values <filepath to below>.yaml`)
  ```
  domain: <see epinio docs>
  user: <username of default user>
  accessControlAllowOrigin: <domain>
  server:
    traceLevel: <0 low, 100 high>
  ```
* at run time (edit the `ACCESS_CONTROL_ALLOW_ORIGIN` env var of the `epinio/epinio-server` `deployment`)

## Run the Epinio UI

The `head` of the UI is `epinio-dev`. To use the latest stable UI with the examples below replace `epinio-dev` with `epinio-v0.3.3`.

The Epinio UI needs to be served from an existing Rancher Dashboard. This can be done in the usual way when bringing up a Rancher instance or to one already running. So either ...

### Apply build when installing Rancher
Set two environment variables
1. Set `CATTLE_UI_DASHBOARD_INDEX` to your build (plus `index.html`). For example `https://releases.rancher.com/dashboard/epinio-dev/index.html`
1. Set `CATTLE_UI_OFFLINE_PREFERRED` to `false` to ensure Rancher serves the files from `CATTLE_UI_DASHBOARD_INDEX`

So, for instance, if running docker apply the env vars via `-e`
```
docker run -d --restart=unless-stopped \
  -p 80:80 -p 443:443 \
  --privileged \
  -e CATTLE_UI_DASHBOARD_INDEX=https://releases.rancher.com/dashboard/epinio-dev/index.html
  -e CATTLE_UI_OFFLINE_PREFERRED=false
  rancher/rancher:latest
```

### Apply build to a running Rancher
1. Open the Rancher UI, log in as an `admin` and go to `Global Settings`
1. Set `ui-dashboard-index` to your build (plus `index.html`). For example `https://releases.rancher.com/dashboard/epinio-dev/index.html`
1. Set `ui-offline-preferred` to `Remote` to ensure Rancher serves the files from `ui-dashboard-index`
1. Refresh your browser

# Import your Epinio Cluster

Your epinio instance will be discovered from clusters that are known to Rancher. For example you could `Import` an existing cluster that has Epinio already installed on it, or you could create a cluster using Rancher and then install Epinio to it. Once Rancher is aware of the cluster that contains Epinio you should be able to navigate to 'Epinio' from the side nav and see your instance.

# Troubleshooting
- If you receive authentication errors it may mean your certificate is invalid. To work around this visit the <epinio url> in your browser and accept the usual certificate browser warning (you won't have to enter your credentials if prompted), then just return to Rancher and refresh your browser.


