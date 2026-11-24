--[[--
Full-screen page with instructions, an optional big code, a large QR code and buttons.

KOReader's QRMessage scales modules by an integer factor and adds a title bar, which made
the code look small on the Kindle: this widget sizes the QR code from the screen instead.
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

local QRScreen = InputContainer:extend({
    text = nil, -- instructions, above the code
    code = nil, -- optional, shown big
    url = nil, -- QR code content
    footer = nil, -- optional, below the QR code
    buttons = nil, -- ButtonTable rows
})

function QRScreen:init()
    local sw, sh = Screen:getWidth(), Screen:getHeight()
    local inner_w = math.floor(math.min(sw, sh) * 0.9)
    local gap = Screen:scaleBySize(16)

    local group = VerticalGroup:new({ align = "center" })
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

    -- Leave room for the texts and buttons: up to 90% of the width, 55% of the height.
    local qr_size = math.floor(math.min(inner_w, sh * 0.55))
    self.qr = QRWidget:new({ text = self.url, width = qr_size, height = qr_size })
    table.insert(group, self.qr)

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

function QRScreen:onShow()
    -- Full refresh: no e-ink ghosting on the QR code.
    UIManager:setDirty(self, function()
        return "full", self.frame.dimen
    end)
    return true
end

function QRScreen:onCloseWidget()
    if self.qr and self.qr.free then
        self.qr:free()
    end
    UIManager:setDirty(nil, function()
        return "ui", self.frame.dimen
    end)
end

return QRScreen
