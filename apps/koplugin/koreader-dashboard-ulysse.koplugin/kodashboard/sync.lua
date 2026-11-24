--[[--
Incremental sync of page stats to the API.

Module-level state (throttle, in-flight flag) is shared by the FileManager and ReaderUI
plugin instances.
]]

local NetworkMgr = require("ui/network/manager")
local UIManager = require("ui/uimanager")
local logger = require("logger")
local socketutil = require("socketutil")
local Covers = require("kodashboard/covers")
local DocSettings = require("docsettings")
local Library = require("kodashboard/library")
local lfs = require("libs/libkoreader-lfs")
local Stats = require("kodashboard/stats")

-- Only against triggers firing together (resume, then Wi-Fi back).
local THROTTLE_SECONDS = 30
-- Upper bound on batches per run, so a large backlog cannot freeze the UI for long.
local MAX_BATCHES = 20
-- Covers read and sent per run (each one opens the book file and uploads it).
local MAX_COVERS = 10
-- Pause between two cover batches when covers are left, so the UI stays usable.
local COVERS_PAUSE_SECONDS = 10
-- Live progress is best effort: never let it hold the UI (socketutil's default block
-- timeout is 60 s, and every request runs on the UI thread).
local REPORT_TIMEOUT = { 2, 4 }
-- Automatic syncs back off while the server is unreachable: 2, 4, 8... minutes, up to 1 h.
local BACKOFF_BASE_SECONDS = 120
local BACKOFF_MAX_SECONDS = 3600

