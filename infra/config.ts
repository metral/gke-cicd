import * as pulumi from "@pulumi/pulumi";

let pulumiGcpConfig = new pulumi.Config("gcp");
const gcpProject = pulumiGcpConfig.require("project");

export const config = {
    gcpProject: gcpProject,
};
