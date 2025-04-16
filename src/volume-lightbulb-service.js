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
      .onGet(volumeCharacteristics.getMuteState.bind(this))
      .onSet(volumeCharacteristics.setMuteState.bind(this));

    this.hapService
      .addCharacteristic(new serviceParams.Characteristic.Brightness())
      .onGet(volumeCharacteristics.getVolume.bind(this))
      .onSet(volumeCharacteristics.setVolume.bind(this));
  }
}

export default VolumeLightbulbService;