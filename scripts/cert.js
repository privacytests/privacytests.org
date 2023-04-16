const { execSync } = require('child_process');
const { mkdir, rm, access } = require('fs/promises');
const fs = require('fs');
const { homedir } = require('os');
const path = require('path');
const os = require('os');
const { _: { memoize } } = require('lodash');

const execSyncExplicit = (command) => {
  console.log(command);
  return execSync(command).toString().trim();
};

const cmd = memoize((shortCommand) =>
  execSync(`which ${shortCommand}`).toString().trim());

const nssdbPath = memoize(() => path.join(homedir(), '.pki', 'nssdb'));

const fileExists = async (path) => {
  try {
    await access(path, fs.constants.F_OK);
    return true;
  } catch (e) {
    return false;
  }
};

const createDB = async (path) => {
  await mkdir(path, { recursive: true });
  execSyncExplicit(`${cmd('certutil')} -N -d sql:${path} --empty-password`);
};

const addCertificateToDB = async (dbPath, certPath) => {
  const command = `${cmd('certutil')} -A -d sql:"${dbPath}" -i "${certPath}" -n pto_certificate -t C,,`;
  execSyncExplicit(command);
};

const generateCert = async () => {
  const certsDir = '/tmp/pto_certs';
  await mkdir(certsDir, { recursive: true });
  const keyPath = path.join(certsDir, 'rootCA-key.pem');
  const certPath = path.join(certsDir, 'rootCA.pem');
  execSyncExplicit(`${cmd('openssl')} req -x509 -sha256 -days 1 -nodes -newkey rsa:2048 -subj "/C=US/ST=CA/L=LA/O=PrivacyTests.Org/OU=./CN=privacytests.org" -keyout "${keyPath}" -out "${certPath}" -outform PEM`);
  return { keyPath, certPath };
};

const setupCertificateNss = async () => {
  const { keyPath, certPath } = await generateCert();
  if (!(await fileExists(nssdbPath()))) {
    await createDB(nssdbPath());
  }
  await addCertificateToDB(nssdbPath(), certPath);
  return { keyPath, certPath };
};

const setupCertificateDarwin = async () => {
  const mkcertPath = execSync('/opt/homebrew/bin/mkcert -CAROOT')
    .toString().trim();
  return {
    keyPath: `${mkcertPath}/rootCA-key.pem`,
    certPath: `${mkcertPath}/rootCA.pem`
  };
};

const setupCertificate = async () => {
  if (os.platform() === 'darwin') {
    return setupCertificateDarwin();
  } else {
    return setupCertificateNss();
  }
};

module.exports = { setupCertificate };
