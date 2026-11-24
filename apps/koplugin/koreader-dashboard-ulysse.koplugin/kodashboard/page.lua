--[[--
Full-screen page: title, text, optional big code, optional QR code, footer and buttons.

Used for the welcome page, the pairing page and the website QR code. KOReader's QRMessage
gave no control over the QR code size.
]]

local Blitbuffer = require("ffi/blitbuffer")
local ButtonTable = require("ui/widget/buttontable")
local CenterContainer = require("ui/widget/container/centercontainer")
local Device = require("device")
local Font = require("ui/font")
local FrameContainer = require("ui/widget/container/framecontainer")
local Geom = require("ui/geometry")
local InputContainer = require("ui/widget/container/inputcontainer")
local QRWidget = require("ui/widget/qrwidget")
local TextBoxWidget = require("ui/widget/textboxwidget")
local TextWidget = require("ui/widget/textwidget")
local UIManager = require("ui/uimanager")
local VerticalGroup = require("ui/widget/verticalgroup")
local VerticalSpan = require("ui/widget/verticalspan")
local Screen = Device.screen

local Page = InputContainer:extend({
    title = nil, -- large, bold
    text = nil, -- body, above the code
    code = nil, -- optional, shown big
    url = nil, -- optional QR code content
    footer = nil, -- optional, below the QR code
    buttons = nil, -- ButtonTable rows
})

function Page:init()
    local sw, sh = Screen:getWidth(), Screen:getHeight()
    local inner_w = math.floor(math.min(sw, sh) * 0.9)
    local gap = Screen:scaleBySize(16)

    local group = VerticalGroup:new({ align = "center" })
    if self.title then
        table.insert(group, TextBoxWidget:new({
            text = self.title,
            face = Font:getFace("tfont", 30),
            bold = true,
            width = inner_w,
            alignment = "center",
        }))
        table.insert(group, VerticalSpan:new({ width = gap * 2 }))
    end
    if self.text then
        table.insert(group, TextBoxWidget:new({
            text = self.text,
            face = Font:getFace("infofont"),
            width = inner_w,
            alignment = "center",
        }))
        table.insert(group, VerticalSpan:new({ width = gap }))
    end
    if self.code then
        table.insert(group, TextWidget:new({
            text = self.code,
            face = Font:getFace("infont", 44),
            bold = true,
        }))
        table.insert(group, VerticalSpan:new({ width = gap }))
    end

    if self.url then
        -- About 45% of the short side: easy to scan, leaves room for the texts.
        local qr_size = math.floor(math.min(sw, sh) * 0.45)
        self.qr = QRWidget:new({ text = self.url, width = qr_size, height = qr_size })
        table.insert(group, self.qr)
    end

    if self.footer then
        table.insert(group, VerticalSpan:new({ width = gap }))
        table.insert(group, TextBoxWidget:new({
            text = self.footer,
            face = Font:getFace("smallinfofont"),
            width = inner_w,
            alignment = "center",
        }))
    end
    if self.buttons then
        table.insert(group, VerticalSpan:new({ width = gap * 2 }))
        table.insert(group, ButtonTable:new({
            width = inner_w,
            buttons = self.buttons,
            zero_sep = true,
            show_parent = self,
        }))
    end

    self.frame = FrameContainer:new({
        background = Blitbuffer.COLOR_WHITE,
        bordersize = 0,
        padding = 0,
        width = sw,
        height = sh,
        CenterContainer:new({ dimen = Geom:new({ w = sw, h = sh }), group }),
    })
    self.dimen = Geom:new({ x = 0, y = 0, w = sw, h = sh })
    self[1] = self.frame
end

function Page:onShow()
    -- Full refresh: no e-ink ghosting.
    UIManager:setDirty(self, function()
        return "full", self.frame.dimen
    end)
    return true
end

function Page:onCloseWidget()
    if self.qr and self.qr.free then
        self.qr:free()
    end
    UIManager:setDirty(nil, function()
        return "ui", self.frame.dimen
    end)
end

return Page
