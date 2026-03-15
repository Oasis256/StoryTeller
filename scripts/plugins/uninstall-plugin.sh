#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<USAGE
Usage:
  $(basename "$0") <plugin-id> [--target-base <dir>] [--purge]

Description:
  Safely uninstalls a plugin by archiving its directory to backups.

Defaults:
  --target-base  \$ABS_PLUGIN_DIR or \$CONFIG_PATH/plugins

Notes:
  - Never hard-deletes plugin files unless --purge is provided.
  - Runs plugin-local uninstall hook if present: <plugin-dir>/uninstall.sh
USAGE
}

PLUGIN_ID=""
TARGET_BASE=""
PURGE="0"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target-base)
      TARGET_BASE="${2:-}"
      shift 2
      ;;
    --purge)
      PURGE="1"
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

TARGET_DIR="$TARGET_BASE/$PLUGIN_ID"
if [[ ! -e "$TARGET_DIR" ]]; then
  echo "Plugin not installed: $TARGET_DIR" >&2
  exit 1
fi

if [[ -x "$TARGET_DIR/uninstall.sh" ]]; then
  echo "Running plugin uninstall hook: $TARGET_DIR/uninstall.sh"
  PLUGIN_ID="$PLUGIN_ID" PLUGIN_DIR="$TARGET_DIR" CONFIG_PATH="${CONFIG_PATH:-}" "$TARGET_DIR/uninstall.sh"
fi

if [[ "$PURGE" == "1" ]]; then
  echo "Purging plugin directory: $TARGET_DIR"
  rm -rf "$TARGET_DIR"
else
  BACKUP_ROOT="$TARGET_BASE/.plugin-backups"
  TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
  BACKUP_DIR="$BACKUP_ROOT/${PLUGIN_ID}-uninstall-$TIMESTAMP"
  mkdir -p "$BACKUP_ROOT"

  echo "Archiving plugin to: $BACKUP_DIR"
  mv "$TARGET_DIR" "$BACKUP_DIR"
fi

echo "Uninstalled plugin '$PLUGIN_ID'"
echo "Restart server to apply plugin removal."
