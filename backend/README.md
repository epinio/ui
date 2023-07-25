[![Unit tests](https://github.com/epinio/ui-backend/actions/workflows/main.yml/badge.svg)](https://github.com/epinio/ui-backend/actions/workflows/main.yml)

# Development

## Build Backend
In this repo, `main` branch

When running locally execute `npm install`
> Note - This doesn't do anything except runs a few things `postinstall`, the most import is a rejig of config files.. which is just `./build/dev-setup.js`


```
cd src/jetstream
npm run build-backend
```
> Note - This just runs `./build/bk-build.sh` under the hood

## Run Backend

```
cd src/jetstream
EPINIO_API_URL=<epinio API URL> \
EPINIO_API_SKIP_SSL=<true|false> \
EPINIO_UI_URL=https://localhost:8005 \
EPINIO_VERSION=dev \
AUTH_ENDPOINT_TYPE=epinio \
./jetstream
```

Alternatively create a `config.properties` file in `src/jetstream` with the ENVVARS above

## Run Frontend
In `rancher/dashboard` repo, `epinio-dev` branch

```
git checkout epinio-dev
yarn install
EXCLUDES_PKG=harvester,rancher-components EXCLUDES_NUXT_PLUGINS=plugins/version,plugins/plugin RANCHER_ENV=epinio API=https://localhost:5443 yarn mem-dev
```

> Note - If switching between `RANCHER_ENV`s you will need to `yarn clean`

> Note - The `API` value points at the backend which defaults to port `5443`



# Template / Helm

## Environment Variables

The following envs should be provided as env vars via helm.

| Key | Required | Default | Description |
|-----|-----|---|--|
| `AUTH_ENDPOINT_TYPE` | Yes | - | Should be `epinio`
| `EPINIO_API_URL` | Yes | - | API URL of epinio instance
| `EPINIO_WSS_URL` | Yes | - | WS API URL of epinio instance
| `EPINIO_API_SKIP_SSL`| No (only for dev) | `false` | Skip checking for valid SSL cert when making requests to `EPINIO_API_URL`
| `CONSOLE_PROXY_CERT_PATH` | Yes | - | Certificates value
| `CONSOLE_PROXY_CERT_KEY_PATH` | Yes | - | Certificates value
| `SESSION_STORE_SECRET` | Yes (only for prod) |
| `UI_PATH` | No | `./ui` | path to UI files that are served up by Jetstream
| `EPINIO_VERSION` | Yes | - | Should match the version of epinio that's installed (requires thought, this will be mislead when there are UI bugs)
| `RANCHER_ENV` | No | - | Not needed for template/helm, though needed when running the ui locally
| `SESSION_STORE_EXPIRY` | Yes | 20 | This should be bumped up in the standalone world, recommend 24 hours, so `1440`


## Building Jetstream

```
./build/bk-build.sh
```

This will create a `jetstream` binary in `src/jetstream`

## Running Jetstream
```
EPINIO_API_URL=<epinio api url> EPINIO_WSS_URL=<epinio ws api> EPINIO_API_SKIP_SSL=true SESSION_STORE_EXPIRY=1440 AUTH_ENDPOINT_TYPE=epinio HTTPS=true ./jetstream
```

## Fetching UI

The UI lives in `rancher/dashboard` (until the new plugins features makes it in). Under certain conditions that repo spits out a build. That build is currently how the rancher integrated solution works. 

So to fetch the files required to be bundled (and served) with the ui backend... something like the following should work

```
wget -r https://releases.rancher.com/dashboard/epinio-standalone-dev/index.html
```

> Note - The main branch/build version for the frontend is `epinio-standalone-dev`, which is referenced in the url. When a full release is required that would change to include the version (format TBD)
