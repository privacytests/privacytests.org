
/*
 * # resist-fingerprinting.js
 *
 * This content script can be injected into a web page to
 * prevent some Web APIs from being used for fingerprinting.
 * Please note: this script is not sufficient to prevent all
 * fingerprinting techniques! Some fingerprinting vectors cannot
 * be mitigated by a content script.
 */

(function () {

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
  if (m.setters) {
    for (let prop in m.setters) {
      Object.defineProperty(obj, prop, {
        set: m.setters[prop],
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

const oldNow = Object.getPrototypeOf(performance).now;
defineProperties(performance, {
  constants: {
    now: () => roundTimeMs(oldNow.apply(performance)),
  },
});

defineProperties(screen, {
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

defineProperties(screen.orientation, {
  constants: {
    type: "landscape-primary",
    angle: 0,
    onchange: null,
  },
});

defineProperties(window, {
  constants: {
    screenX: 0,
    screenY: 0,
  },
});

const oldTimeStamp = Object.getOwnPropertyDescriptor(Event.prototype, "timeStamp").get;
const newTimeStamp = that => roundTimeMs(oldTimeStamp.apply(that));
defineProperties(Event.prototype, {
  getters: {
    timeStamp: function () { return newTimeStamp(this); },
  }
});
defineProperties(MouseEvent.prototype, {
  getters: {
    screenX: function () { return this.clientX; },
    screenY: function () { return this.clientY; },
  }
});

})();
