local ConfirmBox = require("ui/widget/confirmbox")
local InfoMessage = require("ui/widget/infomessage")
local InputDialog = require("ui/widget/inputdialog")
local NetworkMgr = require("ui/network/manager")
local UIManager = require("ui/uimanager")
local WidgetContainer = require("ui/widget/container/widgetcontainer")
local _ = require("gettext")
local T = require("ffi/util").template

-- Submodules are namespaced: plugin dirs end up in the global package.path.
local Api = require("kodashboard/api")
local Pairing = require("kodashboard/pairing")
local Settings = require("kodashboard/settings")

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
            UIManager:show(InfoMessage:new({
                text = _("This device was unlinked from KOReader Dashboard. Link it again to keep syncing."),
            }))
        end,
    })
    self.pairing = Pairing:new({ api = self.api, settings = self.settings })
    self.ui.menu:registerToMainMenu(self)
end

function Dashboard:onCloseWidget()
    if self.pairing then
        self.pairing:stop()
    end
end

function Dashboard:link()
    if not self.settings:get("server_url") then
        UIManager:show(InfoMessage:new({ text = _("Set the server URL first.") }))
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
            self.settings:clearLink()
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
        text = _("KOReader Dashboard"),
        sorting_hint = "tools",
        sub_item_table = {
            {
                text_func = function()
                    return self.settings:isLinked() and _("Unlink device") or _("Link this device")
                end,
                keep_menu_open = true,
                callback = function(touchmenu_instance)
                    local refresh = function()
                        touchmenu_instance:updateItems()
                    end
                    if self.settings:isLinked() then
                        self:unlink(refresh)
                    else
                        self.pairing.on_linked = refresh
                        self:link()
                    end
                end,
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
                        text = T(_("KOReader Dashboard v%1\nSyncs your reading statistics."), VERSION),
                    }))
                end,
            },
        },
    }
end

return Dashboard
