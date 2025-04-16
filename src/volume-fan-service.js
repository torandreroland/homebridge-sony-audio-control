import VolumeCharacteristics from './volume-characteristics.js';

class VolumeFanService {
  constructor(serviceParams, maxVolume) {
    this.api = serviceParams.api;
    this.log = serviceParams.log;
    this.outputZone = serviceParams.outputZone;
    this.lastChanges = serviceParams.lastChanges;
    this.maxVolume = maxVolume;

    this.hapService = new serviceParams.Service.Fanv2(`${serviceParams.accessoryName} Volume`);

    const volumeCharacteristics = new VolumeCharacteristics();

    this.hapService
      .getCharacteristic(serviceParams.Characteristic.Active)
      .onGet(volumeCharacteristics.getMuteState.bind(this))
      .onSet(volumeCharacteristics.setMuteState.bind(this));

    this.hapService
      .addCharacteristic(new serviceParams.Characteristic.RotationSpeed())
      .onGet(volumeCharacteristics.getVolume.bind(this))
      .onSet(volumeCharacteristics.setVolume.bind(this));
  }
}

export default VolumeFanService;