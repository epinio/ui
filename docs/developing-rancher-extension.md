If you haven't already completed the [prerequisites](./prerequisites.md), do those now. 

# Getting The Rancher Extension Running

1. Ensure your epinio instance is running, which is detailed in the [prerequisites](./prerequisites.md) page. 
2. Clone the repository `git clone git@github.com:epinio/ui.git`.
3. Navigate to the `dashboard` directory and run `yarn install`.
4. Run `API=<rancher ip> yarn dev`.
5. Navigate to the address displayed in your terminal; it should be something like `localhost:8005`.
