class VolumeService {
  constructor(serviceParams) {
    this.api = serviceParams.api;
    this.log = serviceParams.log;
    this.lastChanges = serviceParams.lastChanges;

    this.hapService = new serviceParams.Service.Lightbulb(`${serviceParams.accessoryName} Volume`);

    this.hapService
      .getCharacteristic(serviceParams.Characteristic.On)
      .on("get", this.getMuteState.bind(this))
      .on("set", this.setMuteState.bind(this));
    
    this.hapService
      .addCharacteristic(new serviceParams.Characteristic.Brightness())
      .on("get", this.getVolume.bind(this))
      .on("set", this.setVolume.bind(this));
  }

  async getVolumeInformation() {
    const response = await this.api.request("audio", "getVolumeInformation", [{ "output": this.outputZone }], "1.1");
    return response[0];
  }


  async getMuteState(callback) {
    this.log.debug("Getting state of mute!");

    try {
      this.log.debug("Deciding whether to request mute status from receiver based on power status!");

      if (await this.api.getPowerState()) {
        const unmuteState = (await this.getVolumeInformation()).mute !== "on";

        this.log.debug("Speaker is currently %s", unmuteState ? "not muted" : "muted");

        callback(null, unmuteState);
      } else {
        this.log.debug("Reporting muted since since receiver is off!");
        callback(null, false);
      }

    } catch (error) {
      this.log.error("getMuteState() failed: %s", error.message);
      callback(error);
    }
  }

  async setMuteState(newUnmuteState, callback) {
    this.log.debug("Setting state of mute!");

    let powerState;

    try {
      powerState = await this.api.getPowerState();
    } catch (error) {
      this.log.error("getPowerState() failed: %s", error.message);
      callback(error);
      return;
    }

    if (newUnmuteState && !powerState) {
      this.log.debug("Unmuting by powering on receiver since receiver is off!");
      try {
        this.log("Set power state to on");
        await this.api.setPowerState(true);
        callback(null);
      } catch (error) {
        this.log.error("setPowerState() failed: %s", error.message);
        callback(error);
      }
    } else {
      try {
        await this.api.request("audio", "setAudioMute", [{
          "mute": newUnmuteState ? "off" : "on",
          "output": this.outputZone
        }], "1.1");

        this.log("Set mute to %s", newUnmuteState ? "off" : "on");
        callback(null);
      } catch (error) {
        this.log.error("setMuteState() failed: %s", error.message);
        callback(error);
      }
    }
  }

  async getVolume(callback) {
    this.log.debug("Getting state of volume!");

    try {
      const info = await this.getVolumeInformation();

      this.log.debug("Speaker's volume is at %s %", info.volume);
      callback(null, info.volume);
    } catch (error) {
      this.log.error("getVolume() failed: %s", error.message);
      callback(error);
    }
  }

  async setVolume(newVolumeState, callback) {
    try {
      this.lastChanges.volume = Date.now();
      await this.api.request("audio", "setAudioVolume", [{
        "volume": newVolumeState.toString(),
        "output": this.outputZone
      }], "1.1");

      this.log("Set volume to %s", newVolumeState);
      callback(null);
    } catch (error) {
      this.log.error("setVolume() failed: %s", error.message);
      callback(error);
    }
  }
}

module.exports = VolumeService;
