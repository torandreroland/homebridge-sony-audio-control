class InputService {
  constructor(serviceParams, inputName, inputURI) {
    this.api = serviceParams.api;
    this.log = serviceParams.log;
    this.outputZone = serviceParams.outputZone;

    this.name = inputName;
    this.uri = inputURI;

    this.hapService = new serviceParams.Service.Switch(inputName, inputName);

    this.hapService
      .getCharacteristic(serviceParams.Characteristic.On)
      .on("get", this.getInputState.bind(this))
      .on("set", this.setInputState.bind(this));
  }

  async getInputState(callback) {
    this.log.debug("Getting state of input!");

    let powerState;

    try {
      powerState = await this.api.getPowerState();
    } catch (error) {
      this.log.error("getPowerState() failed: %s", error.message);
      callback(error);
      return;
    }

    try {
      if (powerState) {
        this.log.debug("Getting state of input from receiver since power is on!");

        const response = await this.api.request("avContent", "getPlayingContentInfo", [{ "output": this.outputZone }], "1.2");
        const inputState = response[0].uri === this.uri;

        this.log.debug("Input is currently %s", inputState ? "on" : "off");
        callback(null, inputState);
      } else {
        this.log.debug("Reporting state of input as off since receiver is off!");
        callback(null, false);
      }
    } catch (error) {
      this.log.error("getInputState() failed: %s", error.message);
      callback(error);
    }

  }

  async setInputState(newInputState, callback) {
    this.log.debug("Setting state of input!");

    let powerState;

    try {
      powerState = await this.api.getPowerState();
    } catch (error) {
      this.log.error("getPowerState() failed: %s", error.message);
      callback(error);
      return;
    }

    if (newInputState && !powerState) {
      this.log.debug("Powering on receiver before setting input!");

      try {
        await this.api.setPowerState(true);
      } catch (error) {
        this.log.error("setPowerState() failed: %s", error.message);
        callback(error);
        return;
      }

      this.log("Set power to on");
      this.log.debug("Waiting for device to turn on...");
      await this.api.sleep();
    }

    try {
      if (newInputState) {
        await this.api.request("avContent", "setPlayContent", [{
          "output": this.outputZone,
          "uri": this.uri
        }], "1.2");

        this.log("Set input %s to on", this.name);
      } else {
        await this.api.setPowerState(false);

        this.log.debug("Set input %s to off", this.name);
      }

      callback(null);
    } catch (error) {
      this.log.error("setInputState() failed: %s", error.message);
      callback(error);
    }
  }

}

module.exports = InputService;
