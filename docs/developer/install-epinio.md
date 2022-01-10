# k3d

Updated version from https://docs.epinio.io/installation/install_epinio_auto.html

1. Create a cluster without traefik
   ```
   k3d cluster create epinio-v0-3-2 --k3s-server-arg '--no-deploy=traefik'
   ```
2. Discover the ip address of k3d

   a. Mine only worked using the node ip (node name from `docker ps`)
      ```
      docker inspect k3d-epinio-v0-3-2-server-0 | grep IPAddress
      ```
   b. Append this with one of the magic domains (used below)
      ```
      <ip>.nip.io / <ip>.omg.howdoi.website
      ```
3. Populate a helm values file, call it `epinio-values.yaml`
   ```
   domain: <ip>.nip.io
   user: <username of default user, can be anything>
   accessControlAllowOrigin: <url of the location that serves the dashboard, for dev this would be https://localhost:8005>
   server:
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
   helm install epinio-installer epinio/epinio-installer -f epinio-values.yaml
   ```
6. Update the local cli and test. If the ip from above doesn't work it will fail the second command
   ```
   epinio config update
   epinio app list
   ```

