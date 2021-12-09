const sharp = require('sharp');

const cropPreview = (fileIn, fileOut) => {
  sharp(fileIn)
  .resize(1200, 627, {fit: "cover", position:sharp.gravity.north})
  .toFile(fileOut);
}

cropPreview('out/desktopPreview.png', 'out/desktopPreview2.png');
cropPreview('out/nightlyPreview.png', 'out/nightlyPreview2.png');