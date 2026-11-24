--[[--
Incremental sync of page stats, library and covers to the API.

A run never blocks the UI: it happens in a forked subprocess (database reads, cover
extraction, HTTP). The child does not write the settings: it records its changes and
writes them, with its result, to a JSON file the parent applies once the child is done.
SQLite databases are opened read-only in the child, with connections of its own.

Module-level state (throttle, child pid) is shared by the FileManager and ReaderUI plugin
instances, so there is never more than one sync process.
]]

local Api = require("kodashboard/api")
local Covers = require("kodashboard/covers")
local DataStorage = require("datastorage")
local DocSettings = require("docsettings")
local JSON = require("json")
local Library = require("kodashboard/library")
local NetworkMgr = require("ui/network/manager")
local Stats = require("kodashboard/stats")
local UIManager = require("ui/uimanager")
local ffiutil = require("ffi/util")
local lfs = require("libs/libkoreader-lfs")
local logger = require("logger")
local socketutil = require("socketutil")

-- Only against triggers firing together (resume, then Wi-Fi back).
local THROTTLE_SECONDS = 30
-- Upper bound on page stats batches per run.
local MAX_BATCHES = 20
-- Covers read and sent per run (each one opens the book file and uploads it).
local MAX_COVERS = 200
-- Live progress is best effort, and the first report is the reachability probe: keep it short.
local REPORT_TIMEOUT = { 2, 4 }
-- Automatic syncs back off while the server is unreachable: 2, 4, 8... minutes, up to 1 h.
local BACKOFF_BASE_SECONDS = 120
local BACKOFF_MAX_SECONDS = 3600
-- The parent checks the child every second, and kills it after 10 minutes awake.
local POLL_SECONDS = 1
local MAX_POLLS = 600

local CACHE_DIR = DataStorage:getDataDir() .. "/cache"
local RESULT_FILE = CACHE_DIR .. "/kodashboard-sync.json"
local CRE_CACHE_DIR = CACHE_DIR .. "/kodashboard-cr3cache"

local Sync = {
    last_attempt = 0,
    -- Pid of the running sync process, nil when idle.
    pid = nil,
    -- Consecutive runs that failed on the network (server unreachable) or crashed.
    failures = 0,
}

function Sync:init(api, settings)
    self.api = api
    self.settings = settings
end

--- Wi-Fi up and connected, without turning anything on.
function Sync.isConnected()
    return NetworkMgr:isWifiOn() and NetworkMgr:isConnected()
end

function Sync:isRunning()
    return self.pid ~= nil
end

-- Child side ---------------------------------------------------------------------------

--- Settings as the child sees them: reads go to the parent's (in-memory copy), writes and
--- unlinking are only recorded, for the parent to apply.
local ChildSettings = {}
ChildSettings.__index = ChildSettings

function ChildSettings.new(settings)
    return setmetatable({ parent = settings, changes = {}, unlinked = false }, ChildSettings)
end

function ChildSettings:get(key)
    if self.unlinked and key == "device_token" then
        return nil
    end
    local value = self.changes[key]
    if value ~= nil then
        return value
    end
    return self.parent:get(key)
end

function ChildSettings:set(key, value)
    self.changes[key] = value
end

function ChildSettings:isLinked()
    return self:get("device_token") ~= nil
end

function ChildSettings:clearLink()
    self.unlinked = true
end

--- The work of one run, done in the child.
local Job = {}
Job.__index = Job

--- Sends every pending batch. Advances the cursor only after a successful request.
--- @return table { ok = bool, rows = n, books = n, err = string|nil, nothing = bool }
function Job:run()
    -- Quick reachability probe: an unreachable server fails here in seconds.
    if not self:report("running", "stats") then
        return { ok = false, rows = 0, err = "server unreachable" }
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

    local covers_pending
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
    return res
end

--- Sends sidecars changed since the last successful send.
function Job:syncLibrary()
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
function Job:report(state, step, covers_pending)
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
function Job:syncCovers()
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
function Job:checkStatus()
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

