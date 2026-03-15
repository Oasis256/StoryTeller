# Plugin System v1 (Audiobookshelf Fork)

## Goal
Allow custom features (like Achievements, Reading Goals, Upcoming Book) to live outside core files by loading plugins from the server config directory.

## Status
Implemented scaffold in core:
- `server/managers/PluginManager.js`
- `server/Server.js` lifecycle + HTTP route mounting
- `server/SocketAuthority.js` socket hook registration

If no plugins exist, behavior is unchanged.

## Plugin Discovery
Plugins are loaded from:
- `ABS_PLUGIN_DIR` (if set), else
- `${CONFIG_PATH}/plugins`
- `<repo>/plugins` (fallback for bundled/development plugins)

Discovery rules:
- A `.js` file directly under the plugin root is treated as a plugin entry.
- A subdirectory is treated as a plugin if it contains `abs-plugin.js` or `index.js`.

## Plugin Folder Layout
Recommended plugin structure:

```text
<plugin-id>/
  abs-plugin.js
  public/                # optional static ui assets
  install.sh             # optional install hook
  uninstall.sh           # optional uninstall hook
```

## Plugin Contract
A plugin exports an object with at least `register(context)`.

```js
// ${CONFIG_PATH}/plugins/my-feature/abs-plugin.js
module.exports = {
  id: 'my-feature',
  name: 'My Feature',
  version: '1.0.0',
  async register(ctx) {
    const router = ctx.express.Router()

    router.get('/health', (req, res) => {
      res.json({ ok: true, plugin: ctx.id })
    })

    ctx.http.registerApiRoute('/v1', router)

    ctx.socket.on('my_feature:ping', ({ ack, user }) => {
      if (typeof ack === 'function') ack({ success: true, user: user?.username || null })
    })

    ctx.lifecycle.on('server:started', async () => {
      ctx.logger.info('Plugin is active')
    })

    return {
      async dispose() {
        ctx.logger.info('Plugin disposed')
      }
    }
  }
}
```

## Context API (v1)
`register(context)` receives:
- `id`: plugin id
- `logger`: prefixed logger (`debug/info/warn/error`)
- `server`: server instance
- `express`: express module
- `lifecycle`:
  - `on(eventName, handler)`
  - `emit(eventName, payload)`
- `http`:
  - `registerApiRoute(mountPath, router, { authRequired = true })`
- `socket`:
  - `on(eventName, handler, { authRequired = true })`
- `ui`:
  - `registerSlot(slotName, { componentName, scriptUrl, styleUrl?, order?, props? })`
  - `registerStaticAssets(relativeDir = 'public', mountPath = '/assets')`

## Mounted Endpoints
Core now exposes:
- `GET /api/plugins` => loaded plugin metadata
- `GET /api/plugins?metrics=1` => plugin performance metrics (admin users only)
- `GET /api/plugins/ui/slots/:slotName` => registered UI slot contributions (authenticated)

Plugin API routers mount as:
- `/api/plugins/:pluginId`
- `/api/plugins/:pluginId/:mountPath`

Plugin static assets mount as:
- `/plugins-assets/:pluginId/:mountPath/*`

Example above becomes:
- `GET /api/plugins/my-feature/v1/health`

## Lifecycle Events (v1)
Emitted by core:
- `server:initialized`
- `server:started`
- `server:stopping`
- `socket:authenticated`

## UI Slots (v1)
Core UI exposes these plugin slots:
- `item.details.after-metadata` (item page metadata column)
- `nav.sidebar.top` (left library siderail top)
- `nav.sidebar.bottom` (left library siderail bottom)
- `appbar.actions` (top app bar, right side actions)
- `nav.config.top` (config sidebar top)
- `nav.config.bottom` (config sidebar bottom)

## Safety Rules
- Invalid plugins are skipped (logged), not fatal by default.
- Set `ABS_PLUGINS_STRICT=1` to fail startup on plugin load errors.
- Socket handlers default to authenticated-only unless `authRequired: false`.
- Plugin routes default to authenticated-only unless `authRequired: false`.
- Slow plugin handlers are warned in logs when they exceed `ABS_PLUGIN_SLOW_MS` (default: `100`).

## Install / Uninstall Operations (Architecture Standard)
Plugin operations are part of architecture and must use repeatable scripts:

