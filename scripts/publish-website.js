const { execSync } = require('child_process');
const { getWebsiteDir } = require('./website-dir.js');

const websiteDir = getWebsiteDir();
console.log(`Pushing website from ${websiteDir}`);
execSync('git push origin HEAD', { cwd: websiteDir, stdio: 'inherit' });
