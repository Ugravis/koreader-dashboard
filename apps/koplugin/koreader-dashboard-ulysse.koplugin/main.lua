local ConfirmBox = require("ui/widget/confirmbox")
local InfoMessage = require("ui/widget/infomessage")
local InputDialog = require("ui/widget/inputdialog")
local NetworkMgr = require("ui/network/manager")
local UIManager = require("ui/uimanager")
local WidgetContainer = require("ui/widget/container/widgetcontainer")
local _ = require("gettext")
local T = require("ffi/util").template
local datetime = require("datetime")

-- Submodules are namespaced: plugin dirs end up in the global package.path.
local Api = require("kodashboard/api")
local Pairing = require("kodashboard/pairing")
local Page = require("kodashboard/page")
local Settings = require("kodashboard/settings")
local Sync = require("kodashboard/sync")

local VERSION = "0.1.0"

local Dashboard = WidgetContainer:extend({
    name = "koreader-dashboard-ulysse",
    is_doc_only = false,
})

function Dashboard:init()
    self.settings = Settings:load()
    self.api = Api:new({
        settings = self.settings,
        on_unauthorized = function()
            self:refreshMenu()
            UIManager:show(ConfirmBox:new({
                text = _("This e-reader was unlinked from KOReader Dashboard (revoked from the website).\n\n"
                    .. "Link it again to resume syncing. Statistics already sent are kept."),
                ok_text = _("Link now"),
                cancel_text = _("Later"),
                ok_callback = function()
                    self:link()
                end,
            }))
        end,
    })
    self.pairing = Pairing:new({
        api = self.api,
        settings = self.settings,
        on_linked = function()
            self:refreshMenu()
            -- First sync right away: the device is online at this point.
            self:syncNow()
        end,
    })
    Sync:init(self.api, self.settings)
    self.ui.menu:registerToMainMenu(self)

    if not self.settings:isLinked() and not self.settings:get("onboarding_shown") then
        UIManager:nextTick(function()
            -- FileManager and ReaderUI both load the plugin: show it once.
            if self.settings:get("onboarding_shown") or self.settings:isLinked() then
                return
            end
            self.settings:set("onboarding_shown", true)
            self:showWelcome(
                _("Welcome to KOReader Dashboard"),
                _("Sync your reading statistics to your account and follow your reading on the website: "
                    .. "books, reading time, progress.\n\n"
                    .. "1. Tap Link now: a code and a QR code appear.\n"
                    .. "2. Scan the QR code with your phone (or open the link) and sign in.\n"
                    .. "3. Confirm the code. Statistics sync right away, then automatically.\n\n"
                    .. "You can do it later from Tools > KOReader Dashboard.")
            )
        end)
    end
end

function Dashboard:refreshMenu()
    if self.touchmenu_instance then
        pcall(self.touchmenu_instance.updateItems, self.touchmenu_instance)
    end
end

--- Full-screen welcome page with Link now / Later (first start).
function Dashboard:showWelcome(title, text)
    local page
    page = Page:new({
        title = title,
        text = text,
        buttons = {
            {
                {
                    text = _("Later"),
                    callback = function()
                        UIManager:close(page)
                    end,
                },
                {
                    text = _("Link now"),
                    callback = function()
                        UIManager:close(page)
                        self:link()
                    end,
                },
            },
        },
    })
    UIManager:show(page)
end

function Dashboard:onCloseWidget()
    if self.pairing then
        self.pairing:stop()
    end
    self:unschedulePeriodic()
end

-- Sync triggers (see docs/plans/v0.1.0.md, section 0).

function Dashboard:onReaderReady()
    self:schedulePeriodic()
end

function Dashboard:onCloseDocument()
    if self.settings:get("sync_on_close") then
        -- Let the statistics plugin flush its buffer (its own onCloseDocument) first.
        UIManager:scheduleIn(1, function()
            Sync:auto("close")
        end)
    end
end

function Dashboard:onResume()
    -- Wi-Fi often comes back a few seconds after resume: onNetworkConnected covers that case.
    if self.settings:get("sync_on_resume") and Sync.isConnected() then
        Sync:auto("resume")
    end
end

function Dashboard:onNetworkConnected()
    if self.settings:get("sync_on_network") then
        UIManager:scheduleIn(2, function()
            Sync:auto("network")
        end)
    end
end