- Install script: `scripts/plugins/install-plugin.sh`
- Uninstall script: `scripts/plugins/uninstall-plugin.sh`

Install example:

```bash
CONFIG_PATH=/path/to/config \
./scripts/plugins/install-plugin.sh upcoming-book --source ./plugins/upcoming-book
```

Uninstall example (safe archive):

```bash
CONFIG_PATH=/path/to/config \
./scripts/plugins/uninstall-plugin.sh upcoming-book
```

Uninstall example (hard purge):

```bash
CONFIG_PATH=/path/to/config \
./scripts/plugins/uninstall-plugin.sh upcoming-book --purge
```

Operational guarantees:
- Existing plugin installs are backed up before replacement.
- Uninstall archives plugin folder by default (no hard delete unless `--purge`).
- If plugin contains executable hooks:
  - `install.sh` is run after install copy.
  - `uninstall.sh` is run before uninstall archive/purge.
- Runtime activate/deactivate/reload is available via admin API/UI (restart optional fallback).
- Full operational runbook: `scripts/plugins/README.md`

## Admin UI Operations
Plugin operations are also available in Admin UI:

- Page: `/config/plugins`
- API (admin-only):
  - `GET /api/plugins/admin/overview`
  - `POST /api/plugins/admin/install/:pluginId`
  - `POST /api/plugins/admin/install-upload` (`multipart/form-data`, field `file`)
  - `POST /api/plugins/admin/validate-upload` (`multipart/form-data`, field `file`)
  - `POST /api/plugins/admin/enable/:pluginId`
  - `POST /api/plugins/admin/disable/:pluginId`
  - `POST /api/plugins/admin/reload/:pluginId`
  - `POST /api/plugins/admin/uninstall/:pluginId`

Behavior:
- Install/uninstall from UI uses the same safety model as scripts (backup/archive by default).
- Upload install in UI performs: upload -> unzip -> validate entry -> install copy -> activate.
- UI is the primary operator experience; scripts remain the automation/fallback path.

## Performance Instrumentation
Built-in metrics are tracked with low overhead:
- Startup load timing per plugin (`loadMs`) and total startup load time.
- Lifecycle handler timings (`calls`, `avgMs`, `maxMs`, `lastMs`, `errors`).
- Socket handler timings (`calls`, `avgMs`, `maxMs`, `lastMs`, `errors`).
- Plugin HTTP route timings (`calls`, `avgMs`, `maxMs`, `lastMs`, `errors`).

Fetch metrics with:
- `GET /api/plugins?metrics=1` (requires admin user).

## How to Rebuild Removed Features as Plugins
- Achievements plugin:
  - owns achievement tables + migrations
  - exposes `/api/plugins/achievements/*`
  - subscribes to `socket:authenticated` and internal progress events
- Reading Goals plugin:
  - owns goal CRUD + per-user aggregation
  - emits plugin socket events (or uses core websocket channels)
- Upcoming Book plugin:
  - owns provider clients/cache/analytics
  - exposes admin config routes and item enrichment routes

## Frontend Module Strategy (recommended next)
Current scaffold is backend-first. To avoid core UI edits long-term, add a client plugin loader in a second phase:
- Add `GET /api/plugins` metadata consumption in client bootstrap.
- Define plugin UI slots (e.g. app nav, item detail panels, account widgets).
- Let plugin bundles register slot components through a runtime manifest.
- Gate by permissions and server-provided plugin capability list.

## Plugin File Locality (default)
- Plugin feature files should live inside a single plugin folder under `plugins/<plugin-id>/`.
- Plugin tests should live in `plugins/<plugin-id>/test`.
- Core test discovery is handled by symlinks in `test/server/plugins` generated automatically by:
  - `scripts/plugins/link-plugin-tests.sh`
  - wired through `npm pretest`
- This keeps plugin-specific code/tests out of core paths while still participating in the standard test run.

## Next Implementation Slice
1. Add a first-party sample plugin under `${CONFIG_PATH}/plugins/sample`.
2. Add internal server hook emissions at key domain events (progress updates, session close, library item updates).
3. Introduce plugin migration runner scoped per plugin id.
4. Add client slot registry + lazy-loaded remote bundles.
