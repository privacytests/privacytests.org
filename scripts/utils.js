// # General utility functions for javascript

const child_process = require('child_process');

const sleepMs = (t) => new Promise((resolve, reject) => setTimeout(resolve, t));

const execSync = (command, options) => {
  console.log(command);
  return child_process.execSync(command, options);
};

const exec = (command, options) => {
  console.log(command);
  return child_process.exec(command, options);
};

// Returns an list of the PIDs for immediate children
const childProcesses = (pid) => {
  try {
    const list = child_process.execSync(`pgrep -P ${pid}`).toString();
    return list.split(/\s+/).filter(s => s.length > 0);
  } catch (e) {
    return [];
  }
};

// Returns all processes that are descendants of PID, including
// the original PID itself.
const descendantProcesses = (pid) => {
  const children = childProcesses(pid);
  descendants = children.map(descendantProcesses).flat();
  return [pid, ...descendants];
};

// Kill all processes in the list of PIDs.
const killProcesses = (pids) => {
  pids.map(pid => {
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

module.exports = { sleepMs, execSync, exec, killProcessAndDescendants };