function Dashboard:schedulePeriodic()
    self:unschedulePeriodic()
    local minutes = self.settings:get("sync_interval") or 0
    if minutes <= 0 or not self.ui.document then
        return
    end
    self.periodic_func = function()
        Sync:auto("periodic")
        UIManager:scheduleIn(minutes * 60, self.periodic_func)
    end
    UIManager:scheduleIn(minutes * 60, self.periodic_func)
end

function Dashboard:unschedulePeriodic()
    if self.periodic_func then
        UIManager:unschedule(self.periodic_func)
        self.periodic_func = nil
    end
end

--- Manual sync: bypasses the throttle, may turn Wi-Fi on (KOReader prompts per its own settings).
function Dashboard:syncNow(on_done)
    if not self.settings:isLinked() then
        UIManager:show(InfoMessage:new({ text = _("Link this device first.") }))
        return
    end
    NetworkMgr:runWhenOnline(function()
        local progress = InfoMessage:new({ text = _("Syncing reading statistics…") })
        UIManager:show(progress)
        UIManager:forceRePaint()
        local res = Sync:run()
        UIManager:close(progress)
        if not self.settings:isLinked() then
            -- Revoked from the website: Api already told the user.
            self:refreshMenu()
            return
        end
        local text
        if res.ok and res.nothing then
            text = _("Already up to date.")
        elseif res.ok then
            text = T(_("Sync done: %1 pages and %2 books sent."), res.rows, res.books or 0)
        else
            text = T(_("Sync failed: %1"), res.err)
        end
        UIManager:show(InfoMessage:new({ text = text, timeout = res.ok and 3 or nil }))
        self:refreshMenu()
        if on_done then
            on_done()
        end
    end)
end

function Dashboard:lastSyncText()
    local time = self.settings:get("last_sync_time")
    if not time then
        return _("Last sync: never")
    end
    return T(
        _("Last sync: %1 (%2 pages)"),
        datetime.secondsToDateTime(time, G_reader_settings:isTrue("twelve_hour_clock")),
        self.settings:get("last_sync_rows") or 0
    )
end

function Dashboard:showWebsite()
    local url = self.settings:get("web_url")
    local screen
    screen = Page:new({
        text = T(_("Open %1 on your phone or computer to see your reading statistics."), url),
        url = url,
        buttons = {
            {
                {
                    text = _("Close"),
                    callback = function()
                        UIManager:close(screen)
                    end,
                },
            },
        },
    })
    UIManager:show(screen)
end

function Dashboard:syncSettingsMenu()
    local function toggle(key, text)
        return {
            text = text,
            checked_func = function()
                return self.settings:get(key) == true
            end,
            callback = function()
                self.settings:set(key, not self.settings:get(key))
            end,
        }
    end
    local function interval(minutes, text)
        return {
            text = text,
            radio = true,
            checked_func = function()
                return (self.settings:get("sync_interval") or 0) == minutes
            end,
            callback = function()
                self.settings:set("sync_interval", minutes)
                self:schedulePeriodic()
            end,
        }
    end
    return {
        toggle("sync_on_close", _("Sync when closing a book")),
        toggle("sync_on_resume", _("Sync on wake up")),
        toggle("sync_on_network", _("Sync when Wi-Fi connects")),
        {
            text = _("Periodic sync while reading"),
            sub_item_table = {
                interval(0, _("Off")),
                interval(15, _("Every 15 minutes")),
                interval(30, _("Every 30 minutes")),
                interval(60, _("Every 60 minutes")),
            },
            separator = true,
        },
        toggle("allow_wifi", _("Allow turning Wi-Fi on for automatic sync")),
    }
end

function Dashboard:link()
    if not self.settings:get("server_url") then
        self:editServerUrl(function()
            if self.settings:get("server_url") then
                self:link()
            end
        end)
        return
    end
    NetworkMgr:runWhenOnline(function()
        self.pairing:start()
    end)
end

function Dashboard:unlink(on_done)
    UIManager:show(ConfirmBox:new({
        text = _("Unlink this device? Reading statistics will stop syncing.\n"
            .. "You can also revoke it from the website."),
        ok_text = _("Unlink"),
        ok_callback = function()
            -- Revoke server side when online, so the device leaves the website list.
            local revoked = false
            if Sync.isConnected() then
                local status = self.api:request("DELETE", "/v1/devices/current", nil, {
                    auth = true,
                    ignore_401 = true,
                    timeout = { 5, 10 },
                })
                revoked = status == 204 or status == 401
            end
            self.settings:clearLink()
            if not revoked then
                UIManager:show(InfoMessage:new({
                    text = _("Unlinked on this e-reader. No network: revoke it from the website too."),
                }))
            end
            if on_done then
                on_done()
            end
        end,
    }))