--- Entry point of the child: runs the job, writes its result for the parent.
local function runChild(parent_settings)
    local settings = ChildSettings.new(parent_settings)
    local job = setmetatable({ settings = settings, api = Api:new({ settings = settings }) }, Job)
    Covers.cache_dir = CRE_CACHE_DIR
    local ok, res = pcall(job.run, job)
    Library.close()
    if not ok then
        logger.warn("KOReaderDashboard: sync process error", res)
        res = { ok = false, rows = 0, err = tostring(res) }
    end
    local encoded, text = pcall(JSON.encode, {
        res = res,
        changes = settings.changes,
        unlinked = settings.unlinked,
        unreachable = job.unreachable or false,
    })
    if not encoded then
        logger.warn("KOReaderDashboard: cannot encode sync result", text)
        return
    end
    -- Written aside then renamed: the parent never reads a partial file.
    local tmp = RESULT_FILE .. ".tmp"
    local file = io.open(tmp, "w")
    if file then
        file:write(text)
        file:close()
        os.rename(tmp, RESULT_FILE)
    end
end

-- Parent side --------------------------------------------------------------------------

local function readResult()
    local file = io.open(RESULT_FILE, "r")
    if not file then
        return nil
    end
    local text = file:read("*a")
    file:close()
    os.remove(RESULT_FILE)
    local ok, data = pcall(JSON.decode, text)
    return ok and type(data) == "table" and type(data.res) == "table" and data or nil
end

--- Starts a run in a subprocess, unless one is running. Returns at once.
--- @param on_done function|nil called in the parent with the result table once the run ends
--- @return boolean true if a run was started
function Sync:start(on_done)
    local function fail(err)
        if on_done then
            on_done({ ok = false, rows = 0, err = err })
        end
        return false
    end
    if not self.settings:isLinked() then
        return fail("not linked")
    end
    if self.pid then
        return fail("already running")
    end
    self.last_attempt = os.time()
    lfs.mkdir(CACHE_DIR)
    os.remove(RESULT_FILE)

    local settings = self.settings
    local pid, err = ffiutil.runInSubProcess(function()
        runChild(settings)
    end)
    if not pid then
        logger.warn("KOReaderDashboard: cannot start sync process", err)
        return fail(tostring(err))
    end
    self.pid = pid
    self.token = settings:get("device_token")
    self.on_done = on_done
    self.polls = 0
    self:poll()
    return true
end

function Sync:poll()
    UIManager:scheduleIn(POLL_SECONDS, function()
        if not ffiutil.isSubProcessDone(self.pid) then
            self.polls = self.polls + 1
            if self.polls == MAX_POLLS then
                logger.warn("KOReaderDashboard: sync process too long, killing it")
                ffiutil.terminateSubProcess(self.pid)
            end
            self:poll()
            return
        end
        self:collect()
    end)
end

--- Applies the result of the finished child.
function Sync:collect()
    self.pid = nil
    local result = readResult()
    local res
    if not result then
        res = { ok = false, rows = 0, err = "sync process failed" }
        self.failures = self.failures + 1
    else
        res = result.res
        -- Unlinked or linked again during the run: its changes belong to the old link.
        if self.settings:get("device_token") == self.token then
            if type(result.changes) == "table" then
                self.settings:setMany(result.changes)
            end
            if result.unlinked then
                self.settings:clearLink()
                if self.api.on_unauthorized then
                    self.api.on_unauthorized()
                end
            end
        end
        if res.ok then
            self.failures = 0
        elseif result.unreachable then
            self.failures = self.failures + 1
        end
    end
    if not res.ok then
        logger.warn("KOReaderDashboard: sync failed", res.err)
    end
    local on_done = self.on_done
    self.on_done = nil
    if on_done then
        on_done(res)
    end
end

--- Seconds to wait before the next automatic sync.
function Sync:minInterval()
    if self.failures == 0 then
        return THROTTLE_SECONDS
    end
    return math.min(BACKOFF_BASE_SECONDS * 2 ^ (self.failures - 1), BACKOFF_MAX_SECONDS)
end

--- Automatic trigger: throttled, never turns Wi-Fi on unless allowed in settings.
function Sync:auto(reason)
    if not self.settings:isLinked() or self.pid then
        return
    end
    if os.time() - self.last_attempt < self:minInterval() then
        logger.dbg("KOReaderDashboard: sync throttled", reason)
        return
    end
    if self.isConnected() then
        logger.dbg("KOReaderDashboard: auto sync", reason)
        self:start()
    elseif self.settings:get("allow_wifi") then
        NetworkMgr:runWhenOnline(function()
            self:start()
        end)
    end
end

return Sync
