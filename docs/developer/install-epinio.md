# k3d

Updated version from https://docs.epinio.io/installation/installation.html

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
   api:
     password: <random password>
     username: <username of default user, can be anything>
   global:
     domain: '<ip>.nip.io'
   server:
     accessControlAllowOrigin: '<url of the location that serves the dashboard, for dev this would be https://localhost:8005>'
     traceLevel: 100
   ```
4. Add the epinio helm repo to your local helm OR update if you already have it
   ```
   helm repo add epinio https://epinio.github.io/helm-charts
   ```
   ```
   helm repo update
   ```
5. Install epinio (this may take some time)
   ```
   helm install epinio -n epinio --create-namespace epinio/epinio -f epinio-values.yaml
   ```
   
   > Note - The Standalone UI is now bundled with the epinio installer and can be accessed by the API URL listed by `epinio settings show` (see below for instructions on installing the cli)
6. Install the Epinio CLI (for fresh installs)

   Follow the instructions at https://docs.epinio.io/installation/install_epinio_cli.html

7. Update the Epinio CLI (for installs on existing envs) 
   ```
   epinio settings update
   epinio app list
   ```
   Note - If the ip from above doesn't work it will fail the second command

# Update Epinio Instance with a local epinio dev build
1. clones OR fetch latest from `epinio/epinio`
1. cd to the repo (`cd github/epinio`) (if not already there)
3. check go is installed `go`
  a. If not `~/bin/gimme 1.18` and apply the output
4. run `make build && make patch-epinio-deployment`. 
> This won't bring in any changes made to the epinio charts


