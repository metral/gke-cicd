import * as pulumi from "@pulumi/pulumi";
import * as gcp from "@pulumi/gcp";
import * as random from "@pulumi/random";
import * as k8s from "@pulumi/kubernetes";
import { config } from "./config";
import * as util from "./util";
import * as crypto from "crypto";

const projectName = pulumi.getProject();
const stackName = pulumi.getStack();

//============================================================================== 
/*
 * Identity
 */
//============================================================================== 

// Create the GKE cluster developers ServiceAccount.
const devsName = "devs";
const shortStackName = stackName.substr(0,7);
export const devsAccountId = `k8s-${shortStackName}-${devsName}`;
const devsIamServiceAccount = new gcp.serviceAccount.Account(devsName, {
    project: config.gcpProject,
    accountId: devsAccountId,
    displayName: "Kubernetes Developers",
});

// Bind the Developers ServiceAccount to required roles.
//
// roles/storage.admin: Control GCS for use with GCR (create buckets & objects).
util.bindToRole(`${devsName}-k8s`, devsIamServiceAccount, {
    project: config.gcpProject,
    roles: ["roles/storage.admin"],
});

// Create the Developers ServiceAccount key.
const devsIamServiceAccountKey = util.createServiceAccountKey(`${devsName}Key`, devsIamServiceAccount);

// Create the Developers ServiceAccount client secret to authenticate as this service account.
export const devsIamServiceAccountSecret = util.clientSecret(devsIamServiceAccountKey);

//============================================================================== 
/*
 * GKE Cluster
 */
//============================================================================== 

// Generate a strong password for the cluster.
const password = new random.RandomPassword(`${projectName}-password`, { 
    length: 20,
},{ additionalSecretOutputs: ["result"] }).result;

// Create the GKE cluster.
const cluster = new gcp.container.Cluster(`${projectName}`, {
    initialNodeCount: 1,
    podSecurityPolicyConfig: { enabled: true },
    minMasterVersion: "1.14.8-gke.12",
    // minMasterVersion: "1.15.7-gke.2",
    masterAuth: { username: "example-user", password: password },
});

export const kubeconfig = util.createKubeconfig(cluster.name, cluster.endpoint, cluster.masterAuth);
export const clusterName = cluster.name;

// Create a k8s provider instance of the cluster.
const provider = new k8s.Provider(`${projectName}-gke`, { kubeconfig: kubeconfig }, {dependsOn: cluster });

/*
 * Configure Namespaces and Quotas.
 */

// Create Kubernetes namespaces.
const appsNamespace = new k8s.core.v1.Namespace("apps", undefined, { provider: provider });
export const appsNamespaceName = appsNamespace.metadata.name;

// Create a resource quota in the apps namespace.
const quotaAppNamespace = new k8s.core.v1.ResourceQuota("apps",
    {
        metadata: { namespace: appsNamespaceName },
        spec: {
            hard: {
                cpu: "20",
                memory: "1Gi",
                pods: "10",
                replicationcontrollers: "20",
                resourcequotas: "1",
                services: "5",
            },
        },
}, { provider: provider });

/*
 * Configure Developer RBAC.
 */

// Create a limited role for the Developers Service Account to use in
// the Apps namespace.
const devsRole = new k8s.rbac.v1.Role(`pulumi-devs`,
    {
        metadata: { namespace: appsNamespaceName },
        rules: [
            {
                apiGroups: [""],
                resources: ["configmap", "pods", "secrets", "services", "persistentvolumeclaims"],
                verbs: ["get", "list", "watch", "create", "update", "delete"],
            },
            {
                apiGroups: ["rbac.authorization.k8s.io"],
                resources: ["clusterrole", "clusterrolebinding", "role", "rolebinding"],
                verbs: ["get", "list", "watch", "create", "update", "delete"],
            },
            {
                apiGroups: ["extensions", "apps"],
                resources: ["replicasets", "deployments"],
                verbs: ["get", "list", "watch", "create", "update", "delete"],
            },
        ],
}, { provider: provider });

// Bind the Developers Service Account to the new, limited developer role.
const devsRoleBinding = pulumi.all([
    config.gcpProject,
    devsAccountId,
]).apply(([project, devsAccountId]) => {
    return new k8s.rbac.v1.RoleBinding(`pulumi-devel`,
        {
            metadata: { namespace: appsNamespaceName },
            subjects: [{
                kind: "User",
                name: `${devsAccountId}@${project}.iam.gserviceaccount.com`,
            }],
            roleRef: {
                apiGroup: "rbac.authorization.k8s.io",
                kind: "Role",
                name: devsRole.metadata.name,
            },
        }, { provider: provider })
});

// Create a restrictive PodSecurityPolicy.
const restrictivePSP = new k8s.policy.v1beta1.PodSecurityPolicy("00-restrictive", {
    metadata: { name: "00-restrictive" },
    spec: {
        privileged: false,
        hostNetwork: false,
        allowPrivilegeEscalation: false,
        defaultAllowPrivilegeEscalation: false,
        hostPID: false,
        hostIPC: false,
        runAsUser: { rule: "RunAsAny" },
        fsGroup: { rule: "RunAsAny" },
        seLinux: { rule: "RunAsAny" },
        supplementalGroups: { rule: "RunAsAny" },
        volumes: [
            "configMap",
            "downwardAPI",
            "emptyDir",
            "persistentVolumeClaim",
            "secret",
            "projected"
        ],
        allowedCapabilities: [
            "*"
        ]
    }
}, { provider: provider });

// Create a ClusterRole to use the restrictive PodSecurityPolicy.
const restrictiveClusterRole = new k8s.rbac.v1.ClusterRole("restrictive", {
    metadata: { name: "restrictive" },
    rules: [
        {
            apiGroups: [
                "policy"
            ],
            resourceNames: [
                restrictivePSP.metadata.name,
            ],
            resources: [
                "podsecuritypolicies"
            ],
            verbs: [
                "use"
            ]
        }
    ]
}, { provider: provider });

// Create a ClusterRoleBinding for the RBAC devs account ID
// to the ClusterRole that uses the restrictive PodSecurityPolicy.
const allowRestrictedAppsCRB = pulumi.all([
    config.gcpProject,
    devsAccountId,
]).apply(([project, devsAccountId]) => {
    return new k8s.rbac.v1.ClusterRoleBinding("allow-restricted-apps", {
        metadata: { name: "allow-restricted-apps" },
        roleRef: {
            apiGroup: "rbac.authorization.k8s.io",
            kind: "ClusterRole",
            name: restrictiveClusterRole.metadata.name
        },
        subjects: [{
            kind: "User",
            name: `${devsAccountId}@${project}.iam.gserviceaccount.com`,
            namespace: appsNamespaceName
        }],
    }, { provider: provider });
});
