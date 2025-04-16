import fetch from 'node-fetch';

class API {
  constructor(ip, port, log, outputZone) {
    this.baseURL = `http://${ip}:${port}/sony/`;
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
      const powerResponse = this.externalTerminalsVersion === "1.2"
        ? await this.request("avContent", "getCurrentExternalTerminalsStatus", [{}], "1.2")
        : await this.request("avContent", "getCurrentExternalTerminalsStatus", [], "1.0");

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

  async getApiVersions() {
    const result = await this.request("guide", "getSupportedApiInfo", [{}], "1.0");
    const services = result;

    let currentExternalTerminalsVersion = null;
    let systemInformationVersion = null;

    for (const service of services) {
      if (service.service === "avContent") {
        const api = service.apis.find(api => api.name === "getCurrentExternalTerminalsStatus");
        if (api) currentExternalTerminalsVersion = api.versions?.[0]?.version || null;
      }

      if (service.service === "system") {
        const api = service.apis.find(api => api.name === "getSystemInformation");
        if (api) systemInformationVersion = api.versions?.[0]?.version || null;
      }
    }

    this.externalTerminalsVersion = currentExternalTerminalsVersion;
    this.systemInformationVersion = systemInformationVersion;

    this.log.debug(
      "Set API versions: externalTerminalsVersion=%s, systemInformationVersion=%s",
      this.externalTerminalsVersion,
      this.systemInformationVersion
    );
  }

  sleep(ms = 1000) {
    return new Promise(resolve => {
      setTimeout(resolve, ms);
    });
  }
}

export default API;
