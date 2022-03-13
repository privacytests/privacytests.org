import captureWebsite from 'capture-website';

const createPreviewImage = (htmlFile, pngFile) => {
    captureWebsite.file(htmlFile, pngFile, {
      width: 1000,
      height: 500, scaleFactor: 1.2,
      overwrite: true
    });
}

export { createPreviewImage };