#!/usr/bin/env bash
set -euo pipefail

TAG="$(git describe --tags --exact-match 2>/dev/null || git rev-parse --short HEAD)"
VERSION="$(./scripts/release_version.sh development-version)"
COMMIT="$(git rev-parse --short HEAD)"

(
  cd web
  pnpm release
)

docker buildx build \
  --load \
  -f scripts/Dockerfile \
  --build-arg VERSION="$VERSION" \
  --build-arg COMMIT="$COMMIT" \
  -t "sultan/memos:${TAG}" .

docker save "sultan/memos:${TAG}" \
  | gzip \
  > "memos-${TAG}.tar.gz"

sha256sum "memos-${TAG}.tar.gz"
