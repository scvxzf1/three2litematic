#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"

if [ $# -lt 1 ]; then
  echo "Usage: $0 <input.html|js|json> [-o output.litematic] [--preset 1.21|1.20.1|1.16.5|classic] [--hollow]" >&2
  exit 1
fi

node "$PROJECT_ROOT/src/cli/index.js" convert "$@"
