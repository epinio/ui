# Process to deploy latest standalone UI synced with latest ui backend and epinio

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

#### Step 2: prepare ui backend

TODO: RC update all of this

Open another terminal pointing to [epinio/ui/backend](https://github.com/epinio/ui/backend) repo
Execute:

```
cp src/jetstream/config.example src/jetstream/config.properties 
```

Execute `epinio settings show` and copy the **API Url** displayed:
Example:

```
| API Url           | https://epinio.172.21.0.2.omg.howdoi.website |
```

Go to `src/jetstream` and add the following lines to the top of `config.properties`:
```
AUTH_ENDPOINT_TYPE=epinio
EPINIO_API_URL=https://epinio.172.21.0.2.omg.howdoi.website
EPINIO_API_SKIP_SSL=true
EPINIO_VERSION=dev
EPINIO_UI_URL=https://localhost:8005
```

Execute the following:
```
npm run build-backend && ./jetstream 
```

Now the backend should be ok and we can start the rancher dashboard deployment:
<br />

#### Step 3: Prepare the dashboard 

See [here](../../dashboard/README.md)

Rancher standalone UI should now working and listing port should be displayed on terminal (8005 in this example):

```
ℹ Waiting for filehanges                                                                                                                                                                    
ℹ Memory usage: 1.44 GB (RSS: 2.17 GB)                                                                                                                                       
ℹ Listening on: https://192.168.1.44:8005/                                                                                                                                  
Issues checking in progress...                                                                                                                                         
No issues found.  
```
