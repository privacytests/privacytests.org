// resist-fingerprinting.js
//
// This content script can be injected into a web page to
// prevent some Web APIs from being used for fingerprinting.
// Please note: this script is not sufficient to prevent all
// fingerprinting techniques! Some fingerprinting vectors cannot
// be mitigated by a content script.
//
// Here are some rules for adding code:
//  * Later-defined functions call earlier functions
//  * Each function must be documented
//  * We (mostly) redefine properties of prototypes, not instances, so that
//   attackers can't call the old prototype on the instance.

/* jshint esversion: 6 */

(function () { // Enclosing function

// dualResistFunction provides protections for APIs shared by
// both both Workers and Window contexts.
const { defineConstants, defineGetters, defineMutables, freezeConstant } =
(function dualResistFunction () {

// Prevent use of arguments.caller.callee.arguments
"use strict";

console.log("hello from resist-fingerprinting.js");

const defineConstants = function (obj, m) {
  for (let prop in m) {
    Object.defineProperty(obj, prop, {
      value: m[prop],
      writable: false,
      configurable: false,
    });
  }
};
const defineGetters = function (obj, m) {
  for (let prop in m) {
    Object.defineProperty(obj, prop, {
      get: m[prop],
    });
  }
};
const defineSettersAndGetters = function (obj, m) {
  for (let {setter, getter} in m) {
    Object.defineProperty(obj, prop, {
      get: getter,
      set: setter,
//      writable: false,
//      configurable: false,
    });
  }
};
const defineMutables = function (obj, m) {
  for (let prop in m) {
    Object.defineProperty(obj, prop, {
      value: m[prop],
      writable: true,
    });
  }
};
const freezeConstant = function (obj, prop) {
  Object.defineProperty(obj, prop, {
    writable: false,
    configurable: false,
  });
};

const roundTimeMs = t => Math.round(t / 100) * 100;

// ## rounding performance.now()

const oldNow = Performance.prototype.now;
defineConstants(Performance.prototype, {
  now: function () { return roundTimeMs(oldNow.apply(this)); },
});

// ## Date (enforce UTC)

let constantMap = {};
for (let unit of ["Date", "Day", "FullYear", "Hours", "Milliseconds",
                  "Minutes", "Month", "Seconds"]) {
  for (let option of ["set", "get"]) {
    constantMap[option + unit] = function (...args) {
      return Date.prototype[option + "UTC" + unit].apply(this, args);
    };
  }
}
defineConstants(Date.prototype, constantMap);

// ## Event.timeStamp

const oldTimeStamp = Object.getOwnPropertyDescriptor(Event.prototype, "timeStamp").get;
const newTimeStamp = that => roundTimeMs(oldTimeStamp.apply(that));
defineGetters(Event.prototype, {
  timeStamp: function () { return newTimeStamp(this); },
});

// ## self.navigator properties

defineConstants(Object.getPrototypeOf(navigator), {
  hardwareConcurrency: 2,
  language: "en-US",
  languages: "en-US,en",
});

console.log(`we are in a ${self.Window ? "window" : "worker"}`);

// A quine!

const dualResistFunctionSource = dualResistFunction.toString();
//console.log(dualResistFunctionSource);

const oldWorker = self.Worker;
self.Worker = function (src) {
  return new oldWorker(URL.createObjectURL(new Blob([
    `(function () {
       (${dualResistFunctionSource})();
     })();
     importScripts('${src}');`])));
};

return { defineConstants, defineGetters, defineMutables, freezeConstant };

// End dualResistFunction
})();

// Following are additional protections that only apply to Window contexts.

// ## window.screen properties

defineConstants(Screen.prototype, {
  availLeft: 0,
  availTop: 0,
  colorDepth: 24,
  left: 0,
  mozOrientation: "landscape-primary",
  top: 0,
});
defineGetters(Screen.prototype, {
  availHeight: () => window.innerHeight,
  availWidth: () => window.innerWidth,
  height: () => window.innerHeight,
  width: () => window.innerWidth,
});
defineMutables(Screen.prototype, {
  onmozorientationchange: null, // Does this work?
});

// ## screen orientation

if (window.ScreenOrientation) {
  defineConstants(ScreenOrientation.prototype, {
    type: "landscape-primary",
    angle: 0,
    onchange: null,
  });
}

// ## window.screenX, window.screenY
// (Should we use a prototype here instead? I can't find one.)
defineConstants(window, {
  screenX: 0,
  screenY: 0,
  devicePixelRatio: 1,
});
defineGetters(window, {
  outerWidth: () => window.innerWidth,
  outerHeight: () => window.innerHeight,
});

// ## MouseEvent.screenX, MouseEvent.screenY

defineGetters(MouseEvent.prototype, {
  screenX: function () { return this.clientX; },
  screenY: function () { return this.clientY; },
});

// ## window.navigator properties

defineConstants(Object.getPrototypeOf(navigator), {
  buildID: "20100101",
  getBattery: undefined,
  getGamepads: () => [],
});

// ## navigator.mimeTypes and navigator.plugins properties

const dummy_mimeTypes = Object.create(MimeTypeArray.prototype);
defineConstants(dummy_mimeTypes, {
  length: 0,
  namedItem: () => undefined,
  item: () => undefined,
});
const dummy_plugins = Object.create(PluginArray.prototype);
defineConstants(dummy_plugins, {
  length: 0,
  namedItem: () => undefined,
  item: () => undefined,
});
defineGetters(Navigator.prototype, {
  mimeTypes: () => dummy_mimeTypes,
  plugins: () => dummy_plugins,
});

// #### Canvas fingerprinting

let allowCanvas;
const controlCanvas = function (canvas) {
  if (allowCanvas === undefined) {
    allowCanvas = window.confirm("Do you want to allow canvas image extraction?");
  }
  if (allowCanvas) {
    return canvas;
  } else {
    const blankCanvas = document.createElement("canvas");
    blankCanvas.width = canvas.width;
    blankCanvas.height = canvas.height;
    return blankCanvas;
  }
};
const oldToBlob = HTMLCanvasElement.prototype.toBlob;
const newToBlob = function (canvas, ...args) {
  return oldToBlob.apply(controlCanvas(canvas), args);
};
const oldToDataURL = HTMLCanvasElement.prototype.toDataURL;
const newToDataURL = function (canvas, ...args) {
  return oldToDataURL.apply(controlCanvas(canvas), args);
};
defineConstants(HTMLCanvasElement.prototype, {
    toBlob: function (...args) { return newToBlob(this, ...args); },
    toDataURL: function (...args) { return newToDataURL(this, ...args); },
});
freezeConstant(window, "confirm");

// ## performance.timing members
const performance_timing_members = [
  'connectEnd',
  'connectStart',
  'domComplete',
  'domContentLoadedEventEnd',
  'domContentLoadedEventStart',
  'domInteractive',
  'domLoading',
  'domainLookupEnd',
  'domainLookupStart',
  'fetchStart',
  'loadEventEnd',
  'loadEventStart',
  'navigationStart',
  'redirectEnd',
  'redirectStart',
  'requestStart',
  'responseEnd',
  'responseStart',
  'secureConnectionStart',
  'unloadEventEnd',
  'unloadEventStart',
];
const dummy_performance_timing = Object.create(PerformanceTiming.prototype);
  const timingConstantMap = {};
for (let member of performance_timing_members) {
  timingConstantMap[member] = 0;
}
defineConstants(dummy_performance_timing, timingConstantMap);
defineGetters(Performance.prototype, {
  timing: () => dummy_performance_timing,
});

})(); // End enclosing function.

