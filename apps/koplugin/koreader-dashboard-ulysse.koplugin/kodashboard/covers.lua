--[[--
Cover image of a book, read as stored in the file (original colours and format).

First asked to crengine, so it is the cover KOReader shows (EPUB, FB2, MOBI...: crengine
also finds covers the OPF does not declare). Else, for an EPUB, found through the OPF
package: EPUB 3 `properties="cover-image"`, else the EPUB 2 `<meta name="cover">`, else an
image item named "cover". Nothing is rendered or resized here: the API resizes the image.
]]

local logger = require("logger")

local Covers = {
    -- Same limit as the API: larger covers are not sent.
    MAX_BYTES = 8 * 1024 * 1024,
}

local function attr(tag, name)
    return tag:match("%s" .. name .. '%s*=%s*"([^"]*)"') or tag:match("%s" .. name .. "%s*=%s*'([^']*)'")
end

local function unescape(href)
    href = href:gsub("#.*$", ""):gsub("%%(%x%x)", function(h)
        return string.char(tonumber(h, 16))
    end)
    return (href:gsub("&amp;", "&"))
end

--- Zip path of `href` relative to the OPF file.
local function resolve(opf_path, href)
    local parts = {}
    for part in ((opf_path:match("^(.*)/") or "") .. "/" .. unescape(href)):gmatch("[^/]+") do
        if part == ".." then
            table.remove(parts)
        elseif part ~= "." then
            table.insert(parts, part)
        end
    end
    return table.concat(parts, "/")
end

local function isImage(item)
    local media = item["media-type"] or ""
    return media:match("^image/") ~= nil and media ~= "image/svg+xml"
end

--- Zip path of the cover image declared by an OPF document, or nil.
function Covers.coverHref(opf)
    local items, by_id = {}, {}
    for tag in opf:gmatch("<[%w:]*item%s[^>]*>") do
        local item = {
            id = attr(tag, "id"),
            href = attr(tag, "href"),
            ["media-type"] = attr(tag, "media%-type"),
            properties = attr(tag, "properties"),
        }
        if item.href then
            table.insert(items, item)
            if item.id then
                by_id[item.id] = item
            end
        end
    end
    for _, item in ipairs(items) do
        if item.properties and (" " .. item.properties .. " "):find(" cover-image ", 1, true) then
            return item.href
        end
    end
    for tag in opf:gmatch("<[%w:]*meta%s[^>]*>") do
        if attr(tag, "name") == "cover" then
            local content = attr(tag, "content")
            local item = content and by_id[content]
            if item and isImage(item) then
                return item.href
            end
        end
    end
    for _, item in ipairs(items) do
        if isImage(item) and ((item.id or ""):lower():find("cover") or item.href:lower():find("cover")) then
            return item.href
        end
    end
    return nil
end

local function find(entries, path)
    if entries[path] then
        return path
    end
    local lower = path:lower()
    for key, entry in pairs(entries) do
        if type(key) == "string" and key:lower() == lower and entry.mode == "file" then
            return key
        end
    end
    return nil
end

local function extract(arc, path)
    local key = find(arc.entries, path)
    local entry = key and arc.entries[key]
    if not entry or entry.size > Covers.MAX_BYTES then
        return nil
    end
    return arc:extractToMemory(key)
end

--- Raw cover image as crengine finds it, or nil (not a crengine format, no cover, too large).
function Covers.fromCrengine(path)
    local ok_lib, DocumentRegistry = pcall(require, "document/documentregistry")
    local ok_ffi, ffi = pcall(require, "ffi")
    if not ok_lib or not ok_ffi or not pcall(require, "ffi/posix_h") then
        return nil
    end
    local provider = DocumentRegistry:getProvider(path)
    if not provider or provider.provider ~= "crengine" then
        return nil
    end
    local doc = DocumentRegistry:openDocument(path, provider)
    if not doc then
        return nil
    end
    local ok, data = pcall(function()
        -- Metadata only: no rendering needed to get the cover.
        if not doc:loadDocument(false) then
            return nil
        end
        local ptr, size = doc._document:getCoverPageImageData()
        if not ptr then
            return nil
        end
        local image = size and size > 0 and size <= Covers.MAX_BYTES and ffi.string(ptr, size) or nil
        ffi.C.free(ptr)
        return image
    end)
    doc:close()
    if not ok then
        logger.warn("KOReaderDashboard: crengine cover failed", path, data)
        return nil
    end
    return data
end

--- Raw cover image of an EPUB file, or nil (not an EPUB, no cover, too large).
function Covers.fromEpub(path)
    if not path:lower():match("%.epub$") then
        return nil
    end
    local ok_lib, Archiver = pcall(require, "ffi/archiver")
    if not ok_lib then
        return nil
    end
    local arc = Archiver.Reader:new()
    if not arc:open(path) then
        return nil
    end
    local ok, data = pcall(function()
        -- List every entry first: extractToMemory only finds entries already listed.
        for _ in arc:iterate() do
        end
        local container = extract(arc, "META-INF/container.xml")
        local opf_path = container and attr(container:match("<[%w:]*rootfile%s[^>]*>") or "", "full%-path")
        local opf = opf_path and extract(arc, opf_path)
        local href = opf and Covers.coverHref(opf)
        return href and extract(arc, resolve(opf_path, href))
    end)
    arc:close()
    if not ok then
        logger.warn("KOReaderDashboard: cover extraction failed", path, data)
        return nil
    end
    return data
end

--- Raw cover of a book file, or nil.
function Covers.of(path)
    return Covers.fromCrengine(path) or Covers.fromEpub(path)
end

Covers.resolve = resolve

return Covers
