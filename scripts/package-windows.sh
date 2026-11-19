#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="$(node -p "require('${ROOT}/package.json').version")"
NODE_VERSION="${NODE_VERSION:-22.23.5}"
NODE_DIR="node-v${NODE_VERSION}-win-x64"
NODE_URL="https://nodejs.org/dist/v${NODE_VERSION}/${NODE_DIR}.zip"
CACHE_DIR="${ROOT}/.cache/windows-build"
DIST_DIR="${ROOT}/dist"
STAGE_NAME="three2litematic-${VERSION}-win-x64"
STAGE_DIR="${DIST_DIR}/${STAGE_NAME}"
ARCHIVE="${DIST_DIR}/${STAGE_NAME}.zip"

mkdir -p "${CACHE_DIR}" "${DIST_DIR}"

if [[ ! -f "${CACHE_DIR}/node.exe" ]]; then
  printf 'Downloading Node.js %s for Windows x64...\n' "${NODE_VERSION}"
  curl -fL --retry 3 -o "${CACHE_DIR}/${NODE_DIR}.zip" "${NODE_URL}"
  unzip -p "${CACHE_DIR}/${NODE_DIR}.zip" "${NODE_DIR}/node.exe" > "${CACHE_DIR}/node.exe"
fi

EXPECTED_SHA="$(curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/SHASUMS256.txt" | awk '/win-x64\/node\.exe$/ { print $1 }')"
ACTUAL_SHA="$(sha256sum "${CACHE_DIR}/node.exe" | awk '{ print $1 }')"
if [[ -z "${EXPECTED_SHA}" || "${EXPECTED_SHA}" != "${ACTUAL_SHA}" ]]; then
  printf 'node.exe checksum mismatch\n' >&2
  exit 1
fi

rm -rf "${STAGE_DIR}"
mkdir -p "${STAGE_DIR}/runtime" "${STAGE_DIR}/library" "${STAGE_DIR}/scripts" "${STAGE_DIR}/node_modules"

cp -a "${ROOT}/src" "${ROOT}/examples" "${ROOT}/test" "${ROOT}/.agents" "${STAGE_DIR}/"
cp -a "${ROOT}/library/assets" "${ROOT}/library/presets" "${STAGE_DIR}/library/"
cp -a "${ROOT}/node_modules/three" "${STAGE_DIR}/node_modules/"
cp "${ROOT}/README.md" "${ROOT}/package.json" "${ROOT}/package-lock.json" "${STAGE_DIR}/"
cp "${ROOT}/Start-three2litematic.bat" "${ROOT}/three2litematic.cmd" "${STAGE_DIR}/"
cp "${ROOT}/scripts/open-when-ready.ps1" "${ROOT}/scripts/package-windows.sh" "${STAGE_DIR}/scripts/"
cp "${CACHE_DIR}/node.exe" "${STAGE_DIR}/runtime/node.exe"

printf '%s\n' \
  "three2litematic ${VERSION} - Windows x64 portable" \
  "" \
  "1. Extract this ZIP to any writable folder." \
  "2. Double-click Start-three2litematic.bat." \
  "3. Your browser opens http://127.0.0.1:28741/ automatically." \
  "" \
  "CLI: three2litematic.cmd --help" \
  "No Node.js installation is required." \
  "Bundled runtime: Node.js ${NODE_VERSION} (Windows x64)." \
  > "${STAGE_DIR}/WINDOWS-QUICKSTART.txt"

(
  cd "${DIST_DIR}"
  rm -f "${ARCHIVE}"
  7z a -tzip -mx=9 "${ARCHIVE}" "${STAGE_NAME}" >/dev/null
  sha256sum "$(basename "${ARCHIVE}")" > "$(basename "${ARCHIVE}").sha256"
)

printf 'Built: %s\n' "${ARCHIVE}"
printf 'SHA256: %s\n' "$(cut -d' ' -f1 "${ARCHIVE}.sha256")"
