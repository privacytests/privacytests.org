const fs = require('fs');
const path = require('path');

// Default: clone privacytests-website as a sibling of privacytests.org.
// Override with WEBSITE_DIR if your layout differs.
const DEFAULT_WEBSITE_DIR = path.resolve(__dirname, '..', '..', 'privacytests-website');

const getWebsiteDir = ({ required = true } = {}) => {
  const dir = process.env.WEBSITE_DIR
    ? path.resolve(process.env.WEBSITE_DIR)
    : DEFAULT_WEBSITE_DIR;
  if (required && !fs.existsSync(dir)) {
    throw new Error(
      `Website directory not found at ${dir}. ` +
      'Clone https://github.com/privacytests/privacytests-website next to privacytests.org ' +
      '(sibling directory), or set WEBSITE_DIR to that checkout.'
    );
  }
  return dir;
};

module.exports = { getWebsiteDir, DEFAULT_WEBSITE_DIR };
