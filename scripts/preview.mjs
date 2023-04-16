import captureWebsite from 'capture-website';

const createPreviewImage = async (htmlFile, pngFile) => {
  await captureWebsite.file(htmlFile, pngFile, {
    width: 1000,
    height: 500,
    scaleFactor: 1.2,
    overwrite: true
  });
  console.log('wrote', pngFile);
};

export { createPreviewImage };
