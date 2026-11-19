/**
 * Headless Three.js Scene & Voxel Data Extractor for Node.js CLI
 * Executes Three.js .html / .js / .json files inside `node:vm` using the REAL `three`
 * math & geometry engine while shimming WebGLRenderer, Canvas 2D, DOM, OrbitControls, and lil-gui.
 */

import vm from 'node:vm';
import fs from 'node:fs/promises';
import path from 'node:path';
import * as RealTHREE from 'three';

function createChainableStub() {
  const fn = function (..._args) {
    return proxy;
  };
  const proxy = new Proxy(fn, {
    get(_target, prop) {
      if (prop === Symbol.toPrimitive) return () => 0;
      if (prop === 'domElement') return createMockElement('div');
      if (prop === 'then') return undefined; // Do not act like a Promise
      return proxy;
    },
    construct() {
      return proxy;
    },
    apply() {
      return proxy;
    },
  });
  return proxy;
}

function createMockCanvasContext2D() {
  const grad = { addColorStop() {} };
  return {
    fillStyle: '#000',
    strokeStyle: '#000',
    lineWidth: 1,
    font: '12px sans-serif',
    fillRect() {},
    clearRect() {},
    strokeRect() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    arc() {},
    closePath() {},
    fill() {},
    stroke() {},
    fillText() {},
    strokeText() {},
    measureText: (t) => ({ width: String(t).length * 8 }),
    createLinearGradient: () => grad,
    createRadialGradient: () => grad,
    getImageData: (_x, _y, w, h) => ({
      data: new Uint8ClampedArray(Math.max(1, w * h * 4)),
      width: w,
      height: h,
    }),
    putImageData() {},
    drawImage() {},
    save() {},
    restore() {},
    translate() {},
    rotate() {},
    scale() {},
  };
}

function createMockElement(tagName = 'div') {
  const children = [];
  const listeners = new Map();
  return {
    tagName: String(tagName).toUpperCase(),
    style: {},
    dataset: {},
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    clientWidth: 1280,
    clientHeight: 720,
    width: 1280,
    height: 720,
    innerHTML: '',
    textContent: '',
    children,
    appendChild(child) {
      children.push(child);
      return child;
    },
    removeChild() {},
    prepend(child) {
      children.unshift(child);
      return child;
    },
    setAttribute() {},
    getAttribute: () => null,
    addEventListener(type, cb) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(cb);
    },
    removeEventListener() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 }),
    getContext: (kind) => (kind === '2d' ? createMockCanvasContext2D() : createChainableStub()),
  };
}

function buildShimmedThree(capturedScenes) {
  class CapturedScene extends RealTHREE.Scene {
    constructor(...args) {
      super(...args);
      capturedScenes.push(this);
    }
  }

  class DummyWebGLRenderer {
    constructor(params = {}) {
      this.domElement = params.canvas || createMockElement('canvas');
      this.shadowMap = { enabled: false, type: 0 };
      this.capabilities = { isWebGL2: true, getMaxAnisotropy: () => 16 };
      this.info = { render: {}, memory: {} };
      this.toneMapping = 0;
      this.toneMappingExposure = 1.0;
      this.outputColorSpace = '';
    }
    setSize() {}
    setPixelRatio() {}
    setClearColor() {}
    setClearAlpha() {}
    setAnimationLoop(cb) {
      // Run a single setup tick if animation loop builds dynamic state, but never loop infinitely
      this._loopCb = cb;
    }
    render() {}
    dispose() {}
  }

  class RoundedBoxGeometry extends RealTHREE.BoxGeometry {
    constructor(width = 1, height = 1, depth = 1) {
      super(width, height, depth);
      this.type = 'BoxGeometry';
    }
  }

  class DummyControls {
    constructor(camera, domElement) {
      this.object = camera;
      this.domElement = domElement || createMockElement('div');
      this.target = new RealTHREE.Vector3();
      this.enableDamping = false;
      this.autoRotate = false;
    }
    update() {}
    dispose() {}
    addEventListener() {}
    removeEventListener() {}
  }

  const shimmed = new Proxy(RealTHREE, {
    get(target, prop, receiver) {
      if (prop === 'Scene') return CapturedScene;
      if (prop === 'WebGLRenderer' || prop === 'WebGPURenderer') return DummyWebGLRenderer;
      if (prop === 'OrbitControls') return DummyControls;
      if (prop === 'RoundedBoxGeometry') return RoundedBoxGeometry;
      return Reflect.get(target, prop, receiver);
    },
  });

  return { shimmed, DummyControls, RoundedBoxGeometry };
}

/**
 * Rewrite static ES module `import` and `export` statements into sandbox calls
 * so `<script type="module">` blocks run synchronously in `vm.runInContext`.
 */
