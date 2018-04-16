# "homebridge-sony-audio-control" Plugin


With this plugin you can create HomeKit speaker services which will redirect commands to the specified http API server.
This could be handy to outsource the "brains" of the speaker to an separate application, maybe in an entirely different language.

## Compatibility notice
Speakers were introduced within the HomeKit protocol in iOS 10. However the Home App from Apple doesn't support
controlling speakers. Even in current iOS 11 Beta 4 support was not added to the Home App. Though most third party HomeKit apps (We like the Example of [Eve App](https://itunes.apple.com/app/elgato-eve/id917695792)) are able to control speakers. I'm guessing that speaker support will be included in the final iOS 11 release build or within the release of the HomePod.

## Installation
First of all you should already have installed `Homebridge` on your device. Follow the instructions over at the
[HomeBridge Repo](https://github.com/nfarina/homebridge)

To install the `homebridge-sony-audio-control` plugin simply run `sudo npm install -g homebridge-sony-audio-control`

### Configuration

Here is an example configuration. Note that the `mute` section is the only required one
(required by HomeKit Accessory Protocol). `volume` is fully optional. `power` was Andi's decision to include it in the code.
The power attribute is not foreseen for the speaker but the Eve App manages to handle this 'abnormal' characteristic.
We will see what the Home App will do with it.


Every call needs to be status code `200` if successful. The `statusUrl` call of `mute` (and of `power`) expects an `0` or `1` for `off` or `on` with no html markup inside the body of the response. The `statusUrl`of `volume` expects a value from 0 to 100 with no html markup inside the body. The `%s` in the `setUrl` call will be replaced with the volume.

```
    "accessories": [
        {
            "accessory": "receiver",
            "name": "Receiver",
            "baseUrl": "http://10.0.0.138:10000",
            "inputs": [
              {
                "name": "Apple TV",
                "uri": "extInput:video?port=2"
              },
              {
                "name": "TV",
                "uri": "extInput:sat-catv"
              },
              {
                "name": "Blu-ray",
                "uri": "extInput:bd-dvd"
              },
              {
                "name": "Xbox One",
                "uri": "extInput:game"
              },
              {
                "name": "Bluesound",
                "uri": "extInput:tv"
              },
              {
                "name": "Vinyl",
                "uri": "extInput:sacd-cd"
              }
            ]
        }
    ]
```
