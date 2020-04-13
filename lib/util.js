module.exports = {
  mapKeyToControl: mapKeyToControl
};

function mapKeyToIrccCode(key) {
  let code;
  switch (key) {
    case Characteristic.RemoteKey.REWIND:
      code = "AAAAAwAAARAAAAAzAQ==";
      break;
    case Characteristic.RemoteKey.FAST_FORWARD:
      code = "AAAAAwAAARAAAAA0AQ==";
      break;
    case Characteristic.RemoteKey.NEXT_TRACK:
      code = "AAAAAwAAARAAAAAxAQ==";
      break;
    case Characteristic.RemoteKey.PREVIOUS_TRACK:
      code = "AAAAAwAAARAAAAAwAQ==";
      break;
    case Characteristic.RemoteKey.ARROW_UP:
      code = "AAAAAgAAALAAAAB4AQ==";
      break;
    case Characteristic.RemoteKey.ARROW_DOWN:
      code = "AAAAAgAAALAAAAB5AQ==";
      break;
    case Characteristic.RemoteKey.ARROW_LEFT:
      code = "AAAAAgAAALAAAAB6AQ==";
      break;
    case Characteristic.RemoteKey.ARROW_RIGHT:
      code = "AAAAAgAAALAAAAB7AQ==";
      break;
    case Characteristic.RemoteKey.SELECT:
      code = "AAAAAgAAADAAAAAMAQ==";
      break;
    case Characteristic.RemoteKey.BACK:
      code = "AAAAAwAAARAAAAB9AQ==";
      break;
    case Characteristic.RemoteKey.PLAY_PAUSE:
      code = "AAAAAgAAADAAAAAUAQ==";
      break;
    case Characteristic.RemoteKey.INFORMATION:
      code = "AAAAAgAAADAAAABTAQ==";
      break;
    default:
  }
  return (code);
}