export function transformModuleCode(source) {
  let code = source;

  // Replace `import * as X from 'spec'`
  code = code.replace(
    /^\s*import\s+\*\s+as\s+([A-Za-z_$][\w$]*)\s+from\s+['"]([^'"]+)['"]\s*;?/gm,
    (_m, ns, spec) => `const ${ns} = __importModule(${JSON.stringify(spec)});`
  );

  // Replace `import Def, { a, b as c } from 'spec'`
  code = code.replace(
    /^\s*import\s+([A-Za-z_$][\w$]*)\s*,\s*\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]\s*;?/gm,
    (_m, defName, named, spec) => {
      const normalizedNamed = named.replace(/\s+as\s+/g, ': ');
      return `const __mod_${defName} = __importModule(${JSON.stringify(spec)}); const ${defName} = __mod_${defName}.default || __mod_${defName}; const { ${normalizedNamed} } = __mod_${defName};`;
    }
  );

  // Replace `import { a, b as c } from 'spec'` (supports multi-line braces!)
  code = code.replace(
    /^\s*import\s+\{([\s\S]*?)\}\s+from\s+['"]([^'"]+)['"]\s*;?/gm,
    (_m, named, spec) => {
      const normalizedNamed = named.replace(/\s+as\s+/g, ': ');
      return `const { ${normalizedNamed} } = __importModule(${JSON.stringify(spec)});`;
    }
  );

  // Replace `import Def from 'spec'`
  code = code.replace(
    /^\s*import\s+([A-Za-z_$][\w$]*)\s+from\s+['"]([^'"]+)['"]\s*;?/gm,
    (_m, defName, spec) =>
      `const ${defName} = ((m) => m.default || m)(__importModule(${JSON.stringify(spec)}));`
  );

  // Replace side-effect `import 'spec'`
  code = code.replace(/^\s*import\s+['"]([^'"]+)['"]\s*;?/gm, '');

  // Strip `export default` / `export const`
  code = code.replace(/^\s*export\s+default\s+/gm, 'globalThis.__defaultExport = ');
  code = code.replace(/^\s*export\s+(const|let|var|function|class)\s+/gm, '$1 ');
  code = code.replace(/^\s*export\s+\{[^}]*\}\s*;?/gm, '');

  return code;
}

