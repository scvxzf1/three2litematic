/**
 * Browser OrbitControls Bridge for Bidirectional Camera Sync
 * Captures the active OrbitControls and Camera inside `#sourceFrame`.
 */

import { OrbitControls as RawOrbitControls } from '/node_modules/three/examples/jsm/controls/OrbitControls.js';

export * from '/node_modules/three/examples/jsm/controls/OrbitControls.js';

class BridgedOrbitControls extends RawOrbitControls {
  constructor(object, domElement) {
    super(object, domElement);
    window.__CAPTURED_CONTROLS__ = this;
    if (object && object.isCamera) {
      window.__CAPTURED_CAMERA__ = object;
    }
    this.addEventListener('start', () => {
      window.__USER_INTERACTING_SOURCE__ = true;
    });
    this.addEventListener('end', () => {
      window.__USER_INTERACTING_SOURCE__ = false;
    });
    this.addEventListener('change', () => {
      if (window.__USER_INTERACTING_SOURCE__ && typeof window.__ON_SOURCE_CAMERA_CHANGE__ === 'function') {
        window.__ON_SOURCE_CAMERA_CHANGE__();
      }
    });
  }
}

export { BridgedOrbitControls as OrbitControls };
