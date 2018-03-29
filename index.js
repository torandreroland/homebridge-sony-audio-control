"use strict";

var Service, Characteristic;
var request = require("request");

module.exports = function (homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    homebridge.registerAccessory("homebridge-http-speaker", "HTTP-SPEAKER", HTTP_SPEAKER);
}

function HTTP_SPEAKER(log, config) {
    this.log = log;

    this.name = config.name;

    this.volume = {};
    this.mute = {};
    this.power = { enabled: false };

    this.volume.statusUrl = config.volume.statusUrl;
    this.volume.statusBody = "{"method":"getVolumeInformation","id":127,"params":[{"output":"extOutput:zone?zone=1"}],"version":"1.1"}";
    this.volume.setUrl = config.volume.setUrl;
    this.volume.setBody = "{"method":"setAudioVolume","id":127,"params":[{"volume":"%s","output":"extOutput:zone?zone=1"}],"version":"1.1"}";
    this.volume.httpMethod = config.volume.httpMethod || "POST";

    this.mute.statusUrl = config.mute.statusUrl;
    this.mute.statusBody = "{"method":"getVolumeInformation","id":127,"params":[{"output":"extOutput:zone?zone=1"}],"version":"1.1"}";
    this.mute.onUrl = config.mute.onUrl;
    this.mute.onBody = "{"method":"setAudioMute","id":127,"params":[{"mute":"on","output":"extOutput:zone?zone=1"}],"version":"1.1"}";
    this.mute.offUrl = config.mute.offUrl;
    this.mute.offBody = "{"method":"setAudioMute","id":127,"params":[{"mute":"off","output":"extOutput:zone?zone=1"}],"version":"1.1"}";
    this.mute.httpMethod = config.mute.httpMethod || "POST";

    if (config.power) { // if power is configured enable it
        this.power.enabled = true;
        this.power.statusUrl = config.power.statusUrl;
        this.power.statusBody = "{"method":"getPowerStatus","id":127,"params":[],"version":"1.1"}";
        this.power.onUrl = config.power.onUrl;
        this.power.onBody = "{"method":"setPowerStatus","id":127,"params":[{"status":"active"}],"version":"1.1"}";
        this.power.offUrl = config.power.offUrl;
        this.power.offBody = "{"method":"setPowerStatus","id":127,"params":[{"status":"active"}],"version":"1.1"}";
        this.power.httpMethod = config.power.httpMethod || "POST";
    }
}

HTTP_SPEAKER.prototype = {

    identify: function (callback) {
        this.log("Identify requested!");
        callback();
    },

    getServices: function () {
        this.log("Creating speaker!");
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

        return [speakerService];
    },

    getMuteState: function (callback) {
        if (!this.mute.statusUrl) {
            this.log.warn("Ignoring getMuteState() request, 'mute.statusUrl' is not defined!");
            callback(new Error("No 'mute.statusUrl' defined!"));
            return;
        }

        this._httpRequest(this.mute.statusUrl, this.mute.statusBody, "POST", function (error, response, body) {
            if (error) {
                this.log("getMuteState() failed: %s", error.message);
                callback(error);
            }
            else if (response.statusCode !== 200) {
                this.log("getMuteState() request returned http error: %s", response.statusCode);
                callback(new Error("getMuteState() returned http error " + response.statusCode));
            }
            else {
                var responseBody = JSON.parse(body);
                var responseBodyResult = responseBody.result[0];
                var muted = responseBodyResult.mute == "on";
                this.log("Speaker is currently %s", muted? "MUTED": "NOT MUTED");
                callback(null, muted);
            }
        }.bind(this));
    },

    setMuteState: function (muted, callback) {
        if (!this.mute.onUrl || !this.mute.offUrl) {
            this.log.warn("Ignoring setMuteState() request, 'mute.onUrl' or 'mute.offUrl' is not defined!");
            callback(new Error("No 'mute.onUrl' or 'mute.offUrl' defined!"));
            return;
        }

        var url = muted? this.mute.onUrl: this.mute.offUrl;
        var requestbody = muted? this.mute.onBody: this.mute.offBody;

        this._httpRequest(url, requestbody, this.mute.httpMethod, function (error, response, body) {
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
        if (!this.power.statusUrl) {
            this.log.warn("Ignoring getPowerState() request, 'power.statusUrl' is not defined!");
            callback(new Error("No 'power.statusUrl' defined!"));
            return;
        }

        this._httpRequest(this.power.statusUrl, this.power.statusBody, "POST", function (error, response, body) {
            if (error) {
                this.log("getPowerState() failed: %s", error.message);
                callback(error);
            }
            else if (response.statusCode !== 200) {
                this.log("getPowerState() request returned http error: %s", response.statusCode);
                callback(new Error("getPowerState() returned http error " + response.statusCode));
            }
            else {
                var responseBody = JSON.parse(body);
                var responseBodyResult = responseBody.result[0];
                var powered = responseBodyResult.status == "active";
                this.log("Speaker is currently %s", powered? "ON": "OFF");

                callback(null, powered);
            }
        }.bind(this));
    },

    setPowerState: function (power, callback) {
        if (!this.power.onUrl || !this.power.offUrl) {
            this.log.warn("Ignoring setPowerState() request, 'power.onUrl' or 'power.offUrl' is not defined!");
            callback(new Error("No 'power.onUrl' or 'power.offUrl' defined!"));
            return;
        }

        var url = power? this.power.onUrl: this.power.offUrl;
        var requestbody = power? this.power.onBody: this.power.onBody;

        this._httpRequest(url, requestbody, this.power.httpMethod, function (error, response, body) {
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
        if (!this.volume.statusUrl) {
            this.log.warn("Ignoring getVolume() request, 'volume.statusUrl' is not defined!");
            callback(new Error("No 'volume.statusUrl' defined!"));
            return;
        }

        this._httpRequest(this.volume.statusUrl, this.volume.statusBody, "POST", function (error, response, body) {
            if (error) {
                this.log("getVolume() failed: %s", error.message);
                callback(error);
            }
            else if (response.statusCode !== 200) {
                this.log("getVolume() request returned http error: %s", response.statusCode);
                callback(new Error("getVolume() returned http error " + response.statusCode));
            }
            else {
                var responseBody = JSON.parse(body);
                var responseBodyResult = responseBody.result[0];
                var volume = responseBodyResult.volume;j
                this.log("Speaker's volume is at  %s %", volume);

                callback(null, volume);
            }
        }.bind(this));
    },

    setVolume: function (volume, callback) {
        if (!this.volume.setUrl) {
            this.log.warn("Ignoring setVolume() request, 'volume.setUrl' is not defined!");
            callback(new Error("No 'volume.setUrl' defined!"));
            return;
        }

        var body = this.volume.setBody.replace("%s", volume);

        this._httpRequest(this.volume.setUrl, body, this.volume.httpMethod, function (error, response, body) {
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
