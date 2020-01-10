import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";
var fs = require("fs");

// Read the local (KinD) cluster's KUBECONFIG.
var localKubeconfigData = fs.readFileSync(process.env.KUBECONFIG);
export const localKubeconfig: pulumi.Output<any> = pulumi.output(localKubeconfigData.toString());
export const localProvider = new k8s.Provider("local", {kubeconfig: localKubeconfig});
