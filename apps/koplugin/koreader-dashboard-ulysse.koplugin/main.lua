local InfoMessage = require("ui/widget/infomessage")
local UIManager = require("ui/uimanager")
local WidgetContainer = require("ui/widget/container/widgetcontainer")
local _ = require("gettext")

local VERSION = "0.0.1"

local Dashboard = WidgetContainer:extend({
    name = "koreader-dashboard-ulysse",
    is_doc_only = false,
})

function Dashboard:init()
    self.ui.menu:registerToMainMenu(self)
end

function Dashboard:addToMainMenu(menu_items)
    menu_items.koreader_dashboard = {
        text = _("KOReader Dashboard"),
        sorting_hint = "tools",
        sub_item_table = {
            {
                text = _("About"),
                keep_menu_open = true,
                callback = function()
                    UIManager:show(InfoMessage:new({
                        text = _("KOReader Dashboard") .. " v" .. VERSION,
                    }))
                end,
            },
        },
    }
end

return Dashboard
