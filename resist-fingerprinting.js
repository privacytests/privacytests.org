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

(function () {
try {

// Prevent use of arguments.caller.callee.arguments
"use strict";

const defineConstants = function (obj, m) {
  for (let prop in m) {
    Object.defineProperty(obj, prop, {
      value: m[prop],
      writable: false,
    })
  }
};
const defineGetters = function (obj, m) {
  for (let prop in m) {
    Object.defineProperty(obj, prop, {
      get: m[prop],
    })
  }
};
const defineSettersAndGetters = function (obj, m) {
  for (let {setter, getter} in m) {
    Object.defineProperty(obj, prop, {
      get: getter,
      set: setter,
    })
  }
};
const defineMutables = function (obj, m) {
  for (let prop in m) {
    Object.defineProperty(obj, prop, {
      value: m[prop],
      writable: true,
    })
  }
};

const roundTimeMs = t => Math.round(t / 100) * 100;

// ## rounding performance.now()

const oldNow = Performance.prototype.now;
defineConstants(Performance.prototype, {
  now: function () { return roundTimeMs(oldNow.apply(this)); },
});

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
};

// ## window.screenX, window.screenY

defineConstants(window, { // Can we use a prototype here instead?
  screenX: 0,
  screenY: 0,
});

// ## Event.timeStamp

const oldTimeStamp = Object.getOwnPropertyDescriptor(Event.prototype, "timeStamp").get;
const newTimeStamp = that => roundTimeMs(oldTimeStamp.apply(that));
defineGetters(Event.prototype, {
  timeStamp: function () { return newTimeStamp(this); },
});

// ## MouseEvent.screenX, MouseEvent.screenY

defineGetters(MouseEvent.prototype, {
  screenX: function () { return this.clientX; },
  screenY: function () { return this.clientY; },
});

// ## window.navigator properties

defineConstants(Navigator.prototype, {
  buildID: "20100101",
  getBattery: undefined,
  hardwareConcurrency: 2,
  language: "en-US",
  languages: "en-US,en",
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
    toBlob : function (...args) { return newToBlob(this, ...args); },
    toDataURL : function (...args) { return newToDataURL(this, ...args); },
});

// ## Date (enforce UTC)

let constantMap = {};
for (let unit of ["Date", "Day", "FullYear", "Hours", "Milliseconds",
                  "Minutes", "Month", "Seconds"]) {
  for (let option of ["set", "get"]) {
    constantMap[`${option}${unit}`] = function (...args) {
      return Date.prototype[`${option}UTC${unit}`].apply(this, args);
    };
  }
}
defineConstants(Date.prototype, {
  constants: constantMap
});


// ## Handle unexpected errors
// Catch any errors. If the __showResistFingerprintingErrors
// flags is enabled, then we will display on the page.
} catch (e) {
  if (window.__showResistFingerprintingErrors) {
    let errorDiv = document.createElement("div");
    errorDiv.setAttribute("class", "error_message");
    errorDiv.innerText = e.message + "\n" + e.stack.toString();
    document.body.appendChild(errorDiv);
  }
} //try

// End enclosing function
})();
