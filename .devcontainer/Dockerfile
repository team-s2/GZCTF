FROM mcr.microsoft.com/devcontainers/dotnet:2-10.0-noble

ENV DEBIAN_FRONTEND=noninteractive
RUN <<EOF
set -xe
sed -i 's/[a-z]*.ubuntu.com/mirrors.cernet.edu.cn/g' /etc/apt/sources.list
sed -i 's/[a-z]*.ubuntu.com/mirrors.cernet.edu.cn/g' /etc/apt/sources.list.d/*
apt-get update
apt-get install -y --no-install-recommends \
  postgresql-client
EOF

RUN <<EOF
set -xe
# https://code.claude.com/docs/en/quickstart
ARCH=${TARGETARCH:-$(dpkg --print-architecture)}
case "${ARCH}" in
  amd64) PLATFORM="linux-x64" ;;
  arm64) PLATFORM="linux-arm64" ;;
esac
version=$(curl -fsSL https://downloads.claude.ai/claude-code-releases/latest)
curl -fsSL -o /usr/local/bin/claude "https://downloads.claude.ai/claude-code-releases/${version}/${PLATFORM}/claude"
chmod 755 /usr/local/bin/claude
EOF

RUN <<EOF
set -xe
# https://opencode.ai/download
ARCH=${TARGETARCH:-$(dpkg --print-architecture)}
case "${ARCH}" in
  amd64) SUFFIX="linux-x64" ;;
  arm64) SUFFIX="linux-arm64" ;;
esac
curl -fsSL "https://github.com/anomalyco/opencode/releases/latest/download/opencode-${SUFFIX}.tar.gz" | tar xz -C /usr/local/bin/
chmod 755 /usr/local/bin/opencode
EOF

RUN <<EOF
set -xe
# https://developers.openai.com/codex/cli
ARCH=${TARGETARCH:-$(dpkg --print-architecture)}
case "${ARCH}" in
  amd64) SUFFIX="x86_64-unknown-linux-musl" ;;
  arm64) SUFFIX="aarch64-unknown-linux-musl" ;;
esac
curl -fsSL "https://github.com/openai/codex/releases/latest/download/codex-${SUFFIX}.tar.gz" | tar xz -C /tmp
mv "/tmp/codex-${SUFFIX}" /usr/local/bin/codex
chmod 755 /usr/local/bin/codex
EOF
