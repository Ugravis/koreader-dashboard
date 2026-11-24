--[[--
Plugin settings, stored with LuaSettings in settings/koreader-dashboard-ulysse.lua.
]]

local DataStorage = require("datastorage")
local LuaSettings = require("luasettings")

local DEFAULTS = {
    -- No public server yet: the URL must be set from the menu (e.g. http://<mac-lan-ip>:8787).
    server_url = nil,
    device_token = nil,
    -- Last synced page_stat_data.start_time (unix seconds).
    cursor = 0,
    sync_on_close = true,
    sync_on_resume = true,
    sync_on_network = true,
    -- Minutes between periodic syncs while reading, 0 = off.
    sync_interval = 30,
    allow_wifi = false,
    last_sync_time = nil,
    last_sync_rows = nil,
    -- Website base URL, returned by the API when linking or checking the device status.
    web_url = nil,
    -- Sidecar modification time last sent, per book path.
    library_sent = nil,
    -- File version whose cover was handled (sent, or none in the file), per path:
    -- "<file mtime>:new" or "<file mtime>:opened".
    covers_uploaded = nil,
    -- One-time onboarding panel at startup.
    onboarding_shown = false,
}

local Settings = {
    file = DataStorage:getSettingsDir() .. "/koreader-dashboard-ulysse.lua",
}

function Settings:load()
    if not self.data then
        self.data = LuaSettings:open(self.file)
    end
    return self
end

function Settings:get(key)
    local value = self.data:readSetting(key)
    if value == nil then
        return DEFAULTS[key]
    end
    return value
end

function Settings:set(key, value)
    if value == nil then
        self.data:delSetting(key)
    else
        self.data:saveSetting(key, value)
    end
    self.data:flush()
end

function Settings:isLinked()
    return self:get("device_token") ~= nil
end

--- Clears the device token and sync state (unlink or revoked token).
function Settings:clearLink()
    local keys = {
        "device_token",
        "cursor",
        "last_sync_time",
        "last_sync_rows",
        "library_sent",
        "covers_uploaded",
    }
    for _, key in ipairs(keys) do
        self.data:delSetting(key)
    end
    self.data:flush()
end

return Settings
