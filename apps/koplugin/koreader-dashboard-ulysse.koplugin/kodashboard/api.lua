--[[--
HTTP + JSON client for the KOReader Dashboard API.

Every call returns `status, data` on an HTTP response (data = decoded JSON or nil),
or `nil, err` on a network error. A 401 on an authenticated call triggers `on_unauthorized`.
]]

local JSON = require("json")
local http = require("socket.http")
local https = require("ssl.https")
local logger = require("logger")
local ltn12 = require("ltn12")
local socketutil = require("socketutil")

local Api = {}
Api.__index = Api

--- @param o table { settings = Settings, on_unauthorized = function() }
function Api:new(o)
    return setmetatable(o, self)
end

function Api:baseUrl()
    local url = self.settings:get("server_url")
    return url and (url:gsub("/+$", ""))
end

local function decode(text)
    if not text or text == "" then
        return nil
    end
    local ok, data = pcall(JSON.decode, text)
    if ok and type(data) == "table" then
        return data
    end
    return nil
end

--- @param method string
--- @param path string e.g. "/v1/ingest"
--- @param payload table|nil JSON body
--- @param opts table|nil { auth = true, timeout = { block, total }, ignore_401 = true }
function Api:request(method, path, payload, opts)
    opts = opts or {}
    local base = self:baseUrl()
    if not base then
        return nil, "server_url not set"
    end
    local url = base .. path
    local body = payload and JSON.encode(payload)
    local headers = { ["Accept"] = "application/json" }
    if body then
        headers["Content-Type"] = "application/json"
        headers["Content-Length"] = tostring(#body)
    end
    if opts.auth then
        local token = self.settings:get("device_token")
        if not token then
            return nil, "not linked"
        end
        headers["Authorization"] = "Bearer " .. token
    end

    local sink = {}
    local timeout = opts.timeout or { socketutil.LARGE_BLOCK_TIMEOUT, socketutil.LARGE_TOTAL_TIMEOUT }
    socketutil:set_timeout(timeout[1], timeout[2])
    local requester = url:match("^https://") and https or http
    local ok, res, code = pcall(requester.request, {
        url = url,
        method = method,
        headers = headers,
        source = body and ltn12.source.string(body) or nil,
        sink = socketutil.table_sink(sink),
    })
    socketutil:reset_timeout()

    if not ok then
        logger.warn("KOReaderDashboard:", method, path, "failed:", res)
        return nil, tostring(res)
    end
    if res == nil or type(code) ~= "number" then
        logger.warn("KOReaderDashboard:", method, path, "network error:", code)
        return nil, tostring(code)
    end

    local data = decode(table.concat(sink))
    if code == 401 and opts.auth and not opts.ignore_401 then
        logger.warn("KOReaderDashboard: device token rejected, unlinking")
        self.settings:clearLink()
        if self.on_unauthorized then
            self.on_unauthorized()
        end
    elseif code >= 400 then
        logger.warn("KOReaderDashboard:", method, path, "HTTP", code, data and data.error and data.error.code)
    end
    return code, data
end

function Api:post(path, payload, opts)
    return self:request("POST", path, payload, opts)
end

--- Error message from an API error body, for display.
function Api.errorMessage(status, data)
    if type(data) == "table" and type(data.error) == "table" and data.error.message then
        return data.error.message
    end
    return status and ("HTTP " .. tostring(status)) or tostring(data)
end

return Api
