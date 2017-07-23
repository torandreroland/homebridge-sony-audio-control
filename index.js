var Service, Characteristic;
var request = require("request");

module.exports = function (homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    homebridge.registerAccessory("homebridge-http-speaker", "HTTP-SPEAKER", HTTP_SPEAKER);
};

function HTTP_SPEAKER(log, config) {
    this.log = log;

    this.name = config.name;

    this.on = true;
    this.muted = false;
    this.volume = 100;

    this.http_method = config.http_method || 'GET';

    // TODO config stuff
}

HTTP_SPEAKER.prototype = {

    identify: function (callback) {
        this.log("Identify requested!");
        callback();
    },

    getServices: function () {
        this.log("Creating speaker!");
        var speakerService = new Service.Speaker(this.name);

        this.log("... adding on characteristic");
        speakerService
            .addCharacteristic(new Characteristic.On())
            .on("get", this.getOnState.bind(this))
            .on("set", this.setOnState.bind(this));

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
        this.log("getting mute state");
        callback(null, this.muted);
    },

    setMuteState: function (state, callback) {
        this.muted = state;
        this.log("setting mute to %s", state? "MUTED": "NOT MUTED");
        callback();
    },

    getOnState: function (callback) {
        this.log("getting power state");
        callback(null, this.on);
    },

    setOnState: function (state, callback) {
        this.on = state;
        this.log("setting power to %s", state? "ON": "OFF");
        callback();
    },

    getVolume: function (callback) {
        this.log("getting volume");
        callback(null, this.volume);
    },

    setVolume: function (volume, callback) {
        this.volume = volume;
        this.log("setting volume to %s", volume);
        callback();
    }

};