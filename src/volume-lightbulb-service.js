import VolumeCharacteristics from './volume-characteristics.js';
class VolumeLightbulbService {
  constructor(serviceParams, maxVolume) {
    this.api = serviceParams.api;
    this.log = serviceParams.log;
    this.outputZone = serviceParams.outputZone;
    this.lastChanges = serviceParams.lastChanges;
    this.maxVolume = maxVolume;

    this.hapService = new serviceParams.Service.Lightbulb(`${serviceParams.accessoryName} Volume`);

    const volumeCharacteristics = new VolumeCharacteristics();

    this.hapService
      .getCharacteristic(serviceParams.Characteristic.On)
      .on("get", volumeCharacteristics.getMuteState.bind(this))
      .on("set", volumeCharacteristics.setMuteState.bind(this));

    this.hapService
      .addCharacteristic(new serviceParams.Characteristic.Brightness())
      .on("get", volumeCharacteristics.getVolume.bind(this))
      .on("set", volumeCharacteristics.setVolume.bind(this));
  }
}

export default VolumeLightbulbService;