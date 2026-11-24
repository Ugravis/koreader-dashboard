--[[--
Incremental sync of page stats to the API.

Module-level state (throttle, in-flight flag) is shared by the FileManager and ReaderUI
plugin instances.
]]

local NetworkMgr = require("ui/network/manager")
local logger = require("logger")
local socketutil = require("socketutil")
local Stats = require("kodashboard/stats")

local THROTTLE_SECONDS = 5 * 60
-- Upper bound on batches per run, so a large backlog cannot freeze the UI for long.
local MAX_BATCHES = 20

local Sync = {
    last_attempt = 0,
    running = false,
}

function Sync:init(api, settings)
    self.api = api
    self.settings = settings
end

--- Wi-Fi up and connected, without turning anything on.
function Sync.isConnected()
    return NetworkMgr:isWifiOn() and NetworkMgr:isConnected()
end

--- Sends every pending batch. Advances the cursor only after a successful request.
--- @return table { ok = bool, rows = n, err = string|nil, nothing = bool }
function Sync:run()
    if not self.settings:isLinked() then
        return { ok = false, rows = 0, err = "not linked" }
    end
    if self.running then
        return { ok = false, rows = 0, err = "already running" }
    end
    self.running = true
    self.last_attempt = os.time()

    local rows, batches, res = 0, 0, nil
    while batches < MAX_BATCHES do
        local cursor = self.settings:get("cursor") or 0
        local batch, err = Stats.readBatch(cursor)
        if not batch then
            res = { ok = false, rows = rows, err = err }
            break
        end
        if #batch.page_stats == 0 then
            if rows == 0 then
                -- Nothing to send: still check the device, to detect a revoke from the website.
                res = self:checkStatus()
            else
                res = { ok = true, rows = rows }
            end
            break
        end

        local status, data = self.api:post("/v1/ingest", {
            books = batch.books,
            page_stats = batch.page_stats,
        }, {
            auth = true,
            timeout = { socketutil.FILE_BLOCK_TIMEOUT, socketutil.FILE_TOTAL_TIMEOUT },
        })
        if status ~= 200 then
            res = { ok = false, rows = rows, err = self.api.errorMessage(status, data) }
            break
        end

        -- Server cursor = max start_time of the batch, same as ours.
        local next_cursor = type(data) == "table" and tonumber(data.cursor) or batch.cursor
        self.settings:set("cursor", math.max(next_cursor, cursor))
        rows = rows + #batch.page_stats
        batches = batches + 1
        if not batch.full then
            res = { ok = true, rows = rows }
            break
        end
    end
    res = res or { ok = true, rows = rows }

    if res.ok then
        self.settings:set("last_sync_time", os.time())
        self.settings:set("last_sync_rows", rows)
    else
        logger.warn("KOReaderDashboard: sync failed", res.err)
    end
    self.running = false
    return res
end

--- Device status check. A 401 unlinks the device (handled by Api).
function Sync:checkStatus()
    local status, data = self.api:request("GET", "/v1/devices/current", nil, { auth = true })
    if status == 200 then
        if type(data) == "table" and data.web_url then
            self.settings:set("web_url", data.web_url)
        end
        return { ok = true, rows = 0, nothing = true }
    end
    return { ok = false, rows = 0, err = self.api.errorMessage(status, data) }
end

--- Automatic trigger: throttled, never turns Wi-Fi on unless allowed in settings.
function Sync:auto(reason)
    if not self.settings:isLinked() or self.running then
        return
    end
    if os.time() - self.last_attempt < THROTTLE_SECONDS then
        logger.dbg("KOReaderDashboard: sync throttled", reason)
        return
    end
    if self.isConnected() then
        logger.dbg("KOReaderDashboard: auto sync", reason)
        self:run()
    elseif self.settings:get("allow_wifi") then
        NetworkMgr:runWhenOnline(function()
            self:run()
        end)
    end
end

return Sync
