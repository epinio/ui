## Prerequisites
To safely develop the Epinio UI, we will need to set up a cluster and install Epinio on it. 

### Setting up a cluster 
1. We can use Minikube, k3d, etc to do this. For these instructions, we will use Minikube. Go ahead and install Minikube.
2. After installation, run `minikube start`.
3. Enable Nginix Ingress, run `minikube addons enable ingress`. Note: if you are having issues with this on Windows or MacOS, you may run `minikube tunnel` ([source](https://stackoverflow.com/questions/69161998/exposing-minikube-running-on-docker-ip/76663822#76663822)).
4. [Install Rancher](https://ranchermanager.docs.rancher.com/getting-started/installation-and-upgrade/install-upgrade-on-a-kubernetes-cluster) on your new cluster.

    4a. Ensure you have switched your context if minikube didn't do so already.
   
    4b. Note that  when setting this up, your hostname should be rancher.<minikube ip>.nip.io. To get your Minikube IP, run `minikube ip`.
   
    4c. Use the stable branch when adding your Helm charts locally unless you are testing specific features against Epinio.
   
    4d. Depending on your system resources, Rancher can take a while to get started up, so be patient.
   
    4e. Navigate to the Rancher URL you set up and do the setup Rancher process; the default password is `admin`.

5. Set up your Epinio Helm Values file. You can save this as epinio-values.yaml for use in the next step. 

```
  global:
    domain: '<ip>.sslip.io'
  rancher:
    url: '<url of the location that serves the dashboard, for dev this would be https://localhost:8005>'
```

6. [Install Epinio](https://docs.epinio.io/installation/install_epinio)

  6a. Note once you hit the installation step for epinio itself, you can supplement the command with `helm install epinio -n epinio --create-namespace epinio/epinio -f epinio-values.yaml` to target your newly created helm values file. 

Congrats, you have completed all of the prerequisites to develop Epinio! Check out how to get started with the [Epinio Rancher Extension](./developing-rancher-extension.md) or [Standalone Application](./developing-standalone-application.md). Looking forward to your first PR!
