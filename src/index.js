"use strict";

const API = require("./api");
const PowerService = require('./power-service');
const VolumeService = require('./volume-service');
const InputService = require('./input-service');
const SoundFieldService = require('./sound-field-service');
const Notifications = require("./notifications");

var Service, Characteristic;

module.exports = function (homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  homebridge.registerAccessory("homebridge-sony-audio-control", "receiver", SonyAudioControlReceiver);
};


class SonyAudioControlReceiver {

  constructor(log, config) {
    var outputZone = (config.outputZone === undefined) ? "" : config.outputZone;

    this.log = log;
    this.api = new API(config.ip, log, outputZone);
    this.name = config.name;
    this.outputZone = outputZone;
    this.inputs = config.inputs || [];
    this.soundFields = config.soundFields || [
      {
        "name": "Surround Mode",
        "value": "dolbySurround"
      },
      {
        "name": "Stereo Mode",
        "value": "2chStereo"
      }
    ];
    this.ip = config.ip;
    this.enableNetworkStandby = config.enableNetworkStandby === false ? false : true;

    this.pollingInterval = 10000;

    this.lastChanges = { volume: new Date(0) };

    this.services = {
      volumeService: null,
      powerService: null,
      inputServices: [],
      soundFieldServices: []
    };
    this.hapServices = {
      informationService: null,
      volumeService: null,
      powerService: null,
      inputServices: [],
      soundFieldServices: []
    };

    this.notifications = [];

    this.setNetworkStandby();
  }


  identify(callback) {
    this.log("Identify requested!");
    callback();
  }

  getServices() {
    this.log("Creating receiver services!");

    this.log("Creating information service!");
    const informationService = new Service.AccessoryInformation();

    informationService
      .setCharacteristic(Characteristic.Manufacturer, "Sony")
      .setCharacteristic(Characteristic.Model, "STR-DN1080")
      .setCharacteristic(Characteristic.SerialNumber, "Serial number 1");

    this.services.informationService = informationService;

    const serviceParams = {
      api: this.api,
      log: this.log,
      outputZone: this.outputZone,
      accessoryName: this.name,
      lastChanges: this.lastChanges,
      Service: Service,
      Characteristic: Characteristic
    };

    this.log("Creating volume service!");
    const volumeService = new VolumeService(serviceParams);
    this.services.volumeService = volumeService;
    this.hapServices.volumeService = volumeService.hapService;

    this.log("Creating power service!");
    const powerService = new PowerService(serviceParams);
    this.services.powerService = powerService;
    this.hapServices.powerService = powerService.hapService;

    this.services.inputServices = [];
    for (const { name, uri } of this.inputs) {
      this.log("Creating input service %s!", name);
      const inputService = new InputService(serviceParams, name, uri);
      this.services.inputServices.push(inputService);
      this.hapServices.inputServices.push(inputService.hapService);
    }

    this.services.soundFieldServices = [];
    for (const { name, value } of this.soundFields) {
      this.log("Creating soundfield service %s!", name);
      const soundFieldService = new SoundFieldService(serviceParams, name, value);
      this.services.soundFieldServices.push(soundFieldService);
      this.hapServices.soundFieldServices.push(soundFieldService.hapService);
    }

    this.log("Starting notification websockets");
    
    const notificationParams = {
      ip: this.ip,
      log: this.log,
      pollingInterval: this.pollingInterval,
      outputZone: this.outputZone,
      services: this.services,
      hapServices: this.hapServices,
      lastChanges: this.lastChanges,
      Service: Service,
      Characteristic: Characteristic
    };

    this.notifications = [];
    for (const lib of ["audio", "avContent"]) {
      this.notifications.push(new Notifications(notificationParams, lib));
    }

    return [this.hapServices.volumeService, this.hapServices.powerService]
      .concat(this.hapServices.inputServices, this.hapServices.soundFieldServices);
  }

  async setNetworkStandby() {
    try {
      await this.api.request("system", "setPowerSettings", [{
        "settings": [{
          "target": "quickStartMode",
          "value": this.enableNetworkStandby ? "on" : "off"
        }]
      }], "1.0");

      this.log("Network standby is currently %s", this.enableNetworkStandby ? "on" : "off");
    } catch (error) {
      this.log.error("setNetworkStandby() failed: %s", error.message);
    }
  }

}
