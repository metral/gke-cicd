import * as pulumi from "@pulumi/pulumi";

let pulumiGcpConfig = new pulumi.Config("gcp");
const gcpProject = pulumiGcpConfig.require("project");

let pulumiConfig = new pulumi.Config();

// Existing Pulumi stack reference in the format:
// <organization>/<project>/<stack> e.g. "myUser/myProject/dev"
const devClusterStackRef = new pulumi.StackReference(pulumiConfig.require("devClusterStackRef"));

export const config = {
    gcpProject: gcpProject,

    // Dev Cluster
    gkeKubeconfig: devClusterStackRef.getOutput("kubeconfig"),
    clusterName: devClusterStackRef.getOutput("clusterName"),
    appsNamespaceName: devClusterStackRef.getOutput("appsNamespaceName"),
};
