class PowerService {
  constructor(serviceParams) {
    this.api = serviceParams.api;
    this.log = serviceParams.log;
    this.outputZone = serviceParams.outputZone;

    this.hapService = new serviceParams.Service.Switch(serviceParams.accessoryName, serviceParams.accessoryName);
    this.hapService
      .getCharacteristic(serviceParams.Characteristic.On)
      .on("get", this.getPowerState.bind(this))
      .on("set", this.setPowerState.bind(this));
  }

  async getPowerState(callback) {
    try {
      const powerState = await this.api.getPowerState();

      this.log.debug("Speaker is currently %s", powerState ? "on" : "off");
      typeof callback === "function" ? callback(null, powerState) : powerState;
    } catch (error) {
      this.log.error("getPowerState() failed: %s", error.message);
      typeof callback === "function" ? callback(error) : error;
    }
  }

  async setPowerState(newPowerState, callback) {
    try {
      await this.api.setPowerState(newPowerState);

      this.log.debug("Set power to %s", newPowerState ? "on" : "off");
      typeof callback === "function" ? callback(null) : null;
    } catch (error) {
      this.log.error("setPowerState() failed: %s", error.message);
      typeof callback === "function" ? callback(error) : error;
    }
  }
}

export default PowerService;
