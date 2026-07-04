REGISTRY ?= harbor.zjusec.net
IMAGE_NAME ?= library/gzctf
GIT_BRANCH := $(shell git branch --show-current 2>/dev/null)
GIT_SHA := $(shell git rev-parse HEAD)
BUILD_TIMESTAMP := $(shell date -u +%Y-%m-%dT%H:%M:%SZ)
TAG ?= $(shell git rev-parse --short HEAD)
PLATFORM ?= linux/amd64
PROJECT ?= src/GZCTF/GZCTF.csproj
PUBLISH_DIR ?= src/GZCTF/publish
VITE_APP_BUILD_TIMESTAMP ?= $(BUILD_TIMESTAMP)
VITE_APP_GIT_SHA ?= $(GIT_SHA)
VITE_APP_GIT_NAME ?= $(if $(GIT_BRANCH),$(GIT_BRANCH),develop)

IMAGE_REF = $(REGISTRY)/$(IMAGE_NAME):$(TAG)
ARCH = $(subst linux/,,$(PLATFORM))
DOTNET_ENV = VITE_APP_BUILD_TIMESTAMP="$(VITE_APP_BUILD_TIMESTAMP)" VITE_APP_GIT_SHA="$(VITE_APP_GIT_SHA)" VITE_APP_GIT_NAME="$(VITE_APP_GIT_NAME)"

.PHONY: build publish image push clean

build: image

publish:
	$(DOTNET_ENV) dotnet build $(PROJECT) -c Release -o src/GZCTF/build
	$(DOTNET_ENV) dotnet publish $(PROJECT) -c Release -o $(PUBLISH_DIR)/$(PLATFORM) \
		-r linux-$(ARCH) --no-self-contained /p:PublishReadyToRun=true

image: publish
	docker build --platform $(PLATFORM) -t $(IMAGE_REF) src/GZCTF

push: image
	docker push $(IMAGE_REF)

clean:
	rm -rf src/GZCTF/build $(PUBLISH_DIR)
