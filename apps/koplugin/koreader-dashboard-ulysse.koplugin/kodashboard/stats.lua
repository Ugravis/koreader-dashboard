--[[--
Read-only access to KOReader's statistics database (settings/statistics.sqlite3, schema 20221111).

The statistics plugin buffers page stats in memory and flushes them on document close,
suspend and periodically: only flushed rows are visible here.
]]

local DataStorage = require("datastorage")
local SQ3 = require("lua-ljsqlite3/init")
local lfs = require("libs/libkoreader-lfs")
local logger = require("logger")

local Stats = {
    path = DataStorage:getSettingsDir() .. "/statistics.sqlite3",
    BATCH_SIZE = 5000,
}

-- INTEGER columns come back as int64 cdata.
local function num(v)
    if v == nil then
        return nil
    end
    return tonumber(v)
end

local function str(v)
    if v == nil then
        return nil
    end
    return tostring(v)
end

local PAGE_STATS_SQL = [[
    SELECT p.id_book, b.md5, p.page, p.start_time, p.duration, p.total_pages
    FROM page_stat_data p
    JOIN book b ON b.id = p.id_book
    WHERE p.start_time > ? AND b.md5 IS NOT NULL AND p.duration > 0
    ORDER BY p.start_time
    LIMIT %d
]]

local BOOKS_SQL = [[
    SELECT md5, title, authors, series, language, pages, notes, highlights,
           last_open, total_read_time, total_read_pages
    FROM book
    WHERE id IN (%s)
]]

--- Reads the next batch of page stats after `cursor` with the books they reference.
--- @return table|nil { books, page_stats, cursor, full } or nil, err
function Stats.readBatch(cursor, limit)
    limit = limit or Stats.BATCH_SIZE
    if not lfs.attributes(Stats.path, "mode") then
        return nil, "statistics database not found"
    end
    local ok, conn = pcall(SQ3.open, Stats.path, "ro")
    if not ok or not conn then
        logger.warn("KOReaderDashboard: cannot open statistics db", conn)
        return nil, "cannot open statistics database"
    end

    local result, err
    ok, err = pcall(function()
        local page_stats, book_ids, seen = {}, {}, {}
        local stmt = conn:prepare(string.format(PAGE_STATS_SQL, limit))
        stmt:bind(cursor)
        local row = stmt:step()
        while row do
            local id_book = num(row[1])
            if not seen[id_book] then
                seen[id_book] = true
                table.insert(book_ids, id_book)
            end
            table.insert(page_stats, {
                md5 = str(row[2]),
                page = num(row[3]),
                start_time = num(row[4]),
                duration = num(row[5]),
                total_pages = num(row[6]),
            })
            row = stmt:step()
        end
        stmt:close()

        local full = #page_stats >= limit
        -- A full batch may cut rows sharing the last start_time: keep them for the next batch.
        if full then
            local last = page_stats[#page_stats].start_time
            local trimmed = {}
            for _, p in ipairs(page_stats) do
                if p.start_time < last then
                    table.insert(trimmed, p)
                end
            end
            if #trimmed > 0 then
                page_stats = trimmed
            end
        end

        local books = {}
        if #book_ids > 0 then
            stmt = conn:prepare(string.format(BOOKS_SQL, table.concat(book_ids, ",")))
            row = stmt:step()
            while row do
                table.insert(books, {
                    md5 = str(row[1]),
                    title = str(row[2]) or "",
                    authors = str(row[3]),
                    series = str(row[4]),
                    language = str(row[5]),
                    pages = num(row[6]),
                    notes = num(row[7]),
                    highlights = num(row[8]),
                    last_open = num(row[9]),
                    total_read_time = num(row[10]),
                    total_read_pages = num(row[11]),
                })
                row = stmt:step()
            end
            stmt:close()
        end

        local max_start = cursor
        for _, p in ipairs(page_stats) do
            if p.start_time > max_start then
                max_start = p.start_time
            end
        end
        result = { books = books, page_stats = page_stats, cursor = max_start, full = full }
    end)
    pcall(conn.close, conn)

    if not ok then
        logger.warn("KOReaderDashboard: reading statistics failed", err)
        return nil, "cannot read statistics database"
    end
    return result
end

return Stats
