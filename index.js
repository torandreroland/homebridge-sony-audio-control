"use strict";

var Service, Characteristic;
var request = require("request");

module.exports = function (homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    homebridge.registerAccessory("homebridge-sony-audio-control", "receiver", SonyAudioControlReceiver);
};

function SonyAudioControlReceiver(log, config) {
    this.log = log;

    this.name = config.name;

    this.volume = {};
    this.mute = {};
    this.power = { enabled: false };

    this.volume.url = config.baseUrl + "/sony/audio";
    this.volume.statusBody = JSON.stringify({"method":"getVolumeInformation","id":127,"params":[{"output":"extOutput:zone?zone=1"}],"version":"1.1"});
    this.volume.setBody = JSON.stringify({"method":"setAudioVolume","id":127,"params":[{"volume":"%s","output":"extOutput:zone?zone=1"}],"version":"1.1"});
    this.volume.httpMethod = "POST";

    this.mute.url = config.baseUrl + "/sony/audio";
    this.mute.statusBody = JSON.stringify({"method":"getVolumeInformation","id":127,"params":[{"output":"extOutput:zone?zone=1"}],"version":"1.1"});
    this.mute.onBody = JSON.stringify({"method":"setAudioMute","id":127,"params":[{"mute":"on","output":"extOutput:zone?zone=1"}],"version":"1.1"});
    this.mute.offBody = JSON.stringify({"method":"setAudioMute","id":127,"params":[{"mute":"off","output":"extOutput:zone?zone=1"}],"version":"1.1"});
    this.mute.httpMethod = "POST";

    if (config.power) { // if power is configured enable it
        this.power.enabled = true;
        this.power.url = config.baseUrl + "/sony/avContent";
        this.power.statusBody = JSON.stringify({"method":"getCurrentExternalTerminalsStatus","id":127,"params":[],"version":"1.0"});
        this.power.onBody = JSON.stringify({"method":"setActiveTerminal","id":127,"params":[{"active":"active","uri":"extOutput:zone?zone=1"}],"version":"1.0"});
        this.power.offBody = JSON.stringify({"method":"setActiveTerminal","id":127,"params":[{"active":"inactive","uri":"extOutput:zone?zone=1"}],"version":"1.0"});
        this.power.httpMethod = "POST";
    }
}

