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
  this.soundField.url = this.baseHttpUrl + "/sony/audio";
  this.networkStandby.url = this.baseHttpUrl + "/sony/system";
  this.networkStandby.enableNetworkStandby = config.enableNetworkStandby === false ? false : true;
  this.audioWsUrl = this.baseWsUrl + "/sony/audio";
  this.avContentWsUrl = this.baseWsUrl + "/sony/avContent";
  this.setNetWorkStandby();
  this.getNotifications(this.audioWsUrl);
  this.getNotifications(this.avContentWsUrl);
}

SonyAudioControlReceiver.prototype = {
  receiverPowerOnDelay: 1000,
  outputZone: "extOutput:zone?zone=1",
  inputServices: [],
  receiverServices: [],
  onServices: [],
  soundFields: [
    {
      "name": "Surround Mode",
      "value": "dolbySurround"
    },
    {
      "name": "Stereo Mode",
      "value": "2chStereo"
    }
  ],

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
    }
  },

  soundField: {
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
    get onBodyBasis() {
      return JSON.stringify({
        "method": "setSoundSettings",
        "id": 127,
        "params": [{
          "settings": [{
            "value": "%s",
            "target": "soundField"
          }]
        }],
        "version": "1.1"
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
      })
    },
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

    this.informationService = informationService;

    receiverServices.push(informationService);

    this.log("Creating volume service!");
    var volumeService = new Service.Lightbulb(this.name);

    this.log.debug("... configuring mute characteristic");
    volumeService
      .getCharacteristic(Characteristic.On)
      .on("get", this.getMuteState.bind(this))
      .on("set", this.setMuteState.bind(this));

    this.log.debug("... adding volume characteristic");
    volumeService
      .addCharacteristic(new Characteristic.Brightness())
      .on("get", this.getVolume.bind(this))
      .on("set", this.setVolume.bind(this));

    this.volume.service = volumeService;

    receiverServices.push(volumeService);

    this.log("Creating power service!");
    var powerService = new Service.Switch(this.name, this.name);

    this.log.debug("... configuring power characteristic");
    powerService
      .getCharacteristic(Characteristic.On)
      .on("get", this.getPowerState.bind(this))
      .on("set", this.setPowerState.bind(this));

    this.power.service = powerService;

    receiverServices.push(powerService);

    this.log("Creating input services!");

    var inputServices = [];

    for (let i = 0; i < this.inputs.length; i++) {

      this.log("Creating input service %s!", this.inputs[i].name);

      let inputGetFunctionBody = "this.getInputState(callback, \'" + this.inputs[i].uri + "\');";
      let getInputFunction = new Function('callback', inputGetFunctionBody);
      this.inputs[i].getInputState = getInputFunction.bind(this);
      this.inputs[i].onBody = this.input.onBodyBasis.replace("%s", this.inputs[i].uri);
      let inputSetFunctionBody = "this.setInputState(newInputState, callback, " + i + ", \'" + this.inputs[i].onBody + "\');";
      let setInputFunction = new Function('newInputState', 'callback', inputSetFunctionBody);
      this.inputs[i].setInputState = setInputFunction.bind(this);

      var inputService = new Service.Switch("Input " + this.inputs[i].name, this.inputs[i].name);

      this.log.debug("... configuring input characteristic");
      inputService
        .getCharacteristic(Characteristic.On)
        .on("get", this.inputs[i].getInputState.bind(this))
        .on("set", this.inputs[i].setInputState.bind(this));
      this.inputs[i].service = inputService;
      inputServices.push(inputService);
    }

    receiverServices = receiverServices.concat(inputServices);
    this.inputServices = inputServices;

    var soundFieldServices = [];

    for (let i = 0; i < this.soundFields.length; i++) {

      this.log("Creating soundfield service %s!", this.soundFields[i].name);

      let soundFieldGetFunctionBody = "this.getSoundFieldState(callback, \'" + this.soundFields[i].value + "\');";
      let getSoundFieldFunction = new Function('callback', soundFieldGetFunctionBody);
      this.soundFields[i].getSoundFieldState = getSoundFieldFunction.bind(this);
      this.soundFields[i].onBody = this.soundField.onBodyBasis.replace("%s", this.soundFields[i].value);
      let soundFieldSetFunctionBody = "this.setSoundFieldState(newSoundFieldState, callback, " + i + ", \'" + this.soundFields[i].onBody + "\');";
      let setSoundFieldFunction = new Function('newSoundFieldState', 'callback', soundFieldSetFunctionBody);
      this.soundFields[i].setSoundFieldState = setSoundFieldFunction.bind(this);

      var soundFieldService = new Service.Switch(this.soundFields[i].name, this.soundFields[i].name);

      this.log.debug("... configuring soundField characteristic");
      soundFieldService
        .getCharacteristic(Characteristic.On)
        .on("get", this.soundFields[i].getSoundFieldState.bind(this))
        .on("set", this.soundFields[i].setSoundFieldState.bind(this));
      this.soundFields[i].service = soundFieldService;
      soundFieldServices.push(soundFieldService);
    }

    receiverServices = receiverServices.concat(soundFieldServices);
    this.soundFieldServices = soundFieldServices;

    this.receiverServices = receiverServices;

    var onServices = [];

    for (let i = 0; i < this.receiverServices.length; i++) {
      if (this.receiverServices[i] != this.informationService) {
        onServices.push(this.receiverServices[i]);
      }
    }

    this.onServices = onServices;

    return receiverServices;
  },

  getMuteState(callback) {
    this.log.debug("Getting state of mute!");
    this.power.service.getCharacteristic(Characteristic.On).getValue(getUnmuteStateFromReceiverIfOnElseReportMuted.bind(this)(callback));

    function getUnmuteStateFromReceiverIfOnElseReportMuted(callback) {
      this.log.debug("Deciding whether to request mute status from receiver based on power status!");
      if (this.power.service.getCharacteristic(Characteristic.On).value) {
        this.log.debug("Getting state of mute from receiver since power is on!");
        this._httpRequest(this.volume.muteUrl, this.volume.muteStatusBody, function(error, response, body) {
          if (error) {
            this.log.error("getMuteState() failed: %s", error.message);
            callback(error);
          } else if (response.statusCode !== 200) {
            this.log.error("getMuteState() request returned http error: %s", response.statusCode);
            callback(new Error("getMuteState() returned http error " + response.statusCode));
          } else {
            body = body.replace("[[", "[");
            body = body.replace("]]", "]");
            let responseBody = JSON.parse(body);
            let currentMuteState = responseBody.result[0].mute == "off";
            this.log.debug("Speaker is currently %s", currentMuteState ? "not muted" : "muted");
            callback(null, currentMuteState);
          }
        }.bind(this));
      } else {
        this.log.debug("Reporting muted since since receiver is off!");
        callback(null, false);
      }
    }
  },

  setMuteState(newUnmuteState, callback) {
    this.log.debug("Setting state of mute!");
    this.power.service.getCharacteristic(Characteristic.On).getValue(setUnmuteStateByPoweringOnReceiverIfReceiverIsOffElseIssueMuteCommand.bind(this)(newUnmuteState, callback));

    function setUnmuteStateByPoweringOnReceiverIfReceiverIsOffElseIssueMuteCommand(newUnmuteState, callback) {
      if (newUnmuteState && !this.power.service.getCharacteristic(Characteristic.On).value) {
        this.log.debug("Unmuting by powering on receiver since receiver is off!");
        this._httpRequest(this.power.url, this.power.onBody, function(error, response, body) {
          if (error) {
            this.log.error("setPowerState() failed: %s", error.message);
            callback(error);
          } else if (response.statusCode !== 200) {
            this.log.error("setPowerState() request returned http error: %s", response.statusCode);
            callback(new Error("setPowerState() returned http error " + response.statusCode));
          } else {
            this.log("Set power state to on");
            callback();
          }
        }.bind(this));
      } else {
        this.log.debug("Issuing mute command since receiver is on!");
        let requestbody = newUnmuteState ? this.volume.muteOffBody : this.volume.muteOnBody;
        this._httpRequest(this.volume.muteUrl, requestbody, function(error, response, body) {
          if (error) {
            this.log.error("setMuteState() failed: %s", error.message);
            callback(error);
          } else if (response.statusCode !== 200) {
            this.log.error("setMuteState() request returned http error: %s", response.statusCode);
            callback(new Error("setMuteState() returned http error " + response.statusCode));
          } else {
            this.log("Set mute to %s", newUnmuteState ? "off" : "on");
            callback(undefined, body);
          }
        }.bind(this));
      }
    }
  },

  getPowerState(callback) {
    this._httpRequest(this.power.url, this.power.statusBody, function(error, response, body) {
      if (error) {
        this.log.error("getPowerState() failed: %s", error.message);
        callback(error);
      } else if (response.statusCode !== 200) {
        this.log.error("getPowerState() request returned http error: %s", response.statusCode);
        callback(new Error("getPowerState() returned http error " + response.statusCode));
      } else {
        body = body.replace("[[", "[");
        body = body.replace("]]", "]");
        let responseBody = JSON.parse(body);
        let responseBodyResult = responseBody.result[0];
        let currentPowerState = responseBodyResult.active == "active";
        this.log.debug("Speaker is currently %s", currentPowerState ? "on" : "off");
        callback(null, currentPowerState);
      }
    }.bind(this));
  },

  setPowerState(newPowerState, callback) {

    let requestbody = newPowerState ? this.power.onBody : this.power.offBody;

    this._httpRequest(this.power.url, requestbody, function(error, response, body) {
      if (error) {
        this.log.error("setPowerState() failed: %s", error.message);
        callback(error);
      } else if (response.statusCode !== 200) {
        this.log.error("setPowerState() request returned http error: %s", response.statusCode);
        callback(new Error("setPowerState() returned http error " + response.statusCode));
      } else {
        this.log("Set power to %s", newPowerState ? "on" : "off");
        callback(undefined, body);
      }
    }.bind(this));
  },

  getInputState(callback, uri) {
    this.log.debug("Getting state of input!");
    this.power.service.getCharacteristic(Characteristic.On).getValue(checkInputStateOnlyWhenReceiverIsOn.bind(this)(callback, uri));

    function checkInputStateOnlyWhenReceiverIsOn(callback, uri) {
      if (this.power.service.getCharacteristic(Characteristic.On).value) {

        this.log.debug("Getting state of input from receiver since power is on!");

        this._httpRequest(this.input.url, this.input.statusBody, function(error, response, body) {
          if (error) {
            this.log.error("getInputState() failed: %s", error.message);
            callback(error);
          } else if (response.statusCode !== 200) {
            this.log.error("getInputState() request returned http error: %s", response.statusCode);
            callback(new Error("getInputState() returned http error " + response.statusCode));
          } else {
            body = body.replace("[[", "[");
            body = body.replace("]]", "]");
            let responseBody = JSON.parse(body);
            let responseBodyResult = responseBody.result[0];
            let currentInputState = responseBodyResult.uri == uri;
            this.log.debug("Input is currently %s", currentInputState ? "on" : "off");
            callback(null, currentInputState);
          }
        }.bind(this));
      } else {
        this.log.debug("Reporting state of input as off since receiver is off!");
        callback(null, false);
      }
    }
  },

  setInputState(newInputState, callback, inputNumber, inputOnBody) {
    this.log.debug("Setting state of input!");
    this.power.service.getCharacteristic(Characteristic.On).getValue(powerOnReceiverBeforeChangingInputIfNecessary.bind(this)(newInputState, callback, inputNumber, inputOnBody));

    function powerOnReceiverBeforeChangingInputIfNecessary(newInputState, callback, inputNumber, inputOnBody) {
      if (newInputState && !this.power.service.getCharacteristic(Characteristic.On).value) {
        this.log.debug("Powering on receiver before setting input!");

        this._httpRequest(this.power.url, this.power.onBody, function(error, response, body) {
          if (error) {
            this.log.error("setPowerState() failed: %s", error.message);
            callback(error);
          } else if (response.statusCode !== 200) {
            this.log.error("setPowerState() request returned http error: %s", response.statusCode);
            callback(new Error("setPowerState() returned http error " + response.statusCode));
          } else {
            this.log("Set power to on");
            this.log.debug("Waiting for device to turn on...");
            this._sleep(this.receiverPowerOnDelay);
            setInputStateonReceiver.bind(this)(newInputState, callback, inputNumber, inputOnBody, true);
          }
        }.bind(this));
      } else {
        setInputStateonReceiver.bind(this)(newInputState, callback, inputNumber, inputOnBody, false);
      }

      function setInputStateonReceiver(newInputState, callback, inputNumber, inputOnBody, turnedOnPower) {
        this.log.debug("Setting state of input on receiver!");

        let requestbody = newInputState ? inputOnBody : this.power.offBody;

        this._httpRequest(this.input.url, requestbody, function(error, response, body) {
          if (error) {
            this.log.error("setInputState() failed: %s", error.message);
            callback(error);
          } else if (response.statusCode !== 200) {
            this.log.error("setInputState() request returned http error: %s", response.statusCode);
            callback(new Error("setInputState() returned http error " + response.statusCode));
          } else {
            newInputState ? this.log("Set input %s to on", this.inputs[inputNumber].name) : this.log.debug("Set input %s to off", this.inputs[inputNumber].name);
            callback(undefined, body);
          }
        }.bind(this));
      }
    }
  },

  getSoundFieldState(callback, value) {
    this.log.debug("Getting state of soundField!");
    this.power.service.getCharacteristic(Characteristic.On).getValue(checkSoundFieldStateOnlyWhenReceiverIsOn.bind(this)(callback, value));

    function checkSoundFieldStateOnlyWhenReceiverIsOn(callback, value) {
      if (this.power.service.getCharacteristic(Characteristic.On).value) {

        this.log.debug("Getting state of soundField from receiver since power is on!");

        this._httpRequest(this.soundField.url, this.soundField.statusBody, function(error, response, body) {
          if (error) {
            this.log.error("getSoundFieldState() failed: %s", error.message);
            callback(error);
          } else if (response.statusCode !== 200) {
            this.log.error("getSoundFieldState() request returned http error: %s", response.statusCode);
            callback(new Error("getSoundFieldState() returned http error " + response.statusCode));
          } else {
            body = body.replace("[[", "[");
            body = body.replace("]]", "]");
            let responseBody = JSON.parse(body);
            let responseBodyResult = responseBody.result[0];
            let currentSoundFieldState = responseBody.result[0].currentValue == value;
            this.log.debug("SoundField is currently %s", currentSoundFieldState ? "on" : "off");
            callback(null, currentSoundFieldState);
          }
        }.bind(this));
      } else {
        this.log.debug("Reporting state of soundField as off since receiver is off!");
        callback(null, false);
      }
    }
  },

  setSoundFieldState(newSoundFieldState, callback, soundFieldNumber, soundFieldOnBody) {
    this.log.debug("Setting state of soundField!");
    this.power.service.getCharacteristic(Characteristic.On).getValue(powerOnReceiverBeforeChangingSoundFieldIfNecessary.bind(this)(newSoundFieldState, callback, soundFieldNumber, soundFieldOnBody));

    function powerOnReceiverBeforeChangingSoundFieldIfNecessary(newSoundFieldState, callback, soundFieldNumber, soundFieldOnBody) {
      if (newSoundFieldState && !this.power.service.getCharacteristic(Characteristic.On).value) {
        this.log.debug("Powering on receiver before setting soundField!");

        this._httpRequest(this.power.url, this.power.onBody, function(error, response, body) {
          if (error) {
            this.log.error("setPowerState() failed: %s", error.message);
            callback(error);
          } else if (response.statusCode !== 200) {
            this.log.error("setPowerState() request returned http error: %s", response.statusCode);
            callback(new Error("setPowerState() returned http error " + response.statusCode));
          } else {
            this.log("Set power to on");
            this.log.debug("Waiting for device to turn on...");
            this._sleep(this.receiverPowerOnDelay);
            setSoundFieldStateonReceiver.bind(this)(newSoundFieldState, callback, soundFieldNumber, soundFieldOnBody, true);
          }
        }.bind(this));
      } else {
        setSoundFieldStateonReceiver.bind(this)(newSoundFieldState, callback, soundFieldNumber, soundFieldOnBody, false);
      }

      function setSoundFieldStateonReceiver(newSoundFieldState, callback, soundFieldNumber, soundFieldOnBody, turnedOnPower) {
        this.log.debug("Setting state of soundField on receiver!");

        let requestUrl = newSoundFieldState ? this.soundField.url : this.power.url;
        let requestbody = newSoundFieldState ? soundFieldOnBody : this.power.offBody;

        this._httpRequest(requestUrl, requestbody, function(error, response, body) {
          if (error) {
            this.log.error("setSoundFieldState() failed: %s", error.message);
            callback(error);
          } else if (response.statusCode !== 200) {
            this.log.error("setSoundFieldState() request returned http error: %s", response.statusCode);
            callback(new Error("setSoundFieldState() returned http error " + response.statusCode));
          } else {
            newSoundFieldState ? this.log("Set soundfield %s to on", this.soundFields[soundFieldNumber].name) : this.log.debug("Set soundfield %s to off", this.soundFields[soundFieldNumber].name);
            callback(undefined, body);
            this._refreshOnServices.bind(this)(this.soundFieldServices[soundFieldNumber], newSoundFieldState, turnedOnPower);
          }
        }.bind(this));
      }
    }
  },

  getVolume(callback) {
    this.log.debug("Getting state of volume!");

    this._httpRequest(this.volume.volumeUrl, this.volume.volumeStatusBody, function(error, response, body) {
      if (error) {
        this.log.error("getVolume() failed: %s", error.message);
        callback(error);
      } else if (response.statusCode !== 200) {
        this.log.error("getVolume() request returned http error: %s", response.statusCode);
        callback(new Error("getVolume() returned http error " + response.statusCode));
      } else {
        body = body.replace("[[", "[");
        body = body.replace("]]", "]");
        let responseBody = JSON.parse(body);
        let currentVolumeState = responseBody.result[0].volume;
        this.log.debug("Speaker's volume is at %s %", currentVolumeState);
        callback(null, currentVolumeState);
      }
    }.bind(this));
  },

  setVolume(newVolumeState, callback) {

    let requestbody = this.volume.volumeSetBody.replace("%s", newVolumeState);

    this._httpRequest(this.volume.volumeUrl, requestbody, function(error, response, body) {
      if (error) {
        this.log.error("setVolume() failed: %s", error.message);
        callback(error);
      } else if (response.statusCode !== 200) {
        this.log.error("setVolume() request returned http error: %s", response.statusCode);
        callback(new Error("setVolume() returned http error " + response.statusCode));
      } else {
        this.log("Set volume to %s", newVolumeState);
        callback(undefined, body);
      }
    }.bind(this));
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

  _sleep(milliseconds) {
    let currentTime = new Date().getTime();
    while (currentTime + milliseconds >= new Date().getTime()) {}
  },

  _refreshOnServices(triggerService, triggerServiceState, turnedOnPower) {
    if (triggerServiceState == false) {
      for (let i = 0; i < this.onServices.length; i++) {
        if (this.onServices[i] != triggerService) {
          this.log.debug("Also turning off %s when turning off %s", this.onServices[i].getCharacteristic(Characteristic.Name).value, triggerService.getCharacteristic(Characteristic.Name).value);
          this.onServices[i].getCharacteristic(Characteristic.On).updateValue(false);
        }
      }
    } else if (turnedOnPower == true) {
      for (let i = 0; i < this.onServices.length; i++) {
        if (this.onServices[i] != triggerService) {
          this.log.debug("Getting state of %s when turning on device with %s", this.onServices[i].getCharacteristic(Characteristic.Name).value, triggerService.getCharacteristic(Characteristic.Name).value);
          this.onServices[i].getCharacteristic(Characteristic.On).getValue();
        }
      }
    } else if (this.inputServices.includes(triggerService)) {
      for (let i = 0; i < this.inputServices.length; i++) {
        if (this.inputServices[i] != triggerService) {
          this.log.debug("Also turning off %s when switching to %s", this.inputServices[i].getCharacteristic(Characteristic.Name).value, triggerService.getCharacteristic(Characteristic.Name).value);
          this.inputServices[i].getCharacteristic(Characteristic.On).updateValue(false);
        }
      }
      for (let i = 0; i < this.soundFieldServices.length; i++) {
        this.log.debug("Getting state of soundfield %s when switching to %s", this.soundFieldServices[i].getCharacteristic(Characteristic.Name).value, triggerService.getCharacteristic(Characteristic.Name).value);
        this.soundFieldServices[i].getCharacteristic(Characteristic.On).getValue();
      }
    } else if (this.soundFieldServices.includes(triggerService)) {
      for (let i = 0; i < this.soundFieldServices.length; i++) {
        if (this.soundFieldServices[i] != triggerService) {
          this.log.debug("Also turning off soundfield %s when switching to %s", this.soundFieldServices[i].getCharacteristic(Characteristic.Name).value, triggerService.getCharacteristic(Characteristic.Name).value);
          this.soundFieldServices[i].getCharacteristic(Characteristic.On).updateValue(false);
        }
      }
    }
  },

  setNetWorkStandby() {
    this._httpRequest(this.networkStandby.url, this.networkStandby.enableNetworkStandby ? this.networkStandby.onBody : this.networkStandby.offBody, function(error, response, body) {
      if (error) {
        this.log.error("setPowerSettings() failed: %s", error.message);
      } else if (response.statusCode !== 200) {
        this.log.error("setPowerSettings() request returned http error: %s", response.statusCode);
      } else {
        this.log("Network standby is currently %s", this.networkStandby.enableNetworkStandby ? "on" : "off");
      }
    }.bind(this));
  },

  getNotifications(notificationWsUrl) {
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
        client.connect(notificationWsUrl);
      }, 1000);
    }.bind(this));

    client.on('connect', function(connection) {
      function subscribe() {
        if (connection.connected) {
          connection.sendUTF(JSON.stringify(switchNotifications(1, [], [])));
        }
      }

      function pollServer() {
        if (connection.isAlive === false) {
          this.log.error("Dropping connection on endpoing %s since server have not responded to ping", notificationWsUrl);
          connection.drop(1002, "Server have not responded to ping");
        } else {
          connection.isAlive = false;
          connection.ping(Buffer.from([]));
          this.log.debug("Pinging server on endpoint %s", notificationWsUrl);
          setTimeout(pollServer.bind(this), 10000);
        }
      }

      this.log.debug('WebSocket Client Connected');

      connection.isAlive = true;
      setTimeout(pollServer.bind(this), 10000);

      subscribe();

      connection.on('pong', function() {
        this.log.debug("Received pong from server on endpoint %s", notificationWsUrl);
        connection.isAlive = true;
      }.bind(this));

      connection.on('error', function(error) {
        this.log("Connection Error: " + error.toString());
        setTimeout(function() {
          client.connect(notificationWsUrl);
        }, 1000);
      }.bind(this));

      connection.on('close', function() {
        this.log('WebSocket Connection Closed');
        setTimeout(function() {
          client.connect(notificationWsUrl);
        }, 1000);
      }.bind(this));

      connection.on('message', function(message) {
        if (message.type === 'utf8') {
          this.log.debug("Got notification from receiver using WebSocket");
          let msg = JSON.parse(message.utf8Data);
          if (msg.id == 1) {
            let all_notifications = msg.result[0].disabled.concat(msg.result[0].enabled);
            let enable = [];
            let disable = [];
            all_notifications.forEach(
              item => item.name == "notifyExternalTerminalStatus" || item.name == "notifyPlayingContentInfo" || item.name == "notifyVolumeInformation" ? enable.push(item) : disable.push(item));
            connection.sendUTF(JSON.stringify(switchNotifications(127, disable, enable)));
          } else {
            this.log.debug("Received: '" + message.utf8Data + "'");
            if (msg.hasOwnProperty("method")) {
              if (msg.method == "notifyExternalTerminalStatus") {
                for (let i = 0; i < msg.params.length; i++) {
                  if (msg.params[i].uri == this.outputZone) {
                    let newPowerState;
                    newPowerState = msg.params[i].active == "active" ? true : false;
                    this.power.service.getCharacteristic(Characteristic.On).updateValue(newPowerState);
                    this.log("Updated power to " + newPowerState);
                    if (newPowerState) {
                      this.log.debug("Waiting for device to turn on...");
                      this._sleep(this.receiverPowerOnDelay);
                    }
                    this._refreshOnServices.bind(this)(this.power.service, newPowerState, newPowerState);
                  }
                }
              } else if (msg.method == "notifyPlayingContentInfo") {
                for (let i = 0; i < msg.params.length; i++) {
                  if (msg.params[i].output == this.outputZone) {
                    for (let j = 0; j < this.inputs.length; j++) {
                      if (msg.params[i].uri == this.inputs[j].uri) {
                        this.inputServices[j].getCharacteristic(Characteristic.On).updateValue(true);
                        this.log("Updated input " + this.inputs[j].name + " to on");
                        this._refreshOnServices.bind(this)(this.inputServices[j], true, false);
                      }
                    }
                  }
                }
              } else if (msg.method == "notifyVolumeInformation") {
                for (let i = 0; i < msg.params.length; i++) {
                  if (msg.params[i].output == this.outputZone) {
                    let unmuteStatus;
                    unmuteStatus = msg.params[i].mute == "off" ? true : false;
                    let volumeLevel = msg.params[i].volume;
                    this.volume.service.getCharacteristic(Characteristic.Brightness).updateValue(volumeLevel);
                    this.volume.service.getCharacteristic(Characteristic.On).updateValue(unmuteStatus);
                    this.log("Updated volume to %s and mute status to %s", volumeLevel, !unmuteStatus);
                  }
                }
              }
            }
          }
        }
      }.bind(this));

    }.bind(this));

    client.connect(notificationWsUrl);
  }
};