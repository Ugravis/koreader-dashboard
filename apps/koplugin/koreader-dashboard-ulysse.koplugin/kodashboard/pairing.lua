--[[--
Device pairing UI (device authorization flow).

Start -> show user code and QR code (verification URL) -> poll every `interval`
seconds until the user confirms on the web, the code expires or the user cancels.
]]

local ButtonDialog = require("ui/widget/buttondialog")
local Device = require("device")
local InfoMessage = require("ui/widget/infomessage")
local QRMessage = require("ui/widget/qrmessage")
local UIManager = require("ui/uimanager")
local logger = require("logger")
local _ = require("gettext")
local T = require("ffi/util").template

local Pairing = {}
Pairing.__index = Pairing

--- @param o table { api = Api, settings = Settings, on_linked = function() }
function Pairing:new(o)
    return setmetatable(o, self)
end

local function prettyCode(code)
    return code:sub(1, 4) .. "-" .. code:sub(5)
end

function Pairing:start()
    if self.active then
        return
    end
    local model = Device.model or "unknown"
    local status, data = self.api:post("/v1/devices/pair/start", {
        device_name = T(_("KOReader on %1"), model),
        device_model = model,
    })
    if status ~= 200 or type(data) ~= "table" or not data.device_code then
        UIManager:show(InfoMessage:new({
            text = T(_("Could not start linking: %1"), self.api.errorMessage(status, data)),
        }))
        return
    end

    self.active = true
    self.device_code = data.device_code
    self.url = data.verification_url_complete or data.verification_url
    self.interval = math.max(tonumber(data.interval) or 5, 2)
    local expires_in = tonumber(data.expires_in) or 600
    self.deadline = os.time() + expires_in

    self.dialog = ButtonDialog:new({
        title = T(
            _("Go to %1 and enter this code:\n\n%2\n\nThe code expires in %3 minutes."),
            data.verification_url,
            prettyCode(data.user_code),
            math.floor(expires_in / 60)
        ),
        title_align = "center",
        dismissable = false,
        buttons = {
            {
                {
                    text = _("Show QR code"),
                    callback = function()
                        self:showQR()
                    end,
                },
                {
                    text = _("Cancel"),
                    callback = function()
                        self:stop()
                    end,
                },
            },
        },
    })
    UIManager:show(self.dialog)
    self:schedulePoll()
end

function Pairing:showQR()
    self.qr = QRMessage:new({
        text = self.url,
        dismiss_callback = function()
            self.qr = nil
        end,
    })
    UIManager:show(self.qr)
end

function Pairing:schedulePoll()
    self.poll_func = function()
        self:poll()
    end
    UIManager:scheduleIn(self.interval, self.poll_func)
end

--- Closes the dialogs and stops polling.
function Pairing:stop()
    if self.poll_func then
        UIManager:unschedule(self.poll_func)
        self.poll_func = nil
    end
    if self.qr then
        UIManager:close(self.qr)
        self.qr = nil
    end
    if self.dialog then
        UIManager:close(self.dialog)
        self.dialog = nil
    end
    self.active = false
    self.device_code = nil
end

function Pairing:poll()
    if not self.active then
        return
    end
    if os.time() > self.deadline then
        self:stop()
        UIManager:show(InfoMessage:new({ text = _("The code has expired. Start linking again.") }))
        return
    end

    local status, data = self.api:post("/v1/devices/pair/poll", { device_code = self.device_code })
    if status == 200 and type(data) == "table" and data.device_token then
        self:stop()
        self.settings:set("device_token", data.device_token)
        self.settings:set("cursor", 0)
        UIManager:show(InfoMessage:new({ text = _("Device linked to KOReader Dashboard."), timeout = 3 }))
        if self.on_linked then
            self.on_linked()
        end
    elseif status == 428 or status == nil then
        -- Pending, or a transient network error: keep polling until the deadline.
        self:schedulePoll()
    else
        logger.warn("KOReaderDashboard: pairing poll failed", status)
        self:stop()
        UIManager:show(InfoMessage:new({
            text = T(_("Linking failed: %1"), self.api.errorMessage(status, data)),
        }))
    end
end

return Pairing
