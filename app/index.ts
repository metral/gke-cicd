import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";
import * as gcp from "@pulumi/gcp";
import * as app from "./app";
import {config} from "./config";
var fs = require("fs");

// Read the local (KinD) cluster's KUBECONFIG.
var kubeconfigData = fs.readFileSync(process.env.KUBECONFIG);
const kubeconfig: pulumi.Output<any> = pulumi.output(kubeconfigData.toString());

// Create a k8s provider for the local KinD cluster.
const localProvider = new k8s.Provider("localProvider", {
    kubeconfig: kubeconfig,
});

// Create a k8s provider for the remote GKE cluster.
const gkeProvider = new k8s.Provider("gkeProvider", {
    kubeconfig: config.gkeKubeconfig,
    namespace: config.appsNamespaceName,
});

// Create the application on each of the selected clusters.
const instance = new app.DemoApp("demo", {
    provider: localProvider,
});

export const instanceUrl = instance.url;
