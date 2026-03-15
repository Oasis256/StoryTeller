#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<USAGE
Usage:
  $(basename "$0") <plugin-id> [--source <dir>] [--target-base <dir>] [--force]

Description:
  Safely installs a plugin folder into the active plugin directory.

Defaults:
  --source       <repo>/plugins/<plugin-id>
  --target-base  \$ABS_PLUGIN_DIR or \$CONFIG_PATH/plugins

Notes:
  - Creates timestamped backups of existing installed plugin directories before replacement.
  - Runs plugin-local install hook if present: <plugin-dir>/install.sh
USAGE
}

PLUGIN_ID=""
SOURCE_DIR=""
TARGET_BASE=""
FORCE="0"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --source)
      SOURCE_DIR="${2:-}"
      shift 2
      ;;
    --target-base)
      TARGET_BASE="${2:-}"
      shift 2
      ;;
    --force)
      FORCE="1"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      if [[ -z "$PLUGIN_ID" ]]; then
        PLUGIN_ID="$1"
        shift
      else
        echo "Unexpected argument: $1" >&2
        usage
        exit 1
      fi
      ;;
  esac
done

if [[ -z "$PLUGIN_ID" ]]; then
  usage
  exit 1
fi

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/../.." && pwd)"

if [[ -z "$SOURCE_DIR" ]]; then
  SOURCE_DIR="$REPO_ROOT/plugins/$PLUGIN_ID"
fi

if [[ ! -d "$SOURCE_DIR" ]]; then
  echo "Source plugin directory not found: $SOURCE_DIR" >&2
  exit 1
fi

if [[ -z "$TARGET_BASE" ]]; then
  if [[ -n "${ABS_PLUGIN_DIR:-}" ]]; then
    TARGET_BASE="$ABS_PLUGIN_DIR"
  elif [[ -n "${CONFIG_PATH:-}" ]]; then
    TARGET_BASE="$CONFIG_PATH/plugins"
  else
    echo "Target base not provided and neither ABS_PLUGIN_DIR nor CONFIG_PATH is set." >&2
    echo "Use --target-base <dir>." >&2
    exit 1
  fi
fi

mkdir -p "$TARGET_BASE"
TARGET_DIR="$TARGET_BASE/$PLUGIN_ID"
BACKUP_ROOT="$TARGET_BASE/.plugin-backups"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_ROOT"

if [[ -e "$TARGET_DIR" ]]; then
  if [[ "$FORCE" != "1" ]]; then
    echo "Plugin already installed at $TARGET_DIR" >&2
    echo "Use --force to replace (existing install will be backed up)." >&2
    exit 1
  fi

  BACKUP_DIR="$BACKUP_ROOT/${PLUGIN_ID}-preinstall-$TIMESTAMP"
  echo "Backing up existing plugin to: $BACKUP_DIR"
  mv "$TARGET_DIR" "$BACKUP_DIR"
fi

echo "Installing plugin '$PLUGIN_ID'"
if command -v rsync >/dev/null 2>&1; then
  rsync -a --delete "$SOURCE_DIR/" "$TARGET_DIR/"
else
  cp -a "$SOURCE_DIR" "$TARGET_DIR"
fi

if [[ -x "$TARGET_DIR/install.sh" ]]; then
  echo "Running plugin install hook: $TARGET_DIR/install.sh"
  PLUGIN_ID="$PLUGIN_ID" PLUGIN_DIR="$TARGET_DIR" CONFIG_PATH="${CONFIG_PATH:-}" "$TARGET_DIR/install.sh"
fi

echo "Installed plugin to: $TARGET_DIR"
echo "Restart server to load plugin changes."
