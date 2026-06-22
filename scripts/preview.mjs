import captureWebsite from 'capture-website';

const createPreviewImage = async (htmlFile, pngFile) => {
  await captureWebsite.file(htmlFile, pngFile, {
    width: 1000,
    height: 500,
    scaleFactor: 1.2,
    overwrite: true,
    launchOptions: {
      executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    }
  });
  console.log('wrote', pngFile);
};

export { createPreviewImage };
