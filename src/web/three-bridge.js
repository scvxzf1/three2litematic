/**
 * Browser Three.js Bridge Module for Live Iframe Extraction, Camera Sync & Idle GPU Gating
 * Re-exports all of Three.js while recording Scenes/Cameras and skipping redundant idle renders.
 */

import * as RawTHREE from '/node_modules/three/build/three.module.js';

export * from '/node_modules/three/build/three.module.js';

if (!window.__CAPTURED_SCENES__) {
  window.__CAPTURED_SCENES__ = [];
}

class BridgedScene extends RawTHREE.Scene {
  constructor(...args) {
    super(...args);
    window.__CAPTURED_SCENES__.push(this);
  }
}

class BridgedPerspectiveCamera extends RawTHREE.PerspectiveCamera {
  constructor(...args) {
    super(...args);
    window.__CAPTURED_CAMERA__ = this;
  }
}

class BridgedOrthographicCamera extends RawTHREE.OrthographicCamera {
  constructor(...args) {
    super(...args);
    window.__CAPTURED_CAMERA__ = this;
  }
}

let notified = false;

class BridgedWebGLRenderer extends RawTHREE.WebGLRenderer {
  constructor(...args) {
    super(...args);
    const origSetPixelRatio = this.setPixelRatio.bind(this);
    this.setPixelRatio = (r) => origSetPixelRatio(Math.min(Number(r) || 1, 1.5));

    let warmupFrames = 0;
    let lastSig = '';
    let lastScene = null;
    let lastCamera = null;
    const renderStats = {
      total: 0,
      rendered: 0,
      sceneRenders: 0,
      passRenders: 0,
      forcedRenders: 0,
      skippedHidden: 0,
      skippedIdle: 0,
      lastRenderAt: 0,
    };
    window.__SOURCE_RENDER_STATS__ = renderStats;

    const origRender = this.render.bind(this);
    this.render = (scene, camera) => {
      renderStats.total++;
      const isSceneRender = Boolean(scene?.isScene && camera?.isCamera);

      if (isSceneRender) {
        renderStats.sceneRenders++;
        lastScene = scene;
        lastCamera = camera;
        window.__CAPTURED_SCENE__ = scene;
        window.__CAPTURED_CAMERA__ = camera;
        if (!notified) {
          notified = true;
          queueMicrotask(() => {
            if (typeof window.__NOTIFY_SCENE_READY__ === 'function') {
              window.__NOTIFY_SCENE_READY__();
            }
          });
        }
      }

      // Skip GPU rendering completely when iframe pane is hidden (e.g. "仅 MC 投影" tab)
      if (window.innerWidth <= 0 || window.innerHeight <= 0) {
        renderStats.skippedHidden++;
        return;
      }
      if (document.hidden && !window.__KEEP_SOURCE_ALIVE__) {
        renderStats.skippedHidden++;
        return;
      }

      if (!isSceneRender) {
        renderStats.passRenders++;
        renderStats.rendered++;
        renderStats.lastRenderAt = performance.now();
        return origRender(scene, camera);
      }

      // Smart idle sleep when autoRotate is off (e.g. Camera Sync active) and camera hasn't moved
      const ctrl = window.__CAPTURED_CONTROLS__;
      const canSleepIdle =
        !window.__KEEP_SOURCE_ALIVE__ &&
        warmupFrames >= 5 &&
        ctrl &&
        !ctrl.autoRotate &&
        !window.__USER_INTERACTING_SOURCE__;

      if (camera && canSleepIdle && !window.__FORCE_SOURCE_RENDER__) {
        const p = camera.position;
        const q = camera.quaternion;
        const sig = `${p.x.toFixed(4)},${p.y.toFixed(4)},${p.z.toFixed(4)}|${q.x.toFixed(4)},${q.y.toFixed(4)},${q.z.toFixed(4)}|${window.innerWidth}x${window.innerHeight}`;
        if (sig === lastSig) {
          renderStats.skippedIdle++;
          return;
        }
        lastSig = sig;
      } else if (camera) {
        const p = camera.position;
        const q = camera.quaternion;
        lastSig = `${p.x.toFixed(4)},${p.y.toFixed(4)},${p.z.toFixed(4)}|${q.x.toFixed(4)},${q.y.toFixed(4)},${q.z.toFixed(4)}|${window.innerWidth}x${window.innerHeight}`;
      }

      window.__FORCE_SOURCE_RENDER__ = false;
      warmupFrames++;
      renderStats.rendered++;
      renderStats.lastRenderAt = performance.now();
      return origRender(scene, camera);
    };

    window.__CAPTURED_RENDERER__ = this;
    window.__FORCE_SCENE_REDRAW__ = () => {
      if (!lastScene || !lastCamera || document.hidden || window.innerWidth <= 0 || window.innerHeight <= 0) {
        return;
      }
      try {
        renderStats.forcedRenders++;
        renderStats.rendered++;
        renderStats.lastRenderAt = performance.now();
        origRender(lastScene, lastCamera);
      } catch {
        // A context loss will be handled by the source page's own recovery path.
      }
    };
  }
}

export {
  BridgedScene as Scene,
  BridgedPerspectiveCamera as PerspectiveCamera,
  BridgedOrthographicCamera as OrthographicCamera,
  BridgedWebGLRenderer as WebGLRenderer,
};
