#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
PLUGINS_DIR="${REPO_ROOT}/plugins"
TARGET_DIR="${REPO_ROOT}/test/server/plugins"

mkdir -p "${TARGET_DIR}"

if [[ ! -d "${PLUGINS_DIR}" ]]; then
  exit 0
fi

# Remove stale plugin test symlinks that no longer point to existing plugin tests.
while IFS= read -r -d '' entry; do
  if [[ ! -L "${entry}" ]]; then
    continue
  fi

  link_target="$(readlink "${entry}")"
  if [[ "${link_target}" != ../../../plugins/*/test ]]; then
    continue
  fi

  abs_target="$(cd "$(dirname "${entry}")" && cd "${link_target}" 2>/dev/null && pwd || true)"
  if [[ -z "${abs_target}" || ! -d "${abs_target}" ]]; then
    rm -f "${entry}"
  fi
done < <(find "${TARGET_DIR}" -mindepth 1 -maxdepth 1 -print0)

# Link each plugin test directory under test/server/plugins/<plugin-id>
for plugin_path in "${PLUGINS_DIR}"/*; do
  [[ -d "${plugin_path}" ]] || continue
  [[ -d "${plugin_path}/test" ]] || continue

  plugin_id="$(basename "${plugin_path}")"
  link_path="${TARGET_DIR}/${plugin_id}"
  relative_target="../../../plugins/${plugin_id}/test"

  if [[ -e "${link_path}" && ! -L "${link_path}" ]]; then
    echo "[link-plugin-tests] Skipping ${plugin_id}: ${link_path} exists and is not a symlink"
    continue
  fi

  rm -f "${link_path}"
  ln -s "${relative_target}" "${link_path}"
done
