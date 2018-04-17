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
    this.input = {};
    this.power = {};
    this.soundMode = {};
    this.inputServices = [];
    this.receiverServices = [];
    this.inputs = config.inputs;
    this.receiverPowerOnDelay = 200;

    this.volume.volumeUrl = config.baseUrl + "/sony/audio";
    this.volume.volumeStatusBody = JSON.stringify({"method":"getVolumeInformation","id":127,"params":[{"output":"extOutput:zone?zone=1"}],"version":"1.1"});
    this.volume.volumeSetBody = JSON.stringify({"method":"setAudioVolume","id":127,"params":[{"volume":"%s","output":"extOutput:zone?zone=1"}],"version":"1.1"});
    this.volume.volumeHttpMethod = "POST";

    this.volume.muteUrl = config.baseUrl + "/sony/audio";
    this.volume.muteStatusBody = JSON.stringify({"method":"getVolumeInformation","id":127,"params":[{"output":"extOutput:zone?zone=1"}],"version":"1.1"});
    this.volume.muteOnBody = JSON.stringify({"method":"setAudioMute","id":127,"params":[{"mute":"on","output":"extOutput:zone?zone=1"}],"version":"1.1"});
    this.volume.muteOffBody = JSON.stringify({"method":"setAudioMute","id":127,"params":[{"mute":"off","output":"extOutput:zone?zone=1"}],"version":"1.1"});
    this.volume.muteHttpMethod = "POST";

    this.input.url = config.baseUrl + "/sony/avContent";
    this.input.statusBody = JSON.stringify({"method":"getPlayingContentInfo","id":127,"params":[{"output":"extOutput:zone?zone=1"}],"version":"1.2"});
    this.input.onBodyBasis = JSON.stringify({"method":"setPlayContent","id":127,"params":[{"output":"extOutput:zone?zone=1","uri":"%s"}],"version":"1.2"});
    this.input.offBody = JSON.stringify({"method":"setActiveTerminal","id":127,"params":[{"active":"inactive","uri":"extOutput:zone?zone=1"}],"version":"1.0"});
    this.input.httpMethod = "POST";

    this.power.url = config.baseUrl + "/sony/avContent";
    this.power.statusBody = JSON.stringify({"method":"getCurrentExternalTerminalsStatus","id":127,"params":[],"version":"1.0"});
    this.power.onBody = JSON.stringify({"method":"setActiveTerminal","id":127,"params":[{"active":"active","uri":"extOutput:zone?zone=1"}],"version":"1.0"});
    this.power.offBody = JSON.stringify({"method":"setActiveTerminal","id":127,"params":[{"active":"inactive","uri":"extOutput:zone?zone=1"}],"version":"1.0"});
    this.power.httpMethod = "POST";

    this.soundMode.url = config.baseUrl + "/sony/audio";
    this.soundMode.statusBody = JSON.stringify({"method":"getSoundSettings","id":127,"params":[{"target":"soundField"}],"version":"1.1"});
    this.soundMode.stereoValue = "2chStereo"
    this.soundMode.stereoOnBody = JSON.stringify({"method":"setSoundSettings","id":127,"params":[{"settings":[{"value":"2chStereo","target":"soundField"}]}],"version":"1.1"});
    this.soundMode.surroundValue = "dolbySurround"
    this.soundMode.surroundOnBody = JSON.stringify({"method":"setSoundSettings","id":127,"params":[{"settings":[{"value":"dolbySurround","target":"soundField"}]}],"version":"1.1"});
    this.soundMode.httpMethod = "POST";

}

