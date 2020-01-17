default: build

USER=`whoami`
APP_NAME=k8s-demo

# Go pkg path for app
GO_PKG_PATH=github.com/$(USER)/$(APP_NAME)

# Binary output dir
OUTPUT_PATH = _output/linux_amd64/

build:
	# Build binary
	go build .

static-build:
	# Static build for Linux x86_64
	$(shell mkdir -p $(OUTPUT_PATH))
	CGO_ENABLED=0 GOARCH=amd64 GOOS=linux go build -o $(OUTPUT_PATH)/$(APP_NAME) -a -installsuffix no_cgo -ldflags '-w -extld ld -extldflags -static' -x $(GO_PKG_PATH)
