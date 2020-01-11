import * as pulumi from "@pulumi/pulumi";

let pulumiGcpConfig = new pulumi.Config("gcp");
const gcpProject = pulumiGcpConfig.require("project");

let pulumiConfig = new pulumi.Config();

// Existing Pulumi stack reference in the format:
// <organization>/<project>/<stack> e.g. "myUser/myProject/dev"
const clusterStackRef = new pulumi.StackReference(pulumiConfig.require("clusterStackRef"));

export const config = {
    gcpProject: gcpProject,
    gkeKubeconfig: clusterStackRef.getOutput("kubeconfig"),
    clusterName: clusterStackRef.getOutput("clusterName"),
    appsNamespaceName: clusterStackRef.getOutput("appsNamespaceName"),
};