SonyAudioControlReceiver.prototype = {

    identify: function (callback) {
        this.log("Identify requested!");
        callback();
    },

    getServices: function () {
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
        var surroundService = new Service.Switch("Surround", "Surround");

        this.log("... configuring surround characteristic");
        surroundService
            .getCharacteristic(Characteristic.On)
            .on("get", this.getSurroundState.bind(this))
            .on("set", this.setSurroundState.bind(this));

        this.soundMode.surroundService = surroundService;

        receiverServices.push(surroundService);

        this.log("Creating stereo service!");
        var stereoService = new Service.Switch("Stereo", "Stereo");

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

          this.inputs[i].onBody = this.input.onBodyBasis.replace("%s", this.inputs[i].uri);
          var inputSetFunctionBody = "this.setInputStateGeneral(newInputState, callback, " + i + ", \'" + this.inputs[i].onBody + "\');";
          var setInputFunction = new Function('newInputState', 'callback', inputSetFunctionBody);
          this.inputs[i].setInputState = setInputFunction.bind(this);

          let inputService = new Service.Switch("Input " + this.inputs[i].name, this.inputs[i].name);

          this.log("... configuring input characteristic");
          inputService
              .getCharacteristic(Characteristic.On)
              .on("get", this.inputs[i].getInputState.bind(this))
              .on("set", this.inputs[i].setInputState.bind(this));
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

    getUnmuteStateFromReceiverIfOnElseReportMuted: function (callback) {
      this.log("Deciding whether to request mute status from receiver based on power status!");
      if (this.power.service.getCharacteristic(Characteristic.On).value) {
        this.log("Getting state of mute from receiver since power is on!");

          if (!this.volume.muteUrl) {
              this.log.warn("Ignoring getMuteState() request, 'mute.url' is not defined!");
              callback(new Error("No 'mute.url' defined!"));
              return;
          }

          this._httpRequest(this.volume.muteUrl, this.volume.muteStatusBody, "POST", function (error, response, body) {
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
                  var currentMuteState = responseBody.result[0].mute == "off";
                  this.log("Speaker is currently %s", currentMuteState? "NOT MUTED": "MUTED");
                  callback(null, currentMuteState);
              }
          }.bind(this));
      }
      else {
        this.log("Reporting muted since since receiver is off!");
        callback(null, false);
      }
    },

    setMuteState: function (newUnmuteState, callback) {
      this.log("Setting state of mute!");
      this.power.service.getCharacteristic(Characteristic.On).getValue(this.setUnmuteStateByPoweringOnReceiverIfReceiverIsOffElseIssueMuteCommand(newUnmuteState, callback));
    },

    setUnmuteStateByPoweringOnReceiverIfReceiverIsOffElseIssueMuteCommand: function (newUnmuteState, callback) {
      if (newUnmuteState && !this.power.service.getCharacteristic(Characteristic.On).value) {
        this.log("Unmuting by powering on receiver since receiver is off!");

        if (!this.power.url) {
            this.log.warn("Ignoring setPowerState() request, 'power.url' is not defined!");
            callback(new Error("No 'power.url' defined!"));
            return;
        }

        this._httpRequest(this.power.url, this.power.onBody, this.power.httpMethod, function (error, response, body) {
            if (error) {
                this.log("powerOnReceiverToUnmute() failed: %s", error.message);
                callback(error);
            }
            else if (response.statusCode !== 200) {
                this.log("powerOnReceiverToUnmute() request returned http error: %s", response.statusCode);
                callback(new Error("powerOnReceiverToUnmute() returned http error " + response.statusCode));
            }
            else {
                this.log("powerOnReceiverToUnmute() successfully set power state to ON");
                for (let i = 0; i < this.inputServices.length; i++) {
                  this.log("Restoring characteristics of input service " + i + " when powering on receiver to unmute!");
                  this.inputServices[i].getCharacteristic(Characteristic.On).getValue();
                }
                this.log("Restoring characteristics of volume service when powering on receiver to unmute!");
                this.volume.service.getCharacteristic(Characteristic.On).getValue();
                this.volume.service.getCharacteristic(Characteristic.Brightness).getValue();
                this.soundMode.stereoService.getCharacteristic(Characteristic.On).getValue();
                this.soundMode.surroundService.getCharacteristic(Characteristic.On).getValue();
                callback();
            }
        }.bind(this));
      }
      else {
        this.log("Issuing mute command since receiver is on!");

        if (!this.volume.muteUrl) {
            this.log.warn("Ignoring setMuteState() request, 'mute.url' is not defined!");
            callback(new Error("No 'mute.url' defined!"));
            return;
        }

        var requestbody = newUnmuteState? this.volume.muteOffBody: this.volume.muteOnBody;

        this._httpRequest(this.volume.muteUrl, requestbody, this.volume.muteHttpMethod, function (error, response, body) {
            if (error) {
                this.log("setMuteState() failed: %s", error.message);
                callback(error);
            }
            else if (response.statusCode !== 200) {
                this.log("setMuteState() request returned http error: %s", response.statusCode);
                callback(new Error("setMuteState() returned http error " + response.statusCode));
            }
            else {
                this.log("setMuteState() successfully set mute state to %s", newUnmuteState? "OFF": "ON");
                callback(undefined, body);
            }
        }.bind(this));
      }
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
                var currentPowerState = responseBodyResult.active == "active";
                this.log("Speaker is currently %s", currentPowerState? "ON": "OFF");
                callback(null, currentPowerState);
            }
        }.bind(this));
    },

    setPowerState: function (newPowerState, callback) {
        if (!this.power.url) {
            this.log.warn("Ignoring setPowerState() request, 'power.url' is not defined!");
            callback(new Error("No 'power.url' defined!"));
            return;
        }

        var requestbody = newPowerState? this.power.onBody: this.power.offBody;

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
                this.log("setPowerState() successfully set power state to %s", newPowerState? "ON": "OFF");
                for (let i = 0; i < this.inputServices.length; i++) {
                  if (newPowerState) {
                    this.log("Restoring characteristics of input service " + i + " when powering on receiver using power or volume service!");
                    this.inputServices[i].getCharacteristic(Characteristic.On).getValue();
                  }
                  else {
                    this.log("Setting on characteristics of input service " + i + " to off when powering off receiver using power or volume service!");
                    this.inputServices[i].getCharacteristic(Characteristic.On).updateValue(false);
                  }
                }
                if (newPowerState) {
                  this.log("Restoring characteristics of volume service when powering on receiver using power or volume service!");
                  this.volume.service.getCharacteristic(Characteristic.On).getValue();
                  this.volume.service.getCharacteristic(Characteristic.Brightness).getValue();
                  this.soundMode.stereoService.getCharacteristic(Characteristic.On).getValue();
                  this.soundMode.surroundService.getCharacteristic(Characteristic.On).getValue();
                }
                else {
                  this.log("Setting on characteristics of volume service to off when powering off receiver using power or volume service!");
                  this.volume.service.getCharacteristic(Characteristic.On).updateValue(false);
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

    checkInputStateOnlyWhenReceiverIsOn: function (callback, uri) {
      if (this.power.service.getCharacteristic(Characteristic.On).value) {
        this.log("Getting state of input from receiver since power is on!");

        if (!this.input.url) {
            this.log.warn("Ignoring getInputState() request, 'input.url' is not defined!");
            callback(new Error("No 'input.url' defined!"));
            return;
        }

        this._httpRequest(this.input.url, this.input.statusBody, "POST", function (error, response, body) {
            if (error) {
                this.log("getInputState() failed: %s", error.message);
                callback(error);
            }
            else if (response.statusCode !== 200) {
                this.log("getInputState() request returned http error: %s", response.statusCode);
                callback(new Error("getInputState() returned http error " + response.statusCode));
            }
            else {
                body = body.replace("[[", "[");
                body = body.replace("]]", "]");
                var responseBody = JSON.parse(body);
                var responseBodyResult = responseBody.result[0];
                var currentInputState = responseBodyResult.uri == uri;
                this.log("Input is currently %s", currentInputState? "ON": "OFF");
                callback(null, currentInputState);
            }
        }.bind(this));
      }
      else {
        this.log("Reporting state of input as off since receiver is off!");
        callback(null, false);
      }
    },

    setInputStateGeneral: function (newInputState, callback, inputNumber, inputOnBody) {
      this.log("Setting state of input!");
      this.power.service.getCharacteristic(Characteristic.On).getValue(this.powerOnReceiverBeforeChangingInputIfNecessary(newInputState, callback, inputNumber, inputOnBody));
    },

    powerOnReceiverBeforeChangingInputIfNecessary: function (newInputState, callback, inputNumber, inputOnBody) {
      if (newInputState && !this.power.service.getCharacteristic(Characteristic.On).value) {
        this.log("Powering on receiver before setting input!");

        if (!this.power.url) {
            this.log.warn("Ignoring setPowerState() request, 'power.url' is not defined!");
            callback(new Error("No 'power.url' defined!"));
            return;
        }

        this._httpRequest(this.power.url, this.power.onBody, this.power.httpMethod, function (error, response, body) {
            if (error) {
                this.log("setPowerStateBeforeSettingInput() failed: %s", error.message);
                callback(error);
            }
            else if (response.statusCode !== 200) {
                this.log("setPowerStateBeforeSettingInput() request returned http error: %s", response.statusCode);
                callback(new Error("setPowerStateBeforeSettingInput() returned http error " + response.statusCode));
            }
            else {
                this.log("setPowerStateBeforeSettingInput() successfully set power state to ON");
                for (let i = 0; i < this.inputServices.length; i++) {
                  this.log("Restoring characteristics of input service " + i + " when powering on receiver while setting input!");
                  if (i != inputNumber) {
                    this.inputServices[i].getCharacteristic(Characteristic.On).getValue();
                  }
                }
                this.log("Restoring characteristics of volume service when powering on receiver while setting input!");
                this.volume.service.getCharacteristic(Characteristic.On).getValue();
                this.volume.service.getCharacteristic(Characteristic.Brightness).getValue();
                this.soundMode.stereoService.getCharacteristic(Characteristic.On).getValue();
                this.soundMode.surroundService.getCharacteristic(Characteristic.On).getValue();
                this.sleep(this.receiverPowerOnDelay);
                this.setInputStateonReceiver(newInputState, callback, inputNumber, inputOnBody);
            }
        }.bind(this));
      }
      else {
        this.setInputStateonReceiver(newInputState, callback, inputNumber, inputOnBody);
      }
    },

    setInputStateonReceiver: function (newInputState, callback, inputNumber, inputOnBody) {
      this.log("Setting state of input on receiver!");
        if (!this.input.url) {
            this.log.warn("Ignoring setInputState() request, 'input.url' is not defined!");
            callback(new Error("No 'input.url' defined!"));
            return;
        }

        var requestbody = newInputState? inputOnBody: this.power.offBody;

        this._httpRequest(this.input.url, requestbody, this.input.httpMethod, function (error, response, body) {
            if (error) {
                this.log("setInputState() failed: %s", error.message);
                callback(error);
            }
            else if (response.statusCode !== 200) {
                this.log("setInputState() request returned http error: %s", response.statusCode);
                callback(new Error("setInputState() returned http error " + response.statusCode));
            }
            else {
                this.log("setInputState() successfully set input " + inputNumber + " state to %s", newInputState? "ON": "OFF");
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
                }
            }
        }.bind(this));
    },

    getVolume: function (callback) {
        this.log("Getting state of volume!");
        if (!this.volume.volumeUrl) {
            this.log.warn("Ignoring getVolume() request, 'volume.url' is not defined!");
            callback(new Error("No 'volume.url' defined!"));
            return;
        }

        this._httpRequest(this.volume.volumeUrl, this.volume.volumeStatusBody, "POST", function (error, response, body) {
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
                var currentVolumeState = responseBody.result[0].volume;
                this.log("Speaker's volume is at %s %", currentVolumeState);
                callback(null, currentVolumeState);
            }
        }.bind(this));
    },

    setVolume: function (newVolumeState, callback) {
        if (!this.volume.volumeUrl) {
            this.log.warn("Ignoring setVolume() request, 'volume.url' is not defined!");
            callback(new Error("No 'volume.url' defined!"));
            return;
        }

        var requestbody = this.volume.volumeSetBody.replace("%s", newVolumeState);

        this._httpRequest(this.volume.volumeUrl, requestbody, this.volume.volumeHttpMethod, function (error, response, body) {
            if (error) {
                this.log("setVolume() failed: %s", error.message);
                callback(error);
            }
            else if (response.statusCode !== 200) {
                this.log("setVolume() request returned http error: %s", response.statusCode);
                callback(new Error("setVolume() returned http error " + response.statusCode));
            }
            else {
                this.log("setVolume() successfully set volume to %s", newVolumeState);
                callback(undefined, body);
            }
        }.bind(this));
    },

    getStereoState: function (callback) {
      this.log("Getting state of stereo!");
      this.power.service.getCharacteristic(Characteristic.On).getValue(this.getSoundModeStateFromReceiverIfOnElseReportOff(callback, this.soundMode.stereoValue));
    },

    getSurroundState: function (callback) {
      this.log("Getting state of surround!");
      this.power.service.getCharacteristic(Characteristic.On).getValue(this.getSoundModeStateFromReceiverIfOnElseReportOff(callback, this.soundMode.surroundValue));
    },

    getSoundModeStateFromReceiverIfOnElseReportOff: function (callback, compareValue) {
      this.log("Deciding whether to request soundmode from receiver based on power status!");
      if (this.power.service.getCharacteristic(Characteristic.On).value) {
        this.log("Getting current soundmode from receiver since power is on!");

          if (!this.soundMode.url ) {
              this.log.warn("Ignoring getSoundModeState() request, 'soundMode.url' is not defined!");
              callback(new Error("No 'soundMode.url' defined!"));
              return;
          }

          this._httpRequest(this.soundMode.url, this.soundMode.statusBody, "POST", function (error, response, body) {
              if (error) {
                  this.log("getSoundModeState() failed: %s", error.message);
                  callback(error);
              }
              else if (response.statusCode !== 200) {
                  this.log("getSoundModeState() request returned http error: %s", response.statusCode);
                  callback(new Error("getSoundModeState() returned http error " + response.statusCode));
              }
              else {
                  body = body.replace("[[", "[");
                  body = body.replace("]]", "]");
                  var responseBody = JSON.parse(body);
                  var currentSoundModeState = responseBody.result[0].currentValue == compareValue;
                  this.log("SoundMode is currently %s", currentSoundModeState? "ON": "OFF");
                  callback(null, currentSoundModeState);
              }
          }.bind(this));
      }
      else {
        this.log("Reporting off since receiver is off!");
        callback(null, false);
      }
    },

    setStereoState: function (newSoundModeState, callback) {
      this.log("Setting state of stereo soundmode!");
      this.power.service.getCharacteristic(Characteristic.On).getValue(this.powerOnReceiverBeforeChangingsoundModeIfNecessary(newSoundModeState, callback, this.soundMode.stereoOnBody));
    },

    setSurroundState: function (newSoundModeState, callback) {
      this.log("Setting state of surround soundmode!");
      this.power.service.getCharacteristic(Characteristic.On).getValue(this.powerOnReceiverBeforeChangingsoundModeIfNecessary(newSoundModeState, callback, this.soundMode.surroundOnBody));
    },

    powerOnReceiverBeforeChangingsoundModeIfNecessary: function (newSoundModeState, callback, soundModeOnBody) {
      if (newSoundModeState && !this.power.service.getCharacteristic(Characteristic.On).value) {
        this.log("Powering on receiver before setting soundmode!");

        if (!this.power.url) {
            this.log.warn("Ignoring powerOnReceiverBeforeChangingSoundMode() request, 'power.url' is not defined!");
            callback(new Error("No 'power.url' defined!"));
            return;
        }

        this._httpRequest(this.power.url, this.power.onBody, this.power.httpMethod, function (error, response, body) {
            if (error) {
                this.log("powerOnReceiverBeforeChangingSoundMode() failed: %s", error.message);
                callback(error);
            }
            else if (response.statusCode !== 200) {
                this.log("powerOnReceiverBeforeChangingSoundMode() request returned http error: %s", response.statusCode);
                callback(new Error("powerOnReceiverBeforeChangingSoundMode() returned http error " + response.statusCode));
            }
            else {
                this.log("powerOnReceiverBeforeChangingSoundMode() successfully set power state to ON");
                for (let i = 0; i < this.inputServices.length; i++) {
                  this.log("Restoring characteristics of input service " + i + " when powering on receiver while setting soundmode!");
                  this.inputServices[i].getCharacteristic(Characteristic.On).getValue();
                }
                this.log("Restoring characteristics of volume service when powering on receiver while setting input!");
                this.volume.service.getCharacteristic(Characteristic.On).getValue();
                this.volume.service.getCharacteristic(Characteristic.Brightness).getValue();
                this.soundMode.stereoService.getCharacteristic(Characteristic.On).getValue();
                this.soundMode.surroundService.getCharacteristic(Characteristic.On).getValue();
                this.sleep(this.receiverPowerOnDelay);
                this.setSoundModeOnReceiver(newSoundModeState, callback, soundModeOnBody);
            }
        }.bind(this));
      }
      else {
        this.setSoundModeOnReceiver(newSoundModeState, callback, soundModeOnBody);
      }
    },

    setSoundModeOnReceiver: function (newSoundModeState, callback, soundModeOnBody) {
      this.log("Setting soundmode on receiver!");
        if (!this.soundMode.url) {
            this.log.warn("Ignoring setSoundModeOnReceiver() request, 'soundMode.url' is not defined!");
            callback(new Error("No 'soundMode.url' defined!"));
            return;
        }

        var requestbody = newSoundModeState? soundModeOnBody: this.power.offBody;
        var requestUrl = newSoundModeState? this.soundMode.url: this.power.url;
        var requesthttpMethod = newSoundModeState? this.soundMode.httpMethod: this.power.httpMethod;

        this._httpRequest(requestUrl, requestbody, requesthttpMethod, function (error, response, body) {
            if (error) {
                this.log("setSoundModeOnReceiver() failed: %s", error.message);
                callback(error);
            }
            else if (response.statusCode !== 200) {
                this.log("setSoundModeOnReceiver() request returned http error: %s", response.statusCode);
                callback(new Error("setSoundModeOnReceiver() returned http error " + response.statusCode));
            }
            else {
                this.log("setSoundModeOnReceiver() successfully set soundmode to %s", newSoundModeState? "ON": "OFF");
                callback(undefined, body);
                if (!newSoundModeState) {
                  this.log("Setting on characteristics of power and volume service to off when powering receiver off using soundmode services!");
                  this.power.service.getCharacteristic(Characteristic.On).updateValue(false);
                  this.volume.service.getCharacteristic(Characteristic.On).updateValue(false);
                  this.soundMode.stereoService.getCharacteristic(Characteristic.On).updateValue(false);
                  this.soundMode.surroundService.getCharacteristic(Characteristic.On).updateValue(false);

                }
            }
        }.bind(this));
    },

    sleep: function (miliseconds) {
      var currentTime = new Date().getTime();
      while (currentTime + miliseconds >= new Date().getTime()) {
      }
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
        );
    }

};
