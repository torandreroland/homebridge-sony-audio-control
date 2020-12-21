# "homebridge-sony-audio-control" Plugin
With this plugin you can create HomeKit services to control a Sony STR-DN1080 Audio Video Receiver.

The code for this plugin has originally been forked from [Http Speaker for Homebridge](https://github.com/Supereg/homebridge-http-speaker) authored by Andreas Bauer.

## Compatibility notice
This plugin utilizes Sony's [Audio Control API](https://developer.sony.com/develop/audio-control-api/). It has only been tested with a Sony STR-DN1080 Audio Video Receiver, but it may work with other Sony devices that support the API.

The plugin supports powertoggling, volume control including muting, setting sound modes stereo and Dolby Surround and switching configured external inputs.

The plugin doesn't support auto discovery using UPNP. This is by design as the receiver stops responding on port 52323 after being put in standby once (at least that is the case with the european version per firmware version M41.R.0442), which is necessary to support auto discovery.

## Installation
First of all you should already have installed `Homebridge` on your device. Follow the instructions over at the
[HomeBridge Repo](https://github.com/nfarina/homebridge).

To install the `homebridge-sony-audio-control` plugin simply run `sudo npm install -g homebridge-sony-audio-control`.

### Configuration
Below is an example configuration that has to amended to your existing Homebridge-configuration.

You have to edit "ip" to correspond with the IP-address of your receiver.

Set "port" in correspondance with the device. If you omit port, a default value of 10000 will be used. 

Set "name" to what you prefer to refer to the device as using Homekit or Siri.

Set "maxVolume" in correspondance with max volume of the device. This is used to calculate the volume percentage. If you omit maxVolume, a default value of 100 will be used.

Set "outputZone" to the zone you want to control (omit if your device does not support zone control).

"accessory" is used by homebridge to initialize the plugin correctly, so do NOT edit this setting.

To disable network standby, set enableNetworkStandby to false (not recommended as you can't turn on receiver again through a network connection, but it significantly lowers power consumption while off).

For every external input you want to enable, you have to add a new input object with a "name" and "uri". Again "name" can be set to what you prefer to refer to the input as using Homekit or Siri, while "uri" have to correspond to the Device Resource URI per [Device URI](https://developer.sony.com/develop/audio-control-api/api-references/device-uri).

For every soundfield you want to enable, you can add a new soundfield object with a "name" and "value". Again "name" can be set to what you prefer to refer to the soundfield as using Homekit or Siri, while "value" have to correspond with the soundField coding of the Sony equipment. If you omit the soundField array entirely, default soundfields for 2 channel stereo and Dolby Surroind will be created. If you don't want any soundfields to be created, included an empty array (ie. "soundFields": []).

Default values 'Sony', 'STR-DN1080' and 'Serial number 1' for respectively manufacturer, model and serial number can be overridden by adding an object 'accessoryInformation' with fields 'manufacturer', 'model' and/or 'serialNumber'.

    "accessories": [
        {
            "accessory": "receiver",
            "name": "Receiver",
            "ip": "10.0.0.138",
            "maxVolume": 100,
            "port": 10000,
            "outputZone": "extOutput:zone?zone=1",
            "enableNetworkStandby": true,
            "inputs": [
              {
                "name": "Input Apple TV",
                "uri": "extInput:video?port=2"
              },
              {
                "name": "Input TV",
                "uri": "extInput:sat-catv"
              },
              {
                "name": "Input Blu-ray",
                "uri": "extInput:bd-dvd"
              },
              {
                "name": "Input Xbox One",
                "uri": "extInput:game"
              },
              {
                "name": "Input Bluesound",
                "uri": "extInput:tv"
              },
              {
                "name": "Input Vinyl",
                "uri": "extInput:sacd-cd"
              }
            ],
            "soundFields": [
                {
                    "name": "Stereo Mode",
                    "value": "2chStereo"
                },
                {
                    "name": "Surround Mode",
                    "value": "dolbySurround"
                }
            ],
            "accessoryInformation": {
                "manufacturer": "Sony",
                "model": "STR-DN1080",
                "serialNumber": "SN1"
            },
        }
    ]