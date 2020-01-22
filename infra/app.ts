import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

// Arguments for the demo app.
export interface DemoAppArgs {
    provider: k8s.Provider // Provider resource for the target Kubernetes cluster.
    staticAppIp?: pulumi.Input<string> // Optional static IP to use for the service. (Required for AKS).
}

export class DemoApp extends pulumi.ComponentResource {
    public appUrl: pulumi.Output<string>;

    constructor(name: string,
                args: DemoAppArgs,
                opts: pulumi.ComponentResourceOptions = {}) {
        super("examples:kubernetes-ts-multicloud:demo-app", name, args, opts);

        // Create the Deployment.
        const appLabels = {app: name};
        const deployment = new k8s.apps.v1.Deployment(`${name}`, {
            spec: {
                selector: {matchLabels: appLabels},
                replicas: 1,
                template: {
                    metadata: {labels: appLabels},
                    spec: {
                        containers: [
                            {
                                name: "nginx",
                                image: "nginx:1.16",
                                ports: [{containerPort: 80, name: "http"}],
                            }
                        ],
                    },
                },
            }
        }, {provider: args.provider, parent: this});

        // Create a LoadBalancer Service to expose Deployment.
        const service = new k8s.core.v1.Service(`${name}-demo-app`, {
            spec: {
                loadBalancerIP: args.staticAppIp, // Required for AKS - automatic LoadBalancer still in preview.
                selector: appLabels,
                ports: [{port: 80, targetPort: "http"}],
                type: name === "local" ? "ClusterIP" : "LoadBalancer",
            }
        }, {provider: args.provider, parent: this});

        // The address appears in different places depending on the Kubernetes service provider.
        let address = service.status.loadBalancer.ingress[0].hostname;
        if (name === "gke" || name === "aks") {
            address = service.status.loadBalancer.ingress[0].ip;
            this.appUrl = pulumi.interpolate`http://${address}`;
        } else if (name === "local") {
            address = service.metadata.apply(m => `localhost:39703/api/v1/namespaces/default/services/${m.name}/proxy/`);
            this.appUrl = pulumi.interpolate`https://${address}`;
        } else {
            this.appUrl = pulumi.interpolate`http://${address}`;
        }


        this.registerOutputs();
    }
}
