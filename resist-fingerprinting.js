
/*
# resist-fingerprinting.js

This content script can be injected into a web page to
prevent some Web APIs from being used for fingerprinting.
Please note: this script is not sufficient to prevent all
fingerprinting techniques! Some fingerprinting vectors cannot
be mitigated by a content script.

Here are some rules for adding code:
 * Later-defined functions call earlier functions
 * Each function must be documented
 * We (mostly) redefine properties of prototypes, not instances, so that
   attackers can't call the old prototype on the instance.
*/

(function () {

// __defineProperties(obj, m)__.
// Takes an object 'obj' and a map 'm'. The map
// should have one or more of the keys
// 'constants', 'getters', 'setAndGetters', 'mutables'.
const defineProperties = function (obj, m) {
  if (m.constants) {
    for (let prop in m.constants) {
      Object.defineProperty(obj, prop, {
        value: m.constants[prop],
        writable: false,
      })
    }
  }
  if (m.getters) {
    for (let prop in m.getters) {
      Object.defineProperty(obj, prop, {
        get: m.getters[prop],
      })
    }
  }
  if (m.settersAndGetters) {
    for (let {setter, getter} in m.settersAndGetters) {
      Object.defineProperty(obj, prop, {
        get: getter,
        set: setter,
      })
    }
  }
  if (m.mutables) {
    for (let prop in m.mutables) {
      Object.defineProperty(obj, prop, {
        value: m.mutables[prop],
        writable: true,
      })
    }
  }
};

const roundTimeMs = t => Math.round(t / 100) * 100;

// ## rounding performance.now()

const oldNow = Performance.prototype.now;
defineProperties(Performance.prototype, {
  constants: {
    now: function () { return roundTimeMs(oldNow.apply(this)); },
  },
});

// ## window.screen properties

defineProperties(Screen.prototype, {
  constants: {
    availLeft: 0,
    availTop: 0,
    colorDepth: 24,
    left: 0,
    mozOrientation: "landscape-primary",
    top: 0,
  },
  getters: {
    availHeight: () => window.innerHeight,
    availWidth: () => window.innerWidth,
    height: () => window.innerHeight,
    width: () => window.innerWidth,
  },
  mutables: {
    onmozorientationchange: null, // Does this work?
  },
});

// ## screen orientation

defineProperties(ScreenOrientation.prototype, {
  constants: {
    type: "landscape-primary",
    angle: 0,
    onchange: null,
  },
});

// ## window.screenX, window.screenY

defineProperties(window, { // Can we use a prototype here instead?
  constants: {
    screenX: 0,
    screenY: 0,
  },
});

// ## Event.timeStamp

const oldTimeStamp = Object.getOwnPropertyDescriptor(Event.prototype, "timeStamp").get;
const newTimeStamp = that => roundTimeMs(oldTimeStamp.apply(that));
defineProperties(Event.prototype, {
  getters: {
    timeStamp: function () { return newTimeStamp(this); },
  }
});

// ## MouseEvent.screenX, MouseEvent.screenY

defineProperties(MouseEvent.prototype, {
  getters: {
    screenX: function () { return this.clientX; },
    screenY: function () { return this.clientY; },
  }
});

// ## window.navigator properties

defineProperties(Navigator.prototype, {
  constants: {
    getBattery: undefined,
    hardwareConcurrency: 2,
    language: "en-US",
    languages: "en-US,en",
  }
});

// ## Canvas fingerprinting

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
defineProperties(HTMLCanvasElement.prototype, {
  constants: {
    toBlob : function (...args) { return newToBlob(this, ...args); },
    toDataURL : function (...args) { return newToDataURL(this, ...args); },
  }
});

// End enclosing function
})();
