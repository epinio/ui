If you haven't already completed the [pre-requisities](https://github.com/epinio/ui/blob/doc/1.12-updates/docs/developer/pre-requisities.md), do those now. 

# Getting The Rancher Extension Running

1. Ensure your epinio instance is running, which is detailed in the [pre-requisities](https://github.com/epinio/ui/blob/doc/1.12-updates/docs/developer/pre-requisities.md) page. 
2. Clone the repository `git clone git@github.com:epinio/ui.git`.
3. Navigate to the the `dashboard/pkg/epinio` directory and run `yarn install`.
4. Run `API=<epinio ip> yarn dev`.
5. Navigate to the the address displayed in your terminal, it should be something like `localhost:8005`.
