#!/bin/bash

pulumi config set gcp:zone us-west1-a 
pulumi config set gcp:project pulumi-development
pulumi config set clusterStackRef metral/gke-cicd/dev-4C5QRmjifjj3
