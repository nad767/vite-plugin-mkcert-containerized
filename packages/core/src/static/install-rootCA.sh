#!/usr/bin/env sh
set -eu

THIS_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
exec sh "$THIS_DIR/manage-rootCA.sh" install "$@"
