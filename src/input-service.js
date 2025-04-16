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
      .onGet(this.getInputState.bind(this))
      .onSet(this.setInputState.bind(this));
  }

  async getInputState() {
    this.log.debug("Getting state of input!");

    let powerState;

    try {
      powerState = await this.api.getPowerState();
    } catch (error) {
      this.log.error("getPowerState() failed: %s", error.message);
      throw error;
    }

    try {
      if (powerState) {
        this.log.debug("Getting state of input from receiver since power is on!");

        const response = await this.api.request("avContent", "getPlayingContentInfo", [{ "output": this.outputZone }], "1.2");
        const inputState = response[0].uri === this.uri;

        this.log.debug("Input is currently %s", inputState ? "on" : "off");
        return inputState;
      } else {
        this.log.debug("Reporting state of input as off since receiver is off!");
        return false;
      }
    } catch (error) {
      this.log.error("getInputState() failed: %s", error.message);
      throw error;
    }
  }

  async setInputState(newInputState) {
    this.log.debug("Setting state of input!");

    let powerState;

    try {
      powerState = await this.api.getPowerState();
    } catch (error) {
      this.log.error("getPowerState() failed: %s", error.message);
      throw error;
    }

    if (newInputState && !powerState) {
      this.log.debug("Powering on receiver before setting input!");

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
    } catch (error) {
      this.log.error("setInputState() failed: %s", error.message);
      throw error;
    }
  }
}

export default InputService;