--[[--
Book sidecars (metadata.<ext>.lua): reading status, KOReader progress, metadata, annotations.

Books come from the reading history and the home folder. Sidecars are read with dofile,
read-only (DocSettings:open may delete invalid candidates). Books never opened have no
sidecar: their metadata comes from the Cover Browser cache (BookInfoManager), else from the
file name. Only books changed since the last successful send are sent.
]]

local DataStorage = require("datastorage")
local DocSettings = require("docsettings")
local DocumentRegistry = require("document/documentregistry")
local ReadHistory = require("readhistory")
local SQ3 = require("lua-ljsqlite3/init")
local lfs = require("libs/libkoreader-lfs")
local logger = require("logger")
local util = require("util")

local Library = {
    BATCH_BOOKS = 50,
    BATCH_ANNOTATIONS = 4000,
    MAX_DEPTH = 8,
    MAX_FILES = 10000,
}

local STATUSES = { reading = true, complete = true, abandoned = true }

local function str(v)
    if type(v) == "string" and v ~= "" then
        return v
    end
    if type(v) == "number" then
        return tostring(v)
    end
    return nil
end

local function int(v)
    v = tonumber(v)
    return v and math.floor(v) or nil
end

local function localDateTime(v)
    return type(v) == "string" and v:match("^%d%d%d%d%-%d%d%-%d%d %d%d:%d%d:%d%d$") and v or nil
end

local function homeDir()
    local home = G_reader_settings:readSetting("home_dir")
    if home then
        return home
    end
    local ok, fmutil = pcall(require, "apps/filemanager/filemanagerutil")
    if ok and fmutil.getDefaultDir then
        return fmutil.getDefaultDir()
    end
    return nil
end

local function walk(dir, out, seen, depth)
    if depth > Library.MAX_DEPTH or #out >= Library.MAX_FILES then
        return
    end
    local ok, iter, dir_obj = pcall(lfs.dir, dir)
    if not ok then
        return
    end
    for name in iter, dir_obj do
        if name:sub(1, 1) ~= "." then
            local path = dir .. "/" .. name
            local mode = lfs.attributes(path, "mode")
            if mode == "directory" then
                if not name:match("%.sdr$") then
                    walk(path, out, seen, depth + 1)
                end
            elseif
                mode == "file"
                and not seen[path]
                and DocumentRegistry:hasProvider(path)
                and not DocumentRegistry:isImageFile(path)
            then
                seen[path] = true
                table.insert(out, path)
            end
        end
    end
end

--- Book files known to KOReader: history first, then the home folder.
function Library.listFiles()
    local files, seen = {}, {}
    for _, entry in ipairs(ReadHistory.hist or {}) do
        if entry.file and not seen[entry.file] and lfs.attributes(entry.file, "mode") == "file" then
            seen[entry.file] = true
            table.insert(files, entry.file)
        end
    end
    local home = homeDir()
    if home and lfs.attributes(home, "mode") == "directory" then
        walk(home:gsub("/+$", ""), files, seen, 0)
    end
    return files
end

local function annotationsOf(data)
    local list = {}
    for _, a in ipairs(type(data.annotations) == "table" and data.annotations or {}) do
        if type(a) == "table" then
            table.insert(list, {
                text = str(a.text),
                note = str(a.note),
                chapter = str(a.chapter),
                pageno = int(a.pageno),
                datetime = localDateTime(a.datetime),
                datetime_updated = localDateTime(a.datetime_updated),
                color = str(a.color),
                drawer = str(a.drawer),
                pos0 = type(a.pos0) == "string" and a.pos0 or nil,
                pos1 = type(a.pos1) == "string" and a.pos1 or nil,
            })
        end
    end
    return list
end

--- Builds the API payload for one book from its sidecar data, or nil.
function Library.bookFromSidecar(path, data)
    local md5 = str(data.partial_md5_checksum)
    if not md5 then
        local ok, hash = pcall(util.partialMD5, path)
        md5 = ok and hash or nil
    end
    if not md5 then
        return nil
    end
    local props = type(data.doc_props) == "table" and data.doc_props or {}
    -- Statistics identity (title, authors) as written by the statistics plugin, so the book
    -- matches its statistics.sqlite3 row.
    local stats = type(data.stats) == "table" and data.stats or {}
    local summary = type(data.summary) == "table" and data.summary or {}
    local filename = path:match("([^/]+)$") or path
    local percent = tonumber(data.percent_finished)
    local annotations = annotationsOf(data)
    local modified = type(summary.modified) == "string" and summary.modified:match("^%d%d%d%d%-%d%d%-%d%d") or nil
    return {
        md5 = md5,
        title = str(stats.title) or str(props.title) or filename,
        authors = str(stats.authors) or str(props.authors),
        series = str(stats.series) or str(props.series),
        series_index = tonumber(props.series_index),
        language = str(stats.language) or str(props.language),
        keywords = str(props.keywords),
        identifiers = str(props.identifiers),
        description = str(props.description),
        pages = int(data.doc_pages) or int(stats.pages),
        file_path = path,
        status = STATUSES[summary.status] and summary.status or nil,
        status_modified = modified,
        percent_finished = percent and math.max(0, math.min(1, percent)) or nil,
        rating = int(summary.rating),
        review = str(summary.note),
        highlights = int(stats.highlights),
        notes = int(stats.notes),
        -- Omitted when empty: the server treats a missing list as "no annotations".
        annotations = annotations[1] and annotations or nil,
    }
