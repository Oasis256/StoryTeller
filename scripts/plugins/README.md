# Plugin Operations

This folder contains the standard operational scripts for plugin lifecycle management.

- `install-plugin.sh`
- `uninstall-plugin.sh`

Both scripts are designed to be safe by default:
- Install backs up existing plugin installs before replacement.
- Uninstall archives plugin directory by default (no hard delete).
- Optional plugin hooks are supported:
  - `install.sh` (executed after install)
  - `uninstall.sh` (executed before uninstall)

## Requirements

You must provide plugin target location by one of:

1. `ABS_PLUGIN_DIR`
2. `CONFIG_PATH` (scripts use `$CONFIG_PATH/plugins`)
3. `--target-base <dir>` argument

## Quick Usage

Install from bundled repo plugin folder:

```bash
CONFIG_PATH=/path/to/config \
./scripts/plugins/install-plugin.sh upcoming-book --source ./plugins/upcoming-book
```

Uninstall safely (archive):

```bash
CONFIG_PATH=/path/to/config \
./scripts/plugins/uninstall-plugin.sh upcoming-book
```

Uninstall with hard delete:

```bash
CONFIG_PATH=/path/to/config \
./scripts/plugins/uninstall-plugin.sh upcoming-book --purge
```

## Environment-specific Examples

### Manual host process

```bash
# install
CONFIG_PATH=/var/lib/audiobookshelf/config \
./scripts/plugins/install-plugin.sh upcoming-book --source ./plugins/upcoming-book

# restart your app process however you normally do

# uninstall
CONFIG_PATH=/var/lib/audiobookshelf/config \
./scripts/plugins/uninstall-plugin.sh upcoming-book
```

### systemd service

```bash
# install
CONFIG_PATH=/var/lib/audiobookshelf/config \
./scripts/plugins/install-plugin.sh upcoming-book --source ./plugins/upcoming-book

sudo systemctl restart audiobookshelf
sudo systemctl status audiobookshelf --no-pager

# uninstall
CONFIG_PATH=/var/lib/audiobookshelf/config \
./scripts/plugins/uninstall-plugin.sh upcoming-book
sudo systemctl restart audiobookshelf
```

### Docker / docker compose

Use host paths for config and repo workdir:

```bash
# install on host-mounted config
CONFIG_PATH=/srv/audiobookshelf/config \
./scripts/plugins/install-plugin.sh upcoming-book --source ./plugins/upcoming-book

docker compose restart audiobookshelf

docker compose logs -f audiobookshelf

# uninstall
CONFIG_PATH=/srv/audiobookshelf/config \
./scripts/plugins/uninstall-plugin.sh upcoming-book

docker compose restart audiobookshelf
```

If your container uses a custom plugin directory, set `ABS_PLUGIN_DIR` instead:

```bash
ABS_PLUGIN_DIR=/srv/audiobookshelf/custom-plugins \
./scripts/plugins/install-plugin.sh upcoming-book --source ./plugins/upcoming-book
```

## Validation Checklist

After install:

1. `GET /api/plugins` includes your plugin id.
2. Check server logs for plugin load success.
3. Open relevant UI page and verify behavior.

After uninstall:

1. `GET /api/plugins` no longer lists the plugin id.
2. Relevant UI slot is empty or no-op.
3. No plugin runtime errors in logs.

## Rollback

Backups are stored under:

- `<target-base>/.plugin-backups/`

To rollback quickly:

1. Stop/restart window preparation.
2. Move the backup folder back to `<target-base>/<plugin-id>`.
3. Restart service.
