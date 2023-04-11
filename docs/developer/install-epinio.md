# k3d

Updated version from https://docs.epinio.io/installation/installation.html

Pre-Reqs
- docker - On DO - `snap install docker`
- k3d - https://k3d.io/v5.4.6/#installation
- helm cli - https://helm.sh/docs/intro/install/
- kubectl - https://kubernetes.io/docs/tasks/tools/install-kubectl-linux/

Nice to have pre-reqs
- k9s
  - ~https://k9scli.io/topics/install/~ snap seems broken
  - https://github.com/derailed/k9s
- gimme (to install golang)
  - https://github.com/travis-ci/gimme (if in root change location of file from ~/)

1. Create a cluster
   ```
   k3d cluster create epinio-v0-7-1
   ```
   > Note in DO create it with ports forwarded
   ```
   k3d cluster create epinio-0-7-1 -p 80:80@loadbalancer -p 443:443@loadbalancer
   ```

1. Install cert manager
   ```
   helm repo add jetstack https://charts.jetstack.io
   helm repo update
   kubectl create namespace cert-manager
   helm install cert-manager --namespace cert-manager jetstack/cert-manager \
        --set installCRDs=true \
        --set extraArgs[0]=--enable-certificate-owner-ref=true
   ```   
1. Discover the ip address of k3d

   a. (Locally) Mine only worked using the node ip (node name from `docker ps`)
      ```
      docker inspect k3d-epinio-v0-7-1-server-0 | grep IPAddress
      ```
      (DO) This needs to be the public ip 
      ```
      ip addr show eth0
      ```
   b. The domain value is ip with one of the magic domains (examples below)
      ```
      <ip>.nip.io / <ip>.omg.howdoi.website
      ```
3. Populate a helm values file, call it `epinio-values.yaml`
   ```
   global:
     domain: '<ip>.nip.io'
   server:
     accessControlAllowOrigin: '<url of the location that serves the dashboard, for dev this would be https://localhost:8005>'
     traceLevel: 100
   #dex:
   #  ui:
   #    redirectURI: '<the location that serves the dashboard + '/verify-auth', for dev this would be https://localhost:8005/verify-auth>'
   ```
4. Either

   Install from Helm Repo

   a. Add the epinio helm repo to your local helm OR update if you already have it
      ```
      helm repo add epinio https://epinio.github.io/helm-charts
      ```
      ```
      helm repo update
      ```
   b. Install epinio (this may take some time)
      ```
      helm install epinio -n epinio --create-namespace epinio/epinio -f epinio-values.yaml
      ```
   OR

   Install from local helm chart

   a. Ensure the local epinio/epinio repo and it's submodules are up to date AND checked out on the required branch
      
      ```
      git clone https://github.com/epinio/epinio.git
      cd epinio
      git submodule init
      git submodule update
      ```
   
      If publickey denided, generate key and add to github

   b. Install via
      ```
      helm install epinio -n epinio --create-namespace helm-charts/chart/epinio -f /root/epinio-values.yaml
      ```
   

> Note - The Standalone UI is now bundled with the epinio installer and can be accessed by the API URL listed by `epinio settings show` (see below for instructions on installing the cli)


5. Install the Epinio CLI (for fresh installs)

   Follow the instructions at https://docs.epinio.io/installation/install_epinio_cli.html

6. Update the Epinio CLI (for installs on existing envs) 
   ```
   epinio settings update
   epinio app list
   ```
   Note - If the ip from above doesn't work it will fail the second command

# Update Epinio Instance with a local epinio dev build
1. clones OR fetch latest from `epinio/epinio`
1. cd to the repo (`cd github/epinio`) (if not already there)
2. `git fetch` and checkout the desired branch (most probably `main`)
3. check go is installed `go`
  a. If not `~/bin/gimme 1.18` and apply the output
4. run `make build && make patch-epinio-deployment`. 
> This won't bring in any changes made to the epinio charts