SonyAudioControlReceiver.prototype = {

    identify: function (callback) {
        this.log("Identify requested!");
        callback();
    },

    getServices: function () {
        this.log("Creating speaker!");

    		const informationService = new Service.AccessoryInformation();

    		informationService
    		.setCharacteristic(Characteristic.Manufacturer, "Sony")
    		.setCharacteristic(Characteristic.Model, "STR-DN1080")
    		.setCharacteristic(Characteristic.SerialNumber, "Serial number 1");

        var speakerService = new Service.Speaker(this.name);

        if (this.power.enabled) { // since im able to power off/on my speaker i decided to add the option to add the "On" Characteristic
            this.log("... adding on characteristic");
            speakerService
                .addCharacteristic(new Characteristic.On())
                .on("get", this.getPowerState.bind(this))
                .on("set", this.setPowerState.bind(this));
        }

        this.log("... configuring mute characteristic");
        speakerService
            .getCharacteristic(Characteristic.Mute)
            .on("get", this.getMuteState.bind(this))
            .on("set", this.setMuteState.bind(this));

        this.log("... adding volume characteristic");
        speakerService
            .addCharacteristic(new Characteristic.Volume())
            .on("get", this.getVolume.bind(this))
            .on("set", this.setVolume.bind(this));

        return [informationService, speakerService];
    },

    getMuteState: function (callback) {
        if (!this.mute.url) {
            this.log.warn("Ignoring getMuteState() request, 'mute.url' is not defined!");
            callback(new Error("No 'mute.url' defined!"));
            return;
        }

        this._httpRequest(this.mute.url, this.mute.statusBody, "POST", function (error, response, body) {
            if (error) {
                this.log("getMuteState() failed: %s", error.message);
                callback(error);
            }
            else if (response.statusCode !== 200) {
                this.log("getMuteState() request returned http error: %s", response.statusCode);
                callback(new Error("getMuteState() returned http error " + response.statusCode));
            }
            else {
                body = body.replace("[[", "[");
                body = body.replace("]]", "]");
                var responseBody = JSON.parse(body);
                var muted = responseBody.result[0].mute == "on";
                this.log("Speaker is currently %s", muted? "MUTED": "NOT MUTED");
                callback(null, muted);
            }
        }.bind(this));
    },

    setMuteState: function (muted, callback) {
        if (!this.mute.url) {
            this.log.warn("Ignoring setMuteState() request, 'mute.url' is not defined!");
            callback(new Error("No 'mute.url' defined!"));
            return;
        }

        var requestbody = muted? this.mute.onBody: this.mute.offBody;

        this._httpRequest(this.mute.url, requestbody, this.mute.httpMethod, function (error, response, body) {
            if (error) {
                this.log("setMuteState() failed: %s", error.message);
                callback(error);
            }
            else if (response.statusCode !== 200) {
                this.log("setMuteState() request returned http error: %s", response.statusCode);
                callback(new Error("setMuteState() returned http error " + response.statusCode));
            }
            else {
                this.log("setMuteState() successfully set mute state to %s", muted? "ON": "OFF");

                callback(undefined, body);
            }
        }.bind(this));
    },

    getPowerState: function (callback) {
        if (!this.power.url) {
            this.log.warn("Ignoring getPowerState() request, 'power.url' is not defined!");
            callback(new Error("No 'power.url' defined!"));
            return;
        }

        this._httpRequest(this.power.url, this.power.statusBody, "POST", function (error, response, body) {
            if (error) {
                this.log("getPowerState() failed: %s", error.message);
                callback(error);
            }
            else if (response.statusCode !== 200) {
                this.log("getPowerState() request returned http error: %s", response.statusCode);
                callback(new Error("getPowerState() returned http error " + response.statusCode));
            }
            else {
                body = body.replace("[[", "[");
                body = body.replace("]]", "]");
                var responseBody = JSON.parse(body);
                var responseBodyResult = responseBody.result[0];
                var powered = responseBodyResult.active == "active";
                this.log("Speaker is currently %s", powered? "ON": "OFF");

                callback(null, powered);
            }
        }.bind(this));
    },

    setPowerState: function (power, callback) {
        if (!this.power.url) {
            this.log.warn("Ignoring setPowerState() request, 'power.url' is not defined!");
            callback(new Error("No 'power.url' defined!"));
            return;
        }

        var requestbody = power? this.power.onBody: this.power.offBody;

        this._httpRequest(this.power.url, requestbody, this.power.httpMethod, function (error, response, body) {
            if (error) {
                this.log("setPowerState() failed: %s", error.message);
                callback(error);
            }
            else if (response.statusCode !== 200) {
                this.log("setPowerState() request returned http error: %s", response.statusCode);
                callback(new Error("setPowerState() returned http error " + response.statusCode));
            }
            else {
                this.log("setPowerState() successfully set power state to %s", power? "ON": "OFF");

                callback(undefined, body);
            }
        }.bind(this));
    },

    getVolume: function (callback) {
        if (!this.volume.url) {
            this.log.warn("Ignoring getVolume() request, 'volume.url' is not defined!");
            callback(new Error("No 'volume.url' defined!"));
            return;
        }

        this._httpRequest(this.volume.url, this.volume.statusBody, "POST", function (error, response, body) {
            if (error) {
                this.log("getVolume() failed: %s", error.message);
                callback(error);
            }
            else if (response.statusCode !== 200) {
                this.log("getVolume() request returned http error: %s", response.statusCode);
                callback(new Error("getVolume() returned http error " + response.statusCode));
            }
            else {
                body = body.replace("[[", "[");
                body = body.replace("]]", "]");
                var responseBody = JSON.parse(body);
                var volume = responseBody.result[0].volume;
                this.log("Speaker's volume is at  %s %", volume);

                callback(null, volume);
            }
        }.bind(this));
    },

    setVolume: function (volume, callback) {
        if (!this.volume.url) {
            this.log.warn("Ignoring setVolume() request, 'volume.url' is not defined!");
            callback(new Error("No 'volume.url' defined!"));
            return;
        }

        var body = this.volume.setBody.replace("%s", volume);

        this._httpRequest(this.volume.url, body, this.volume.httpMethod, function (error, response, body) {
            if (error) {
                this.log("setVolume() failed: %s", error.message);
                callback(error);
            }
            else if (response.statusCode !== 200) {
                this.log("setVolume() request returned http error: %s", response.statusCode);
                callback(new Error("setVolume() returned http error " + response.statusCode));
            }
            else {
                this.log("setVolume() successfully set volume to %s", volume);

                callback(undefined, body);
            }
        }.bind(this));
    },

    _httpRequest: function (url, body, method, callback) {
        request(
            {
                url: url,
                body: body,
                method: method,
                rejectUnauthorized: false
            },
            function (error, response, body) {
                callback(error, response, body);
            }
        )
    }

};