end

-- Cover Browser's metadata cache, read only with a connection of our own: this runs in the
-- sync subprocess, which must neither write it nor reuse a connection opened before the fork.
local BOOKINFO_DB = DataStorage:getSettingsDir() .. "/bookinfo_cache.sqlite3"
local BOOKINFO_SQL = "SELECT pages, title, authors, series, series_index, language, keywords, description "
    .. "FROM bookinfo WHERE directory=? AND filename=? AND in_progress=0;"

local function bookInfoDb()
    if Library.bookinfo_db == nil then
        local ok, conn = false, nil
        if lfs.attributes(BOOKINFO_DB, "mode") == "file" then
            ok, conn = pcall(SQ3.open, BOOKINFO_DB, "ro")
        end
        Library.bookinfo_db = ok and conn or false
        if Library.bookinfo_db then
            pcall(conn.set_busy_timeout, conn, 5000)
        end
    end
    return Library.bookinfo_db or nil
end

--- Metadata Cover Browser cached for a book file, or nil.
local function cachedProps(path)
    local conn = bookInfoDb()
    if not conn then
        return nil
    end
    local directory, filename = util.splitFilePathName(path)
    local ok, row = pcall(function()
        local stmt = conn:prepare(BOOKINFO_SQL)
        local found = stmt:bind(directory, filename):step()
        stmt:close()
        return found
    end)
    if not ok or not row then
        return nil
    end
    return {
        pages = tonumber(row[1]),
        title = row[2],
        authors = row[3],
        series = row[4],
        series_index = row[5],
        language = row[6],
        keywords = row[7],
        description = row[8],
    }
end

--- Closes the metadata cache connection, if open.
function Library.close()
    if Library.bookinfo_db then
        pcall(Library.bookinfo_db.close, Library.bookinfo_db)
    end
    Library.bookinfo_db = nil
end

--- Calibre names files "Title - Author.ext".
function Library.propsFromFilename(path)
    local name = (path:match("([^/]+)$") or path):gsub("%.[^.]+$", "")
    local title, authors = name:match("^(.-) %- (.+)$")
    return { title = title or name, authors = authors }
end

--- Payload for a book never opened (no sidecar), or nil.
function Library.bookFromFile(path)
    local ok, md5 = pcall(util.partialMD5, path)
    if not ok or not md5 then
        return nil
    end
    local props = cachedProps(path)
    local fallback = Library.propsFromFilename(path)
    props = props or {}
    return {
        md5 = md5,
        title = str(props.title) or fallback.title,
        authors = str(props.authors) or fallback.authors,
        series = str(props.series),
        series_index = tonumber(props.series_index),
        language = str(props.language),
        keywords = str(props.keywords),
        description = str(props.description),
        pages = int(props.pages),
        file_path = path,
    }
end

--- md5 the book is sent with: the sidecar's (as bookFromSidecar), else the file's.
function Library.md5Of(path)
    local sidecar = DocSettings:findSidecarFile(path)
    if sidecar then
        local ok, data = pcall(dofile, sidecar)
        local md5 = ok and type(data) == "table" and str(data.partial_md5_checksum)
        if md5 then
            return md5
        end
    end
    local ok, md5 = pcall(util.partialMD5, path)
    return ok and md5 or nil
end

--- Books changed since the last send: { { path, mtime, book } }.
--- `sent[path]` is the sidecar mtime, or "new:<file mtime>" for a book never opened.
function Library.collectChanged(sent)
    local changed = {}
    for _, path in ipairs(Library.listFiles()) do
        local sidecar = DocSettings:findSidecarFile(path)
        local mtime = sidecar and lfs.attributes(sidecar, "modification")
        if not sidecar then
            local file_mtime = lfs.attributes(path, "modification")
            local marker = file_mtime and ("new:" .. file_mtime)
            if marker and sent[path] ~= marker then
                local book = Library.bookFromFile(path)
                if book then
                    table.insert(changed, { path = path, mtime = marker, book = book })
                end
            end
        elseif mtime and sent[path] ~= mtime then
            local ok, data = pcall(dofile, sidecar)
            if ok and type(data) == "table" then
                local book = Library.bookFromSidecar(path, data)
                if book then
                    table.insert(changed, { path = path, mtime = mtime, book = book })
                end
            else
                logger.warn("KOReaderDashboard: unreadable sidecar", sidecar)
            end
        end
    end
    return changed
end

--- Splits changed books into request batches (books and annotations limits).
function Library.batches(changed)
    local batches, current, annotations = {}, {}, 0
    for _, item in ipairs(changed) do
        local n = #(item.book.annotations or {})
        if #current > 0 and (#current >= Library.BATCH_BOOKS or annotations + n > Library.BATCH_ANNOTATIONS) then
            table.insert(batches, current)
            current, annotations = {}, 0
        end
        if n > Library.BATCH_ANNOTATIONS then
            -- Keep the most recent annotations only (server limit per request).
            local trimmed = {}
            for i = n - Library.BATCH_ANNOTATIONS + 1, n do
                table.insert(trimmed, item.book.annotations[i])
            end
            item.book.annotations = trimmed
            n = #trimmed
        end
        table.insert(current, item)
        annotations = annotations + n
    end
    if #current > 0 then
        table.insert(batches, current)
    end
    return batches
end

return Library
