#!/bin/bash

# For Google, we need to authenticate with a service principal for
# certain authentication operations.
if [ ! -z "$GOOGLE_CREDENTIALS" ]; then
    export GOOGLE_APPLICATION_CREDENTIALS="$(mktemp).json"
    echo "$GOOGLE_CREDENTIALS" > $GOOGLE_APPLICATION_CREDENTIALS
    gcloud auth activate-service-account --key-file=$GOOGLE_APPLICATION_CREDENTIALS
fi

# Pull down Service Account Secret key for Developers to auth as a k8s dev.
gsutil cp gs://dev-sa-secret/key.json /tmp/key.json && \
	gcloud auth activate-service-account --key-file /tmp/key.json && \
	gcloud auth configure-docker

# Build the Go app.
cd $GITHUB_WORKSPACE
make build && make static-build
