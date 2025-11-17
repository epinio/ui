If you haven't already completed the [pre-requisities](https://github.com/epinio/ui/blob/doc/1.12-updates/docs/developer/pre-requisities.md), do those now. 

# Getting The Epinio Standalone Instance Running

## Running the UI Backend

1. Ensure your epinio instance is running, which is detailed in the [pre-requisities](https://github.com/epinio/ui/blob/doc/1.12-updates/docs/developer/pre-requisities.md) page.
2. Ensure you have golang installed. 
3. Clone the repository `git clone git@github.com:epinio/ui.git`.
4. Navigate to the the `backend/src/jetstream` and run `npm run build-backend`.
5. Create a `config.properties` file for the backend. You can use the example below to get started.
```
# Database connectivity environment variables
DATABASE_PROVIDER=sqlite
HTTP_CONNECTION_TIMEOUT_IN_SECS=10
HTTP_CLIENT_TIMEOUT_IN_SECS=120
HTTP_CLIENT_TIMEOUT_MUTATING_IN_SECS=120
HTTP_CLIENT_TIMEOUT_LONGRUNNING_IN_SECS=600
HTTPS=true
SKIP_SSL_VALIDATION=true
CONSOLE_PROXY_TLS_ADDRESS=:5443
CONSOLE_CLIENT=console
CF_CLIENT=cf
UAA_ENDPOINT=
CONSOLE_ADMIN_SCOPE=stratos.admin
CF_ADMIN_ROLE=cloud_controller.admin
ALLOWED_ORIGINS=http://nginx
SESSION_STORE_SECRET=wheeee!
#SESSION_STORE_EXPIRY=20
CONSOLE_PROXY_CERT_PATH=../../dev-ssl/server.crt
CONSOLE_PROXY_CERT_KEY_PATH=../../dev-ssl/server.key
ENCRYPTION_KEY=B374A26A71490437AA024E4FADD5B497FDFF1A8EA6FF12F6FB65AF2720B59CCF

# Keep the sql lite database file
SQLITE_KEEP_DB=true
UI_PATH=../../dist
LOG_TO_JSON=false
LOG_API_REQUESTS=true
SSO_LOGIN=false

# Allow-list for the SSO redirect url. Paths can contain wildcard `*`
SSO_ALLOWLIST=

# Enable feature in tech preview
ENABLE_TECH_PREVIEW=false

# Use local admin user rather than UAA users
AUTH_ENDPOINT_TYPE=local
LOCAL_USER=admin
LOCAL_USER_PASSWORD=admin
LOCAL_USER_SCOPE=stratos.admin

EPINIO_API_URL=https://epinio.<ip>
EPINIO_WSS_URL=wss://epinio.<ip>
EPINIO_API_SKIP_SSL=true
EPINIO_UI_URL=https://localhost:8005
EPINIO_VERSION=dev
AUTH_ENDPOINT_TYPE=epinio
SESSION_STORE_EXPIRY=1440
```
6. Run the backend server `./jetstream`.
7. The backend should startup and give an address with the port `:5443`.

## Running Epinio UI

1. Run `EXCLUDES_PKG=harvester,rancher-components RANCHER_ENV=epinio API=https://localhost:5443 yarn dev`.
2. Navigate to the the address displayed in your terminal, it should be something like `localhost:8005`.
