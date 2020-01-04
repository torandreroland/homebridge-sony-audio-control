"use strict";

var Service,
  Characteristic;
var request = require("request");

module.exports = function(homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  homebridge.registerAccessory("homebridge-sony-audio-control", "receiver", SonyAudioControlReceiver);
};

function SonyAudioControlReceiver(log, config) {
  this.log = log;
  this.name = config.name;
  this.inputs = config.inputs;
  this.baseHttpUrl = "http://" + config.ip + ":10000";
  this.baseWsUrl = "ws://" + config.ip + ":10000";
  this.volume.volumeUrl = this.baseHttpUrl + "/sony/audio";
  this.volume.muteUrl = this.baseHttpUrl + "/sony/audio";
  this.input.url = this.baseHttpUrl + "/sony/avContent";
  this.power.url = this.baseHttpUrl + "/sony/avContent";
  this.soundMode.url = this.baseHttpUrl + "/sony/audio";
  this.networkStandby.url = this.baseHttpUrl + "/sony/system";
  this.networkStandby.enableNetworkStandby = config.enableNetworkStandby === false ? false : true;
  this.setNetWorkStandby();
  this.getVolumeInformationNotifcations();
  this.getActiveInputAndOutputNotification();
}

SonyAudioControlReceiver.prototype = {
  receiverPowerOnDelay: 200,
  outputZone: "extOutput:zone?zone=1",

  volume: {
    get volumeStatusBody() {
      return JSON.stringify({
        "method": "getVolumeInformation",
        "id": 127,
        "params": [{
          "output": "extOutput:zone?zone=1"
        }],
        "version": "1.1"
      })
    },
    get volumeSetBody() {
      return JSON.stringify({
        "method": "setAudioVolume",
        "id": 127,
        "params": [{
          "volume": "%s",
          "output": "extOutput:zone?zone=1"
        }],
        "version": "1.1"
      })
    },
    get muteStatusBody() {
      return JSON.stringify({
        "method": "getVolumeInformation",
        "id": 127,
        "params": [{
          "output": "extOutput:zone?zone=1"
        }],
        "version": "1.1"
      })
    },
    get muteOnBody() {
      return JSON.stringify({
        "method": "setAudioMute",
        "id": 127,
        "params": [{
          "mute": "on",
          "output": "extOutput:zone?zone=1"
        }],
        "version": "1.1"
      })
    },
    get muteOffBody() {
      return JSON.stringify({
        "method": "setAudioMute",
        "id": 127,
        "params": [{
          "mute": "off",
          "output": "extOutput:zone?zone=1"
        }],
        "version": "1.1"
      })
    }
  },

  
  input: {
    get statusBody() {
      return JSON.stringify({
        "method": "getPlayingContentInfo",
        "id": 127,
        "params": [{
          "output": "extOutput:zone?zone=1"
        }],
        "version": "1.2"
      })
    },
    get onBodyBasis() {
      return JSON.stringify({
        "method": "setPlayContent",
        "id": 127,
        "params": [{
          "output": "extOutput:zone?zone=1",
          "uri": "%s"
        }],
        "version": "1.2"
      })
    },
    get offBody() {
      return JSON.stringify({
        "method": "setActiveTerminal",
        "id": 127,
        "params": [{
          "active": "inactive",
          "uri": "extOutput:zone?zone=1"
        }],
        "version": "1.0"
      })
    }
  },

  power: {
    get statusBody() {
      return JSON.stringify({
        "method": "getCurrentExternalTerminalsStatus",
        "id": 127,
        "params": [],
        "version": "1.0"
      })
    },
    get onBody() {
      return JSON.stringify({
        "method": "setActiveTerminal",
        "id": 127,
        "params": [{
          "active": "active",
          "uri": "extOutput:zone?zone=1"
        }],
        "version": "1.0"
      })
    },
    get offBody() {
      return JSON.stringify({
        "method": "setActiveTerminal",
        "id": 127,
        "params": [{
          "active": "inactive",
          "uri": "extOutput:zone?zone=1"
        }],
        "version": "1.0"
      })
    }
  },

  
  soundMode: {
    get statusBody() {
      return JSON.stringify({
        "method": "getSoundSettings",
        "id": 127,
        "params": [{
          "target": "soundField"
        }],
        "version": "1.1"
      })
    },
    stereoValue: "2chStereo",
    get stereoOnBody() {
      return JSON.stringify({
        "method": "setSoundSettings",
        "id": 127,
        "params": [{
          "settings": [{
            "value": "2chStereo",
            "target": "soundField"
          }]
        }],
        "version": "1.1"
      })
    },
    surroundValue: "dolbySurround",
    get surroundOnBody() {
      return JSON.stringify({
        "method": "setSoundSettings",
        "id": 127,
        "params": [{
          "settings": [{
            "value": "dolbySurround",
            "target": "soundField"
          }]
        }],
        "version": "1.1"
      })
    }
  },


  networkStandby: {
    get onBody() {
      return JSON.stringify({
      "method": "setPowerSettings",
      "id": 127,
      "params": [{
        "settings": [{
          "target": "quickStartMode",
          "value": "on"
        }]
      }],
      "version": "1.0"
    })},
    get offBody() {
      return JSON.stringify({
        "method": "setPowerSettings",
        "id": 127,
        "params": [{
          "settings": [{
            "target": "quickStartMode",
            "value": "off"
          }]
        }],
        "version": "1.0"
      })
    } 
  },

  inputServices: [],
  receiverServices: [],

  identify(callback) {
    this.log("Identify requested!");
    callback();
  },

  getServices() {
    this.log("Creating receiver services!");

    var receiverServices = [];

    this.log("Creating information service!");
    const informationService = new Service.AccessoryInformation();

    informationService
      .setCharacteristic(Characteristic.Manufacturer, "Sony")
      .setCharacteristic(Characteristic.Model, "STR-DN1080")
      .setCharacteristic(Characteristic.SerialNumber, "Serial number 1");

    receiverServices.push(informationService);

    this.log("Creating volume service!");
    var volumeService = new Service.Lightbulb(this.name);

    this.log("... configuring mute characteristic");
    volumeService
      .getCharacteristic(Characteristic.On)
      .on("get", this.getMuteState.bind(this))
      .on("set", this.setMuteState.bind(this));

    this.volume.service = volumeService;

    this.log("... adding volume characteristic");
    volumeService
      .addCharacteristic(new Characteristic.Brightness())
      .on("get", this.getVolume.bind(this))
      .on("set", this.setVolume.bind(this));

    receiverServices.push(volumeService);

    this.log("Creating power service!");
    var powerService = new Service.Switch(this.name, this.name);

    this.log("... configuring power characteristic");
    powerService
      .getCharacteristic(Characteristic.On)
      .on("get", this.getPowerState.bind(this))
      .on("set", this.setPowerState.bind(this));

    this.power.service = powerService;

    receiverServices.push(powerService);

    this.log("Creating surround service!");
    var surroundService = new Service.Switch("Surround Mode", "Surround Mode");

    this.log("... configuring surround characteristic");
    surroundService
      .getCharacteristic(Characteristic.On)
      .on("get", this.getSurroundState.bind(this))
      .on("set", this.setSurroundState.bind(this));

    this.soundMode.surroundService = surroundService;

    receiverServices.push(surroundService);

    this.log("Creating stereo service!");
    var stereoService = new Service.Switch("Stereo Mode", "Stereo Mode");

    this.log("... configuring stereo characteristic");
    stereoService
      .getCharacteristic(Characteristic.On)
      .on("get", this.getStereoState.bind(this))
      .on("set", this.setStereoState.bind(this));

    this.soundMode.stereoService = stereoService;

    receiverServices.push(stereoService);

    this.log("Creating input services!");

    var inputServices = [];

    for (let i = 0; i < this.inputs.length; i++) {

      this.log("Creating input service %s!", this.inputs[i].name);

      var inputGetFunctionBody = "this.getInputStateGeneral(callback, \'" + this.inputs[i].uri + "\');";
      var getInputFunction = new Function('callback', inputGetFunctionBody);
      this.inputs[i].getInputState = getInputFunction.bind(this);
      this.log("Inputs object %s", this.input);
      this.log("onBodydBasis object %s", this.input.onBodyBasis);
      this.inputs[i].onBodyBasis = this.input.onBodyBasis;
      this.inputs[i].onBody = this.inputs[i].onBodyBasis.replace("%s", this.inputs[i].uri);
      var inputSetFunctionBody = "this.setInputStateGeneral(newInputState, callback, " + i + ", \'" + this.inputs[i].onBody + "\');";
      var setInputFunction = new Function('newInputState', 'callback', inputSetFunctionBody);
      this.inputs[i].setInputState = setInputFunction.bind(this);

      let inputService = new Service.Switch("Input " + this.inputs[i].name, this.inputs[i].name);

      this.log("... configuring input characteristic");
      inputService
        .getCharacteristic(Characteristic.On)
        .on("get", this.inputs[i].getInputState.bind(this))
        .on("set", this.inputs[i].setInputState.bind(this));
      this.inputs[i].service = inputService;
      inputServices.push(inputService);
    }

    receiverServices = receiverServices.concat(inputServices);
    this.inputServices = inputServices;
    this.receiverServices = receiverServices;

    return receiverServices;
  },

  getMuteState: function (callback) {
    this.log("Getting state of mute!");
    this.power.service.getCharacteristic(Characteristic.On).getValue(this.getUnmuteStateFromReceiverIfOnElseReportMuted(callback));
  },

  //TODO Flytt denne
  getUnmuteStateFromReceiverIfOnElseReportMuted: function (callback) {
    this.log("Deciding whether to request mute status from receiver based on power status!");
    if (this.power.service.getCharacteristic(Characteristic.On).value) {
      this.log("Getting state of mute from receiver since power is on!");
      this._httpRequest(this.volume.muteUrl, this.volume.muteStatusBody, function(error, response, body) {
        if (error) {
          this.log("getMuteState() failed: %s", error.message);
          callback(error);
        } else if (response.statusCode !== 200) {
          this.log("getMuteState() request returned http error: %s", response.statusCode);
          callback(new Error("getMuteState() returned http error " + response.statusCode));
        } else {
          body = body.replace("[[", "[");
          body = body.replace("]]", "]");
          var responseBody = JSON.parse(body);
          var currentMuteState = responseBody.result[0].mute == "off";
          this.log("Speaker is currently %s", currentMuteState ? "NOT MUTED" : "MUTED");
          callback(null, currentMuteState);
        }
      }.bind(this));
    } else {
      this.log("Reporting muted since since receiver is off!");
      callback(null, false);
    }
  },

  setMuteState: function (newUnmuteState, callback) {
    this.log("Setting state of mute!");
    this.power.service.getCharacteristic(Characteristic.On).getValue(this.setUnmuteStateByPoweringOnReceiverIfReceiverIsOffElseIssueMuteCommand(newUnmuteState, callback));
  },

  //TODO Flytt denne
  setUnmuteStateByPoweringOnReceiverIfReceiverIsOffElseIssueMuteCommand: function (newUnmuteState, callback) {
    if (newUnmuteState && !this.power.service.getCharacteristic(Characteristic.On).value) {
      this.log("Unmuting by powering on receiver since receiver is off!");
      this._httpRequest(this.power.url, this.power.onBody, function(error, response, body) {
        if (error) {
          this.log("setPowerState() failed: %s", error.message);
          callback(error);
        } else if (response.statusCode !== 200) {
          this.log("setPowerState() request returned http error: %s", response.statusCode);
          callback(new Error("setPowerState() returned http error " + response.statusCode));
        } else {
          this.log("setPowerState() successfully set power state to ON");
          this._sleep(this.receiverPowerOnDelay);
          for (let i = 0; i < this.inputServices.length; i++) {
            this.log("Restoring characteristics of input service " + i + " when powering on receiver to unmute!");
            this.inputServices[i].getCharacteristic(Characteristic.On).getValue();
          }
          this.log("Restoring characteristics of volume service when powering on receiver to unmute!");
          this.volume.service.getCharacteristic(Characteristic.On).getValue();
          this.volume.service.getCharacteristic(Characteristic.Brightness).getValue();
          this.log("Restoring characteristics of soundmode services when powering on receiver to unmute!");
          this.soundMode.stereoService.getCharacteristic(Characteristic.On).getValue();
          this.soundMode.surroundService.getCharacteristic(Characteristic.On).getValue();
          callback();
        }
      }.bind(this));
    } else {
      this.log("Issuing mute command since receiver is on!");

      var requestbody = newUnmuteState ? this.volume.muteOffBody : this.volume.muteOnBody;

      this._httpRequest(this.volume.muteUrl, requestbody, function(error, response, body) {
        if (error) {
          this.log("setMuteState() failed: %s", error.message);
          callback(error);
        } else if (response.statusCode !== 200) {
          this.log("setMuteState() request returned http error: %s", response.statusCode);
          callback(new Error("setMuteState() returned http error " + response.statusCode));
        } else {
          this.log("setMuteState() successfully set mute state to %s", newUnmuteState ? "OFF" : "ON");
          callback(undefined, body);
        }
      }.bind(this));
    }

  },

  getPowerState(callback) {

    this._httpRequest(this.power.url, this.power.statusBody, function(error, response, body) {
      if (error) {
        this.log("getPowerState() failed: %s", error.message);
        callback(error);
      } else if (response.statusCode !== 200) {
        this.log("getPowerState() request returned http error: %s", response.statusCode);
        callback(new Error("getPowerState() returned http error " + response.statusCode));
      } else {
        body = body.replace("[[", "[");
        body = body.replace("]]", "]");
        var responseBody = JSON.parse(body);
        var responseBodyResult = responseBody.result[0];
        var currentPowerState = responseBodyResult.active == "active";
        this.log("Speaker is currently %s", currentPowerState ? "ON" : "OFF");
        callback(null, currentPowerState);
      }
    }.bind(this));
  },

  setPowerState(newPowerState, callback) {

    var requestbody = newPowerState ? this.power.onBody : this.power.offBody;

    this._httpRequest(this.power.url, requestbody, function(error, response, body) {
      if (error) {
        this.log("setPowerState() failed: %s", error.message);
        callback(error);
      } else if (response.statusCode !== 200) {
        this.log("setPowerState() request returned http error: %s", response.statusCode);
        callback(new Error("setPowerState() returned http error " + response.statusCode));
      } else {
        this.log("setPowerState() successfully set power state to %s", newPowerState ? "ON" : "OFF");
        this._sleep(this.receiverPowerOnDelay);
        if (newPowerState) {
          for (let i = 0; i < this.inputServices.length; i++) {
            this.log("Restoring characteristics of input service " + i + " when powering on receiver using power service!");
            this.inputServices[i].getCharacteristic(Characteristic.On).getValue();
          }
          this.log("Restoring characteristics of volume service when powering on receiver using power service!");
          this.volume.service.getCharacteristic(Characteristic.On).getValue();
          this.volume.service.getCharacteristic(Characteristic.Brightness).getValue();
          this.log("Restoring characteristics of soundmode services when powering on receiver using power service!");
          this.soundMode.stereoService.getCharacteristic(Characteristic.On).getValue();
          this.soundMode.surroundService.getCharacteristic(Characteristic.On).getValue();
        } else {
          for (let i = 0; i < this.inputServices.length; i++) {
            this.log("Setting on characteristics of input service " + i + " to off when powering off receiver using power service!");
            this.inputServices[i].getCharacteristic(Characteristic.On).updateValue(false);
          }
          this.log("Setting on characteristics of volume service to off when powering off receiver using power service!");
          this.volume.service.getCharacteristic(Characteristic.On).updateValue(false);
          this.log("Setting on characteristics of soundmode services to off when powering off receiver using power service!");
          this.soundMode.stereoService.getCharacteristic(Characteristic.On).updateValue(false);
          this.soundMode.surroundService.getCharacteristic(Characteristic.On).updateValue(false);
        }
        callback(undefined, body);
      }
    }.bind(this));
  },

  getInputStateGeneral: function (callback, uri) {
    this.log("Getting state of input!");
    this.power.service.getCharacteristic(Characteristic.On).getValue(this.checkInputStateOnlyWhenReceiverIsOn(callback, uri));
  },

  //TODO Flytt denne
  checkInputStateOnlyWhenReceiverIsOn: function (callback, uri) {
    if (this.power.service.getCharacteristic(Characteristic.On).value) {

      this.log("Getting state of input from receiver since power is on!");

      this._httpRequest(this.input.url, this.input.statusBody, function(error, response, body) {
        if (error) {
          this.log("getInputState() failed: %s", error.message);
          callback(error);
        } else if (response.statusCode !== 200) {
          this.log("getInputState() request returned http error: %s", response.statusCode);
          callback(new Error("getInputState() returned http error " + response.statusCode));
        } else {
          body = body.replace("[[", "[");
          body = body.replace("]]", "]");
          var responseBody = JSON.parse(body);
          var responseBodyResult = responseBody.result[0];
          var currentInputState = responseBodyResult.uri == uri;
          this.log("Input is currently %s", currentInputState ? "ON" : "OFF");
          callback(null, currentInputState);
        }
      }.bind(this));
    } else {
      this.log("Reporting state of input as off since receiver is off!");
      callback(null, false);
    }
  },

  setInputStateGeneral: function (newInputState, callback, inputNumber, inputOnBody) {
    this.log("Setting state of input!");
    this.power.service.getCharacteristic(Characteristic.On).getValue(this.powerOnReceiverBeforeChangingInputIfNecessary(newInputState, callback, inputNumber, inputOnBody));
  },

  //TODO Flytt denne
  powerOnReceiverBeforeChangingInputIfNecessary: function (newInputState, callback, inputNumber, inputOnBody) {
    if (newInputState && !this.power.service.getCharacteristic(Characteristic.On).value) {
      this.log("Powering on receiver before setting input!");

      this._httpRequest(this.power.url, this.power.onBody, function(error, response, body) {
        if (error) {
          this.log("setPowerState() failed: %s", error.message);
          callback(error);
        } else if (response.statusCode !== 200) {
          this.log("setPowerState() request returned http error: %s", response.statusCode);
          callback(new Error("setPowerState() returned http error " + response.statusCode));
        } else {
          this.log("setPowerState() successfully set power state to ON");
          this._sleep(this.receiverPowerOnDelay);
          for (let i = 0; i < this.inputServices.length; i++) {
            this.log("Restoring characteristics of input service " + i + " when powering on receiver while setting input!");
            if (i != inputNumber) {
              this.inputServices[i].getCharacteristic(Characteristic.On).getValue();
            }
          }
          this.log("Restoring characteristics of volume service when powering on receiver while setting input!");
          this.volume.service.getCharacteristic(Characteristic.On).getValue();
          this.volume.service.getCharacteristic(Characteristic.Brightness).getValue();
          this.setInputStateonReceiver(newInputState, callback, inputNumber, inputOnBody);
        }
      }.bind(this));
    } else {
      this.setInputStateonReceiver(newInputState, callback, inputNumber, inputOnBody);
    }
  },

  //TODO Flytt denne
  setInputStateonReceiver(newInputState, callback, inputNumber, inputOnBody) {
    this.log("Setting state of input on receiver!");

    var requestbody = newInputState ? inputOnBody : this.power.offBody;

    this._httpRequest(this.input.url, requestbody, function(error, response, body) {
      if (error) {
        this.log("setInputState() failed: %s", error.message);
        callback(error);
      } else if (response.statusCode !== 200) {
        this.log("setInputState() request returned http error: %s", response.statusCode);
        callback(new Error("setInputState() returned http error " + response.statusCode));
      } else {
        this.log("setInputState() successfully set input " + inputNumber + " state to %s", newInputState ? "ON" : "OFF");
        callback(undefined, body);
        for (let i = 0; i < this.inputServices.length; i++) {
          if (i != inputNumber) {
            this.log("Also setting characteristic of input " + i + " to off when setting characteristic of input " + inputNumber);
            this.inputServices[i].getCharacteristic(Characteristic.On).updateValue(false);
          }
        }
        if (!newInputState) {
          this.log("Setting on characteristics of power and volume service to off when powering receiver off using input service!");
          this.power.service.getCharacteristic(Characteristic.On).updateValue(false);
          this.volume.service.getCharacteristic(Characteristic.On).updateValue(false);
          this.log("Setting on characteristics of soundmode services to off when powering receiver off using input service!");
          this.soundMode.stereoService.getCharacteristic(Characteristic.On).updateValue(false);
          this.soundMode.surroundService.getCharacteristic(Characteristic.On).updateValue(false);
        } else {
          this.log("Getting characteristics of stereo and surround service from receiver when changing input!");
          this.soundMode.stereoService.getCharacteristic(Characteristic.On).getValue();
          this.soundMode.surroundService.getCharacteristic(Characteristic.On).getValue();
        }
      }
    }.bind(this));
  },

  getVolume(callback) {
    this.log("Getting state of volume!");

    this._httpRequest(this.volume.volumeUrl, this.volume.volumeStatusBody, function(error, response, body) {
      if (error) {
        this.log("getVolume() failed: %s", error.message);
        callback(error);
      } else if (response.statusCode !== 200) {
        this.log("getVolume() request returned http error: %s", response.statusCode);
        callback(new Error("getVolume() returned http error " + response.statusCode));
      } else {
        body = body.replace("[[", "[");
        body = body.replace("]]", "]");
        var responseBody = JSON.parse(body);
        var currentVolumeState = responseBody.result[0].volume;
        this.log("Speaker's volume is at %s %", currentVolumeState);
        callback(null, currentVolumeState);
      }
    }.bind(this));
  },

  setVolume(newVolumeState, callback) {

    var requestbody = this.volume.volumeSetBody.replace("%s", newVolumeState);

    this._httpRequest(this.volume.volumeUrl, requestbody, function(error, response, body) {
      if (error) {
        this.log("setVolume() failed: %s", error.message);
        callback(error);
      } else if (response.statusCode !== 200) {
        this.log("setVolume() request returned http error: %s", response.statusCode);
        callback(new Error("setVolume() returned http error " + response.statusCode));
      } else {
        this.log("setVolume() successfully set volume to %s", newVolumeState);
        callback(undefined, body);
      }
    }.bind(this));
  },

  getStereoState(callback) {
    this.log("Getting state of stereo!");
    this.power.service.getCharacteristic(Characteristic.On).getValue(this.getSoundModeStateFromReceiverIfOnElseReportOff(callback, this.soundMode.stereoValue));
  },

  getSurroundState(callback) {
    this.log("Getting state of surround!");
    this.power.service.getCharacteristic(Characteristic.On).getValue(this.getSoundModeStateFromReceiverIfOnElseReportOff(callback, this.soundMode.surroundValue));
  },

  getSoundModeStateFromReceiverIfOnElseReportOff(callback, compareValue) {
    this.log("Deciding whether to request soundmode from receiver based on power status!");
    if (this.power.service.getCharacteristic(Characteristic.On).value) {
      this.log("Getting current soundmode from receiver since power is on!");

      this._httpRequest(this.soundMode.url, this.soundMode.statusBody, function(error, response, body) {
        if (error) {
          this.log("getSoundModeState() failed: %s", error.message);
          callback(error);
        } else if (response.statusCode !== 200) {
          this.log("getSoundModeState() request returned http error: %s", response.statusCode);
          callback(new Error("getSoundModeState() returned http error " + response.statusCode));
        } else {
          body = body.replace("[[", "[");
          body = body.replace("]]", "]");
          var responseBody = JSON.parse(body);
          var currentSoundModeState = responseBody.result[0].currentValue == compareValue;
          this.log("SoundMode is currently %s", currentSoundModeState ? "ON" : "OFF");
          callback(null, currentSoundModeState);
        }
      }.bind(this));
    } else {
      this.log("Reporting off since receiver is off!");
      callback(null, false);
    }
  },

  setStereoState(newSoundModeState, callback) {
    this.log("Setting state of stereo soundmode!");
    this.power.service.getCharacteristic(Characteristic.On).getValue(this.powerOnReceiverBeforeChangingsoundModeIfNecessary(newSoundModeState, callback, this.soundMode.stereoOnBody));
  },

  setSurroundState(newSoundModeState, callback) {
    this.log("Setting state of surround soundmode!");
    this.power.service.getCharacteristic(Characteristic.On).getValue(this.powerOnReceiverBeforeChangingsoundModeIfNecessary(newSoundModeState, callback, this.soundMode.surroundOnBody));
  },

  powerOnReceiverBeforeChangingsoundModeIfNecessary(newSoundModeState, callback, soundModeOnBody) {
    if (newSoundModeState && !this.power.service.getCharacteristic(Characteristic.On).value) {

      this.log("Powering on receiver before setting soundmode!");

      this._httpRequest(this.power.url, this.power.onBody, function(error, response, body) {
        if (error) {
          this.log("setPowerState() failed: %s", error.message);
          callback(error);
        } else if (response.statusCode !== 200) {
          this.log("setPowerState() request returned http error: %s", response.statusCode);
          callback(new Error("setPowerState() returned http error " + response.statusCode));
        } else {
          this.log("setPowerState() successfully set power state to ON");
          this._sleep(this.receiverPowerOnDelay);
          for (let i = 0; i < this.inputServices.length; i++) {
            this.log("Restoring characteristics of input service " + i + " when powering on receiver while setting soundmode!");
            this.inputServices[i].getCharacteristic(Characteristic.On).getValue();
          }
          this.log("Restoring characteristics of volume service when powering on receiver while setting input!");
          this.volume.service.getCharacteristic(Characteristic.On).getValue();
          this.volume.service.getCharacteristic(Characteristic.Brightness).getValue();
          this.setSoundModeOnReceiver(newSoundModeState, callback, soundModeOnBody);
        }
      }.bind(this));
    } else {
      this.setSoundModeOnReceiver(newSoundModeState, callback, soundModeOnBody);
    }
  },

  //TODO Flytt denne
  setSoundModeOnReceiver(newSoundModeState, callback, soundModeOnBody) {
    this.log("Setting soundmode on receiver!");

    var requestbody = newSoundModeState ? soundModeOnBody : this.power.offBody;
    var requestUrl = newSoundModeState ? this.soundMode.url : this.power.url;

    this._httpRequest(requestUrl, requestbody, function(error, response, body) {
      if (error) {
        this.log("setSoundMode() failed: %s", error.message);
        callback(error);
      } else if (response.statusCode !== 200) {
        this.log("setSoundMode() request returned http error: %s", response.statusCode);
        callback(new Error("setSoundMode() returned http error " + response.statusCode));
      } else {
        this.log("setSoundMode() successfully set soundmode to %s", newSoundModeState ? "ON" : "OFF");
        callback(undefined, body);

        if (!newSoundModeState) {
          for (let i = 0; i < this.inputServices.length; i++) {
            this.log("Setting on characteristics of input service " + i + " to off when powering off receiver using power service!");
            this.inputServices[i].getCharacteristic(Characteristic.On).updateValue(false);
          }
          this.log("Setting on characteristics of power and volume service to off when powering receiver off using soundmode services!");
          this.power.service.getCharacteristic(Characteristic.On).updateValue(false);
          this.volume.service.getCharacteristic(Characteristic.On).updateValue(false);
        }

        this.log("Setting other soundmodes to off when changing state of soundmode!");
        if (soundModeOnBody == this.soundMode.stereoOnBody) {
          this.soundMode.surroundService.getCharacteristic(Characteristic.On).updateValue(false);
        } else {
          this.soundMode.stereoService.getCharacteristic(Characteristic.On).updateValue(false);
        }
      }
    }.bind(this));
  },

  _sleep(miliseconds) {
    var currentTime = new Date().getTime();
    while (currentTime + miliseconds >= new Date().getTime()) {
    }
  },

  _httpRequest(url, body, callback) {
    request({
      url: url,
      body: body,
      method: "POST",
      rejectUnauthorized: false
    },
      function(error, response, body) {
        callback(error, response, body);
      }
    );
  },

  setNetWorkStandby() {
    this._httpRequest(this.networkStandby.url, this.networkStandby.enableNetworkStandby ? this.networkStandby.onBody : this.networkStandby.offBody, function(error, response, body) {
      if (error) {
        this.log("setPowerSettings() failed: %s", error.message);
      } else if (response.statusCode !== 200) {
        this.log("setPowerSettings() request returned http error: %s", response.statusCode);
      } else {
        this.log("Network standby is currently %s", this.networkStandby.enableNetworkStandby ? "ON" : "OFF");
      }
    }.bind(this));
  },

  getVolumeInformationNotifcations() {
    var WebSocketClient = require('websocket').client;
    var client = new WebSocketClient();

    function switchNotifications(id, disable, enable) {
      return {
        "method": "switchNotifications",
        "id": id,
        "params": [{
          "disabled": disable,
          "enabled": enable
        }],
        "version": "1.0"
      };
    }

    client.on('connectFailed', function(error) {
      this.log('Connect Error: ' + error.toString());
      setTimeout(function() {
        client.connect(AudioWsUrl);
      }, 1000);
    }.bind(this));

    client.on('connect', function(connection) {
      this.log('WebSocket Client Connected');

      connection.on('error', function(error) {
        this.log("Connection Error: " + error.toString());
        setTimeout(function() {
          client.connect(AudioWsUrl);
        }, 1000);
      }.bind(this));

      connection.on('close', function() {
        this.log('WebSocket Connection Closed');
        setTimeout(function() {
          client.connect(AudioWsUrl);
        }, 1000);
      }.bind(this));

      connection.on('message', function(message) {
        this.log("Connection established using WebSocket");
        if (message.type === 'utf8') {
          this.log("Got notification from receiver using WebSocket");
          var msg = JSON.parse(message.utf8Data);
          if (msg.id == 1) {
            let all_notifications = msg.result[0].disabled.concat(msg.result[0].enabled);
            var enable = [];
            var disable = [];
            all_notifications.forEach(
              item => item.name == "notifyVolumeInformation" ? enable.push(item) : disable.push(item));
            connection.sendUTF(JSON.stringify(switchNotifications(127, disable, enable)));
          } else {
            this.log("Received: '" + message.utf8Data + "'");
            this.log("Received: '" + msg + "'");
            if (msg.hasOwnProperty("method")) {
              if (msg.method == "notifyVolumeInformation") {
                for (let i = 0; i < msg.params.length; i++) {
                  if (msg.params[i].output == this.outputZone) {
                    var unmuteStatus;
                    if (msg.params[i].mute == "off") {
                      unmuteStatus = true;
                    } else {
                      unmuteStatus = false;
                    }
                    var volumeLevel = msg.params[i].volume;
                    this.volume.service.getCharacteristic(Characteristic.Brightness).updateValue(volumeLevel);
                    this.log("Set the volume to " + volumeLevel);
                    this.volume.service.getCharacteristic(Characteristic.On).updateValue(unmuteStatus);
                    this.log("Set the unmute status to " + unmuteStatus);
                  }
                }
              }
            }
          }
        }
      }.bind(this));

      function subscribe() {
        if (connection.connected) {
          connection.sendUTF(JSON.stringify(switchNotifications(1, [], [])));
        }
      }

      subscribe();

    }.bind(this));

    var AudioWsUrl = this.baseWsUrl + "/sony/audio";
    client.connect(AudioWsUrl);

  },

  getActiveInputAndOutputNotification() {
    var WebSocketClient = require('websocket').client;
    var client = new WebSocketClient();

    function switchNotifications(id, disable, enable) {
      return {
        "method": "switchNotifications",
        "id": id,
        "params": [{
          "disabled": disable,
          "enabled": enable
        }],
        "version": "1.0"
      };
    }

    client.on('connectFailed', function(error) {
      this.log('Connect Error: ' + error.toString());
      setTimeout(function() {
        client.connect(AudioWsUrl);
      }, 1000);
    }.bind(this));

    client.on('connect', function(connection) {
      this.log('WebSocket Client Connected');

      connection.on('error', function(error) {
        this.log("Connection Error: " + error.toString());
        setTimeout(function() {
          client.connect(AudioWsUrl);
        }, 1000);
      }.bind(this));

      connection.on('close', function() {
        this.log('WebSocket Connection Closed');
        setTimeout(function() {
          client.connect(AudioWsUrl);
        }, 1000);
      }.bind(this));

      connection.on('message', function(message) {
        this.log("Connection established using WebSocket");
        if (message.type === 'utf8') {
          this.log("Got notification from receiver using WebSocket");
          var msg = JSON.parse(message.utf8Data);
          if (msg.id == 1) {
            let all_notifications = msg.result[0].disabled.concat(msg.result[0].enabled);
            var enable = [];
            var disable = [];
            all_notifications.forEach(
              item => item.name == "notifyExternalTerminalStatus" || item.name == "notifyPlayingContentInfo" ? enable.push(item) : disable.push(item));
            connection.sendUTF(JSON.stringify(switchNotifications(127, disable, enable)));
          } else {
            this.log("Received: '" + message.utf8Data + "'");
            this.log("Received: '" + msg + "'");
            if (msg.hasOwnProperty("method")) {
              if (msg.method == "notifyExternalTerminalStatus") {
                for (let i = 0; i < msg.params.length; i++) {
                  if (msg.params[i].uri == this.outputZone) {
                    var newPowerState;
                    if (msg.params[i].active == "active") {
                      newPowerState = true;
                    } else {
                      newPowerState = false;
                    }
                    this.power.service.getCharacteristic(Characteristic.On).updateValue(newPowerState);
                    this.log("Set the power to " + newPowerState);
                    if (newPowerState == true) {
                      this._sleep(this.receiverPowerOnDelay);
                      for (let j = 0; j < this.receiverServices.length; j++) {
                        if (this.receiverServices[j] != this.power.service) {
                          this.receiverServices[j].getCharacteristic(Characteristic.On).getValue();
                        }
                      }
                    } else {
                      for (let j = 0; j < this.receiverServices.length; j++) {
                        if (this.receiverServices[j] != this.power.service) {
                          this.receiverServices[j].getCharacteristic(Characteristic.On).updateValue(false);
                        }
                      }
                    }
                  }
                }
              } else if (msg.method == "notifyPlayingContentInfo") {
                for (let i = 0; i < msg.params.length; i++) {
                  if (msg.params[i].output == this.outputZone) {
                    for (let j = 0; j < this.inputs.length; j++) {
                      if (msg.params[i].uri == this.inputs[j].uri) {
                        this.inputs[j].service.getCharacteristic(Characteristic.On).updateValue(true);
                        this.log("Set characteristic of input " + this.inputs[j].name + " to on.");
                        this.soundMode.stereoService.getCharacteristic(Characteristic.On).getValue();
                        this.soundMode.surroundService.getCharacteristic(Characteristic.On).getValue();
                      } else {
                        this.inputs[j].service.getCharacteristic(Characteristic.On).updateValue(false);
                        this.log("Set characteristic of input " + this.inputs[j].name + " to off.");
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }.bind(this));

      function subscribe() {
        if (connection.connected) {
          connection.sendUTF(JSON.stringify(switchNotifications(1, [], [])));
        }
      }

      subscribe();

    }.bind(this));

    var AudioWsUrl = this.baseWsUrl + "/sony/avContent";
    client.connect(AudioWsUrl);

  }
};