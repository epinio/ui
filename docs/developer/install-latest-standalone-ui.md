# Process to deploy latest standalone UI  synced with latest ui-backend and epinio

### Step 1: get latest epinio update

Open a terminal pointing to [epinio/epinio](https://github.com/epinio/epinio) repo
Ensure submodules are synced. As help this can be executed:
```
git pull --recurse-submodules
```
Execute:
```
export KUBECONFIG=$PWD/tmp/acceptance-kubeconfig
```
Ensure you have nodes running:

```
epinio git:(main) kubectl get nodes
NAME                             STATUS   ROLES                  AGE    VERSION 
k3d-epinio-acceptance-server-0   Ready    control-plane,master   109s   v1.20.11+k3s2 
```
Execute:
```
make install-cert-manager
make prepare_environment_k3d  
```
Check epinio version:
It should output the current version, plus and aditional number

```✔️  Epinio Environment 
Platform: k3s 
Kubernetes Version: v1.20.11+k3s2 
Epinio Server Version: v0.8.0-124-g57f85060 
Epinio Client Version: v0.8.0-124-g57f85060 
```
######Optional: create a symlink for the latest versions
`ln -s ~/epinio/dist/epinio-linux-amd64 /usr/local/bin/epinio`

---

## To run the latest version of the UI

#### Step 2: prepare ui-backend

Open another terminal pointing to [epinio/ui-backend](https://github.com/epinio/ui-backend) repo
Execute:

```
cp src/jetstream/config.example src/jetstream/config.properties 
```

Go to `/src/jetstream/` and ensure the following line is enabled in `config.properties` file:
`AUTH_ENDPOINT_TYPE=epinio`

Execute `epinio settings show` and copy the **API Url** displayed:
Example:

```
| API Url           | https://epinio.172.21.0.2.omg.howdoi.website |
```

Execute the following with the copied ip:
```
go build && EPINIO_API_URL=https://epinio.172.21.0.2.omg.howdoi.website EPINIO_WSS_URL=https://epinio.172.21.0.2.omg.howdoi.website EPINIO_API_SKIP_SSL=true EPINIO_VERSION=dev ./jetstream  
```

Now the backend should be ok and we can start the rancher dashboard deployment:
<br />

#### Step 3: Prepare the dashboard 

Open new terminal poiting to `dev` branch on [rancher/dashboard](https://github.com/rancher/dashboard/tree/epinio-dev) repo

Ensure you have `node version 16.15.0` or lower. This may change over time.

Execute:
```
yarn install 
EXCLUDES_PKG=rancher-components API=https://localhost:5443 RANCHER_ENV=epinio yarn mem-dev
``` 

Rancher standalone UI should now working and listing port should be displayed on terminal (8005 in this example):

```
ℹ Waiting for filehanges                                                                                                                                                                    
ℹ Memory usage: 1.44 GB (RSS: 2.17 GB)                                                                                                                                       
ℹ Listening on: https://192.168.1.44:8005/                                                                                                                                  
Issues checking in progress...                                                                                                                                         
No issues found.  
```
