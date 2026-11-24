# KOReader plugin

Syncs KOReader reading statistics (`settings/statistics.sqlite3`) to the KOReader Dashboard API.

Tested against KOReader `2026.07.1`.

## Install (USB)

1. Plug the e-reader in USB.
2. Copy `koreader-dashboard-ulysse.koplugin/` into `koreader/plugins/` on the device.
3. Restart KOReader.
4. The plugin appears under **Tools > KOReader Dashboard**.

## Debug

Logs are written to `koreader/crash.log` on the device.

If the plugin prevents KOReader from starting, delete its folder from `koreader/plugins/` over USB.

## Lint

```bash
luacheck apps/koplugin
```
