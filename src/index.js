"use strict";

import API from './api.js';
import PowerService from './power-service.js';
import VolumeLightbulbService from './volume-lightbulb-service.js';
import VolumeFanService from './volume-fan-service.js';
import InputService from './input-service.js';
import SoundFieldService from './sound-field-service.js';
import Notifications from './notifications.js'; 

var Service, Characteristic;

export default function (homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  homebridge.registerAccessory("homebridge-sony-audio-control", "receiver", SonyAudioControlReceiver);
};


class SonyAudioControlReceiver {

  constructor(log, config) {
    var outputZone = (config.outputZone === undefined) ? "" : config.outputZone;

    this.log = log;
    this.name = config.name;
    this.outputZone = outputZone;
    this.inputs = config.inputs || [];
    this.soundFields = config.soundFields || [{
        "name": "Surround Mode",
        "value": "dolbySurround"
      },
      {
        "name": "Stereo Mode",
        "value": "2chStereo"
      }
    ];
    this.ip = config.ip;
    this.port = config.port || 10000;
    this.api = new API(this.ip, this.port, log, outputZone);
    this.accessoryInformation = config.accessoryInformation || {};
    this.manufacturer = this.accessoryInformation.manufacturer || "Sony";
    this.model = this.accessoryInformation.model || "STR-DN1080";
    this.serialNumber = this.accessoryInformation.serialNumber || "Serial number 1";
    this.enableVolumeLightbulbService = config.enableVolumeLightbulbService === false ? false : true;
    this.enableVolumeFanService = config.enableVolumeFanService === true ? true : false;
    this.maxVolume = config.maxVolume || 100;
    this.enableNetworkStandby = config.enableNetworkStandby === false ? false : true;

    this.pollingInterval = 10000;

    this.lastChanges = {
      volume: new Date(0)
    };

    this.services = {
      volumeLightbulbService: null,
      volumeFanService: null,
      volumeServices: [],
      powerService: null,
      inputServices: [],
      soundFieldServices: []
    };
    this.hapServices = {
      informationService: null,
      volumeLightbulbService: null,
      volumeFanService: null,
      volumeServices: [],
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
      .setCharacteristic(Characteristic.Manufacturer, this.manufacturer)
      .setCharacteristic(Characteristic.Model, this.model)
      .setCharacteristic(Characteristic.SerialNumber, this.serialNumber);

    this.log.debug("Added information service with manufacturer '%s', model '%s' and serial number '%s'", informationService.getCharacteristic(Characteristic.Manufacturer).value, informationService.getCharacteristic(Characteristic.Model).value, informationService.getCharacteristic(Characteristic.SerialNumber).value)
    this.services.informationService = informationService;

    const serviceParams = {
      api: this.api,
      log: this.log,
      outputZone: this.outputZone,
      accessoryName: this.name,
      lastChanges: this.lastChanges,
      Service: Service,
      Characteristic: Characteristic,
      soundFieldServices: this.hapServices.soundFieldServices
    };

    if (this.enableVolumeLightbulbService) {
      this.log("Creating volume lightbulb service!");
      const volumeLightbulbService = new VolumeLightbulbService(serviceParams, this.maxVolume);
      this.services.volumeLightbulbService = volumeLightbulbService;
      this.hapServices.volumeLightbulbService = volumeLightbulbService.hapService;
      this.services.volumeServices.push(volumeLightbulbService);
      this.hapServices.volumeServices.push(volumeLightbulbService.hapService);
    }

    if (this.enableVolumeFanService) {
      this.log("Creating volume fan service!");
      const volumeFanService = new VolumeFanService(serviceParams, this.maxVolume);
      this.services.volumeFanService = volumeFanService;
      this.hapServices.volumeFanService = volumeFanService.hapService;
      this.services.volumeServices.push(volumeFanService);
      this.hapServices.volumeServices.push(volumeFanService.hapService);
    }

    this.log("Creating power service!");
    const powerService = new PowerService(serviceParams);
    this.services.powerService = powerService;
    this.hapServices.powerService = powerService.hapService;

    for (const {
        name,
        uri
      } of this.inputs) {
      this.log("Creating input service %s!", name);
      const inputService = new InputService(serviceParams, name, uri);
      this.services.inputServices.push(inputService);
      this.hapServices.inputServices.push(inputService.hapService);
    }

    for (const {
        name,
        value
      } of this.soundFields) {
      this.log("Creating soundfield service %s!", name);
      const soundFieldService = new SoundFieldService(serviceParams, name, value);
      this.services.soundFieldServices.push(soundFieldService);
      this.hapServices.soundFieldServices.push(soundFieldService.hapService);
    }

    this.log("Starting notification websockets");

    const notificationParams = {
      ip: this.ip,
      port: this.port,
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

    return [this.services.informationService, this.hapServices.powerService]
      .concat(this.hapServices.volumeServices, this.hapServices.inputServices, this.hapServices.soundFieldServices);
  }

  async getModelName() {
    try {
      const interfaceResponse = await this.api.request("system", "getInterfaceInformation", [], "1.0");

      this.log.debug("Model name is %s", interfaceResponse.modelName);
      return interfaceResponse.modelName
    } catch (error) {
      this.log.error("getInterfaceInformation() failed: %s", error.message);
    }
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
