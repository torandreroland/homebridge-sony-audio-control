class SoundFieldService {
  constructor(serviceParams, soundFieldName, soundFieldValue) {
    this.api = serviceParams.api;
    this.log = serviceParams.log;
    this.outputZone = serviceParams.outputZone;
    this.soundFieldServices = serviceParams.soundFieldServices;
    this.Characteristic = serviceParams.Characteristic;

    this.name = soundFieldName;
    this.value = soundFieldValue;

    this.hapService = new serviceParams.Service.Switch(soundFieldName, soundFieldName);

    this.hapService
      .getCharacteristic(serviceParams.Characteristic.On)
      .onGet(this.getSoundFieldState.bind(this))
      .onSet(this.setSoundFieldState.bind(this));
  }

  async getSoundFieldState() {
    this.log.debug("Getting state of soundField!");

    let powerState;

    try {
      powerState = await this.api.getPowerState();
    } catch (error) {
      this.log.error("getPowerState() failed: %s", error.message);
      throw error;
    }

    try {
      if (powerState) {
        this.log.debug("Getting state of soundField from receiver since power is on!");

        const response = await this.api.request("audio", "getSoundSettings", [{ "target": "soundField" }], "1.1");
        const soundFieldState = response[0].currentValue === this.value;

        this.log.debug("SoundField %s is currently %s", this.name, soundFieldState ? "on" : "off");
        return soundFieldState;
      } else {
        this.log.debug("Reporting state of soundField as off since receiver is off!");
        return false;
      }
    } catch (error) {
      this.log.error("getSoundFieldState() failed: %s", error.message);
      throw error;
    }
  }

  async setSoundFieldState(newSoundFieldState) {
    this.log.debug("Setting state of soundField!");

    let powerState;

    try {
      powerState = await this.api.getPowerState();
    } catch (error) {
      this.log.error("getPowerState() failed: %s", error.message);
      throw error;
    }

    if (newSoundFieldState && !powerState) {
      this.log.debug("Powering on receiver before setting soundField!");

      try {
        await this.api.setPowerState(true);
      } catch (error) {
        this.log.error("setPowerState() failed: %s", error.message);
        throw error;
      }

      this.log("Set power to on");
      this.log.debug("Waiting for device to turn on...");
      await this.api.sleep();
    }

    try {
      if (newSoundFieldState) {
        await this.api.request("audio", "setSoundSettings", [{
          "settings": [{
            "target": "soundField",
            "value": this.value
          }]
        }], "1.1");

        this.log("Set soundField %s to on", this.name);

        for (const soundFieldService of this.soundFieldServices) {
          if (soundFieldService === this.hapService) continue;
          this.log.debug("Also turning off %s when switching soundfield", soundFieldService.getCharacteristic(this.Characteristic.Name).value);
          soundFieldService.getCharacteristic(this.Characteristic.On).updateValue(false);
        }
      } else {
        await this.api.setPowerState(false);

        this.log.debug("Set soundField %s to off", this.name);
      }
    } catch (error) {
      this.log.error("setSoundFieldState() failed: %s", error.message);
      throw error;
    }
  }
}

export default SoundFieldService;
