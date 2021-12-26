import captureWebsite from 'capture-website';
// imports
import fs from 'fs';

//console.log(captureWebsite);
//console.log(sharp);

const listHtmlFiles = (dir) => {
  return fs.readdirSync(dir).filter(f => f.endsWith(".html"));
};

const createPreviewImage = (htmlFile) => {
    const pngFile = htmlFile.replace(".html", "-preview.png");
    captureWebsite.file("./out/" + htmlFile, "./out/" + pngFile, {
      width: 1200,
      height: 627, scaleFactor: 1,
      overwrite: true
    });
}

const main = () => {
  const htmlFiles = listHtmlFiles("./out");
  for (let htmlFile of htmlFiles) {
    createPreviewImage(htmlFile);
  }
};

main();