local Sync = {
    last_attempt = 0,
    running = false,
    -- Consecutive runs that hit a network error (server unreachable).
    failures = 0,
    -- Set during a run once a request hit a network error: no more requests in that run.
    unreachable = false,
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
    self.unreachable = false
    local covers_pending

    -- Quick reachability probe: an unreachable server fails here in seconds, not minutes.
    if not self:report("running", "stats") then
        return self:finish({ ok = false, rows = 0, err = "server unreachable" })
    end

    local rows, batches, res = 0, 0, nil
    while batches < MAX_BATCHES do
        local cursor = self.settings:get("cursor") or 0
        local batch, err = Stats.readBatch(cursor)
        if not batch then
            res = { ok = false, rows = rows, err = err }
            break
        end
        if #batch.page_stats == 0 then
            res = { ok = true, rows = rows }
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
            self.unreachable = status == nil
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
        self:report("running", "library")
        local lib = self:syncLibrary()
        res.books = lib.books
        if lib.ok then
            covers_pending = self:syncCovers()
        end
        if not lib.ok then
            res = { ok = false, rows = rows, err = lib.err }
        elseif rows == 0 and lib.books == 0 then
            -- Nothing sent at all: still check the device, to detect a revoke from the website.
            res = self:checkStatus()
        end
    end

    if res.ok then
        self.settings:set("last_sync_time", os.time())
        self.settings:set("last_sync_rows", rows)
    end
    if self.settings:isLinked() then
        self:report("idle", nil, covers_pending)
    end
    res = self:finish(res)
    self:scheduleCovers(covers_pending)
    return res
end

--- Ends a run: updates the backoff and clears the running flag.
function Sync:finish(res)
    if res.ok then
        self.failures = 0
    else
        logger.warn("KOReaderDashboard: sync failed", res.err)
        if self.unreachable then
            self.failures = self.failures + 1
        end
    end
    self.running = false
    return res
end

--- Seconds to wait before the next automatic sync.
function Sync:minInterval()
    if self.failures == 0 then
        return THROTTLE_SECONDS
    end
    return math.min(BACKOFF_BASE_SECONDS * 2 ^ (self.failures - 1), BACKOFF_MAX_SECONDS)
end

--- Sends the covers left in further batches, while each batch makes progress (a book
--- unknown to the server never does) and Wi-Fi stays up.
function Sync:scheduleCovers(left)
    if not left or left == 0 then
        return
    end
    UIManager:scheduleIn(COVERS_PAUSE_SECONDS, function()
        if self.running or not self.settings:isLinked() or not self.isConnected() then
            return
        end
        self.running = true
        self.unreachable = false
        local now_left = self:syncCovers()
        self:report("idle", nil, now_left)
        self.running = false
        if now_left < left and not self.unreachable then
            self:scheduleCovers(now_left)
        end
    end)
end

--- Sends sidecars changed since the last successful send.
function Sync:syncLibrary()
    local sent = self.settings:get("library_sent") or {}
    local ok, changed = pcall(Library.collectChanged, sent)
    if not ok then
        logger.warn("KOReaderDashboard: library scan failed", changed)
        return { ok = true, books = 0 }
    end
    local books = 0
    for _, batch in ipairs(Library.batches(changed)) do
        local payload = {}
        for _, item in ipairs(batch) do
            table.insert(payload, item.book)
        end
        local status, data = self.api:post("/v1/library", { books = payload }, {
            auth = true,
            timeout = { socketutil.FILE_BLOCK_TIMEOUT, socketutil.FILE_TOTAL_TIMEOUT },
        })
        if status ~= 200 then
            self.unreachable = status == nil
            return { ok = false, books = books, err = self.api.errorMessage(status, data) }
        end
        for _, item in ipairs(batch) do
            sent[item.path] = item.mtime
        end
        self.settings:set("library_sent", sent)
        books = books + #batch
    end
    return { ok = true, books = books }
end

local function urlEncode(text)
    return (text:gsub("[^%w%-%._~/]", function(c)
        return string.format("%%%02X", c:byte())
    end))
end

--- Live progress for the website. Best effort, short timeout; skipped once the server
--- proved unreachable in this run.
--- @param state string "running" or "idle"
--- @param step string|nil "stats", "library" or "covers" while running
--- @param covers_pending number|nil covers left to send
--- @return boolean false on a network error
function Sync:report(state, step, covers_pending)
    if self.unreachable then
        return false
    end
    local status = self.api:request("PUT", "/v1/devices/current/sync", {
        state = state,
        step = step,
        covers_pending = covers_pending,
    }, {
        auth = true,
        timeout = REPORT_TIMEOUT,
    })
    if status == nil then
        self.unreachable = true
        return false
    end
    return true
end

--- Books whose cover is not handled yet: { { path, marker } }.
local function pendingCovers(sent)
    local pending = {}
    for _, path in ipairs(Library.listFiles()) do
        local mtime = lfs.attributes(path, "modification")
        -- Opening a book creates its sidecar, whose md5 may differ from the file's: resend then.
        local marker = mtime and (mtime .. (DocSettings:findSidecarFile(path) and ":opened" or ":new"))
        if marker and sent[path] ~= marker then
            table.insert(pending, { path = path, marker = marker })
        end
    end
    return pending
end

--- Sends the covers of books not handled yet, once per file version, and again once opened.
--- Best effort: a failure never fails the sync, the cover is retried on the next run.
--- @return number covers left for the next runs
function Sync:syncCovers()
    local sent = self.settings:get("covers_uploaded") or {}
    local pending = pendingCovers(sent)
    local left = #pending
    if not self:report("running", "covers", left) then
        return left
    end
    for i, item in ipairs(pending) do
        if i > MAX_COVERS then
            break
        end
        local done = true
        local image = Covers.of(item.path)
        local md5 = image and Library.md5Of(item.path)
        if md5 then
            local url = "/v1/library/covers/" .. md5 .. "?path=" .. urlEncode(item.path)
            local status = self.api:request("PUT", url, nil, {
                auth = true,
                raw = image,
                timeout = { socketutil.FILE_BLOCK_TIMEOUT, socketutil.FILE_TOTAL_TIMEOUT },
            })
            if status == nil then
                self.unreachable = true
                break -- Network down: stop, retry next run.
            end
            -- 404: book not on the server yet. Other errors (bad or too large image) are
            -- final for this file version.
            done = status ~= 404 and status ~= 401 and status < 500
        end
        if done then
            sent[item.path] = item.marker
            self.settings:set("covers_uploaded", sent)
            left = left - 1
            if image then
                self:report("running", "covers", left)
            end
        end
    end
    return left
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
    self.unreachable = status == nil
    return { ok = false, rows = 0, err = self.api.errorMessage(status, data) }
end

--- Automatic trigger: throttled, never turns Wi-Fi on unless allowed in settings.
function Sync:auto(reason)
    if not self.settings:isLinked() or self.running then
        return
    end
    if os.time() - self.last_attempt < self:minInterval() then
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
