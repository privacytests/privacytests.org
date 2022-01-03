import captureWebsite from 'capture-website';

const createPreviewImage = (htmlFile, pngFile) => {
    captureWebsite.file(htmlFile, pngFile, {
      width: 1200,
      height: 627, scaleFactor: 1,
      overwrite: true
    });
}

export { createPreviewImage };