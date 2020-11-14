const fetch = require("node-fetch");


class API {
  constructor(ip, log, outputZone) {
    this.baseURL = `http://${ip}:10000/sony/`;
    this.log = log;
    this.outputZone = outputZone;
  }

  async request(lib, method, params, version) {
    const body = JSON.stringify({
      method,
      id: 1,
      params,
      version
    });
    this.log.debug(body);
    const response = await fetch(this.baseURL + lib, {
      method: "post",
      body: body,
      headers: { "Content-Type": "application/json" }
    });

    if (!response.ok) throw new Error(`HTTP error: ${response.status} ${response.statusText}`);

    const json = await response.json();
    if (json.error != null) throw new Error(`API error:\n${JSON.stringify(json["error"])}`);

    return json.result[0];
  }

  async getPowerState() {
    if (this.outputZone) {
      const powerResponse = await this.request("avContent", "getCurrentExternalTerminalsStatus", [], "1.0");
      return powerResponse
      .filter(terminal => terminal.uri === this.outputZone)
      .some(terminal => terminal.active === "active");
    } else {
      const powerResponse = await this.request("system", "getPowerStatus", [], "1.1");
      return powerResponse.status === "active";
    }
  }

  async setPowerState(newPowerState) {
    if (this.outputZone) {
      await this.request("avContent", "setActiveTerminal", [{
        "active": newPowerState ? "active" : "inactive",
        "uri": this.outputZone
      }], "1.0");
    } else {
      await this.request("system", "setPowerStatus", [{
        "status": newPowerState ? "active" : "off"
      }], "1.1");
    }

  }

  sleep(ms = 1000) {
    return new Promise(resolve => {
      setTimeout(resolve, ms);
    });
  }

}

module.exports = API;
