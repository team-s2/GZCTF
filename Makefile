REGISTRY ?= harbor.zjusec.net
IMAGE_NAME ?= library/gzctf
TAG ?= $(shell git rev-parse --short HEAD)
PLATFORM ?= linux/amd64
PROJECT ?= src/GZCTF/GZCTF.csproj
PUBLISH_DIR ?= src/GZCTF/publish

IMAGE_REF = $(REGISTRY)/$(IMAGE_NAME):$(TAG)
ARCH = $(subst linux/,,$(PLATFORM))

.PHONY: build publish image push clean

build: image

publish:
	dotnet build $(PROJECT) -c Release -o src/GZCTF/build
	dotnet publish $(PROJECT) -c Release -o $(PUBLISH_DIR)/$(PLATFORM) \
		-r linux-$(ARCH) --no-self-contained /p:PublishReadyToRun=true

image: publish
	docker build --platform $(PLATFORM) -t $(IMAGE_REF) src/GZCTF

push: image
	docker push $(IMAGE_REF)

clean:
	rm -rf src/GZCTF/build $(PUBLISH_DIR)