end

function Dashboard:editServerUrl(on_done)
    local dialog
    dialog = InputDialog:new({
        title = _("Server URL"),
        input = self.settings:get("server_url") or "",
        input_hint = "http://192.168.1.10:8787",
        description = _("KOReader Dashboard API address. Plain HTTP is for local development only."),
        buttons = {
            {
                {
                    text = _("Cancel"),
                    id = "close",
                    callback = function()
                        UIManager:close(dialog)
                    end,
                },
                {
                    text = _("Save"),
                    is_enter_default = true,
                    callback = function()
                        local value = dialog:getInputText():gsub("^%s+", ""):gsub("%s+$", ""):gsub("/+$", "")
                        if value ~= "" and not value:match("^https?://[%w%.%-]+") then
                            UIManager:show(InfoMessage:new({
                                text = _("Enter a URL starting with http:// or https://"),
                            }))
                            return
                        end
                        local changed = value ~= (self.settings:get("server_url") or "")
                        self.settings:set("server_url", value ~= "" and value or nil)
                        -- A token belongs to one server.
                        if changed and self.settings:isLinked() then
                            self.settings:clearLink()
                        end
                        UIManager:close(dialog)
                        if on_done then
                            on_done()
                        end
                    end,
                },
            },
        },
    })
    UIManager:show(dialog)
    dialog:onShowKeyboard()
end

function Dashboard:addToMainMenu(menu_items)
    menu_items.koreader_dashboard = {
        -- Status in the Tools menu itself: TouchMenu items cannot be styled.
        text_func = function()
            return self.settings:isLinked() and _("KOReader Dashboard · linked")
                or _("KOReader Dashboard · not linked")
        end,
        sorting_hint = "tools",
        sub_item_table = {
            {
                text_func = function()
                    return self.settings:isLinked() and _("Status: linked") or _("Status: not linked")
                end,
                keep_menu_open = true,
                callback = function(touchmenu_instance)
                    self.touchmenu_instance = touchmenu_instance
                    if self.settings:isLinked() then
                        UIManager:show(InfoMessage:new({ text = self:lastSyncText() }))
                    else
                        self:link()
                    end
                end,
            },
            {
                text_func = function()
                    return T(_("Website: %1"), self.settings:get("web_url") or _("link the device first"))
                end,
                enabled_func = function()
                    return self.settings:get("web_url") ~= nil
                end,
                keep_menu_open = true,
                callback = function()
                    self:showWebsite()
                end,
                separator = true,
            },
            {
                text_func = function()
                    return self.settings:isLinked() and _("Unlink device") or _("Link this device")
                end,
                keep_menu_open = true,
                callback = function(touchmenu_instance)
                    self.touchmenu_instance = touchmenu_instance
                    local refresh = function()
                        touchmenu_instance:updateItems()
                    end
                    if self.settings:isLinked() then
                        self:unlink(refresh)
                    else
                        self:link()
                    end
                end,
            },
            {
                text = _("Sync now"),
                enabled_func = function()
                    return self.settings:isLinked()
                end,
                keep_menu_open = true,
                callback = function(touchmenu_instance)
                    self.touchmenu_instance = touchmenu_instance
                    self:syncNow(function()
                        touchmenu_instance:updateItems()
                    end)
                end,
            },
            {
                text_func = function()
                    return self:lastSyncText()
                end,
                enabled_func = function()
                    return false
                end,
            },
            {
                text = _("Sync settings"),
                sub_item_table_func = function()
                    return self:syncSettingsMenu()
                end,
                separator = true,
            },
            {
                text_func = function()
                    return T(_("Server URL: %1"), self.settings:get("server_url") or _("not set"))
                end,
                keep_menu_open = true,
                callback = function(touchmenu_instance)
                    self:editServerUrl(function()
                        touchmenu_instance:updateItems()
                    end)
                end,
                separator = true,
            },
            {
                text = _("About"),
                keep_menu_open = true,
                callback = function()
                    UIManager:show(InfoMessage:new({
                        text = T(
                            _("KOReader Dashboard v%1\nSyncs your reading statistics.\n\n"
                                .. "Developed by Ulysse Pennetier."),
                            VERSION
                        ),
                    }))
                end,
            },
        },
    }
end

return Dashboard
