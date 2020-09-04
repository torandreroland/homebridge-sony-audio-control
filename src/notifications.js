const WebSocketClient = require('websocket').client;


class Notifications {
  constructor(notificationParams, lib) {
    this.url = `ws://${notificationParams.ip}:10000/sony/${lib}`;
    this.lib = lib;
    this.log = notificationParams.log;
    this.pollingInterval = notificationParams.pollingInterval;
    this.outputZone = notificationParams.outputZone;
    this.services = notificationParams.services;
    this.hapServices = notificationParams.hapServices;
    this.Service = notificationParams.Service;
    this.Characteristic = notificationParams.Characteristic;

    const notificationHandlers = {
      "notifyExternalTerminalStatus": this.notifyExternalTerminalStatus.bind(this),
      "notifyPlayingContentInfo": this.notifyPlayingContentInfo.bind(this),
      "notifyVolumeInformation": this.notifyVolumeInformation.bind(this)
    };

    this.client = new WebSocketClient({keepalive: true, keepaliveInterval: this.pollingInterval}); 

    this.client.on('connectFailed', error => {
      this.log('Connect Error: ' + error.toString());
      setTimeout(() => this.client.connect(this.url), this.pollingInterval);
    });

    this.client.on('connect', connection => {

      this.log('WebSocket client connected on endpoint %s', this.url);

      this.connection = connection;

      this.switchNotifications(1, [], []);

      connection.on('pong', () => {
        this.log.debug("Received pong from server on endpoint %s", this.lib);
      });

      connection.on('error', error => {
        this.log.error("Connection error on endpoint %s : %s", this.lib, error.toString());
        setTimeout(() => this.client.connect(this.url), this.pollingInterval);
      });

      connection.on('close', () => {
        this.log('WebSocket connection closed on endpoint %s', this.lib);
        setTimeout(() => this.client.connect(this.url), this.pollingInterval);
      });

      connection.on('message', message => {
        if (message.type !== 'utf8') return;

        this.log.debug("Got notification from receiver using WebSocket");
        let msg = JSON.parse(message.utf8Data);
        if (msg.id == 1) {
          let allNotifications = msg.result[0].disabled.concat(msg.result[0].enabled);
          let enable = [];
          let disable = [];

          for (const notification of allNotifications) {
            if (notificationHandlers.hasOwnProperty(notification.name)) {
              enable.push(notification);
            } else {
              disable.push(notification);
            }
          }

          this.switchNotifications(127, disable, enable);
        } else {
          this.log.debug("Received: '" + message.utf8Data + "'");
          if (msg.method == null || !notificationHandlers.hasOwnProperty(msg.method)) return;

          const handler = notificationHandlers[msg.method];
          handler(msg);
        }
      });

    });

    this.client.connect(this.url);
  }

  switchNotifications(id, disable, enable) {
    if (this.connection.connected) {
      this.connection.sendUTF(JSON.stringify({
        "method": "switchNotifications",
        "id": id,
        "params": [{
          "disabled": disable,
          "enabled": enable
        }],
        "version": "1.0"
      }));
    }
  }

  getServiceName(service) {
    return service.getCharacteristic(this.Characteristic.Name).value;
  }

  notifyExternalTerminalStatus(msg) {
    const extTerminal = msg.params.find(param => param.uri === this.outputZone); 
    if (extTerminal == null) {
      this.log.debug("No notifyExternalTerminalStatus parameter matches the configured output zone!");
      return;
    }

    const newPowerState = extTerminal.active === "active";
    this.hapServices.powerService.getCharacteristic(this.Characteristic.On).updateValue(newPowerState);
    this.log("Updated power to " + newPowerState);

    const affectedServices = this.hapServices.inputServices.concat(this.hapServices.soundFieldServices, this.hapServices.volumeService);
    if (newPowerState) {
      this.log.debug("Waiting for device to turn on...");
      
      setTimeout(() => {
        for (const service of affectedServices) {
          this.log.debug("Getting state of %s when turning on the device", this.getServiceName(service));
          service.getCharacteristic(this.Characteristic.On).getValue();
        }
      }, 1000);
    } else {
      for (const service of affectedServices) {
        this.log.debug("Also turning off %s when turning off the device", this.getServiceName(service));
        service.getCharacteristic(this.Characteristic.On).updateValue(false);
      }
    }
  }

  notifyPlayingContentInfo(msg) {
    const param = msg.params.find(param => param.output === this.outputZone);
    if (param == null) {
      this.log.debug("No notifyPlayingContentInfo parameter matches the configured output zone!");
      return;
    }
    
    const inputService = this.services.inputServices.find(service => service.uri === param.uri);
    
    inputService.hapService.getCharacteristic(this.Characteristic.On).updateValue(true);
    this.log("Updated input %s to on", inputService.name);

    for (const service of this.hapServices.inputServices) {
      if (service === inputService.hapService) continue;
      this.log.debug("Also turning off %s when switching to %s", this.getServiceName(inputService), inputService.name);
      service.getCharacteristic(this.Characteristic.On).updateValue(false);
    }
    for (const service of this.hapServices.soundFieldServices) {
      this.log.debug("Getting state of soundfield %s when switching to %s", this.getServiceName(service), inputService.name);
      service.getCharacteristic(this.Characteristic.On).getValue();
    }
  }

  notifyVolumeInformation(msg) {
    const param = msg.params.find(param => param.output === this.outputZone);
    if (param == null) {
      this.log.debug("No notifyVolumeInformation parameter matches the configured output zone!");
      return;
    }
    
    const unmuteStatus = param.mute === "off";
    const volumeLevel = param.volume;
    this.hapServices.volumeService.getCharacteristic(this.Characteristic.On).updateValue(unmuteStatus);
    this.hapServices.volumeService.getCharacteristic(this.Characteristic.Brightness).updateValue(volumeLevel);
    this.log("Updated volume to %s and mute status to %s", volumeLevel, !unmuteStatus);
  }
}

module.exports = Notifications;
