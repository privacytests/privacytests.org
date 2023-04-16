// # General utility functions for javascript

const fs = require('fs');
const YAML = require('yaml');
const childProcess = require('child_process');
const datauri = require('datauri/sync');

const sleepMs = (t) => new Promise((resolve, reject) => setTimeout(resolve, t));

const execSync = (command, options) => {
  console.log(command);
  return childProcess.execSync(command, options);
};

const exec = (command, options) => {
  console.log(command);
  return childProcess.exec(command, options);
};

// Returns an list of the PIDs for immediate children
const childProcesses = (pid) => {
  try {
    const list = childProcess.execSync(`pgrep -P ${pid}`).toString();
    return list.split(/\s+/).filter(s => s.length > 0);
  } catch (e) {
    return [];
  }
};

// Returns all processes that are descendants of PID, including
// the original PID itself.
const descendantProcesses = (pid) => {
  const children = childProcesses(pid);
  const descendants = children.map(descendantProcesses).flat();
  return [pid, ...descendants];
};

// Kill all processes in the list of PIDs.
const killProcesses = (pids) => {
  pids.forEach(pid => {
    try {
      process.kill(pid, process.SIGTERM);
    } catch (e) {
      console.log(e);
    }
  });
};

// Kill a process and all of its descendants.
const killProcessAndDescendants = (pid) => {
  killProcesses(descendantProcesses(pid));
};

// Read a YAML file from disk.
const readYAMLFile = (file) => {
  const fileContents = fs.readFileSync(file, 'utf8');
  return YAML.parse(fileContents);
};

const dataUriFromFile = path => datauri(path.join(__dirname, path)).content;

module.exports = { sleepMs, execSync, exec, killProcessAndDescendants, readYAMLFile, dataUriFromFile };
