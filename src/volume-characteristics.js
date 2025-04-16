class VolumeCharacteristics {
  async getMuteState(callback) {
    this.log.debug("Getting state of mute!");

    const volumeInformation = new VolumeInformation();

    try {
      this.log.debug("Deciding whether to request mute status from receiver based on power status!");

      if (await this.api.getPowerState()) {
        const unmuteState = (await volumeInformation.getVolumeInformation.bind(this)()).mute !== "on";

        this.log.debug("Speaker is currently %s", unmuteState ? "not muted" : "muted");

        callback ? callback(null, unmuteState) : unmuteState;
      } else {
        this.log.debug("Reporting muted since since receiver is off!");
        callback ? callback(null, false) : false;
      }
    } catch (error) {
      this.log.error("getMuteState() failed: %s", error.message);
      callback ? callback(error) : error;
    }
  }

  async setMuteState(newUnmuteState, callback) {
    this.log.debug("Setting state of mute!");

    let powerState;

    try {
      powerState = await this.api.getPowerState();
    } catch (error) {
      this.log.error("getPowerState() failed: %s", error.message);
      callback ? callback(error) : error;
      return;
    }

    if (newUnmuteState && !powerState) {
      this.log.debug("Unmuting by powering on receiver since receiver is off!");
      try {
        this.log("Set power state to on");
        await this.api.setPowerState(true);
        callback ? callback(null) : null;
      } catch (error) {
        this.log.error("setPowerState() failed: %s", error.message);
        callback ? callback(error) : error;
      }
    } else {
      try {
        await this.api.request("audio", "setAudioMute", [{
          "mute": newUnmuteState ? "off" : "on",
          "output": this.outputZone
        }], "1.1");

        this.log("Set mute to %s", newUnmuteState ? "off" : "on");
        callback ? callback(null) : null;
      } catch (error) {
        this.log.error("setMuteState() failed: %s", error.message);
        callback ? callback(error) : error;
      }
    }
  }

  async getVolume(callback) {
    this.log.debug("Getting state of volume!");

    const volumeInformation = new VolumeInformation();

    try {
      const info = await volumeInformation.getVolumeInformation.bind(this)();
      const volume = Math.round(info.volume / this.maxVolume * 100);

      this.log.debug("Speaker's volume is at %s %", volume);
      callback ? callback(null, volume) : volume;
    } catch (error) {
      this.log.error("getVolume() failed: %s", error.message);
      callback ? callback(error) : error;
    }
  }

  async setVolume(newVolumeState, callback) {
    try {
      this.lastChanges.volume = Date.now();

      const volume = Math.round(newVolumeState / 100 * this.maxVolume);
      await this.api.request("audio", "setAudioVolume", [{
        "volume": volume.toString(),
        "output": this.outputZone
      }], "1.1");

      this.log("Set volume to %s", volume);
      callback ? callback(null) : null;
    } catch (error) {
      this.log.error("setVolume() failed: %s", error.message);
      callback ? callback(error) : error;
    }
  }
}

class VolumeInformation {
  async getVolumeInformation() {
    const response = await this.api.request("audio", "getVolumeInformation", [{ "output": this.outputZone }], "1.1");
    return response[0];
  }
}

export default VolumeCharacteristics;