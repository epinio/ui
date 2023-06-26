# Epinio UI

## Pre-Requisites

### Configure Epinio
Epinio must be informed of the domain the UI is served on. This can be set by the access controll allow origin property  
* when installing epinio (`helm install epinio-installer epinio/epinio-installer --values <filepath to below>.yaml`)
  ```
  global:
    domain: <see epinio docs>
  server:
    accessControlAllowOrigin: <domain>
  ```
* at run time (edit the `ACCESS_CONTROL_ALLOW_ORIGIN` env var of the `epinio/epinio-server` `deployment`)

## Run the Epinio UI

See [./dashboard/README.md](./dashboard/README.md)
