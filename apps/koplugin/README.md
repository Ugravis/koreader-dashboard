# KOReader plugin

Syncs KOReader reading statistics (`settings/statistics.sqlite3`) to the KOReader Dashboard API.

Tested against KOReader `2026.07.1`.

## Layout

```
koreader-dashboard-ulysse.koplugin/
  _meta.lua
  main.lua                 events and menu
  kodashboard/settings.lua LuaSettings in settings/koreader-dashboard-ulysse.lua
  kodashboard/api.lua      HTTP + JSON (socketutil timeouts, 401 unlinks the device)
  kodashboard/pairing.lua  link UI: code + QR, polling
```

Submodules live in `kodashboard/` because KOReader appends every plugin dir to the global `package.path`: a plain `require("api")` could load another plugin's module.

## Install (USB)

1. Plug the e-reader in USB.
2. Copy `koreader-dashboard-ulysse.koplugin/` into `koreader/plugins/` on the device.
3. Restart KOReader.
4. The plugin appears under **Tools > KOReader Dashboard**.

## Link the device

1. **Server URL**: for local development, `http://<mac-lan-ip>:8787` (the API listens on `0.0.0.0`). Set `WEB_ORIGIN` in `apps/api/.env` to an address the phone can open (`http://<mac-lan-ip>:3000`), since it is used in the link URL and QR code.
2. **Link this device**: shows a code and a QR code. Open the URL, sign in, enter the code. The plugin polls until the code is confirmed or expires (10 min).
3. **Unlink device** forgets the token locally. Revoke it from the website to invalidate it server side.

Changing the server URL unlinks the device.

## Debug

Logs are written to `koreader/crash.log` on the device (prefix `KOReaderDashboard:`).

If the plugin prevents KOReader from starting, delete its folder from `koreader/plugins/` over USB.

## Lint

```bash
luacheck --config apps/koplugin/.luacheckrc apps/koplugin
```
