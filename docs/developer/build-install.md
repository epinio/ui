
# Build the Epinio UI
Whilst the Epinio UI code lives in the rancher/dashboard repo builds are created via the same Dashboard build process and are triggered on..

- Merging code to the `epinio-dev` branch (output served at `https://releases.rancher.com/dashboard/epinio-dev`)
- Tagging one of the epinio branches (output available via `https://releases.rancher.com/dashboard/<tag name>`)

# Install the Epinio UI

The output of the build process is a fully functioning dashboard and can be applied as per usual when bringing up a Rancher instance or to one already running.

## Apply build when installing Rancher
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

## Apply build to a running Rancher
1. Open the Rancher UI, log in as an `admin` and go to `Global Settings`
1. Set `ui-dashboard-index` to your build (plus `index.html`). For example `https://releases.rancher.com/dashboard/epinio-dev/index.html`
1. Set `ui-offline-preferred` to `Remote` to ensure Rancher serves the files from `ui-dashboard-index`
1. Refresh your browser

# Import your Epinio Cluster

Your epinio instance will be discovered from clusters that are known to Rancher. For example you could `Import` an existing cluster that has Epinio already installed on it, or you could create a cluster using Rancher and then Install Epinio to it. Once Rancher is aware of the cluster than contains Epinio you should be able to navigate to 'Epinio' from the side nav and see your instance.