function extractScriptsFromHtml(html) {
  let title = null;
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch) {
    title = titleMatch[1].trim();
  }

  // Check if there is an explicit <script id="voxel-data" type="application/json">
  let embeddedJsonData = null;
  const jsonBlockMatch = html.match(
    /<script[^>]*id=["']voxel-data["'][^>]*>([\s\S]*?)<\/script>/i
  );
  if (jsonBlockMatch) {
    try {
      embeddedJsonData = JSON.parse(jsonBlockMatch[1]);
    } catch {
      // Ignore malformed embedded JSON block
    }
  }

  const scripts = [];
  const scriptRegex = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = scriptRegex.exec(html)) !== null) {
    const attrs = match[1] || '';
    const body = match[2] || '';
    if (/\btype\s*=\s*["']importmap["']/i.test(attrs)) continue;
    if (/\btype\s*=\s*["']application\/(ld\+)?json["']/i.test(attrs)) continue;
    if (/\bsrc\s*=\s*["'][^"']+["']/i.test(attrs) && body.trim().length === 0) continue;
    if (body.trim().length > 0) {
      scripts.push(body);
    }
  }

  return { title, embeddedJsonData, scripts };
}

/**
 * Load and execute a `.html`, `.js`, or `.json` file to extract `__VOXEL_DATA__` and/or `THREE.Scene`.
 */
export async function loadInputSource(filePath) {
  const absPath = path.resolve(filePath);
  const ext = path.extname(absPath).toLowerCase();
  const rawText = await fs.readFile(absPath, 'utf-8');
  const baseName = path.basename(absPath, ext);

  if (ext === '.json') {
    const parsed = JSON.parse(rawText);
    return {
      title: parsed.name || baseName,
      voxelData: parsed,
      scene: null,
    };
  }

  let scripts = [rawText];
  let title = baseName;
  let embeddedJsonData = null;

  if (ext === '.html' || ext === '.htm' || rawText.trimStart().startsWith('<')) {
    const parsedHtml = extractScriptsFromHtml(rawText);
    if (parsedHtml.title) title = parsedHtml.title;
    embeddedJsonData = parsedHtml.embeddedJsonData;
    scripts = parsedHtml.scripts;
  }

  if (embeddedJsonData && scripts.length === 0) {
    return { title, voxelData: embeddedJsonData, scene: null };
  }

  const capturedScenes = [];
  const { shimmed: THREE, DummyControls, RoundedBoxGeometry } = buildShimmedThree(capturedScenes);

  const elementById = new Map();
  const bodyEl = createMockElement('body');
  const docEl = createMockElement('html');

  const mockDocument = {
    body: bodyEl,
    documentElement: docEl,
    title,
    createElement: (tag) => createMockElement(tag),
    getElementById: (id) => {
      if (!elementById.has(id)) elementById.set(id, createMockElement('div'));
      return elementById.get(id);
    },
    querySelector: () => createMockElement('div'),
    querySelectorAll: () => [],
    addEventListener() {},
    removeEventListener() {},
  };

  let rafCount = 0;
  const pendingRaf = [];

  const mockWindow = {
    innerWidth: 1280,
    innerHeight: 720,
    devicePixelRatio: 1,
    document: mockDocument,
    THREE,
    __VOXEL_DATA__: embeddedJsonData || null,
    addEventListener() {},
    removeEventListener() {},
    requestAnimationFrame(cb) {
      if (rafCount < 1 && typeof cb === 'function') {
        rafCount++;
        pendingRaf.push(cb);
      }
      return rafCount;
    },
    cancelAnimationFrame() {},
    setTimeout: (callback) => {
      if (typeof callback === 'function') callback();
      return 0;
    },
    clearTimeout() {},
    setInterval: () => 0,
    clearInterval() {},
    performance: { now: () => 16.67 },
    matchMedia: () => ({ matches: false, addEventListener() {} }),
  };

  function importModule(specifier) {
    const s = String(specifier);
    if (
      s === 'three' ||
      /\/three(\.module)?(\.min)?\.js$/i.test(s) ||
      /^https?:\/\/[^/]+\/(npm\/)?three(@[^/]+)?\/?$/i.test(s)
    ) {
      return THREE;
    }
    if (/OrbitControls|TrackballControls|MapControls|FlyControls/i.test(s)) {
      return {
        OrbitControls: DummyControls,
        TrackballControls: DummyControls,
        MapControls: DummyControls,
        FlyControls: DummyControls,
        default: DummyControls,
      };
    }
    if (/RoundedBoxGeometry/i.test(s)) {
      return { RoundedBoxGeometry, default: RoundedBoxGeometry };
    }
    // Generic chainable stub module for postprocessing, lil-gui, environments, etc.
    const stub = createChainableStub();
    return new Proxy(
      { default: stub },
      {
        get(_t, prop) {
          if (prop === '__esModule') return true;
          return createChainableStub();
        },
      }
    );
  }

  const sandbox = {
    window: mockWindow,
    self: mockWindow,
    globalThis: null,
    document: mockDocument,
    navigator: { userAgent: 'three2litematic-cli/1.0' },
    THREE,
    __importModule: importModule,
    requestAnimationFrame: mockWindow.requestAnimationFrame,
    cancelAnimationFrame: mockWindow.cancelAnimationFrame,
    performance: mockWindow.performance,
    setTimeout: mockWindow.setTimeout,
    clearTimeout: mockWindow.clearTimeout,
    setInterval: mockWindow.setInterval,
    clearInterval: mockWindow.clearInterval,
    console: {
      log() {},
      info() {},
      warn() {},
      error() {},
    },
    Math,
    Date,
    Array,
    Object,
    Number,
    String,
    Boolean,
    Map,
    Set,
    WeakMap,
    WeakSet,
    Promise,
    Symbol,
    RegExp,
    JSON,
    Error,
    TypeError,
    RangeError,
    Float32Array,
    Float64Array,
    Int8Array,
    Uint8Array,
    Uint8ClampedArray,
    Int16Array,
    Uint16Array,
    Int32Array,
    Uint32Array,
    DataView,
    ArrayBuffer,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
  };
  sandbox.globalThis = sandbox;
  mockWindow.window = mockWindow;

  const ctx = vm.createContext(sandbox);

  for (let i = 0; i < scripts.length; i++) {
    const transformed = transformModuleCode(scripts[i]);
    vm.runInContext(transformed, ctx, {
      filename: `${path.basename(absPath)}#script${i + 1}`,
      timeout: 8000,
    });
  }

  // Let async scene builders advance past their shimmed timer awaits before
  // inspecting the scene graph (common with staged generated HTML scenes).
  for (let i = 0; i < 3; i++) {
    await new Promise((resolve) => setImmediate(resolve));
  }

  // Flush single RAF callback if scene initializes inside first frame
  while (pendingRaf.length > 0) {
    const cb = pendingRaf.shift();
    try {
      cb(16.67);
    } catch {
      // Ignore render-time WebGL calls inside animation frame
    }
  }

  const voxelData =
    mockWindow.__VOXEL_DATA__ ||
    sandbox.__VOXEL_DATA__ ||
    embeddedJsonData ||
    null;

  // Pick scene with most meshes
  let bestScene = sandbox.scene?.isScene ? sandbox.scene : mockWindow.scene?.isScene ? mockWindow.scene : null;
  let bestMeshCount = -1;

  const candidates = [...capturedScenes];
  if (bestScene && !candidates.includes(bestScene)) candidates.push(bestScene);

  for (const sc of candidates) {
    let meshCount = 0;
    sc.traverse((o) => {
      if (o.isMesh || o.isInstancedMesh) meshCount++;
    });
    if (meshCount > bestMeshCount) {
      bestMeshCount = meshCount;
      bestScene = sc;
    }
  }

  return {
    title,
    voxelData,
    scene: bestScene,
  };
}
