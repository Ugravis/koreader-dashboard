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
  kodashboard/pairing.lua  link flow: code + QR, polling
  kodashboard/page.lua     full-screen page (welcome, pairing code + QR code, website QR code)
  kodashboard/stats.lua    read-only statistics.sqlite3 reads (batches of 5,000)
  kodashboard/sync.lua     incremental sync, throttle, cursor
  kodashboard/library.lua  book sidecars: status, KOReader %, metadata, annotations
```

Submodules live in `kodashboard/` because KOReader appends every plugin dir to the global `package.path`: a plain `require("api")` could load another plugin's module.

## Install (USB)

1. Plug the e-reader in USB.
2. Copy `koreader-dashboard-ulysse.koplugin/` into `koreader/plugins/` on the device.
3. Restart KOReader.
4. The plugin appears under **Tools > KOReader Dashboard**.

## Link the device

1. Same Wi-Fi for the Mac, the Kindle and the phone. Use the Mac LAN IP (`ipconfig getifaddr en0`) everywhere, never `localhost` (session cookies are bound to the host):
   - `apps/api/.env`: `API_URL=http://<mac-lan-ip>:8787`, `WEB_ORIGIN=http://<mac-lan-ip>:3000` (used in the link URL and QR code)
   - `apps/web/.env.local`: `NEXT_PUBLIC_API_URL=http://<mac-lan-ip>:8787`
   - Plugin **Server URL**: `http://<mac-lan-ip>:8787`, or pre-create `koreader/settings/koreader-dashboard-ulysse.lua` with `return { ["server_url"] = "http://<mac-lan-ip>:8787" }` over USB.
2. **Link this device** (also offered once by a full-screen welcome page at first startup): shows a code and a large QR code on the same screen. Open the URL, sign in, enter the code. The plugin polls until the code is confirmed or expires (10 min).
3. A first sync runs right after linking.
4. **Unlink device** revokes the device on the server when online (it leaves the website list) and forgets the token. A device revoked from the website is unlinked at its next sync.

Changing the server URL unlinks the device.

## Sync

Reads `page_stat_data` rows with `start_time > cursor` (joined to `book`, every `book` column sent) and posts them to `/v1/ingest` in batches of 5,000. The cursor only moves after a successful request. The statistics plugin flushes its buffer on document close, suspend and periodically: unflushed pages are sent on a later sync.

| Trigger                | Default | Notes                                                      |
| ---------------------- | ------- | ---------------------------------------------------------- |
| Closing a book         | on      | 1 s after close, once the statistics plugin has flushed    |
| Wake up                | on      | only if Wi-Fi is already connected                         |
| Wi-Fi connects         | on      | `NetworkConnected` event                                   |
| Periodic while reading | 30 min  | off / 15 / 30 / 60                                         |
| **Sync now**           | —       | bypasses the throttle, may turn Wi-Fi on (KOReader prompt) |

Automatic syncs: at most one every 5 minutes, never turn Wi-Fi on unless **Allow turning Wi-Fi on for automatic sync** is checked, no request when nothing is pending. A failure keeps the cursor and waits for the next trigger. When nothing is pending, a sync only checks the device status (`GET /v1/devices/current`), which detects a revoke from the website.

### Library (sidecars)

After the page stats, each sync reads the sidecar (`metadata.<ext>.lua`) of the books in the reading history and in the home folder, and sends those changed since the last successful send to `/v1/library`: reading status (reading / finished / on hold, also when set from the file browser), KOReader's percent, rating and review, metadata (series, language, keywords, identifiers, description), file path, and every highlight and note (text, note, chapter, page, date). Sidecars are read with `dofile`, never written.

## Debug

Logs are written to `koreader/crash.log` on the device (prefix `KOReaderDashboard:`).

If the plugin prevents KOReader from starting, delete its folder from `koreader/plugins/` over USB.

## Lint

```bash
luacheck --config apps/koplugin/.luacheckrc apps/koplugin
```
