import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  VERSION_PRESETS,
  BLOCK_FAMILIES,
  BLOCK_DATABASE,
  SLAB_DATABASE,
  BLOCK_BY_ID,
  getBlockNameZh,
  extractStructuredVoxels,
  extractSceneVoxels,
  buildBlockGrid,
  encodeLitematic,
  decodeLitematic,
  encodeSpongeSchem,
  decodeSpongeSchem,
  encodeMcFunction,
  resolveVerticalPlacement,
} from '/src/core/index.js';
import {
  buildMergedVoxelScene,
  applyFastLayerDrawRange,
  getBlockMaterialTexture,
  raycastVoxelDDA,
  updateVoxelSceneHighlight,
} from '/src/web/voxel-renderer.js';

// ==================== DOM References ====================
const activeAssetBadge = document.getElementById('activeAssetBadge');
const openLibraryBtn = document.getElementById('openLibraryBtn');
const assetCountBadge = document.getElementById('assetCountBadge');
const saveAssetBtn = document.getElementById('saveAssetBtn');
const fileInput = document.getElementById('fileInput');
const openEditorBtn = document.getElementById('openEditorBtn');
const exportFormatSelect = document.getElementById('exportFormatSelect');
const previewFormatBtn = document.getElementById('previewFormatBtn');
const exportBtn = document.getElementById('exportBtn');
const formatPreviewModal = document.getElementById('formatPreviewModal');
const closeFormatPreviewBtn = document.getElementById('closeFormatPreviewBtn');
const formatPreviewSubtitle = document.getElementById('formatPreviewSubtitle');
const formatPreviewLoading = document.getElementById('formatPreviewLoading');
const formatPreviewContent = document.getElementById('formatPreviewContent');
const formatPreviewBadge = document.getElementById('formatPreviewBadge');
const formatPreviewStatus = document.getElementById('formatPreviewStatus');
const formatPreviewDescription = document.getElementById('formatPreviewDescription');
const formatPreviewDimensions = document.getElementById('formatPreviewDimensions');
const formatPreviewBlocks = document.getElementById('formatPreviewBlocks');
const formatPreviewMaterials = document.getElementById('formatPreviewMaterials');
const formatPreviewOutput = document.getElementById('formatPreviewOutput');
const formatPreviewNote = document.getElementById('formatPreviewNote');
const downloadFormatPreviewBtn = document.getElementById('downloadFormatPreviewBtn');
const toggleGridPreviewBtn = document.getElementById('toggleGridPreviewBtn');
const deferredPreviewOverlay = document.getElementById('deferredPreviewOverlay');
const deferredPreviewStats = document.getElementById('deferredPreviewStats');
const showGridPreviewBtn = document.getElementById('showGridPreviewBtn');
const viewportsContainer = document.getElementById('viewportsContainer');
const sourceFrame = document.getElementById('sourceFrame');
const sourcePane = document.getElementById('sourcePane');
const sourcePlaceholder = document.getElementById('sourcePlaceholder');
const mcCanvasHost = document.getElementById('mcCanvasHost');
const statsBadge = document.getElementById('statsBadge');

// Viewport HUD
const syncCamBtn = document.getElementById('syncCamBtn');
const voxelInspector = document.getElementById('voxelInspector');
const inspSwatch = document.getElementById('inspSwatch');
const inspName = document.getElementById('inspName');
const inspCoord = document.getElementById('inspCoord');
const inspId = document.getElementById('inspId');
const inspActionHint = document.getElementById('inspActionHint');
const clearHighlightBtn = document.getElementById('clearHighlightBtn');
const renderStyleBtn = document.getElementById('renderStyleBtn');
const materialRenderStyleBtn = document.getElementById('materialRenderStyleBtn');

// Layer Slice Bar
const sliceModeBtn = document.getElementById('sliceModeBtn');
const layerDownBtn = document.getElementById('layerDownBtn');
const layerSlider = document.getElementById('layerSlider');
const layerUpBtn = document.getElementById('layerUpBtn');
const layerLabel = document.getElementById('layerLabel');
const resetCameraBtn = document.getElementById('resetCameraBtn');

// Style Presets Bar
const stylePresetSelect = document.getElementById('stylePresetSelect');
const openSavePresetBtn = document.getElementById('openSavePresetBtn');
const deletePresetBtn = document.getElementById('deletePresetBtn');
const savePresetInline = document.getElementById('savePresetInline');
const newPresetNameInput = document.getElementById('newPresetNameInput');
const confirmSavePresetBtn = document.getElementById('confirmSavePresetBtn');
const cancelSavePresetBtn = document.getElementById('cancelSavePresetBtn');

// Sidebar Parameter Panes & Controls
const paramPaneBasic = document.getElementById('paramPaneBasic');
const paramPaneAdvanced = document.getElementById('paramPaneAdvanced');
const schemNameInput = document.getElementById('schemNameInput');
const presetSelect = document.getElementById('presetSelect');
const scaleModeSelect = document.getElementById('scaleModeSelect');
const targetSizeInput = document.getElementById('targetSizeInput');
const targetSizeVal = document.getElementById('targetSizeVal');

const familyChipsEl = document.getElementById('familyChips');
const resetFamiliesBtn = document.getElementById('resetFamiliesBtn');

const useSlabsChk = document.getElementById('useSlabsChk');
const hollowInteriorChk = document.getElementById('hollowInteriorChk');
const excludeGravityChk = document.getElementById('excludeGravityChk');
const survivalFriendlyChk = document.getElementById('survivalFriendlyChk');
const preferSceneChk = document.getElementById('preferSceneChk');

const brightnessInput = document.getElementById('brightnessInput');
const brightnessVal = document.getElementById('brightnessVal');
const saturationInput = document.getElementById('saturationInput');
const saturationVal = document.getElementById('saturationVal');
const ditherInput = document.getElementById('ditherInput');
const ditherVal = document.getElementById('ditherVal');
const resetGradingBtn = document.getElementById('resetGradingBtn');

// Material List
const materialSummary = document.getElementById('materialSummary');
const copyMaterialsBtn = document.getElementById('copyMaterialsBtn');
const clearOverridesBtn = document.getElementById('clearOverridesBtn');
const clearDisabledBtn = document.getElementById('clearDisabledBtn');
const materialListEl = document.getElementById('materialList');

// Asset Library Modal
const assetLibraryModal = document.getElementById('assetLibraryModal');
const closeLibraryBtn = document.getElementById('closeLibraryBtn');
const libSearchInput = document.getElementById('libSearchInput');
const libExtFilter = document.getElementById('libExtFilter');
const saveAsCopyBtn = document.getElementById('saveAsCopyBtn');
const libSelectAllChk = document.getElementById('libSelectAllChk');
const libSelectedCount = document.getElementById('libSelectedCount');
const libBatchFormatSelect = document.getElementById('libBatchFormatSelect');
const libBatchExportBtn = document.getElementById('libBatchExportBtn');
const libBatchDeleteBtn = document.getElementById('libBatchDeleteBtn');
const assetCardsGrid = document.getElementById('assetCardsGrid');

// Block Replacement Picker Modal
const blockPickerModal = document.getElementById('blockPickerModal');
const pickerTitle = document.getElementById('pickerTitle');
const closePickerBtn = document.getElementById('closePickerBtn');
const pickerSearchInput = document.getElementById('pickerSearchInput');
const pickerGrid = document.getElementById('pickerGrid');

// Code Modal & Overlays
const editorModal = document.getElementById('editorModal');
const closeEditorBtn = document.getElementById('closeEditorBtn');
const codeTextarea = document.getElementById('codeTextarea');
const applyCodeBtn = document.getElementById('applyCodeBtn');
const dropOverlay = document.getElementById('dropOverlay');
const toastEl = document.getElementById('toast');

// World Map Editor DOM
const converterSidebarWrap = document.getElementById('converterSidebarWrap');
const worldSidebarWrap = document.getElementById('worldSidebarWrap');
const worldMapTitleBadge = document.getElementById('worldMapTitleBadge');
const jumpPlayerBtn = document.getElementById('jumpPlayerBtn');
const jumpSpawnBtn = document.getElementById('jumpSpawnBtn');
const focusFootprintBtn = document.getElementById('focusFootprintBtn');
const rescanCenterBtn = document.getElementById('rescanCenterBtn');
const toggleChunkGridBtn = document.getElementById('toggleChunkGridBtn');
const mapGotoXInput = document.getElementById('mapGotoXInput');
const mapGotoZInput = document.getElementById('mapGotoZInput');
const mapGotoBtn = document.getElementById('mapGotoBtn');
const mapViewResetBtn = document.getElementById('mapViewResetBtn');
const mapZoomOutBtn = document.getElementById('mapZoomOutBtn');
const mapZoomResetBtn = document.getElementById('mapZoomResetBtn');
const mapZoomInBtn = document.getElementById('mapZoomInBtn');
const worldCanvasWrap = document.getElementById('worldCanvasWrap');
const worldMapCanvas = document.getElementById('worldMapCanvas');
const worldEmptyOverlay = document.getElementById('worldEmptyOverlay');
const worldCursorInfo = document.getElementById('worldCursorInfo');
const worldFootprintInfo = document.getElementById('worldFootprintInfo');

const refreshWorldsBtn = document.getElementById('refreshWorldsBtn');
const worldSelect = document.getElementById('worldSelect');
const worldPathInput = document.getElementById('worldPathInput');
const loadWorldMapBtn = document.getElementById('loadWorldMapBtn');
const worldMetaBox = document.getElementById('worldMetaBox');
const worldVerBadge = document.getElementById('worldVerBadge');
const worldHeightRangeText = document.getElementById('worldHeightRangeText');
const worldSpawnText = document.getElementById('worldSpawnText');
const worldPlayerText = document.getElementById('worldPlayerText');
const worldLockWarn = document.getElementById('worldLockWarn');

const placeNearPlayerBtn = document.getElementById('placeNearPlayerBtn');
const placeNearSpawnBtn = document.getElementById('placeNearSpawnBtn');
const placeXInput = document.getElementById('placeXInput');
const placeYInput = document.getElementById('placeYInput');
const placeZInput = document.getElementById('placeZInput');
const autoGroundChk = document.getElementById('autoGroundChk');
const sampledGroundLabel = document.getElementById('sampledGroundLabel');
const groundOffsetInput = document.getElementById('groundOffsetInput');
const autoSinkChk = document.getElementById('autoSinkChk');
const topClearanceInput = document.getElementById('topClearanceInput');
const worldHeightFitStatus = document.getElementById('worldHeightFitStatus');
const mirrorXChk = document.getElementById('mirrorXChk');
const includeAirChk = document.getElementById('includeAirChk');
const fillVoidChk = document.getElementById('fillVoidChk');
const fillModeSelect = document.getElementById('fillModeSelect');
const fillBottomYField = document.getElementById('fillBottomYField');
const fillBottomYInput = document.getElementById('fillBottomYInput');
const fillMaterialSelect = document.getElementById('fillMaterialSelect');
const voidFillHint = document.getElementById('voidFillHint');
const commitPlaceBtn = document.getElementById('commitPlaceBtn');
const backupCountLabel = document.getElementById('backupCountLabel');
const maxBackupsInput = document.getElementById('maxBackupsInput');
const clearAllBackupsBtn = document.getElementById('clearAllBackupsBtn');
const backupSizeHint = document.getElementById('backupSizeHint');
const worldBackupList = document.getElementById('worldBackupList');

// ==================== Application State ====================
const state = {
  sourceKind: 'none', // 'html' | 'json' | 'litematic'
  sourceExt: 'html',
  rawHtml: '',
  rawBinaryBytes: null,
  rawBinaryBase64: null,
  voxelData: null,
  capturedScene: null,
  importedGrid: null,
  currentGrid: null,
  cellLookup: null,
  activeMeshes: [],
  blockTypeById: new Map(),
  lastMode: '',
  previewDeferred: false,
  activeViewTab: 'mc',
  preferLightBlocks: false,

  // Asset Management State
  currentAssetId: null, // null = unsaved draft, 'example:...' = builtin, '<slug>' = user library asset
  libraryAssets: [],
  libFilterTab: 'all', // 'all' | 'user' | 'fav' | 'builtin'
  selectedAssetIds: new Set(),

  // Style Presets State
  stylePresets: [],

  disabledBlocks: new Set(),
  disabledFamilies: new Set(),
  blockOverrides: new Map(),

  pickerSourceMaterial: null,
  pickerCategory: 'all',

  cameraSync: true,
  lightingMode: 'day',
  renderStyle: (() => {
    try {
      return localStorage.getItem('t2l_render_style') === 'color' ? 'color' : 'material';
    } catch {
      return 'material';
    }
  })(),
  singleLayerMode: false,
  sliceLevel: 1,
  highlightedBlockId: null,

  mcBaseTarget: new THREE.Vector3(8, 6, 8),
  mcBaseDist: 24,
  sourceBaseTarget: new THREE.Vector3(0, 0, 0),
  sourceBaseDist: 24,
  sourceOrigAutoRotate: false,
  sourceBaselineCaptured: false,
};

let toastTimer = null;
function showToast(msg, duration = 2800) {
  toastEl.textContent = msg;
  toastEl.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.add('hidden'), duration);
}

function updateActiveAssetHeaderUI() {
  const id = state.currentAssetId;
  if (!id) {
    activeAssetBadge.textContent = '未入库草稿';
    activeAssetBadge.classList.remove('saved');
    saveAssetBtn.textContent = '💾 存入资产库';
  } else if (String(id).startsWith('example:')) {
    activeAssetBadge.textContent = '内置示例';
    activeAssetBadge.classList.remove('saved');
    saveAssetBtn.textContent = '💾 存为我的资产';
  } else {
    activeAssetBadge.textContent = '📁 已存资产';
    activeAssetBadge.classList.add('saved');
    saveAssetBtn.textContent = '💾 更新保存';
  }
}

function uint8ToBase64(u8) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < u8.length; i += chunk) {
    binary += String.fromCharCode(...u8.subarray(i, i + chunk));
  }
  return btoa(binary);
}

// ==================== High-Performance On-Demand Three.js Renderer ====================
const mcScene = new THREE.Scene();
mcScene.background = new THREE.Color('#0c1018');

const mcCamera = new THREE.PerspectiveCamera(48, 1, 0.1, 2500);
mcCamera.position.set(36, 30, 36);

const mcRenderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: 'high-performance',
  preserveDrawingBuffer: false,
});
mcRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
mcRenderer.outputColorSpace = THREE.SRGBColorSpace;
mcCanvasHost.appendChild(mcRenderer.domElement);

const mcControls = new OrbitControls(mcCamera, mcRenderer.domElement);
mcControls.enableDamping = true;
mcControls.dampingFactor = 0.1;

const hemiLight = new THREE.HemisphereLight(0xeef6ff, 0x556070, 0.9);
mcScene.add(hemiLight);

const sunLight = new THREE.DirectionalLight(0xfffaf0, 1.05);
sunLight.position.set(65, 115, 80);
mcScene.add(sunLight);

const fillLight = new THREE.DirectionalLight(0x9ab8ff, 0.35);
fillLight.position.set(-60, 40, -70);
mcScene.add(fillLight);

const buildGroup = new THREE.Group();
mcScene.add(buildGroup);

const pointLightGroup = new THREE.Group();
mcScene.add(pointLightGroup);

const hoverEdgesGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.04, 1.04, 1.04));
const hoverWireframeMat = new THREE.LineBasicMaterial({
  color: 0x38bdf8,
  depthTest: true,
  transparent: true,
  opacity: 0.95,
});
const hoverBoxMesh = new THREE.LineSegments(hoverEdgesGeo, hoverWireframeMat);
hoverBoxMesh.visible = false;
mcScene.add(hoverBoxMesh);

let floorGridHelper = null;
let needsMcRender = true;
let dampingFramesLeft = 0;

function requestRender() {
  needsMcRender = true;
}

function resizeMcViewport() {
  const rect = mcCanvasHost.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;
  mcCamera.aspect = rect.width / rect.height;
  mcCamera.updateProjectionMatrix();
  mcRenderer.setSize(rect.width, rect.height, false);
  requestRender();
}

let resizeRaf = 0;
new ResizeObserver(() => {
  cancelAnimationFrame(resizeRaf);
  resizeRaf = requestAnimationFrame(resizeMcViewport);
}).observe(mcCanvasHost);

function renderOffscreenPixels(width, height) {
  const rt = new THREE.WebGLRenderTarget(width, height, {
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
    colorSpace: THREE.SRGBColorSpace,
  });

  const prevAspect = mcCamera.aspect;
  const prevGridVis = floorGridHelper ? floorGridHelper.visible : false;
  const prevHoverVis = hoverBoxMesh.visible;

  if (floorGridHelper) floorGridHelper.visible = false;
  hoverBoxMesh.visible = false;
  mcCamera.aspect = width / height;
  mcCamera.updateProjectionMatrix();

  const prevTarget = mcRenderer.getRenderTarget();
  mcRenderer.setRenderTarget(rt);
  mcRenderer.clear();
  mcRenderer.render(mcScene, mcCamera);

  const rgba = new Uint8Array(width * height * 4);
  mcRenderer.readRenderTargetPixels(rt, 0, 0, width, height, rgba);

  mcRenderer.setRenderTarget(prevTarget);
  rt.dispose();

  mcCamera.aspect = prevAspect;
  mcCamera.updateProjectionMatrix();
  if (floorGridHelper) floorGridHelper.visible = prevGridVis;
  hoverBoxMesh.visible = prevHoverVis;
  requestRender();
  return rgba;
}

function capturePreviewThumbnail140() {
  const size = 140;
  const rgba = renderOffscreenPixels(size, size);
  const argb = new Int32Array(size * size);
  for (let y = 0; y < size; y++) {
    const srcRow = size - 1 - y;
    for (let x = 0; x < size; x++) {
      const si = (srcRow * size + x) * 4;
      argb[y * size + x] = (0xff << 24) | (rgba[si] << 16) | (rgba[si + 1] << 8) | rgba[si + 2];
    }
  }
  return argb;
}

function captureCoverPngDataUrl(width = 240, height = 152) {
  if (!state.currentGrid) return null;
  const rgba = renderOffscreenPixels(width, height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(width, height);
  for (let y = 0; y < height; y++) {
    const srcRow = height - 1 - y;
    for (let x = 0; x < width; x++) {
      const si = (srcRow * width + x) * 4;
      const di = (y * width + x) * 4;
      imgData.data[di] = rgba[si];
      imgData.data[di + 1] = rgba[si + 1];
      imgData.data[di + 2] = rgba[si + 2];
      imgData.data[di + 3] = 255;
    }
  }
  ctx.putImageData(imgData, 0, 0);
  return canvas.toDataURL('image/png');
}

function captureLightweightCoverPngDataUrl(width = 240, height = 152) {
  const source = worldState.footprintCanvas;
  if (!source) return null;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0c1018';
  ctx.fillRect(0, 0, width, height);
  const scale = Math.min((width - 20) / source.width, (height - 20) / source.height);
  const drawWidth = Math.max(1, Math.round(source.width * scale));
  const drawHeight = Math.max(1, Math.round(source.height * scale));
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(source, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
  return canvas.toDataURL('image/png');
}

// ==================== Bidirectional Camera Sync ====================
let isSyncingCamera = false;
let userInteractingMc = false;

mcControls.addEventListener('start', () => {
  userInteractingMc = true;
  dampingFramesLeft = 45;
  requestRender();
});
mcControls.addEventListener('end', () => {
  userInteractingMc = false;
  dampingFramesLeft = 45;
});
mcControls.addEventListener('change', () => {
  needsMcRender = true;
  if (userInteractingMc && state.cameraSync) {
    syncMcToSource();
  }
});

function captureSourceCameraBaseline() {
  const win = sourceFrame.contentWindow;
  if (!win) return false;
  const srcCtrl = win.__CAPTURED_CONTROLS__;
  const srcCam = win.__CAPTURED_CAMERA__ || srcCtrl?.object;
  if (!srcCam) return false;

  if (srcCtrl && srcCtrl.target) {
    state.sourceBaseTarget.copy(srcCtrl.target);
    state.sourceOrigAutoRotate = Boolean(srcCtrl.autoRotate);
    if (state.cameraSync) {
      srcCtrl.autoRotate = false;
    }
  } else {
    state.sourceBaseTarget.set(0, 0, 0);
  }

  const d = srcCam.position.distanceTo(state.sourceBaseTarget);
  state.sourceBaseDist = Math.max(1, d);
  state.sourceBaselineCaptured = true;
  return true;
}

function syncMcToSource() {
  if (!state.cameraSync || isSyncingCamera || state.sourceKind !== 'html') return;
  const win = sourceFrame.contentWindow;
  if (!win) return;
  if (!state.sourceBaselineCaptured) {
    captureSourceCameraBaseline();
  }
  const srcCtrl = win.__CAPTURED_CONTROLS__;
  const srcCam = win.__CAPTURED_CAMERA__ || srcCtrl?.object;
  if (!srcCam) return;

  isSyncingCamera = true;
  try {
    const ratio = state.sourceBaseDist / Math.max(1, state.mcBaseDist);
    const panDelta = mcControls.target.clone().sub(state.mcBaseTarget).multiplyScalar(ratio);
    const camOffset = mcCamera.position.clone().sub(mcControls.target).multiplyScalar(ratio);

    const nextTarget = state.sourceBaseTarget.clone().add(panDelta);
    if (srcCtrl && srcCtrl.target) {
      srcCtrl.autoRotate = false;
      srcCtrl.target.copy(nextTarget);
      if (srcCtrl._sphericalDelta) srcCtrl._sphericalDelta.set(0, 0, 0);
      if (srcCtrl._panOffset) srcCtrl._panOffset.set(0, 0, 0);
    }
    srcCam.position.copy(nextTarget).add(camOffset);
    srcCam.lookAt(nextTarget);
    if (srcCtrl && typeof srcCtrl.update === 'function') {
      srcCtrl.update();
    }
    win.__FORCE_SOURCE_RENDER__ = true;
  } finally {
    isSyncingCamera = false;
  }
}

function syncSourceToMc() {
  if (!state.cameraSync || isSyncingCamera || state.sourceKind !== 'html') return;
  const win = sourceFrame.contentWindow;
  if (!win) return;
  if (!state.sourceBaselineCaptured) {
    captureSourceCameraBaseline();
  }
  const srcCtrl = win.__CAPTURED_CONTROLS__;
  const srcCam = win.__CAPTURED_CAMERA__ || srcCtrl?.object;
  if (!srcCam || !srcCtrl) return;

  isSyncingCamera = true;
  try {
    const invRatio = state.mcBaseDist / Math.max(1, state.sourceBaseDist);
    const panDelta = srcCtrl.target.clone().sub(state.sourceBaseTarget).multiplyScalar(invRatio);
    const camOffset = srcCam.position.clone().sub(srcCtrl.target).multiplyScalar(invRatio);

    mcControls.target.copy(state.mcBaseTarget).add(panDelta);
    mcCamera.position.copy(mcControls.target).add(camOffset);
    mcCamera.lookAt(mcControls.target);
    mcControls.update();
    requestRender();
  } finally {
    isSyncingCamera = false;
  }
}

// ==================== Smooth Camera Preset Animation ====================
let camTween = null;

function animateCameraToPreset(presetName) {
  if (!state.currentGrid) return;
  const target = state.mcBaseTarget.clone();
  const dist = state.mcBaseDist;
  const destPos = target.clone();

  switch (presetName) {
    case 'front':
      destPos.add(new THREE.Vector3(0, dist * 0.14, dist * 1.18));
      break;
    case 'side':
      destPos.add(new THREE.Vector3(dist * 1.18, dist * 0.14, 0));
      break;
    case 'top':
      destPos.add(new THREE.Vector3(0, dist * 1.38, 0.01));
      break;
    case 'iso':
    default:
      destPos.set(
        target.x + (dist / 1.35) * 0.82,
        target.y + (dist / 1.35) * 0.68,
        target.z + (dist / 1.35) * 0.82
      );
      break;
  }

  camTween = {
    startPos: mcCamera.position.clone(),
    endPos: destPos,
    startTarget: mcControls.target.clone(),
    endTarget: target,
    startTime: performance.now(),
    duration: 220,
  };
  requestRender();
}

function animateMcPreview(now) {
  requestAnimationFrame(animateMcPreview);

  if (camTween) {
    const t = Math.min(1, (now - camTween.startTime) / camTween.duration);
    const ease = 1 - Math.pow(1 - t, 3);
    mcCamera.position.lerpVectors(camTween.startPos, camTween.endPos, ease);
    mcControls.target.lerpVectors(camTween.startTarget, camTween.endTarget, ease);
    mcControls.update();
    if (state.cameraSync) syncMcToSource();
    needsMcRender = true;
    if (t >= 1) camTween = null;
  } else if (userInteractingMc || dampingFramesLeft > 0) {
    if (!userInteractingMc) dampingFramesLeft--;
    const moved = mcControls.update();
    if (moved) {
      needsMcRender = true;
      if (state.cameraSync) syncMcToSource();
    } else if (!userInteractingMc) {
      dampingFramesLeft = 0;
    }
  }

  if (needsMcRender) {
    needsMcRender = false;
    mcRenderer.render(mcScene, mcCamera);
  }
}
requestAnimationFrame(animateMcPreview);

// ==================== Lighting Presets & Clustered Emissive PointLights ====================
function rebuildEmissivePointLights(blocks) {
  while (pointLightGroup.children.length > 0) {
    const l = pointLightGroup.children.pop();
    if (l.dispose) l.dispose();
  }

  if (state.lightingMode === 'day' || !blocks || blocks.length === 0) return;
  const emissives = blocks.filter((b) => b.block.category === 'emissive');
  if (emissives.length === 0) return;

  const clusters = [];
  const clusterRadiusSq = 81;

  for (const item of emissives) {
    let joined = null;
    for (const c of clusters) {
      const dx = item.x - c.sumX / c.count;
      const dy = item.y - c.sumY / c.count;
      const dz = item.z - c.sumZ / c.count;
      if (dx * dx + dy * dy + dz * dz <= clusterRadiusSq) {
        joined = c;
        break;
      }
    }
    if (joined) {
      joined.sumX += item.x + 0.5;
      joined.sumY += item.y + 0.5;
      joined.sumZ += item.z + 0.5;
      joined.count += 1;
    } else if (clusters.length < 6) {
      clusters.push({
        sumX: item.x + 0.5,
        sumY: item.y + 0.5,
        sumZ: item.z + 0.5,
        count: 1,
        hex: item.block.hex,
      });
    }
  }

  const baseStrength = state.lightingMode === 'night' ? 18 : 9;
  const maxDim = state.currentGrid
    ? Math.max(state.currentGrid.width, state.currentGrid.height, state.currentGrid.length, 16)
    : 24;

  for (const c of clusters) {
    const boost = Math.min(2.2, 1 + Math.log2(c.count) * 0.25);
    const pl = new THREE.PointLight(
      new THREE.Color(c.hex),
      baseStrength * boost,
      Math.max(20, maxDim * 0.68),
      1.6
    );
    pl.position.set(c.sumX / c.count, c.sumY / c.count, c.sumZ / c.count);
    pointLightGroup.add(pl);
  }
}

function applyLightingPreset(mode) {
  state.lightingMode = mode;
  if (mode === 'night') {
    mcScene.background.set('#05070d');
    hemiLight.color.setHex(0x3b4c7a);
    hemiLight.groundColor.setHex(0x0d111c);
    hemiLight.intensity = 0.22;
    sunLight.color.setHex(0x7aa2f7);
    sunLight.intensity = 0.24;
    sunLight.position.set(-55, 90, -45);
    fillLight.color.setHex(0x334155);
    fillLight.intensity = 0.1;
  } else if (mode === 'sunset') {
    mcScene.background.set('#15101d');
    hemiLight.color.setHex(0xffb48a);
    hemiLight.groundColor.setHex(0x2d2342);
    hemiLight.intensity = 0.5;
    sunLight.color.setHex(0xff8c42);
    sunLight.intensity = 1.35;
    sunLight.position.set(95, 34, 48);
    fillLight.color.setHex(0x6366f1);
    fillLight.intensity = 0.28;
  } else {
    mcScene.background.set('#0c1018');
    hemiLight.color.setHex(0xeef6ff);
    hemiLight.groundColor.setHex(0x556070);
    hemiLight.intensity = 0.9;
    sunLight.color.setHex(0xfffaf0);
    sunLight.intensity = 1.05;
    sunLight.position.set(65, 115, 80);
    fillLight.color.setHex(0x9ab8ff);
    fillLight.intensity = 0.35;
  }
  if (state.currentGrid && !state.previewDeferred) renderGridInViewport(state.currentGrid, false);
}

function fitCameraToGrid(grid) {
  const cx = grid.width * 0.5;
  const cy = grid.height * 0.42;
  const cz = grid.length * 0.5;
  const maxDim = Math.max(grid.width, grid.height, grid.length, 8);
  const dist = maxDim * 1.45;

  state.mcBaseTarget.set(cx, cy, cz);
  mcControls.target.set(cx, cy, cz);
  mcCamera.position.set(cx + dist * 0.82, cy + dist * 0.68, cz + dist * 0.82);
  state.mcBaseDist = mcCamera.position.distanceTo(mcControls.target);

  mcCamera.near = 0.1;
  mcCamera.far = Math.max(2000, maxDim * 12);
  mcCamera.updateProjectionMatrix();
  mcControls.update();

  if (state.cameraSync) syncMcToSource();
  requestRender();
}

function clearBuildGroupMeshes() {
  while (buildGroup.children.length > 0) {
    const child = buildGroup.children.pop();
    if (child.geometry) child.geometry.dispose();
    if (child.material) child.material.dispose();
  }
  state.activeMeshes = [];
  state.blockTypeById = new Map();
}

function setImportedPreviewDeferred(deferred, resetCam = false) {
  state.previewDeferred = Boolean(deferred && state.sourceKind === 'litematic');
  const isImportedBlueprint = state.sourceKind === 'litematic' && Boolean(state.importedGrid);
  toggleGridPreviewBtn.classList.toggle('hidden', !isImportedBlueprint);
  deferredPreviewOverlay.classList.toggle('hidden', !isImportedBlueprint || !state.previewDeferred);
  const litematicOption = exportFormatSelect.querySelector('option[value="litematic"]');
  litematicOption.textContent = state.previewDeferred
    ? '.litematic (轻量，无缩略图)'
    : '.litematic (含缩略图)';

  if (!isImportedBlueprint) return;

  const grid = state.currentGrid;
  if (grid) {
    deferredPreviewStats.textContent =
      `${grid.width} × ${grid.height} × ${grid.length} · ${grid.blocks.length.toLocaleString()} 个非空气方块`;
  }

  toggleGridPreviewBtn.textContent = state.previewDeferred ? '🧊 渲染 3D 预览' : '♻️ 释放 3D 网格';
  toggleGridPreviewBtn.title = state.previewDeferred
    ? '按需生成完整 3D 网格，可能额外占用内存与显卡资源'
    : '移除 3D 网格以释放显卡资源；方块数据仍可用于格式转换与存档操作';

  if (state.previewDeferred) {
    clearBuildGroupMeshes();
    state.cellLookup = null;
    if (floorGridHelper) {
      mcScene.remove(floorGridHelper);
      floorGridHelper.geometry.dispose();
      floorGridHelper.material.dispose();
      floorGridHelper = null;
    }
    rebuildEmissivePointLights([]);
    hoverBoxMesh.visible = false;
    voxelInspector.classList.add('hidden');
    requestRender();
  } else if (grid) {
    deferredPreviewOverlay.classList.add('hidden');
    renderGridInViewport(grid, resetCam);
    maybeCacheActiveAssetWebglThumb();
  }
}

toggleGridPreviewBtn.addEventListener('click', () => {
  setImportedPreviewDeferred(!state.previewDeferred, true);
});
showGridPreviewBtn.addEventListener('click', () => {
  setImportedPreviewDeferred(false, true);
});

function renderGridInViewport(grid, resetCam = false) {
  clearBuildGroupMeshes();

  if (floorGridHelper) {
    mcScene.remove(floorGridHelper);
    floorGridHelper.geometry.dispose();
    floorGridHelper.material.dispose();
    floorGridHelper = null;
  }

  const maxSpan = Math.max(grid.width, grid.length, 8);
  const gridSize = Math.ceil(maxSpan / 2) * 2 + 4;
  floorGridHelper = new THREE.GridHelper(gridSize, gridSize, 0x334155, 0x1a2333);
  floorGridHelper.position.set(grid.width * 0.5, -0.01, grid.length * 0.5);
  mcScene.add(floorGridHelper);

  const built = buildMergedVoxelScene(grid, {
    lightingMode: state.lightingMode,
    renderStyle: state.renderStyle,
  });

  state.cellLookup = built.cellLookup;
  state.blockTypeById = built.blockTypeById;
  state.activeMeshes = built.meshes;
  updateVoxelSceneHighlight(state.activeMeshes, state.blockTypeById, state.highlightedBlockId);

  for (const m of built.meshes) {
    buildGroup.add(m);
  }

  applyFastLayerDrawRange(state.activeMeshes, {
    sliceLevel: state.sliceLevel,
    singleLayerMode: state.singleLayerMode,
    height: grid.height,
  });

  rebuildEmissivePointLights(grid.blocks);

  if (resetCam) fitCameraToGrid(grid);
  else requestRender();
}

function updateRenderStyleUI() {
  const materialMode = state.renderStyle === 'material';
  const buttonText = materialMode ? '🧱 材质模式' : '🎨 颜色模式';
  const buttonTitle = materialMode
    ? '当前使用内置 Voxel Craft 16px 材质包，点击切换为纯颜色预览'
    : '当前使用方块代表色预览，点击切换为内置 Voxel Craft 16px 材质包';
  renderStyleBtn.textContent = buttonText;
  renderStyleBtn.title = buttonTitle;
  renderStyleBtn.classList.toggle('active', materialMode);
  renderStyleBtn.classList.toggle('color-mode', !materialMode);

  materialRenderStyleBtn.textContent = materialMode ? '🧱 材质' : '🎨 颜色';
  materialRenderStyleBtn.title = buttonTitle;
  materialRenderStyleBtn.classList.toggle('active', materialMode);
  materialRenderStyleBtn.classList.toggle('color-mode', !materialMode);
}

function toggleRenderStyle() {
  state.renderStyle = state.renderStyle === 'material' ? 'color' : 'material';
  try {
    localStorage.setItem('t2l_render_style', state.renderStyle);
  } catch {
    // Ignore storage restrictions.
  }
  updateRenderStyleUI();
  if (state.currentGrid) {
    if (!state.previewDeferred) renderGridInViewport(state.currentGrid, false);
    renderMaterialListUI(state.currentGrid.materials);
  }
  showToast(state.renderStyle === 'material' ? '已切换为材质模式：Voxel Craft 16px 材质包' : '已切换为颜色模式：使用方块代表色');
}

renderStyleBtn.addEventListener('click', toggleRenderStyle);
materialRenderStyleBtn.addEventListener('click', toggleRenderStyle);

updateRenderStyleUI();

function updateSliceRangeFast() {
  if (!state.currentGrid) return;
  applyFastLayerDrawRange(state.activeMeshes, {
    sliceLevel: state.sliceLevel,
    singleLayerMode: state.singleLayerMode,
    height: state.currentGrid.height,
  });
  requestRender();
}

// ==================== 3D DDA Voxel Raycast Hover & Click ====================
const raycaster = new THREE.Raycaster();
const pointerNdc = new THREE.Vector2();
let pointerDownPos = { x: 0, y: 0 };
let lastHoveredVoxel = null;
let pendingHoverX = 0;
let pendingHoverY = 0;
let hoverPickRaf = 0;

function pickVoxelAtClientPos(clientX, clientY) {
  if (!state.currentGrid || !state.cellLookup) return null;
  const rect = mcCanvasHost.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;

  pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(pointerNdc, mcCamera);
  return raycastVoxelDDA(raycaster.ray, state.currentGrid, state.cellLookup, {
    sliceLevel: state.sliceLevel,
    singleLayerMode: state.singleLayerMode,
  });
}

function updateInspectorUI(voxel) {
  if (voxel === lastHoveredVoxel && voxel !== null) return;
  lastHoveredVoxel = voxel;

  if (!voxel && !state.highlightedBlockId) {
    voxelInspector.classList.add('hidden');
    if (hoverBoxMesh.visible) {
      hoverBoxMesh.visible = false;
      requestRender();
    }
    return;
  }

  if (voxel) {
    const isSlab = Boolean(voxel.block.isSlab);
    const yOff = isSlab ? (voxel.block.slabHalf === 'top' ? 0.75 : 0.25) : 0.5;
    hoverBoxMesh.scale.set(1, isSlab ? 0.5 : 1, 1);
    hoverBoxMesh.position.set(voxel.x + 0.5, voxel.y + yOff, voxel.z + 0.5);
    hoverBoxMesh.visible = true;
    requestRender();

    inspSwatch.style.background = voxel.block.hex;
    inspName.textContent = getBlockNameZh(voxel.block.id, voxel.block.nameZh);
    inspCoord.textContent = `X:${voxel.x} Y:${voxel.y} Z:${voxel.z}`;
    inspId.textContent = voxel.block.id;
    voxelInspector.classList.remove('hidden');
  } else if (hoverBoxMesh.visible) {
    hoverBoxMesh.visible = false;
    requestRender();
  }

  const isPinned = Boolean(state.highlightedBlockId);
  voxelInspector.classList.toggle('pinned', isPinned);
  clearHighlightBtn.classList.toggle('hidden', !isPinned);
  inspActionHint.textContent = isPinned ? '正透视高亮同类块' : '点击透视高亮同类块';
}

function setHighlightedBlockId(blockId, sampleInfo = null) {
  state.highlightedBlockId = state.highlightedBlockId === blockId ? null : blockId;
  lastHoveredVoxel = null;
  if (state.currentGrid) {
    if (!state.previewDeferred) {
      updateVoxelSceneHighlight(state.activeMeshes, state.blockTypeById, state.highlightedBlockId);
      requestRender();
    }
    for (const row of materialListEl.querySelectorAll('.mat-row')) {
      row.classList.toggle('highlighted', row.dataset.blockId === state.highlightedBlockId);
    }
  }
  if (state.previewDeferred) return;
  if (state.highlightedBlockId && sampleInfo) {
    inspSwatch.style.background = sampleInfo.hex;
    inspName.textContent = getBlockNameZh(sampleInfo.id, sampleInfo.nameZh);
    inspId.textContent = sampleInfo.id;
    inspCoord.textContent = sampleInfo.count ? `共 ${sampleInfo.count} 块` : inspCoord.textContent;
    voxelInspector.classList.remove('hidden');
  }
  updateInspectorUI(null);
}

mcCanvasHost.addEventListener('pointerdown', (e) => {
  pointerDownPos = { x: e.clientX, y: e.clientY };
});
mcCanvasHost.addEventListener('pointermove', (e) => {
  if (e.buttons !== 0) return;
  pendingHoverX = e.clientX;
  pendingHoverY = e.clientY;
  if (hoverPickRaf) return;
  hoverPickRaf = requestAnimationFrame(() => {
    hoverPickRaf = 0;
    updateInspectorUI(pickVoxelAtClientPos(pendingHoverX, pendingHoverY));
  });
});
mcCanvasHost.addEventListener('pointerleave', () => {
  lastHoveredVoxel = null;
  if (hoverBoxMesh.visible) {
    hoverBoxMesh.visible = false;
    requestRender();
  }
  if (!state.highlightedBlockId) voxelInspector.classList.add('hidden');
});
mcCanvasHost.addEventListener('pointerup', (e) => {
  if (e.button !== 0) return;
  if (Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y) > 4) return;
  const hit = pickVoxelAtClientPos(e.clientX, e.clientY);
  if (hit) {
    setHighlightedBlockId(hit.block.id, hit.block);
    updateInspectorUI(hit);
  } else if (state.highlightedBlockId) {
    setHighlightedBlockId(null);
  }
});
clearHighlightBtn.addEventListener('click', () => setHighlightedBlockId(null));

// ==================== Config Snapshot Serialization (Per-Asset & Presets) ====================
function serializeCurrentConfig() {
  return {
    versionPreset: presetSelect.value,
    scaleMode: scaleModeSelect.value,
    targetSize: Number(targetSizeInput.value) || 64,
    useSlabs: useSlabsChk.checked,
    hollowInterior: hollowInteriorChk.checked,
    excludeGravity: excludeGravityChk.checked,
    survivalFriendly: survivalFriendlyChk.checked,
    preferScene: preferSceneChk.checked,
    preferLightBlocks: state.preferLightBlocks,
    brightness: Number(brightnessInput.value) || 0,
    saturation: Number(saturationInput.value ?? 100),
    ditherStrength: Number(ditherInput.value) || 0,
    disabledBlocks: Array.from(state.disabledBlocks),
    disabledFamilies: Array.from(state.disabledFamilies),
    blockOverrides: Object.fromEntries(state.blockOverrides.entries()),
  };
}

function resetConfigToDefaults() {
  applyConfigSnapshot({
    versionPreset: '1.21',
    scaleMode: 'auto',
    targetSize: 64,
    useSlabs: false,
    hollowInterior: false,
    excludeGravity: true,
    survivalFriendly: true,
    preferScene: false,
    preferLightBlocks: false,
    brightness: 0,
    saturation: 100,
    ditherStrength: 0,
    disabledBlocks: [],
    disabledFamilies: [],
    blockOverrides: {},
  });
}

function applyConfigSnapshot(cfg, { keepScaleAndVersion = false } = {}) {
  if (!cfg) return;
  if (!keepScaleAndVersion) {
    if (cfg.versionPreset && VERSION_PRESETS[cfg.versionPreset]) {
      presetSelect.value = cfg.versionPreset;
    }
    if (cfg.scaleMode) scaleModeSelect.value = cfg.scaleMode;
    if (cfg.targetSize != null) {
      targetSizeInput.value = String(cfg.targetSize);
      targetSizeVal.textContent = String(cfg.targetSize);
    }
    if (cfg.preferScene !== undefined) preferSceneChk.checked = Boolean(cfg.preferScene);
  }

  if (cfg.useSlabs !== undefined) useSlabsChk.checked = Boolean(cfg.useSlabs);
  if (cfg.hollowInterior !== undefined) hollowInteriorChk.checked = Boolean(cfg.hollowInterior);
  if (cfg.excludeGravity !== undefined) excludeGravityChk.checked = Boolean(cfg.excludeGravity);
  if (cfg.survivalFriendly !== undefined) survivalFriendlyChk.checked = Boolean(cfg.survivalFriendly);
  state.preferLightBlocks = Boolean(cfg.preferLightBlocks);

  const br = Number(cfg.brightness) || 0;
  const sat = cfg.saturation != null ? Number(cfg.saturation) : 100;
  const dith = Number(cfg.ditherStrength) || 0;

  brightnessInput.value = String(br);
  brightnessVal.textContent = br > 0 ? `+${br}` : `${br}`;
  saturationInput.value = String(sat);
  saturationVal.textContent = `${sat}%`;
  ditherInput.value = String(dith);
  ditherVal.textContent = `${dith}%`;

  state.disabledBlocks = new Set(Array.isArray(cfg.disabledBlocks) ? cfg.disabledBlocks : []);
  state.disabledFamilies = new Set(Array.isArray(cfg.disabledFamilies) ? cfg.disabledFamilies : []);
  state.blockOverrides = new Map(Object.entries(cfg.blockOverrides || {}));

  renderFamilyChipsUI();
}

// ==================== Style & Override Presets Library ====================
async function refreshPresetsList(selectedId = '') {
  try {
    const res = await fetch('/api/presets');
    const data = await res.json();
    state.stylePresets = data.presets || [];
  } catch {
    state.stylePresets = [];
  }

  stylePresetSelect.innerHTML = '<option value="">🎨 套用调色/替换预设...</option>';
  for (const p of state.stylePresets) {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.builtIn ? p.name : `⭐ ${p.name}`;
    stylePresetSelect.appendChild(opt);
  }
  stylePresetSelect.value = selectedId || '';
  const activePreset = state.stylePresets.find((p) => p.id === stylePresetSelect.value);
  deletePresetBtn.classList.toggle('hidden', !activePreset || activePreset.builtIn);
}

stylePresetSelect.addEventListener('change', () => {
  const pid = stylePresetSelect.value;
  const preset = state.stylePresets.find((p) => p.id === pid);
  deletePresetBtn.classList.toggle('hidden', !preset || preset.builtIn);
  if (!preset) return;
  applyConfigSnapshot(preset.config, { keepScaleAndVersion: true });
  try {
    rebuildSchematic(false);
    showToast(`已套用预设「${preset.name}」`);
  } catch (err) {
    showToast(err.message);
  }
});

openSavePresetBtn.addEventListener('click', () => {
  savePresetInline.classList.toggle('hidden');
  if (!savePresetInline.classList.contains('hidden')) {
    newPresetNameInput.value = '';
    newPresetNameInput.focus();
  }
});

cancelSavePresetBtn.addEventListener('click', () => {
  savePresetInline.classList.add('hidden');
});

confirmSavePresetBtn.addEventListener('click', async () => {
  const name = newPresetNameInput.value.trim();
  if (!name) {
    showToast('请输入预设方案名称');
    return;
  }
  try {
    const res = await fetch('/api/presets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        config: serializeCurrentConfig(),
      }),
    });
    const data = await res.json();
    savePresetInline.classList.add('hidden');
    await refreshPresetsList(data.preset?.id || '');
    showToast(`🎉 已保存可复用预设「${name}」`);
  } catch (err) {
    showToast(`保存预设失败: ${err.message}`);
  }
});

deletePresetBtn.addEventListener('click', async () => {
  const pid = stylePresetSelect.value;
  const preset = state.stylePresets.find((p) => p.id === pid);
  if (!preset || preset.builtIn) return;
  await fetch(`/api/presets/${encodeURIComponent(pid)}`, { method: 'DELETE' });
  await refreshPresetsList('');
  showToast(`已删除预设「${preset.name}」`);
});

// ==================== Disk-Persisted Asset Library Center ====================
async function refreshLibraryAssets() {
  try {
    const res = await fetch('/api/library/assets');
    const data = await res.json();
    state.libraryAssets = data.assets || [];
    assetCountBadge.textContent = String(state.libraryAssets.length);
    // Clean up deleted IDs from selection set
    const validIds = new Set(state.libraryAssets.map((a) => a.id));
    for (const sid of Array.from(state.selectedAssetIds)) {
      if (!validIds.has(sid)) state.selectedAssetIds.delete(sid);
    }
    if (!assetLibraryModal.classList.contains('hidden')) {
      renderAssetLibraryGrid();
    }
  } catch (err) {
    console.warn('刷新资产库失败:', err);
  }
}

function getFilteredLibraryAssets() {
  const q = libSearchInput.value.trim().toLowerCase();
  const tab = state.libFilterTab;
  const extFilter = libExtFilter.value;

  return state.libraryAssets.filter((a) => {
    if (tab === 'user' && a.kind !== 'user') return false;
    if (tab === 'fav' && !a.favorite) return false;
    if (tab === 'builtin' && a.kind !== 'builtin') return false;

    if (extFilter === 'html' && !['html', 'js'].includes(a.sourceExt)) return false;
    if (extFilter === 'json' && a.sourceExt !== 'json') return false;
    if (extFilter === 'schem' && !['litematic', 'schem'].includes(a.sourceExt)) return false;

    if (q) {
      const hay = `${a.name} ${a.sourceExt} ${(a.tags || []).join(' ')}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function updateBatchSelectionBarUI(filteredList) {
  const count = state.selectedAssetIds.size;
  libSelectedCount.textContent = String(count);
  libBatchExportBtn.disabled = count === 0;
  const hasSelectedUserAssets = Array.from(state.selectedAssetIds).some(
    (id) => !String(id).startsWith('example:')
  );
  libBatchDeleteBtn.disabled = !hasSelectedUserAssets;
  libSelectAllChk.checked =
    filteredList.length > 0 && filteredList.every((a) => state.selectedAssetIds.has(a.id));
}

function renderAssetLibraryGrid() {
  const list = getFilteredLibraryAssets();
  updateBatchSelectionBarUI(list);
  assetCardsGrid.innerHTML = '';

  if (list.length === 0) {
    assetCardsGrid.innerHTML = `<div style="grid-column:1/-1;padding:42px;text-align:center;color:var(--text-muted);font-size:13px;">暂无匹配的资产。你可以点击顶栏「💾 存入资产库」或直接拖入多个文件批量入库！</div>`;
    return;
  }

  const frag = document.createDocumentFragment();

  for (const asset of list) {
    const isUser = asset.kind === 'user';
    const isOpen = state.currentAssetId === asset.id;
    const card = document.createElement('div');
    card.className = 'asset-card' + (isOpen ? ' current-open' : '');

    const thumbWrap = document.createElement('div');
    thumbWrap.className = 'asset-thumb-wrap';

    // Selection Checkbox
    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.className = 'asset-select-chk';
    chk.checked = state.selectedAssetIds.has(asset.id);
    chk.addEventListener('click', (e) => e.stopPropagation());
    chk.addEventListener('change', () => {
      if (chk.checked) state.selectedAssetIds.add(asset.id);
      else state.selectedAssetIds.delete(asset.id);
      updateBatchSelectionBarUI(list);
    });
    thumbWrap.appendChild(chk);

    // Favorite Star (User Assets)
    if (isUser) {
      const favBtn = document.createElement('button');
      favBtn.className = 'asset-fav-btn' + (asset.favorite ? ' fav' : '');
      favBtn.textContent = asset.favorite ? '★' : '☆';
      favBtn.title = asset.favorite ? '取消收藏置顶' : '收藏并置顶';
      favBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await fetch(`/api/library/assets/${encodeURIComponent(asset.id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ favorite: !asset.favorite }),
        });
        await refreshLibraryAssets();
      });
      thumbWrap.appendChild(favBtn);
    }

    if (asset.thumbnailUrl) {
      const img = document.createElement('img');
      img.className = 'cover-img';
      img.src = asset.thumbnailUrl;
      img.alt = asset.name;
      thumbWrap.appendChild(img);
    } else {
      const fb = document.createElement('div');
      fb.className = 'asset-fallback-icon';
      fb.innerHTML = `<img src="/src/web/assets/icon-64.png" width="38" height="38" style="opacity:0.85;border-radius:8px" alt="" /><span>点击加载预览</span>`;
      thumbWrap.appendChild(fb);
    }

    const extBadge = document.createElement('span');
    extBadge.className = 'asset-ext-badge';
    extBadge.textContent = isUser ? asset.sourceExt.toUpperCase() : `示例 · ${asset.sourceExt.toUpperCase()}`;
    thumbWrap.appendChild(extBadge);

    const hasCustomCfg =
      asset.config &&
      ((asset.config.disabledFamilies?.length || 0) > 0 ||
        (asset.config.disabledBlocks?.length || 0) > 0 ||
        Object.keys(asset.config.blockOverrides || {}).length > 0 ||
        asset.config.useSlabs ||
        asset.config.ditherStrength > 0);

    if (hasCustomCfg) {
      const cfgBadge = document.createElement('span');
      cfgBadge.className = 'asset-cfg-badge';
      cfgBadge.textContent = '含专属配置';
      thumbWrap.appendChild(cfgBadge);
    }

    thumbWrap.addEventListener('click', () => {
      openAssetFromLibrary(asset);
      assetLibraryModal.classList.add('hidden');
    });

    const body = document.createElement('div');
    body.className = 'asset-body';

    const titleRow = document.createElement('div');
    titleRow.className = 'asset-title-row';

    const titleEl = document.createElement('div');
    titleEl.className = 'asset-title';
    titleEl.textContent = asset.name;
    titleEl.title = asset.name;
    titleEl.addEventListener('click', () => {
      openAssetFromLibrary(asset);
      assetLibraryModal.classList.add('hidden');
    });
    titleRow.appendChild(titleEl);

    const metaLine = document.createElement('div');
    metaLine.className = 'asset-meta-line';
    const dimText = asset.dimensions
      ? `${asset.dimensions.width}×${asset.dimensions.height}×${asset.dimensions.length} · ${asset.blockCount} 块`
      : '内置可交互作品';
    const dateText = asset.updatedAt
      ? new Date(asset.updatedAt).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
      : '';
    metaLine.innerHTML = `<span>${dimText}</span><span>${dateText}</span>`;

    const actions = document.createElement('div');
    actions.className = 'asset-card-actions';

    const openBtn = document.createElement('button');
    openBtn.className = 'btn-mini active-mode';
    openBtn.textContent = isOpen ? '当前打开' : '打开';
    openBtn.addEventListener('click', () => {
      openAssetFromLibrary(asset);
      assetLibraryModal.classList.add('hidden');
    });
    actions.appendChild(openBtn);

    if (isUser) {
      const renBtn = document.createElement('button');
      renBtn.className = 'btn-mini';
      renBtn.textContent = '重命名';
      renBtn.addEventListener('click', () => {
        const inp = document.createElement('input');
        inp.type = 'text';
        inp.value = asset.name;
        inp.style.width = '100%';
        inp.style.fontSize = '12px';
        inp.style.padding = '2px 5px';
        titleRow.replaceChild(inp, titleEl);
        inp.focus();
        inp.select();

        const commit = async () => {
          const nextName = inp.value.trim();
          if (nextName && nextName !== asset.name) {
            await fetch(`/api/library/assets/${encodeURIComponent(asset.id)}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: nextName }),
            });
            if (state.currentAssetId === asset.id) {
              schemNameInput.value = nextName;
            }
          }
          await refreshLibraryAssets();
        };
        inp.addEventListener('keydown', (ke) => {
          if (ke.key === 'Enter') inp.blur();
          if (ke.key === 'Escape') refreshLibraryAssets();
        });
        inp.addEventListener('blur', commit, { once: true });
      });

      const delBtn = document.createElement('button');
      delBtn.className = 'btn-mini';
      delBtn.style.color = 'var(--danger)';
      delBtn.textContent = '删除';
      delBtn.addEventListener('click', async () => {
        await fetch(`/api/library/assets/${encodeURIComponent(asset.id)}`, { method: 'DELETE' });
        if (state.currentAssetId === asset.id) {
          state.currentAssetId = null;
          updateActiveAssetHeaderUI();
        }
        await refreshLibraryAssets();
        showToast(`已删除资产「${asset.name}」`);
      });

      actions.append(renBtn, delBtn);
    } else {
      const forkBtn = document.createElement('button');
      forkBtn.className = 'btn-mini';
      forkBtn.textContent = '克隆入库';
      forkBtn.title = '复制一份到“我的资产”以便自定义参数与封面';
      forkBtn.addEventListener('click', async () => {
        const srcRes = await fetch(asset.sourceUrl);
        const text = await srcRes.text();
        const saveRes = await fetch('/api/library/assets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: `${asset.name}_副本`,
            sourceExt: asset.sourceExt,
            sourceText: text,
            tags: ['克隆示例'],
          }),
        });
        const saved = await saveRes.json();
        state.libFilterTab = 'user';
        document.querySelectorAll('[data-libtab]').forEach((b) =>
          b.classList.toggle('active', b.dataset.libtab === 'user')
        );
        await refreshLibraryAssets();
        showToast(`已克隆为我的资产「${saved.asset?.name}」`);
      });
      actions.appendChild(forkBtn);
    }

    body.append(titleRow, metaLine, actions);
    card.append(thumbWrap, body);
    frag.appendChild(card);
  }

  assetCardsGrid.appendChild(frag);
}

async function maybeCacheActiveAssetWebglThumb() {
  if (!state.currentAssetId || !state.currentGrid) return;
  const asset = state.libraryAssets.find((a) => a.id === state.currentAssetId);
  if (!asset || asset.thumbKind === 'webgl') return;

  try {
    const thumbnailDataUrl = captureCoverPngDataUrl(240, 152);
    if (!thumbnailDataUrl) return;
    const res = await fetch(`/api/library/cache-thumb/${encodeURIComponent(asset.id)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        versionStamp: asset.versionStamp,
        thumbnailDataUrl,
      }),
    });
    const data = await res.json();
    if (data.updated) {
      asset.thumbKind = 'webgl';
      const base = asset.kind === 'user'
        ? `/api/library/assets/${encodeURIComponent(asset.id)}/thumbnail`
        : `/api/library/cache-thumb/${encodeURIComponent(asset.id)}`;
      asset.thumbnailUrl = `${base}?v=${data.versionStamp || asset.versionStamp}&w=1`;
    }
  } catch {
    // Non-fatal background cache upgrade
  }
}

async function openAssetFromLibrary(asset) {
  try {
    if (asset.config) {
      applyConfigSnapshot(asset.config);
    } else {
      resetConfigToDefaults();
    }

    state.currentAssetId = asset.id;
    updateActiveAssetHeaderUI();

    const res = await fetch(asset.sourceUrl);
    const ext = asset.sourceExt || 'html';

    if (ext === 'litematic' || ext === 'schem') {
      const buf = await res.arrayBuffer();
      const u8 = new Uint8Array(buf);
      state.rawBinaryBytes = u8;
      state.rawBinaryBase64 = null;
      state.sourceExt = ext;
      const decoded = ext === 'schem' ? await decodeSpongeSchem(u8) : await decodeLitematic(u8);
      state.sourceKind = 'litematic';
      state.importedGrid = decoded;
      state.previewDeferred = true;
      state.highlightedBlockId = null;
      updateInspectorUI(null);
      schemNameInput.value = asset.name;
      sourceFrame.classList.add('hidden');
      sourcePane.classList.remove('clean-scene-preview');
      sourcePlaceholder.classList.remove('hidden');
      rebuildSchematic(true);
      if (!state.previewDeferred) maybeCacheActiveAssetWebglThumb();
      showToast(`已打开资产: ${asset.name}`);
      return;
    }

    const text = await res.text();
    state.rawBinaryBytes = null;
    state.rawBinaryBase64 = null;
    state.sourceExt = ext;

    if (ext === 'json') {
      const parsed = JSON.parse(text);
      state.sourceKind = 'json';
      state.rawHtml = text;
      state.voxelData = parsed;
      state.capturedScene = null;
      state.importedGrid = null;
      state.highlightedBlockId = null;
      updateInspectorUI(null);
      codeTextarea.value = text;
      schemNameInput.value = asset.name;
      sourceFrame.classList.add('hidden');
      sourcePane.classList.remove('clean-scene-preview');
      sourcePlaceholder.classList.remove('hidden');
      rebuildSchematic(true);
      maybeCacheActiveAssetWebglThumb();
      showToast(`已打开资产: ${asset.name}`);
      return;
    }

    loadHtmlScene(text, asset.name, { keepAssetBinding: true });
  } catch (err) {
    showToast(`打开资产失败: ${err.message}`, 3800);
  }
}

async function saveCurrentSceneToLibrary({ asCopy = false } = {}) {
  if (!state.currentGrid) {
    showToast('当前没有可保存的场景');
    return;
  }

  const isExistingUserAsset =
    !asCopy && state.currentAssetId && !String(state.currentAssetId).startsWith('example:');
  const baseName = (schemNameInput.value || 'Voxel_Asset').trim();
  const finalName = asCopy ? `${baseName}_副本` : baseName;
  const thumbnailDataUrl = state.previewDeferred
    ? captureLightweightCoverPngDataUrl(240, 152)
    : captureCoverPngDataUrl(240, 152);

  const payload = {
    id: isExistingUserAsset ? state.currentAssetId : null,
    name: finalName,
    sourceExt: state.sourceExt || 'html',
    thumbnailDataUrl,
    dimensions: {
      width: state.currentGrid.width,
      height: state.currentGrid.height,
      length: state.currentGrid.length,
    },
    blockCount: state.currentGrid.blocks.length,
    materialCount: state.currentGrid.materials.length,
    config: serializeCurrentConfig(),
  };

  if (state.sourceKind === 'litematic' && (state.rawBinaryBytes || state.rawBinaryBase64)) {
    payload.sourceBase64 = state.rawBinaryBase64 || uint8ToBase64(state.rawBinaryBytes);
  } else {
    payload.sourceText = codeTextarea.value || state.rawHtml;
  }

  try {
    const res = await fetch('/api/library/assets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    state.currentAssetId = data.asset.id;
    schemNameInput.value = data.asset.name;
    updateActiveAssetHeaderUI();
    await refreshLibraryAssets();
    showToast(
      isExistingUserAsset
        ? `✅ 已更新资产「${data.asset.name}」（含 3D 封面与专属参数）`
        : `🎉 已存入本地资产库「${data.asset.name}」(library/assets/${data.asset.id})`
    );
  } catch (err) {
    showToast(`保存资产失败: ${err.message}`, 4000);
  }
}

openLibraryBtn.addEventListener('click', async () => {
  assetLibraryModal.classList.remove('hidden');
  await refreshLibraryAssets();
  renderAssetLibraryGrid();
});

closeLibraryBtn.addEventListener('click', () => assetLibraryModal.classList.add('hidden'));
saveAssetBtn.addEventListener('click', () => saveCurrentSceneToLibrary({ asCopy: false }));
saveAsCopyBtn.addEventListener('click', () => saveCurrentSceneToLibrary({ asCopy: true }));

libSearchInput.addEventListener('input', renderAssetLibraryGrid);
libExtFilter.addEventListener('change', renderAssetLibraryGrid);

for (const tbtn of document.querySelectorAll('[data-libtab]')) {
  tbtn.addEventListener('click', () => {
    document.querySelectorAll('[data-libtab]').forEach((b) => b.classList.remove('active'));
    tbtn.classList.add('active');
    state.libFilterTab = tbtn.dataset.libtab;
    renderAssetLibraryGrid();
  });
}

libSelectAllChk.addEventListener('change', () => {
  const visible = getFilteredLibraryAssets();
  if (libSelectAllChk.checked) {
    for (const a of visible) state.selectedAssetIds.add(a.id);
  } else {
    for (const a of visible) state.selectedAssetIds.delete(a.id);
  }
  renderAssetLibraryGrid();
});

libBatchExportBtn.addEventListener('click', async () => {
  const ids = Array.from(state.selectedAssetIds);
  if (ids.length === 0) return;
  const fmt = libBatchFormatSelect.value;
  libBatchExportBtn.disabled = true;
  libBatchExportBtn.textContent = '⏳ 正在转换打包...';

  try {
    const res = await fetch('/api/library/batch-export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ids,
        format: fmt,
        fallbackPreset: presetSelect.value,
      }),
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || `HTTP ${res.status}`);
    }
    const fnameHeader = res.headers.get('X-Export-Filename');
    const filename = fnameHeader ? decodeURIComponent(fnameHeader) : `batch-export.${ids.length > 1 ? 'zip' : fmt}`;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`🎉 已批量导出 ${ids.length} 个资产 → ${filename}！`, 4000);
  } catch (err) {
    showToast(`批量导出失败: ${err.message}`, 4000);
  } finally {
    libBatchExportBtn.disabled = false;
    libBatchExportBtn.textContent = '📦 批量打包导出';
  }
});

libBatchDeleteBtn.addEventListener('click', async () => {
  const userIds = Array.from(state.selectedAssetIds).filter(
    (id) => !String(id).startsWith('example:')
  );
  if (userIds.length === 0) return;
  for (const id of userIds) {
    await fetch(`/api/library/assets/${encodeURIComponent(id)}`, { method: 'DELETE' });
    state.selectedAssetIds.delete(id);
    if (state.currentAssetId === id) {
      state.currentAssetId = null;
      updateActiveAssetHeaderUI();
    }
  }
  await refreshLibraryAssets();
  showToast(`已批量删除 ${userIds.length} 个资产`);
});

// ==================== Material Family Chips & Manual Block Picker ====================
function renderFamilyChipsUI() {
  familyChipsEl.innerHTML = '';
  resetFamiliesBtn.classList.toggle('hidden', state.disabledFamilies.size === 0);

  for (const fam of BLOCK_FAMILIES) {
    const chip = document.createElement('button');
    const isOff = state.disabledFamilies.has(fam.key);
    chip.className = 'fam-chip' + (isOff ? ' disabled' : '');
    chip.textContent = fam.label;
    chip.title = isOff ? `点击重新启用 ${fam.label}` : `点击禁用全部 ${fam.label}`;
    chip.addEventListener('click', () => {
      if (state.disabledFamilies.has(fam.key)) state.disabledFamilies.delete(fam.key);
      else state.disabledFamilies.add(fam.key);
      try {
        rebuildSchematic(false);
        renderFamilyChipsUI();
      } catch (err) {
        state.disabledFamilies.delete(fam.key);
        renderFamilyChipsUI();
        showToast(err.message);
      }
    });
    familyChipsEl.appendChild(chip);
  }
}

function openBlockPickerForMaterial(matRowEntry) {
  state.pickerSourceMaterial = matRowEntry;
  pickerTitle.textContent = `🎨 将「${matRowEntry.nameZh}」手动替换为...`;
  pickerSearchInput.value = '';
  renderPickerGrid();
  blockPickerModal.classList.remove('hidden');
  setTimeout(() => pickerSearchInput.focus(), 30);
}

function renderPickerGrid() {
  const preset = VERSION_PRESETS[presetSelect.value] || VERSION_PRESETS['1.21'];
  const query = pickerSearchInput.value.trim().toLowerCase();
  const cat = state.pickerCategory;

  const allCandidates = [...BLOCK_DATABASE, ...SLAB_DATABASE].filter((blk) => {
    if (blk.minMinor > preset.maxMinor) return false;
    if (cat === 'solid' && (blk.category !== 'solid' || blk.isSlab)) return false;
    if (cat === 'slab' && !blk.isSlab) return false;
    if (cat === 'translucent' && blk.category !== 'translucent') return false;
    if (cat === 'emissive' && blk.category !== 'emissive') return false;
    if (query) {
      return blk.nameZh.toLowerCase().includes(query) || blk.id.toLowerCase().includes(query);
    }
    return true;
  });

  pickerGrid.innerHTML = '';

  for (const cand of allCandidates) {
    const btn = document.createElement('button');
    btn.className = 'picker-item';
    btn.innerHTML = `
      <span class="mat-swatch" style="background:${cand.hex}"></span>
      <div style="min-width:0;flex:1">
        <div class="p-name">${cand.nameZh}</div>
        <div class="p-id">${cand.id.replace('minecraft:', '')}</div>
      </div>
    `;
    btn.addEventListener('click', () => {
      const src = state.pickerSourceMaterial;
      if (!src) return;
      const sourceIds = src.overriddenFrom?.length > 0 ? [...src.overriddenFrom, src.id] : [src.id];
      for (const sid of sourceIds) {
        if (sid === cand.id) state.blockOverrides.delete(sid);
        else state.blockOverrides.set(sid, cand.id);
      }
      if (state.highlightedBlockId === src.id) state.highlightedBlockId = cand.id;
      blockPickerModal.classList.add('hidden');
      rebuildSchematic(false);
      showToast(`已将「${src.nameZh}」手动替换为「${cand.nameZh}」`);
    });
    pickerGrid.appendChild(btn);
  }
}

closePickerBtn.addEventListener('click', () => blockPickerModal.classList.add('hidden'));
pickerSearchInput.addEventListener('input', renderPickerGrid);
for (const cbtn of document.querySelectorAll('[data-pcat]')) {
  cbtn.addEventListener('click', () => {
    document.querySelectorAll('[data-pcat]').forEach((b) => b.classList.remove('active'));
    cbtn.classList.add('active');
    state.pickerCategory = cbtn.dataset.pcat;
    renderPickerGrid();
  });
}

// ==================== Conversion & Sidebar Updates ====================
function getConversionOptions() {
  return {
    versionPreset: presetSelect.value,
    scaleMode: scaleModeSelect.value,
    targetSize: Number(targetSizeInput.value) || 64,
    useSlabs: useSlabsChk.checked,
    hollowInterior: hollowInteriorChk.checked,
    excludeGravity: excludeGravityChk.checked,
    survivalFriendly: survivalFriendlyChk.checked,
    preferLightBlocks: state.preferLightBlocks,
    brightness: Number(brightnessInput.value) || 0,
    saturation: Number(saturationInput.value ?? 100),
    ditherStrength: Number(ditherInput.value) || 0,
    disabledBlocks: state.disabledBlocks,
    disabledFamilies: state.disabledFamilies,
    blockOverrides: state.blockOverrides,
  };
}

function formatStackText(count) {
  const stacks = Math.floor(count / 64);
  const rem = count % 64;
  if (stacks === 0) return `${rem} 个`;
  if (rem === 0) return `${stacks} 组`;
  return `${stacks} 组 + ${rem}`;
}

function updateLayerLabelUI() {
  const max = Number(layerSlider.max) || 1;
  const val = state.sliceLevel;
  if (state.singleLayerMode) {
    layerLabel.textContent = `第 ${val} / ${max} 层`;
  } else {
    layerLabel.textContent = val >= max ? `全部 (${max} 层)` : `1 ~ ${val} / ${max} 层`;
  }
}

function renderMaterialListUI(materials) {
  materialSummary.textContent = `(${materials.length} 种)`;
  clearDisabledBtn.classList.toggle('hidden', state.disabledBlocks.size === 0);
  clearOverridesBtn.classList.toggle('hidden', state.blockOverrides.size === 0);
  materialListEl.innerHTML = '';

  const canModify = state.sourceKind !== 'litematic';
  const frag = document.createDocumentFragment();

  for (const m of materials) {
    const row = document.createElement('div');
    row.className = 'mat-row' + (state.highlightedBlockId === m.id ? ' highlighted' : '');
    row.dataset.blockId = m.id;

    const swatch = document.createElement('div');
    swatch.className = 'mat-swatch';
    const blockDefinition = BLOCK_BY_ID.get(m.id) || m;
    if (state.renderStyle === 'material') {
      swatch.style.backgroundColor = m.hex;
      swatch.style.backgroundImage = `url("${getBlockMaterialTexture(blockDefinition)}")`;
    } else {
      swatch.style.backgroundImage = 'none';
      swatch.style.backgroundColor = m.hex;
    }

    const badgeHtml =
      m.overriddenFrom && m.overriddenFrom.length > 0
        ? `<span class="override-badge" title="手动替换自: ${m.overriddenFrom.map((id) => BLOCK_BY_ID.get(id)?.nameZh || id).join(', ')}">手动</span>`
        : '';

    const info = document.createElement('div');
    info.className = 'mat-info';
    const nameEl = document.createElement('div');
    nameEl.className = 'mat-name';
    nameEl.textContent = getBlockNameZh(m.id, m.nameZh);
    if (badgeHtml) nameEl.insertAdjacentHTML('beforeend', badgeHtml);
    const idEl = document.createElement('div');
    idEl.className = 'mat-id';
    idEl.textContent = m.id;
    info.append(nameEl, idEl);

    const countEl = document.createElement('div');
    countEl.className = 'mat-count';
    countEl.innerHTML = `<strong>${m.count}</strong><span>${formatStackText(m.count)}</span>`;

    row.append(swatch, info, countEl);

    row.addEventListener('click', (e) => {
      if (e.target.closest('.mat-actions')) return;
      setHighlightedBlockId(m.id, m);
    });

    if (canModify) {
      const actions = document.createElement('div');
      actions.className = 'mat-actions';

      const repBtn = document.createElement('button');
      repBtn.className = 'mat-replace-btn';
      repBtn.title = '手动指定替换成其他任意 Minecraft 方块';
      repBtn.textContent = '替换';
      repBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openBlockPickerForMaterial(m);
      });

      const banBtn = document.createElement('button');
      banBtn.className = 'mat-ban-btn';
      banBtn.title = '禁用此方块并自动顺延匹配';
      banBtn.textContent = '禁用';
      banBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (state.highlightedBlockId === m.id) state.highlightedBlockId = null;
        state.disabledBlocks.add(m.id);
        rebuildSchematic(false);
        showToast(`已禁用 ${m.nameZh}，自动替换为相近方块`);
      });

      actions.append(repBtn, banBtn);
      row.appendChild(actions);
    }

    frag.appendChild(row);
  }

  materialListEl.appendChild(frag);
}

function rebuildSchematic(resetCam = false) {
  if (state.sourceKind === 'litematic' && state.importedGrid) {
    const g = state.importedGrid;
    state.currentGrid = g;
    layerSlider.max = String(g.height);
    if (resetCam || state.sliceLevel > g.height) {
      state.sliceLevel = g.height;
      layerSlider.value = String(g.height);
    }
    updateLayerLabelUI();
    statsBadge.textContent = `${g.width}×${g.height}×${g.length} · ${g.blocks.length} 块 (导入蓝图)`;
    setImportedPreviewDeferred(state.previewDeferred, resetCam);
    renderMaterialListUI(g.materials);
    exportBtn.disabled = false;
    previewFormatBtn.disabled = false;
    onCurrentGridUpdatedForWorldMap();
    return;
  }

  const opts = getConversionOptions();
  const useStructured =
    !preferSceneChk.checked &&
    state.voxelData &&
    (Array.isArray(state.voxelData) || Array.isArray(state.voxelData.voxels));

  let extracted;
  if (useStructured) {
    extracted = extractStructuredVoxels(state.voxelData, opts);
  } else if (state.capturedScene) {
    extracted = extractSceneVoxels(state.capturedScene, opts);
  } else if (state.voxelData) {
    extracted = extractStructuredVoxels(state.voxelData, opts);
  } else {
    return;
  }

  const grid = buildBlockGrid(extracted.voxels, opts);
  state.currentGrid = grid;
  state.previewDeferred = false;
  setImportedPreviewDeferred(false);
  state.lastMode = extracted.mode;

  if (
    state.highlightedBlockId &&
    !grid.materials.some((m) => m.id === state.highlightedBlockId)
  ) {
    state.highlightedBlockId = null;
    updateInspectorUI(null);
  }

  layerSlider.max = String(grid.height);
  if (resetCam || !state.singleLayerMode) {
    state.sliceLevel = grid.height;
    layerSlider.value = String(grid.height);
  } else {
    state.sliceLevel = Math.min(state.sliceLevel, grid.height);
    layerSlider.value = String(state.sliceLevel);
  }
  updateLayerLabelUI();

  const modeTag =
    extracted.mode === 'structured'
      ? '1:1 标准体素'
      : extracted.mode === 'native-voxel-mesh'
      ? '1:1 体素网格'
      : extracted.mode === 'grid-1to1'
      ? '1:1 网格直提'
      : '网格体素化';
  const slabNote = grid.slabCount > 0 ? ` · 含半砖 ${grid.slabCount}` : '';
  const hollowNote = grid.hollowedCount > 0 ? ` · 省 ${grid.hollowedCount} 块` : '';
  statsBadge.textContent = `${grid.width}×${grid.height}×${grid.length} · ${grid.blocks.length} 块 (${modeTag}${slabNote}${hollowNote})`;

  renderGridInViewport(grid, resetCam);
  renderMaterialListUI(grid.materials);
  exportBtn.disabled = grid.blocks.length === 0;
  previewFormatBtn.disabled = grid.blocks.length === 0;
  onCurrentGridUpdatedForWorldMap();
}

// ==================== HTML Sandbox Bridge & Multi-File Import ====================
function prepareBridgedHtml(rawSource) {
  let html = rawSource.trim();

  if (!/<html|<body|<script/i.test(html)) {
    html = `<!DOCTYPE html><html><head><style>html,body{margin:0;height:100%;overflow:hidden;background:#111;}</style></head><body><script type="module">\n${html}\n</script></body></html>`;
  }

  html = html.replace(
    /from\s+['"]https?:\/\/[^'"]*\/three(\.module)?(\.min)?\.js['"]/gi,
    "from 'three'"
  );
  html = html.replace(
    /from\s+['"]https?:\/\/[^'"]*\/examples\/jsm\/([^'"]+)['"]/gi,
    "from 'three/addons/$1'"
  );

  const bridgeImportMap = `<script type="importmap">
{
  "imports": {
    "three": "/src/web/three-bridge.js",
    "three/addons/controls/OrbitControls.js": "/src/web/orbit-bridge.js",
    "three/addons/": "/node_modules/three/examples/jsm/"
  }
}
</script>`;
  const cleanPreviewScript = '<script src="/src/web/scene-preview.js"></script>';

  if (/<script[^>]*type=["']importmap["'][^>]*>[\s\S]*?<\/script>/i.test(html)) {
    html = html.replace(
      /<script[^>]*type=["']importmap["'][^>]*>[\s\S]*?<\/script>/i,
      bridgeImportMap
    );
  } else if (/<head[^>]*>/i.test(html)) {
    html = html.replace(/<head[^>]*>/i, (m) => `${m}\n${bridgeImportMap}`);
  } else {
    html = `${bridgeImportMap}\n${html}`;
  }

  if (/<\/body>/i.test(html)) {
    html = html.replace(/<\/body>/i, `${cleanPreviewScript}\n</body>`);
  } else {
    html += `\n${cleanPreviewScript}`;
  }

  return html;
}

function loadHtmlScene(rawHtml, suggestedName = '', { keepAssetBinding = false } = {}) {
  if (!keepAssetBinding) {
    state.currentAssetId = null;
    updateActiveAssetHeaderUI();
  }
  state.sourceKind = 'html';
  state.sourceExt = 'html';
  state.rawHtml = rawHtml;
  state.rawBinaryBytes = null;
  state.rawBinaryBase64 = null;
  state.voxelData = null;
  state.capturedScene = null;
  state.importedGrid = null;
  setImportedPreviewDeferred(false);
  state.highlightedBlockId = null;
  state.sourceBaselineCaptured = false;
  lastHoveredVoxel = null;
  updateInspectorUI(null);
  codeTextarea.value = rawHtml;

  const titleMatch = rawHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (suggestedName) {
    schemNameInput.value = suggestedName;
  } else if (titleMatch && titleMatch[1].trim()) {
    schemNameInput.value = titleMatch[1].trim().replace(/\s+/g, '_');
  }

  sourcePlaceholder.classList.add('hidden');
  sourceFrame.classList.remove('hidden');
  sourcePane.classList.add('clean-scene-preview');

  const bridged = prepareBridgedHtml(rawHtml);
  let extractedOnce = false;
  let lastSceneSignature = '';
  let stableSceneReads = 0;

  const tryExtractFromIframe = () => {
    if (extractedOnce) return;
    const win = sourceFrame.contentWindow;
    if (!win) return;

    win.__ON_SOURCE_CAMERA_CHANGE__ = syncSourceToMc;

    const vData = win.__VOXEL_DATA__ || null;
    let scene = win.__CAPTURED_SCENE__ || win.scene || null;
    if (!scene && Array.isArray(win.__CAPTURED_SCENES__) && win.__CAPTURED_SCENES__.length > 0) {
      scene = win.__CAPTURED_SCENES__[win.__CAPTURED_SCENES__.length - 1];
    }

    if (!vData && !scene) return;

    let meshCount = 0;
    let vertexCount = 0;
    if (scene?.traverse) {
      scene.traverse((obj) => {
        if (!obj.isMesh && !obj.isInstancedMesh) return;
        meshCount++;
        vertexCount += obj.geometry?.attributes?.position?.count || obj.count || 0;
      });
    }
    const signature = `${meshCount}:${vertexCount}`;
    if (signature === lastSceneSignature && meshCount > 0) {
      stableSceneReads++;
    } else {
      stableSceneReads = 0;
      lastSceneSignature = signature;
    }
    if (!vData && stableSceneReads < 2) return;

    extractedOnce = true;
    state.voxelData = vData;
    state.capturedScene = scene;

    if (vData?.name && !suggestedName) {
      schemNameInput.value = vData.name;
    }

    captureSourceCameraBaseline();
    try {
      rebuildSchematic(true);
      maybeCacheActiveAssetWebglThumb();
    } catch (err) {
      showToast(`转换出错: ${err.message}`, 4000);
    }
  };

  sourceFrame.onload = () => {
    const win = sourceFrame.contentWindow;
    if (win) {
      win.__NOTIFY_SCENE_READY__ = tryExtractFromIframe;
      win.__ON_SOURCE_CAMERA_CHANGE__ = syncSourceToMc;
    }
    tryExtractFromIframe();
    for (const delay of [350, 700, 1050, 1400, 1800, 2300, 3000, 4000, 5500, 8000]) {
      setTimeout(tryExtractFromIframe, delay);
    }
  };

  sourceFrame.srcdoc = bridged;
}

async function handleImportedFiles(fileList) {
  const files = Array.from(fileList || []);
  if (files.length === 0) return;

  // Multi-file batch import directly into `library/assets/`!
  if (files.length > 1) {
    showToast(`⏳ 正在批量导入 ${files.length} 个文件到本地资产库...`);
    let okCount = 0;
    for (const file of files) {
      const nameNoExt = file.name.replace(/\.[^.]+$/, '');
      const ext = file.name.split('.').pop().toLowerCase();
      const body = { name: nameNoExt, sourceExt: ext, tags: ['批量导入'] };
      if (ext === 'litematic' || ext === 'schem') {
        const u8 = new Uint8Array(await file.arrayBuffer());
        body.sourceBase64 = uint8ToBase64(u8);
      } else {
        body.sourceText = await file.text();
      }
      const res = await fetch('/api/library/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) okCount++;
    }
    state.libFilterTab = 'user';
    document.querySelectorAll('[data-libtab]').forEach((b) =>
      b.classList.toggle('active', b.dataset.libtab === 'user')
    );
    assetLibraryModal.classList.remove('hidden');
    await refreshLibraryAssets();
    renderAssetLibraryGrid();
    showToast(`🎉 已成功将 ${okCount} 个文件批量存入本地资产库！`, 3800);
    return;
  }

  // Single-file import into live workspace
  const file = files[0];
  const nameNoExt = file.name.replace(/\.[^.]+$/, '');
  const ext = file.name.split('.').pop().toLowerCase();
  state.currentAssetId = null;
  updateActiveAssetHeaderUI();

  if (ext === 'litematic' || ext === 'schem') {
    const buf = await file.arrayBuffer();
    const u8 = new Uint8Array(buf);
    state.rawBinaryBytes = u8;
    state.rawBinaryBase64 = null;
    state.sourceExt = ext;
    const decoded = ext === 'schem' ? await decodeSpongeSchem(u8) : await decodeLitematic(u8);
    state.sourceKind = 'litematic';
    state.importedGrid = decoded;
    state.previewDeferred = true;
    state.highlightedBlockId = null;
    updateInspectorUI(null);
    schemNameInput.value = decoded.metadata.name || nameNoExt;
    sourceFrame.classList.add('hidden');
    sourcePane.classList.remove('clean-scene-preview');
    sourcePlaceholder.classList.remove('hidden');
    rebuildSchematic(true);
    showToast(`已加载 ${ext.toUpperCase()} 蓝图: ${decoded.metadata.name}（可点“💾 存入资产库”保存）`);
    return;
  }

  const text = await file.text();
  state.rawBinaryBytes = null;
  state.rawBinaryBase64 = null;
  state.sourceExt = ext;

  if (ext === 'json') {
    const parsed = JSON.parse(text);
    state.sourceKind = 'json';
    state.rawHtml = text;
    state.voxelData = parsed;
    state.capturedScene = null;
    state.importedGrid = null;
    state.highlightedBlockId = null;
    updateInspectorUI(null);
    codeTextarea.value = text;
    schemNameInput.value = parsed.name || nameNoExt;
    sourceFrame.classList.add('hidden');
    sourcePane.classList.remove('clean-scene-preview');
    sourcePlaceholder.classList.remove('hidden');
    rebuildSchematic(true);
    showToast(`已加载体素 JSON: ${nameNoExt}`);
    return;
  }

  loadHtmlScene(text, nameNoExt);
  showToast(`已加载场景: ${file.name}`);
}

// ==================== Other Event Listeners ====================
for (const pt of document.querySelectorAll('[data-ptab]')) {
  pt.addEventListener('click', () => {
    document.querySelectorAll('[data-ptab]').forEach((b) => b.classList.remove('active'));
    pt.classList.add('active');
    const isBasic = pt.dataset.ptab === 'basic';
    paramPaneBasic.classList.toggle('hidden', !isBasic);
    paramPaneAdvanced.classList.toggle('hidden', isBasic);
  });
}

resetFamiliesBtn.addEventListener('click', () => {
  state.disabledFamilies.clear();
  renderFamilyChipsUI();
  rebuildSchematic(false);
  showToast('已重新启用全部材质大类');
});

let gradingRaf = 0;
for (const [inp, labelEl, suffix] of [
  [brightnessInput, brightnessVal, ''],
  [saturationInput, saturationVal, '%'],
  [ditherInput, ditherVal, '%'],
]) {
  inp.addEventListener('input', () => {
    const v = Number(inp.value);
    labelEl.textContent = (inp === brightnessInput && v > 0 ? `+${v}` : `${v}`) + suffix;
    cancelAnimationFrame(gradingRaf);
    gradingRaf = requestAnimationFrame(() => {
      try {
        rebuildSchematic(false);
      } catch (err) {
        showToast(err.message);
      }
    });
  });
}

resetGradingBtn.addEventListener('click', () => {
  brightnessInput.value = '0';
  brightnessVal.textContent = '0';
  saturationInput.value = '100';
  saturationVal.textContent = '100%';
  ditherInput.value = '0';
  ditherVal.textContent = '0%';
  rebuildSchematic(false);
  showToast('已重置亮度、饱和度与 3D 抖动参数');
});

clearOverridesBtn.addEventListener('click', () => {
  state.blockOverrides.clear();
  rebuildSchematic(false);
  showToast('已清空所有手动替换规则');
});

for (const btn of document.querySelectorAll('.tab-btn')) {
  btn.addEventListener('click', () => {
    const previousView = state.activeViewTab;
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    const view = btn.dataset.view;
    state.activeViewTab = view;

    if (view === 'world') {
      viewportsContainer.className = 'viewports only-world';
      converterSidebarWrap.classList.add('hidden');
      worldSidebarWrap.classList.remove('hidden');
      activateWorldMapTab();
      return;
    }

    converterSidebarWrap.classList.remove('hidden');
    worldSidebarWrap.classList.add('hidden');
    viewportsContainer.className =
      view === 'mc' ? 'viewports only-mc' : view === 'source' ? 'viewports only-source' : 'viewports split';
    setTimeout(() => {
      resizeMcViewport();
      if (sourceFrame.contentWindow) {
        sourceFrame.contentWindow.__FORCE_SOURCE_RENDER__ = true;
      }
    }, 20);
    if (previousView === 'world' && view !== 'world') {
      setTimeout(refreshWorldPreviewIfDirty, 0);
    }
  });
}

syncCamBtn.addEventListener('click', () => {
  state.cameraSync = !state.cameraSync;
  syncCamBtn.classList.toggle('active', state.cameraSync);
  const srcCtrl = sourceFrame.contentWindow?.__CAPTURED_CONTROLS__;
  if (state.cameraSync) {
    syncMcToSource();
    showToast('已开启双屏视角同步');
  } else if (srcCtrl) {
    srcCtrl.autoRotate = state.sourceOrigAutoRotate;
    showToast('已关闭双屏视角同步');
  }
});

for (const btn of document.querySelectorAll('[data-light]')) {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-light]').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    applyLightingPreset(btn.dataset.light);
  });
}

for (const btn of document.querySelectorAll('[data-cam]')) {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-cam]').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    animateCameraToPreset(btn.dataset.cam);
  });
}

sliceModeBtn.addEventListener('click', () => {
  state.singleLayerMode = !state.singleLayerMode;
  sliceModeBtn.textContent = state.singleLayerMode ? '🔪 单层模式' : '📚 累积层';
  sliceModeBtn.classList.toggle('active-mode', state.singleLayerMode);
  if (state.singleLayerMode && state.currentGrid && state.sliceLevel >= state.currentGrid.height) {
    state.sliceLevel = Math.max(1, Math.ceil(state.currentGrid.height * 0.4));
    layerSlider.value = String(state.sliceLevel);
  } else if (!state.singleLayerMode && state.currentGrid) {
    state.sliceLevel = state.currentGrid.height;
    layerSlider.value = String(state.sliceLevel);
  }
  updateLayerLabelUI();
  updateSliceRangeFast();
});

function stepLayer(delta) {
  if (!state.currentGrid) return;
  const max = state.currentGrid.height;
  state.sliceLevel = Math.max(1, Math.min(max, state.sliceLevel + delta));
  layerSlider.value = String(state.sliceLevel);
  updateLayerLabelUI();
  updateSliceRangeFast();
}

layerDownBtn.addEventListener('click', () => stepLayer(-1));
layerUpBtn.addEventListener('click', () => stepLayer(1));

layerSlider.addEventListener('input', () => {
  state.sliceLevel = Number(layerSlider.value);
  updateLayerLabelUI();
  updateSliceRangeFast();
});

window.addEventListener('keydown', (e) => {
  const tag = document.activeElement?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  if (e.key === 'ArrowUp') {
    e.preventDefault();
    stepLayer(1);
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    stepLayer(-1);
  } else if (e.key === 'Escape') {
    if (!formatPreviewModal.classList.contains('hidden')) {
      closeFormatPreview();
    } else if (!assetLibraryModal.classList.contains('hidden')) {
      assetLibraryModal.classList.add('hidden');
    } else if (!blockPickerModal.classList.contains('hidden')) {
      blockPickerModal.classList.add('hidden');
    } else if (state.highlightedBlockId) {
      setHighlightedBlockId(null);
    }
  }
});

resetCameraBtn.addEventListener('click', () => {
  if (state.currentGrid) fitCameraToGrid(state.currentGrid);
});

for (const ctrl of [
  presetSelect,
  scaleModeSelect,
  useSlabsChk,
  hollowInteriorChk,
  excludeGravityChk,
  survivalFriendlyChk,
  preferSceneChk,
]) {
  ctrl.addEventListener('change', () => {
    try {
      rebuildSchematic(false);
    } catch (err) {
      showToast(err.message);
    }
  });
}

targetSizeInput.addEventListener('input', () => {
  targetSizeVal.textContent = targetSizeInput.value;
});
targetSizeInput.addEventListener('change', () => {
  if (scaleModeSelect.value === '1:1') {
    scaleModeSelect.value = 'fit';
  }
  rebuildSchematic(true);
});

copyMaterialsBtn.addEventListener('click', async () => {
  if (!state.currentGrid || state.currentGrid.materials.length === 0) return;
  const lines = [
    `# ${schemNameInput.value || 'Schematic'} 材料清单 (${state.currentGrid.width}×${state.currentGrid.height}×${state.currentGrid.length}，共 ${state.currentGrid.blocks.length} 块)`,
    '',
    ...state.currentGrid.materials.map(
      (m) => `- [ ] **${m.nameZh}** (\`${m.id}\`): ${m.count} 个 (${formatStackText(m.count)})`
    ),
  ];
  try {
    await navigator.clipboard.writeText(lines.join('\n'));
    showToast('📋 已复制 Markdown 备料清单到剪贴板！');
  } catch {
    showToast('复制失败，请检查剪贴板权限');
  }
});

clearDisabledBtn.addEventListener('click', () => {
  state.disabledBlocks.clear();
  rebuildSchematic(false);
  showToast('已恢复所有禁用的方块');
});

function getSafeExportName() {
  return (schemNameInput.value || 'ThreeJS_Voxel_Build')
    .trim()
    .replace(/[^\w\u4e00-\u9fa5-]+/g, '_');
}

async function buildExportArtifact() {
  const grid = state.currentGrid;
  const format = exportFormatSelect.value;
  const safeName = getSafeExportName();
  const versionPreset = presetSelect.value;
  let bytes;
  let detail;

  if (format === 'schem') {
    bytes = await encodeSpongeSchem(grid, {
      name: safeName,
      versionPreset,
      author: 'three2litematic',
    });
    detail = 'Sponge Schematic v2；可交由 WorldEdit、FAWE、Axiom 等工具读取。';
  } else if (format === 'mcfunction') {
    bytes = encodeMcFunction(grid, { name: safeName });
    detail = '原版数据包函数；生成结果由 /fill 与 /setblock 命令组成。';
  } else {
    const previewImageData = state.previewDeferred ? null : capturePreviewThumbnail140();
    bytes = await encodeLitematic(grid, {
      name: safeName,
      versionPreset,
      author: 'three2litematic',
      previewImageData,
    });
    const preset = VERSION_PRESETS[versionPreset] || VERSION_PRESETS['1.21'];
    detail = `Litematica 投影；目标数据版本为 ${preset.label}（DataVersion ${preset.mcDataVersion}）。`;
    if (state.previewDeferred) detail += ' 轻量模式未生成游戏内缩略图；需要时可先生成 3D 预览再重新转换。';
    else detail += ' 已内嵌 140×140 游戏内彩色预览缩略图。';
  }

  return {
    grid,
    format,
    safeName,
    versionPreset,
    deferred: state.previewDeferred,
    bytes,
    detail,
    filename: `${safeName}.${format}`,
  };
}

function downloadExportArtifact(artifact) {
  const blob = new Blob([artifact.bytes], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = artifact.filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast(
    `🎉 已导出 ${artifact.filename} (${(artifact.bytes.byteLength / 1024).toFixed(1)} KB) · ${artifact.detail}！`,
    4200
  );
}

let formatPreviewGeneration = 0;

function closeFormatPreview() {
  formatPreviewGeneration++;
  formatPreviewModal.classList.add('hidden');
  downloadFormatPreviewBtn.disabled = true;
}

function generateFormatPreview() {
  if (!state.currentGrid) return;
  formatPreviewModal.classList.remove('hidden');
  formatPreviewLoading.classList.add('hidden');
  formatPreviewContent.classList.remove('hidden');
  const grid = state.currentGrid;
  const format = exportFormatSelect.value;
  const safeName = getSafeExportName();
  const filename = `${safeName}.${format}`;
  const preset = VERSION_PRESETS[presetSelect.value] || VERSION_PRESETS['1.21'];
  let detail;
  if (format === 'schem') {
    detail = `Sponge Schematic v2；目标数据版本为 ${preset.label}（DataVersion ${preset.mcDataVersion}），可交由 WorldEdit、FAWE、Axiom 等工具读取。`;
  } else if (format === 'mcfunction') {
    detail = '原版数据包函数；生成结果由 /fill 与 /setblock 命令组成，并在下载时压缩连续 X 轴区段。';
  } else {
    detail = `Litematica 投影；目标数据版本为 ${preset.label}（DataVersion ${preset.mcDataVersion}）。`;
    if (state.previewDeferred) detail += ' 当前为轻量模式，下载时不会生成游戏内缩略图。';
    else detail += ' 下载时会嵌入 140×140 游戏内彩色预览缩略图。';
  }

  const notes = [detail, '这里只读取统一方块网格并展示兼容性摘要；点击下载后才在内存中编码，不写入临时文件。'];
  if (format === 'schem' && (grid.width > 32767 || grid.height > 32767 || grid.length > 32767)) {
    notes.push('⚠️ .schem 单轴尺寸上限为 32767，超限时编码会裁切；请缩小结构后再导出。');
  }
  if (format === 'mcfunction') {
    notes.push(`最多 ${grid.blocks.length.toLocaleString()} 条方块命令，实际数量会因连续区段合并而减少。`);
  }
  if (state.sourceKind === 'litematic') {
    notes.push('导入蓝图按位置与方块状态转换；原始方块实体、实体和其他附加元数据不会随当前转换管线保留。');
  }

  formatPreviewBadge.textContent = `.${format}`;
  formatPreviewStatus.textContent = '摘要就绪 · 等待下载时转写';
  formatPreviewDescription.textContent = detail;
  formatPreviewDimensions.textContent = `${grid.width} × ${grid.height} × ${grid.length}`;
  formatPreviewBlocks.textContent = grid.blocks.length.toLocaleString();
  formatPreviewMaterials.textContent = `${grid.materials.length} 种`;
  formatPreviewOutput.textContent = filename;
  formatPreviewNote.textContent = notes.join(' ');
  formatPreviewSubtitle.textContent = `轻量摘要 · ${filename} · 下载时生成内存结果`;
  downloadFormatPreviewBtn.textContent = `📤 下载 .${format}`;
  downloadFormatPreviewBtn.disabled = false;
}

previewFormatBtn.addEventListener('click', generateFormatPreview);
closeFormatPreviewBtn.addEventListener('click', closeFormatPreview);
formatPreviewModal.addEventListener('click', (event) => {
  if (event.target === formatPreviewModal) closeFormatPreview();
});

downloadFormatPreviewBtn.addEventListener('click', async () => {
  if (!state.currentGrid) return;
  const generation = ++formatPreviewGeneration;
  downloadFormatPreviewBtn.disabled = true;
  formatPreviewLoading.classList.remove('hidden');
  formatPreviewContent.classList.add('hidden');
  try {
    await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 30)));
    if (generation !== formatPreviewGeneration) return;
    const artifact = await buildExportArtifact();
    if (generation !== formatPreviewGeneration) return;
    closeFormatPreview();
    downloadExportArtifact(artifact);
  } catch (err) {
    if (generation !== formatPreviewGeneration) return;
    formatPreviewLoading.classList.add('hidden');
    formatPreviewContent.classList.remove('hidden');
    downloadFormatPreviewBtn.disabled = false;
    showToast(`转换失败: ${err.message}`, 4000);
  }
});

exportBtn.addEventListener('click', async () => {
  if (!state.currentGrid) return;
  try {
    const artifact = await buildExportArtifact();
    downloadExportArtifact(artifact);
  } catch (err) {
    showToast(`导出失败: ${err.message}`, 4000);
  }
});

fileInput.addEventListener('change', (e) => {
  if (e.target.files?.length) handleImportedFiles(e.target.files);
  fileInput.value = '';
});

openEditorBtn.addEventListener('click', () => editorModal.classList.remove('hidden'));
closeEditorBtn.addEventListener('click', () => editorModal.classList.add('hidden'));
applyCodeBtn.addEventListener('click', () => {
  const raw = codeTextarea.value.trim();
  if (!raw) return;
  editorModal.classList.add('hidden');
  if (raw.startsWith('{') || raw.startsWith('[')) {
    try {
      const parsed = JSON.parse(raw);
      state.sourceKind = 'json';
      state.sourceExt = 'json';
      state.rawHtml = raw;
      state.rawBinaryBytes = null;
      state.voxelData = parsed;
      state.capturedScene = null;
      state.importedGrid = null;
      state.highlightedBlockId = null;
      updateInspectorUI(null);
      sourceFrame.classList.add('hidden');
      sourcePane.classList.remove('clean-scene-preview');
      sourcePlaceholder.classList.remove('hidden');
      rebuildSchematic(true);
      showToast('已解析体素 JSON 并更新预览');
      return;
    } catch {
      // Treat as JS
    }
  }
  loadHtmlScene(raw, schemNameInput.value, { keepAssetBinding: true });
  showToast('已运行代码并更新 MC 投影预览');
});

window.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropOverlay.classList.remove('hidden');
});
dropOverlay.addEventListener('dragleave', (e) => {
  if (e.target === dropOverlay) dropOverlay.classList.add('hidden');
});
window.addEventListener('drop', (e) => {
  e.preventDefault();
  dropOverlay.classList.add('hidden');
  if (e.dataTransfer?.files?.length) handleImportedFiles(e.dataTransfer.files);
});

// ==================== Offline 2D Minecraft Save World Map Editor ====================
const worldState = {
  initialized: false,
  discoveredWorlds: [],
  worldPath: '',
  worldInfo: null,
  bounds: null,
  heights: null,
  mapImage: null,
  staticPreviewCanvas: null,
  previewDirty: false,
  previewLoading: false,
  titleBase: '',
  generatedChunkCount: 0,

  camWorldX: 0,
  camWorldZ: 0,
  zoom: 1.5, // CSS pixels per block
  showChunkGrid: true,

  targetX: 0,
  requestedY: 64,
  targetY: 64,
  targetZ: 0,
  rotation: 0,
  mirrorX: false,

  outW: 16,
  outL: 16,
  footprintCanvas: null,
  sampledGroundY: null,
  verticalPlacement: null,
  voidCellsInFootprint: 0,
  validCellsInFootprint: 0,
};

function updateWorldPreviewStatusBadge() {
  if (!worldState.worldInfo) {
    worldMapTitleBadge.textContent = '未加载存档';
    return;
  }
  worldMapTitleBadge.textContent = worldState.previewDirty
    ? `${worldState.titleBase} · 🕓 预览待刷新`
    : worldState.titleBase;
}

function updateWorldLoadButtonState() {
  const hasPath = Boolean((worldPathInput.value || '').trim());
  loadWorldMapBtn.disabled = worldState.previewLoading || !hasPath;
  loadWorldMapBtn.textContent = worldState.previewLoading ? '加载中...' : '加载地形';
}

function markWorldPreviewDirty() {
  if (!worldState.worldInfo) return;
  worldState.previewDirty = true;
  updateWorldPreviewStatusBadge();
}

function parseHexRgbFast(hex) {
  const s = String(hex || '#888888').replace('#', '');
  const n = parseInt(s, 16);
  if (Number.isNaN(n)) return [136, 136, 136];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function decodeBase64Int16(b64) {
  const bin = atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    u8[i] = bin.charCodeAt(i);
  }
  return new Int16Array(u8.buffer);
}

function rebuildFootprintPreviewCanvas() {
  const g = state.currentGrid;
  if (!g || !g.blocks || g.blocks.length === 0) {
    worldState.outW = 16;
    worldState.outL = 16;
    worldState.footprintCanvas = null;
    updateCommitPlaceButtonState();
    return;
  }

  const rotSteps = (((Math.round(worldState.rotation / 90) % 4) + 4) % 4);
  const W = g.width;
  const H = Math.max(1, g.height);
  const L = g.length;
  const outW = rotSteps % 2 === 1 ? L : W;
  const outL = rotSteps % 2 === 1 ? W : L;

  worldState.outW = outW;
  worldState.outL = outL;

  const topY = new Int16Array(outW * outL).fill(-1);
  const topHex = new Array(outW * outL);

  for (let i = 0; i < g.blocks.length; i++) {
    const item = g.blocks[i];
    let x = worldState.mirrorX ? W - 1 - item.x : item.x;
    let z = item.z;
    for (let r = 0; r < rotSteps; r++) {
      const curSpanZ = r % 2 === 1 ? W : L;
      const rx = curSpanZ - 1 - z;
      const rz = x;
      x = rx;
      z = rz;
    }
    if (x < 0 || x >= outW || z < 0 || z >= outL) continue;
    const idx = z * outW + x;
    if (item.y >= topY[idx]) {
      topY[idx] = item.y;
      topHex[idx] = item.block.hex;
    }
  }

  const c = document.createElement('canvas');
  c.width = outW;
  c.height = outL;
  const cctx = c.getContext('2d');
  const img = cctx.createImageData(outW, outL);

  for (let i = 0; i < outW * outL; i++) {
    if (topY[i] < 0) continue;
    const [r, gr, b] = parseHexRgbFast(topHex[i]);
    const hShade = 0.82 + 0.32 * (topY[i] / H);
    const di = i * 4;
    img.data[di] = Math.min(255, Math.round(r * hShade));
    img.data[di + 1] = Math.min(255, Math.round(gr * hShade));
    img.data[di + 2] = Math.min(255, Math.round(b * hShade));
    img.data[di + 3] = 228;
  }

  cctx.putImageData(img, 0, 0);
  worldState.footprintCanvas = c;
  updateCommitPlaceButtonState();
}

function getLoadedSurfaceHeight(wx, wz) {
  const b = worldState.bounds;
  const h = worldState.heights;
  if (!b || !h) return -32768;
  const ix = Math.floor(wx) - b.minX;
  const iz = Math.floor(wz) - b.minZ;
  if (ix < 0 || ix >= b.width || iz < 0 || iz >= b.length) return -32768;
  return h[iz * b.width + ix];
}

function updateCommitPlaceButtonState() {
  const ready = Boolean(
    worldState.worldInfo &&
      state.currentGrid &&
      state.currentGrid.blocks.length > 0 &&
      worldState.verticalPlacement &&
      !worldState.verticalPlacement.error &&
      (worldState.validCellsInFootprint > 0 || fillVoidChk.checked)
  );
  commitPlaceBtn.disabled = !ready;
}

function getOccupiedVerticalBounds() {
  const blocks = state.currentGrid?.blocks || [];
  let minY = Infinity;
  let maxY = -Infinity;
  for (const item of blocks) {
    const id = item.block?.id;
    if (!Number.isInteger(item.y) || ['minecraft:air', 'minecraft:cave_air', 'minecraft:void_air'].includes(id)) {
      continue;
    }
    minY = Math.min(minY, item.y);
    maxY = Math.max(maxY, item.y);
  }
  return Number.isFinite(minY) && Number.isFinite(maxY) ? { minY, maxY } : null;
}

function getTopClearanceLayers() {
  const value = Math.floor(Number(topClearanceInput.value));
  const normalized = Number.isFinite(value) ? Math.max(0, value) : 0;
  topClearanceInput.value = String(normalized);
  return normalized;
}

function updateVerticalPlacement(requestedY) {
  const worldInfo = worldState.worldInfo;
  const bounds = getOccupiedVerticalBounds();
  if (!worldInfo || !bounds) {
    worldState.verticalPlacement = null;
    worldHeightFitStatus.textContent = '根据存档高度上限自动调整基底 Y。';
    worldHeightFitStatus.classList.remove('error', 'success');
    updateCommitPlaceButtonState();
    return null;
  }

  const normalizedRequestedY = Number.isFinite(Number(requestedY))
    ? Math.floor(Number(requestedY))
    : worldState.requestedY;
  worldState.requestedY = normalizedRequestedY;

  try {
    const placement = resolveVerticalPlacement({
      requestedY: normalizedRequestedY,
      minWorldY: worldInfo.minY,
      maxWorldY: worldInfo.maxY,
      minStructureY: bounds.minY,
      maxStructureY: bounds.maxY,
      topClearanceLayers: getTopClearanceLayers(),
      autoSink: autoSinkChk.checked,
    });
    worldState.verticalPlacement = placement;
    worldState.targetY = placement.baseY;
    const sinkText = placement.settledBy > 0
      ? `已自动沉降 ${placement.settledBy} 层`
      : '无需沉降';
    worldHeightFitStatus.textContent =
      `模型占用 ${placement.structureHeight} 层 · 顶部 Y=${placement.topY} · 上方留空 ${placement.topClearanceLayers} 层 · ${sinkText}`;
    worldHeightFitStatus.classList.remove('error');
    worldHeightFitStatus.classList.add('success');
    updateCommitPlaceButtonState();
    return placement;
  } catch (err) {
    worldState.verticalPlacement = { error: err.message, requestedY: normalizedRequestedY };
    worldState.targetY = normalizedRequestedY;
    worldHeightFitStatus.textContent = `⚠️ ${err.message}`;
    worldHeightFitStatus.classList.remove('success');
    worldHeightFitStatus.classList.add('error');
    updateCommitPlaceButtonState();
    return null;
  }
}

function updateFootprintGroundSnap({ syncInputs = true } = {}) {
  const outW = worldState.outW;
  const outL = worldState.outL;
  const tx = worldState.targetX;
  const tz = worldState.targetZ;

  let validCount = 0;
  let voidCount = 0;
  const centerSamples = [];
  const allSamples = [];

  const padX = Math.floor(outW * 0.25);
  const padZ = Math.floor(outL * 0.25);
  const stepX = Math.max(1, Math.floor(outW / 24));
  const stepZ = Math.max(1, Math.floor(outL / 24));

  for (let dz = 0; dz < outL; dz += stepZ) {
    for (let dx = 0; dx < outW; dx += stepX) {
      const h = getLoadedSurfaceHeight(tx + dx, tz + dz);
      if (h === -32768) {
        voidCount++;
      } else {
        validCount++;
        allSamples.push(h);
        if (dx >= padX && dx <= outW - 1 - padX && dz >= padZ && dz <= outL - 1 - padZ) {
          centerSamples.push(h);
        }
      }
    }
  }

  worldState.validCellsInFootprint = validCount;
  worldState.voidCellsInFootprint = voidCount;

  const pool = centerSamples.length > 0 ? centerSamples : allSamples;
  if (pool.length > 0) {
    pool.sort((a, b) => a - b);
    const med = pool[Math.floor(pool.length / 2)];
    worldState.sampledGroundY = med;
    sampledGroundLabel.textContent = `地表 Y=${med}`;

    if (autoGroundChk.checked && worldState.worldInfo) {
      const off = Number(groundOffsetInput.value) || 0;
      const clampedY = Math.max(
        worldState.worldInfo.minY,
        Math.min(worldState.worldInfo.maxY, med + 1 + off)
      );
      worldState.requestedY = clampedY;
    }
  } else {
    worldState.sampledGroundY = null;
    sampledGroundLabel.textContent = worldState.worldInfo ? '未生成区块' : '地表 Y=--';
  }

  updateVerticalPlacement(worldState.requestedY);

  if (syncInputs) {
    placeXInput.value = String(worldState.targetX);
    placeYInput.value = String(worldState.targetY);
    placeZInput.value = String(worldState.targetZ);
  }

  const gH = state.currentGrid ? state.currentGrid.height : 0;
  if (worldState.worldInfo) {
    const statusWarn =
      validCount === 0
        ? ' · ⚠️ 当前选框位于未探索虚空区块，请拖到绿色已生成地形上'
        : voidCount > 0
        ? ' · ⚠️ 部分跨越未生成边缘区块'
        : '';
    const verticalWarn = worldState.verticalPlacement?.error ? ` · ⚠️ ${worldState.verticalPlacement.error}` : '';
    worldFootprintInfo.textContent = `占地: ${outW}×${gH}×${outL} · 范围 X:[${tx}..${tx + outW - 1}] Z:[${tz}..${tz + outL - 1}] · 基底 Y=${worldState.targetY}${statusWarn}${verticalWarn}`;
  }
  updateCommitPlaceButtonState();
}

function worldToScreen(wx, wz, cssW, cssH) {
  return [
    cssW * 0.5 + (wx - worldState.camWorldX) * worldState.zoom,
    cssH * 0.5 + (wz - worldState.camWorldZ) * worldState.zoom,
  ];
}

function screenToWorld(sx, sy, cssW, cssH) {
  return [
    worldState.camWorldX + (sx - cssW * 0.5) / worldState.zoom,
    worldState.camWorldZ + (sy - cssH * 0.5) / worldState.zoom,
  ];
}

function resizeWorldCanvas() {
  const rect = worldCanvasWrap.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.round(rect.width * dpr);
  const h = Math.round(rect.height * dpr);
  if (worldMapCanvas.width !== w || worldMapCanvas.height !== h) {
    worldMapCanvas.width = w;
    worldMapCanvas.height = h;
  }
  drawWorldMapCanvas();
}

new ResizeObserver(() => {
  if (state.activeViewTab === 'world') {
    requestAnimationFrame(resizeWorldCanvas);
  }
}).observe(worldCanvasWrap);

function drawMapMarker(ctx, sx, sy, color, labelText) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(sx, sy, 5.5, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#090d14';
  ctx.stroke();

  ctx.font = '600 11px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';
  const tw = ctx.measureText(labelText).width;
  const bx = sx - tw * 0.5 - 6;
  const by = sy - 26;
  ctx.fillStyle = 'rgba(11, 15, 23, 0.86)';
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(bx, by, tw + 12, 17, 4);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#f8fafc';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(labelText, sx, by + 8.5);
  ctx.restore();
}

function drawWorldMapCanvas() {
  const rect = worldCanvasWrap.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;
  const dpr = worldMapCanvas.width / rect.width;
  const cssW = rect.width;
  const cssH = rect.height;

  const ctx = worldMapCanvas.getContext('2d');
  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, cssW, cssH);

  // Background
  ctx.fillStyle = '#090d14';
  ctx.fillRect(0, 0, cssW, cssH);

  const b = worldState.bounds;
  const previewBitmap = worldState.staticPreviewCanvas || worldState.mapImage;
  if (b && previewBitmap) {
    const [x0, y0] = worldToScreen(b.minX, b.minZ, cssW, cssH);
    const drawW = b.width * worldState.zoom;
    const drawH = b.length * worldState.zoom;

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(previewBitmap, x0, y0, drawW, drawH);

    // Subtle loaded-region border
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.32)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x0, y0, drawW, drawH);

    // 16x16 Chunk Grid & 512x512 Region Lines
    if (worldState.showChunkGrid && worldState.zoom >= 0.75) {
      const [minVisX, minVisZ] = screenToWorld(0, 0, cssW, cssH);
      const [maxVisX, maxVisZ] = screenToWorld(cssW, cssH, cssW, cssH);
      const startCx = Math.floor(minVisX / 16);
      const endCx = Math.ceil(maxVisX / 16);
      const startCz = Math.floor(minVisZ / 16);
      const endCz = Math.ceil(maxVisZ / 16);

      ctx.beginPath();
      for (let cx = startCx; cx <= endCx; cx++) {
        if (cx % 32 === 0) continue;
        const [sx] = worldToScreen(cx * 16, 0, cssW, cssH);
        ctx.moveTo(sx, 0);
        ctx.lineTo(sx, cssH);
      }
      for (let cz = startCz; cz <= endCz; cz++) {
        if (cz % 32 === 0) continue;
        const [, sy] = worldToScreen(0, cz * 16, cssW, cssH);
        ctx.moveTo(0, sy);
        ctx.lineTo(cssW, sy);
      }
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Region (.mca 32x32 chunks = 512 blocks) boundaries
      ctx.beginPath();
      for (let cx = startCx; cx <= endCx; cx++) {
        if (cx % 32 !== 0) continue;
        const [sx] = worldToScreen(cx * 16, 0, cssW, cssH);
        ctx.moveTo(sx, 0);
        ctx.lineTo(sx, cssH);
      }
      for (let cz = startCz; cz <= endCz; cz++) {
        if (cz % 32 !== 0) continue;
        const [, sy] = worldToScreen(0, cz * 16, cssW, cssH);
        ctx.moveTo(0, sy);
        ctx.lineTo(cssW, sy);
      }
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.35)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    // Spawn & Player Markers
    const wInfo = worldState.worldInfo;
    if (wInfo?.spawnPos) {
      const [sx, sy] = worldToScreen(wInfo.spawnPos[0] + 0.5, wInfo.spawnPos[2] + 0.5, cssW, cssH);
      drawMapMarker(ctx, sx, sy, '#fbbf24', `🏠 出生点 (${wInfo.spawnPos[0]}, ${wInfo.spawnPos[2]})`);
    }
    if (wInfo?.playerPos) {
      const [px, py] = worldToScreen(wInfo.playerPos[0] + 0.5, wInfo.playerPos[2] + 0.5, cssW, cssH);
      drawMapMarker(ctx, px, py, '#38bdf8', `🧭 玩家 (${wInfo.playerPos[0]}, ${wInfo.playerPos[2]})`);
    }

    // Draggable Building Footprint Overlay
    if (state.currentGrid) {
      const [fx, fy] = worldToScreen(worldState.targetX, worldState.targetZ, cssW, cssH);
      const fw = Math.max(4, worldState.outW * worldState.zoom);
      const fh = Math.max(4, worldState.outL * worldState.zoom);
      const isValid = worldState.validCellsInFootprint > 0;
      const borderColor = isValid ? '#4ade80' : '#f87171';

      ctx.fillStyle = isValid ? 'rgba(74, 222, 128, 0.14)' : 'rgba(248, 113, 113, 0.18)';
      ctx.fillRect(fx, fy, fw, fh);

      if (worldState.footprintCanvas) {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(worldState.footprintCanvas, fx, fy, fw, fh);
      }

      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 2;
      ctx.strokeRect(fx, fy, fw, fh);

      // Front / Orientation direction indicator arrow on footprint edge
      const cx = fx + fw * 0.5;
      const cy = fy + fh * 0.5;
      const rotSteps = (((Math.round(worldState.rotation / 90) % 4) + 4) % 4);
      const dirs = [
        [0, -1], // 0°: North (-Z)
        [1, 0],  // 90°: East (+X)
        [0, 1],  // 180°: South (+Z)
        [-1, 0], // 270°: West (-X)
      ];
      const [dx, dy] = dirs[rotSteps];
      const ax = cx + dx * (fw * 0.5);
      const ay = cy + dy * (fh * 0.5);
      ctx.beginPath();
      ctx.arc(ax, ay, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = '#38bdf8';
      ctx.fill();
      ctx.strokeStyle = '#090d14';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Footprint floating label
      const nameStr = (schemNameInput.value || '建筑').slice(0, 18);
      const rotTag = worldState.rotation ? ` · ${worldState.rotation}°` : '';
      const mirTag = worldState.mirrorX ? ' · 镜像' : '';
      const topTag = worldState.verticalPlacement && !worldState.verticalPlacement.error
        ? ` · 顶Y=${worldState.verticalPlacement.topY}`
        : '';
      const tag = `📦 ${nameStr} (${worldState.outW}×${worldState.outL} · Y=${worldState.targetY}${topTag}${rotTag}${mirTag})`;
      ctx.font = '600 11px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';
      const tw = ctx.measureText(tag).width;
      const lx = fx + fw * 0.5 - tw * 0.5 - 7;
      const ly = fy + fh + 6;
      ctx.fillStyle = 'rgba(11, 15, 23, 0.9)';
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(lx, ly, tw + 14, 19, 4);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = isValid ? '#bbf7d0' : '#fecaca';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(tag, fx + fw * 0.5, ly + 9.5);
    }

    // Compass N indicator in top-right of canvas
    ctx.fillStyle = 'rgba(15, 19, 27, 0.84)';
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(cssW - 42, 10, 32, 32, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#f87171';
    ctx.font = '700 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('▲N', cssW - 26, 29);
  }

  ctx.restore();
}

function isScreenPointInsideFootprint(sx, sy, cssW, cssH) {
  if (!worldState.bounds || !state.currentGrid) return false;
  const [fx, fy] = worldToScreen(worldState.targetX, worldState.targetZ, cssW, cssH);
  const fw = worldState.outW * worldState.zoom;
  const fh = worldState.outL * worldState.zoom;
  const pad = Math.max(6, (16 - Math.min(fw, fh)) * 0.5);
  return sx >= fx - pad && sx <= fx + fw + pad && sy >= fy - pad && sy <= fy + fh + pad;
}

// Map Pointer Interactions (Drag Footprint / Click Terrain / Pan / Wheel Zoom)
let mapDragState = null;

worldMapCanvas.addEventListener('contextmenu', (e) => e.preventDefault());

worldMapCanvas.addEventListener('pointerdown', (e) => {
  if (!worldState.bounds) return;
  const rect = worldMapCanvas.getBoundingClientRect();
  const sx = e.clientX - rect.left;
  const sy = e.clientY - rect.top;
  const [wx, wz] = screenToWorld(sx, sy, rect.width, rect.height);

  worldMapCanvas.setPointerCapture(e.pointerId);

  if (e.button === 0 && isScreenPointInsideFootprint(sx, sy, rect.width, rect.height)) {
    mapDragState = {
      pointerId: e.pointerId,
      mode: 'drag-building',
      grabOffsetX: wx - worldState.targetX,
      grabOffsetZ: wz - worldState.targetZ,
    };
    worldCanvasWrap.style.cursor = 'grabbing';
  } else {
    mapDragState = {
      pointerId: e.pointerId,
      mode: 'pan-or-click',
      button: e.button,
      downSx: sx,
      downSy: sy,
      startCamX: worldState.camWorldX,
      startCamZ: worldState.camWorldZ,
      hasPanned: false,
    };
  }
});

worldMapCanvas.addEventListener('pointermove', (e) => {
  if (!worldState.bounds) return;
  const rect = worldMapCanvas.getBoundingClientRect();
  const sx = e.clientX - rect.left;
  const sy = e.clientY - rect.top;
  const [wx, wz] = screenToWorld(sx, sy, rect.width, rect.height);
  const bx = Math.floor(wx);
  const bz = Math.floor(wz);
  const h = getLoadedSurfaceHeight(bx, bz);
  worldCursorInfo.textContent = `指针: X:${bx}, Z:${bz} · 区块:(${bx >> 4}, ${bz >> 4}) · ${
    h === -32768 ? '未生成区块' : `地表 Y=${h}`
  }`;

  if (!mapDragState) {
    worldCanvasWrap.style.cursor = isScreenPointInsideFootprint(sx, sy, rect.width, rect.height)
      ? 'move'
      : 'crosshair';
    return;
  }

  if (mapDragState.mode === 'drag-building') {
    worldState.targetX = Math.round(wx - mapDragState.grabOffsetX);
    worldState.targetZ = Math.round(wz - mapDragState.grabOffsetZ);
    updateFootprintGroundSnap({ syncInputs: true });
    drawWorldMapCanvas();
  } else if (mapDragState.mode === 'pan-or-click') {
    const dx = sx - mapDragState.downSx;
    const dy = sy - mapDragState.downSy;
    if (mapDragState.hasPanned || Math.hypot(dx, dy) > 4) {
      mapDragState.hasPanned = true;
      worldCanvasWrap.style.cursor = 'grabbing';
      worldState.camWorldX = mapDragState.startCamX - dx / worldState.zoom;
      worldState.camWorldZ = mapDragState.startCamZ - dy / worldState.zoom;
      drawWorldMapCanvas();
    }
  }
});

worldMapCanvas.addEventListener('pointerup', (e) => {
  if (!mapDragState || mapDragState.pointerId !== e.pointerId) return;
  const rect = worldMapCanvas.getBoundingClientRect();
  const sx = e.clientX - rect.left;
  const sy = e.clientY - rect.top;

  if (mapDragState.mode === 'pan-or-click' && !mapDragState.hasPanned && mapDragState.button === 0) {
    const [wx, wz] = screenToWorld(sx, sy, rect.width, rect.height);
    worldState.targetX = Math.floor(wx - worldState.outW * 0.5);
    worldState.targetZ = Math.floor(wz - worldState.outL * 0.5);
    updateFootprintGroundSnap({ syncInputs: true });
    drawWorldMapCanvas();
  }

  mapDragState = null;
  worldCanvasWrap.style.cursor = isScreenPointInsideFootprint(sx, sy, rect.width, rect.height)
    ? 'move'
    : 'crosshair';
});

worldMapCanvas.addEventListener(
  'wheel',
  (e) => {
    if (!worldState.bounds) return;
    e.preventDefault();
    const rect = worldMapCanvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const [wxBefore, wzBefore] = screenToWorld(sx, sy, rect.width, rect.height);

    const factor = e.deltaY < 0 ? 1.2 : 1 / 1.2;
    const nextZoom = Math.max(0.5, Math.min(14, worldState.zoom * factor));
    worldState.zoom = nextZoom;
    worldState.camWorldX = wxBefore - (sx - rect.width * 0.5) / nextZoom;
    worldState.camWorldZ = wzBefore - (sy - rect.height * 0.5) / nextZoom;
    mapZoomResetBtn.textContent = `${Math.round(nextZoom * 100)}%`;
    drawWorldMapCanvas();
  },
  { passive: false }
);

function setWorldZoomCentered(nextZoom) {
  const clamped = Math.max(0.5, Math.min(14, nextZoom));
  worldState.zoom = clamped;
  mapZoomResetBtn.textContent = `${Math.round(clamped * 100)}%`;
  drawWorldMapCanvas();
}

mapZoomInBtn.addEventListener('click', () => setWorldZoomCentered(worldState.zoom * 1.3));
mapZoomOutBtn.addEventListener('click', () => setWorldZoomCentered(worldState.zoom / 1.3));
mapZoomResetBtn.addEventListener('click', () => setWorldZoomCentered(1.5));

toggleChunkGridBtn.addEventListener('click', () => {
  worldState.showChunkGrid = !worldState.showChunkGrid;
  toggleChunkGridBtn.classList.toggle('active', worldState.showChunkGrid);
  drawWorldMapCanvas();
});

function formatBytesHuman(bytes) {
  const n = Number(bytes) || 0;
  if (n <= 0) return '0 B';
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function getConfiguredMaxBackups() {
  const v = Math.floor(Number(maxBackupsInput.value) || 10);
  return Math.max(1, Math.min(50, v));
}

// Restore saved maxBackups preference if any (default 10)
try {
  const savedCap = Number(localStorage.getItem('t2l_max_backups'));
  if (savedCap >= 1 && savedCap <= 50) {
    maxBackupsInput.value = String(Math.floor(savedCap));
  }
} catch {
  // Ignore storage restrictions
}

let clearAllConfirmTimer = null;
let clearAllArmed = false;

function resetClearAllConfirmUI() {
  clearAllArmed = false;
  clearTimeout(clearAllConfirmTimer);
  clearAllBackupsBtn.textContent = '🧹 清空';
}

function renderWorldBackupsUI(backups = []) {
  worldState.currentBackups = backups;
  resetClearAllConfirmUI();
  const cap = getConfiguredMaxBackups();
  backupCountLabel.textContent = `(${backups.length} / ${cap})`;
  clearAllBackupsBtn.classList.toggle('hidden', backups.length === 0);
  worldBackupList.innerHTML = '';

  const totalBytes = backups.reduce((acc, item) => acc + (Number(item.totalBytes) || 0), 0);
  if (backups.length > 0) {
    backupSizeHint.textContent = `共占用 ${formatBytesHuman(totalBytes)} · 超出 ${cap} 份自动清理最早快照；点 🗑️ 仅删备份不回滚地图。`;
  } else {
    backupSizeHint.textContent = `默认保留最新 ${cap} 份快照，超出自动删除；也可手动清理释放空间。`;
  }

  if (backups.length === 0) {
    worldBackupList.innerHTML = `<div style="padding:14px 6px;text-align:center;color:var(--text-muted);font-size:11.5px;">暂无修改记录。每次点击「一键写入存档地图」时会自动生成区域备份快照。</div>`;
    return;
  }

  for (const b of backups) {
    const row = document.createElement('div');
    row.className = 'backup-row';
    const timeStr = b.timestamp
      ? new Date(b.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      : '';
    const posStr = Array.isArray(b.targetPos) ? `X:${b.targetPos[0]} Y:${b.targetPos[1]} Z:${b.targetPos[2]}` : '';
    const sizeStr = b.totalBytes ? ` · ${formatBytesHuman(b.totalBytes)}` : '';
    row.innerHTML = `
      <div class="backup-info">
        <div class="backup-title" title="${b.label || b.id}">📦 ${b.label || b.id}</div>
        <div class="backup-sub">${timeStr} · ${posStr} · ${b.placedBlockCount || 0}块${sizeStr}</div>
      </div>
    `;

    const actions = document.createElement('div');
    actions.className = 'backup-actions';

    const restoreBtn = document.createElement('button');
    restoreBtn.className = 'btn-mini active-mode';
    restoreBtn.textContent = '⏪ 回滚';
    restoreBtn.title = `恢复备份文件 (${(b.files || []).join(', ')}) 并移除该次写入的建筑`;
    restoreBtn.addEventListener('click', async () => {
      restoreBtn.disabled = true;
      restoreBtn.textContent = '还原中...';
      try {
        const res = await fetch('/api/worlds/restore', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            worldPath: worldState.worldPath,
            backupId: b.id,
          }),
        });
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
        renderWorldBackupsUI(data.backups || []);
        markWorldPreviewDirty();
        showToast(`⏪ 已无损回滚撤销「${b.label}」，退出地图页签后刷新预览`, 3800);
      } catch (err) {
        showToast(`回滚失败: ${err.message}`, 4000);
        restoreBtn.disabled = false;
        restoreBtn.textContent = '⏪ 回滚';
      }
    });

    const delBtn = document.createElement('button');
    delBtn.className = 'btn-mini backup-del-btn';
    delBtn.textContent = '🗑️';
    delBtn.title = '仅删除此备份文件释放空间（保留地图上已放置的建筑）';
    delBtn.addEventListener('click', async () => {
      delBtn.disabled = true;
      try {
        const res = await fetch('/api/worlds/backups/cleanup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            worldPath: worldState.worldPath,
            backupId: b.id,
          }),
        });
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
        renderWorldBackupsUI(data.backups || []);
        showToast(`🗑️ 已清理备份「${b.label}」（当前地图建筑保留不变）`);
      } catch (err) {
        showToast(`删除备份失败: ${err.message}`, 3800);
        delBtn.disabled = false;
      }
    });

    actions.append(restoreBtn, delBtn);
    row.appendChild(actions);
    worldBackupList.appendChild(row);
  }
}

maxBackupsInput.addEventListener('change', async () => {
  const cap = getConfiguredMaxBackups();
  maxBackupsInput.value = String(cap);
  try {
    localStorage.setItem('t2l_max_backups', String(cap));
  } catch {
    // Ignore
  }

  const curBackups = worldState.currentBackups || [];
  if (worldState.worldPath && curBackups.length > cap) {
    try {
      const res = await fetch('/api/worlds/backups/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          worldPath: worldState.worldPath,
          maxBackups: cap,
        }),
      });
      const data = await res.json();
      if (res.ok && !data.error) {
        renderWorldBackupsUI(data.backups || []);
        showToast(`🧹 已按新上限 (${cap} 份) 自动清理 ${data.deletedCount} 份旧备份`);
        return;
      }
    } catch {
      // Fallback UI refresh
    }
  }
  renderWorldBackupsUI(curBackups);
});

clearAllBackupsBtn.addEventListener('click', async () => {
  if (!worldState.worldPath) return;
  if (!clearAllArmed) {
    clearAllArmed = true;
    clearAllBackupsBtn.textContent = '⚠️ 确认清空';
    clearTimeout(clearAllConfirmTimer);
    clearAllConfirmTimer = setTimeout(resetClearAllConfirmUI, 3500);
    return;
  }

  resetClearAllConfirmUI();
  clearAllBackupsBtn.disabled = true;
  try {
    const res = await fetch('/api/worlds/backups/cleanup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        worldPath: worldState.worldPath,
        clearAll: true,
      }),
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
    renderWorldBackupsUI(data.backups || []);
    showToast(`🧹 已手动清空全部 ${data.deletedCount} 份备份快照（当前地图建筑保留不变）`, 3800);
  } catch (err) {
    showToast(`清空备份失败: ${err.message}`, 3800);
  } finally {
    clearAllBackupsBtn.disabled = false;
  }
});

async function loadWorldTerrainMap({
  worldPath,
  centerX = null,
  centerZ = null,
  keepTarget = false,
  keepCamera = false,
} = {}) {
  const targetPath = (worldPath || worldPathInput.value || '').trim();
  if (!targetPath) {
    showToast('请先选择或输入 Minecraft 存档路径');
    return;
  }

  worldState.previewLoading = true;
  updateWorldLoadButtonState();

  try {
    const res = await fetch('/api/worlds/map', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        worldPath: targetPath,
        centerX,
        centerZ,
        spanChunks: 32,
      }),
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);

    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error('解析地形 PNG 失败'));
      img.src = data.mapPngDataUrl;
    });

    const staticPreview = document.createElement('canvas');
    staticPreview.width = img.naturalWidth || img.width;
    staticPreview.height = img.naturalHeight || img.height;
    staticPreview.getContext('2d').drawImage(img, 0, 0);

    const wInfo = data.worldInfo;
    worldState.worldPath = wInfo.worldPath;
    worldState.worldInfo = wInfo;
    worldState.bounds = data.bounds;
    worldState.heights = decodeBase64Int16(data.heightsInt16Base64);
    worldState.mapImage = img;
    worldState.staticPreviewCanvas = staticPreview;
    worldState.previewDirty = false;
    worldState.generatedChunkCount = data.generatedChunkCount;

    worldPathInput.value = wInfo.worldPath;
    worldSelect.value = worldState.discoveredWorlds.some((world) => world.worldPath === wInfo.worldPath)
      ? wInfo.worldPath
      : '';
    worldEmptyOverlay.classList.add('hidden');
    worldMetaBox.classList.remove('hidden');

    const instSuffix = wInfo.instanceName ? ` [${wInfo.instanceName}]` : '';
    worldState.titleBase = `${wInfo.levelName}${instSuffix} · MC ${wInfo.mcVersionName}`;
    updateWorldPreviewStatusBadge();
    worldVerBadge.textContent = `MC ${wInfo.mcVersionName}`;
    worldHeightRangeText.textContent = `高度: ${wInfo.minY} ~ ${wInfo.maxY} · 已加载 ${data.generatedChunkCount} 区块`;
    worldSpawnText.textContent = `🏠 出生点: ${wInfo.spawnPos.join(', ')}`;
    worldPlayerText.textContent = wInfo.playerPos
      ? `🧭 玩家: ${wInfo.playerPos.join(', ')}`
      : '🧭 玩家: 单人位置未知';
    worldLockWarn.classList.toggle('hidden', !wInfo.possiblyActiveInGame);

    renderWorldBackupsUI(wInfo.backups || []);
    rebuildFootprintPreviewCanvas();

    const anchor = wInfo.playerPos || wInfo.spawnPos || [0, 64, 0];
    if (!keepCamera) {
      worldState.camWorldX = centerX != null ? centerX : anchor[0];
      worldState.camWorldZ = centerZ != null ? centerZ : anchor[2];
      mapGotoXInput.value = String(Math.round(worldState.camWorldX));
      mapGotoZInput.value = String(Math.round(worldState.camWorldZ));
    }
    if (!keepTarget) {
      worldState.targetX = anchor[0] + 12;
      worldState.targetZ = anchor[2] - Math.floor(worldState.outL * 0.5);
      worldState.requestedY = worldState.targetY;
    }

    updateFootprintGroundSnap({ syncInputs: true });
    resizeWorldCanvas();
    drawWorldMapCanvas();
  } catch (err) {
    showToast(`读取存档地图失败: ${err.message}`, 4200);
  } finally {
    worldState.previewLoading = false;
    updateWorldLoadButtonState();
  }
}

async function refreshWorldPreviewIfDirty() {
  if (!worldState.previewDirty || !worldState.worldInfo || worldState.previewLoading) return;
  await loadWorldTerrainMap({
    worldPath: worldState.worldPath,
    centerX: Math.round(worldState.camWorldX),
    centerZ: Math.round(worldState.camWorldZ),
    keepTarget: true,
    keepCamera: true,
  });
}

async function discoverWorlds() {
  try {
    const res = await fetch('/api/worlds/discover');
    const data = await res.json();
    worldState.discoveredWorlds = data.worlds || [];

    const prevSelected = worldSelect.value;
    worldSelect.innerHTML = '<option value="">-- 选择自动发现的本地存档 --</option>';
    for (const w of worldState.discoveredWorlds) {
      const opt = document.createElement('option');
      opt.value = w.worldPath;
      const inst = w.instanceName ? ` [${w.instanceName}]` : '';
      const dirHint = w.folderName && w.folderName !== w.levelName ? ` (${w.folderName})` : '';
      opt.textContent = `${w.levelName}${dirHint} · MC ${w.mcVersionName}${inst}`;
      worldSelect.appendChild(opt);
    }

    if (prevSelected && worldState.discoveredWorlds.some((w) => w.worldPath === prevSelected)) {
      worldSelect.value = prevSelected;
    } else {
      worldSelect.value = '';
    }
    updateWorldLoadButtonState();
  } catch (err) {
    console.warn('扫描本地存档失败:', err);
  }
}

async function activateWorldMapTab() {
  rebuildFootprintPreviewCanvas();
  resizeWorldCanvas();
  if (!worldState.initialized) {
    worldState.initialized = true;
    await discoverWorlds();
  } else {
    updateFootprintGroundSnap({ syncInputs: true });
    drawWorldMapCanvas();
  }
}

function onCurrentGridUpdatedForWorldMap() {
  rebuildFootprintPreviewCanvas();
  if (worldState.worldInfo) {
    updateFootprintGroundSnap({ syncInputs: true });
    if (state.activeViewTab === 'world') {
      drawWorldMapCanvas();
    }
  }
}

worldSelect.addEventListener('change', () => {
  if (worldSelect.value) {
    worldPathInput.value = worldSelect.value;
    const selected = worldState.discoveredWorlds.find((world) => world.worldPath === worldSelect.value);
    showToast(
      selected
        ? `已选择「${selected.levelName}」，点击“加载地形”生成静态预览`
        : '已选择存档，点击“加载地形”生成静态预览'
    );
  } else {
    worldPathInput.value = '';
  }
  updateWorldLoadButtonState();
});

refreshWorldsBtn.addEventListener('click', async () => {
  await discoverWorlds();
  showToast(`🔄 已扫描发现 ${worldState.discoveredWorlds.length} 个本地 Minecraft 存档`);
});

loadWorldMapBtn.addEventListener('click', () => {
  loadWorldTerrainMap({ worldPath: worldPathInput.value });
});

worldPathInput.addEventListener('input', updateWorldLoadButtonState);
worldPathInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') loadWorldTerrainMap({ worldPath: worldPathInput.value });
});
updateWorldLoadButtonState();

function jumpToWorldCoord(wx, wz) {
  if (!worldState.worldInfo) return;
  const targetX = Math.round(Number(wx));
  const targetZ = Math.round(Number(wz));
  if (!Number.isFinite(targetX) || !Number.isFinite(targetZ)) return;
  const b = worldState.bounds;
  const margin = 96;
  const outsideLoaded =
    !b ||
    targetX < b.minX + margin ||
    targetX > b.minX + b.width - margin ||
    targetZ < b.minZ + margin ||
    targetZ > b.minZ + b.length - margin;

  worldState.camWorldX = targetX;
  worldState.camWorldZ = targetZ;
  mapGotoXInput.value = String(targetX);
  mapGotoZInput.value = String(targetZ);
  if (outsideLoaded) {
    loadWorldTerrainMap({
      worldPath: worldState.worldPath,
      centerX: targetX,
      centerZ: targetZ,
      keepTarget: true,
      keepCamera: true,
    });
  } else {
    drawWorldMapCanvas();
  }
}

function jumpToGotoInputs() {
  const x = Number(mapGotoXInput.value);
  const z = Number(mapGotoZInput.value);
  if (!Number.isFinite(x) || !Number.isFinite(z)) {
    showToast('请输入有效的 X 和 Z 坐标');
    return;
  }
  jumpToWorldCoord(x, z);
}

function resetWorldMapView() {
  const centerX = worldState.targetX + worldState.outW * 0.5;
  const centerZ = worldState.targetZ + worldState.outL * 0.5;
  worldState.zoom = 1.5;
  mapZoomResetBtn.textContent = '150%';
  jumpToWorldCoord(centerX, centerZ);
}

mapGotoBtn.addEventListener('click', jumpToGotoInputs);
for (const input of [mapGotoXInput, mapGotoZInput]) {
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') jumpToGotoInputs();
  });
}
mapViewResetBtn.addEventListener('click', resetWorldMapView);

jumpPlayerBtn.addEventListener('click', () => {
  const p = worldState.worldInfo?.playerPos;
  if (!p) {
    showToast('当前存档单人玩家坐标未知，已跳转至出生点');
    const sp = worldState.worldInfo?.spawnPos;
    if (sp) jumpToWorldCoord(sp[0], sp[2]);
    return;
  }
  jumpToWorldCoord(p[0], p[2]);
});

jumpSpawnBtn.addEventListener('click', () => {
  const sp = worldState.worldInfo?.spawnPos;
  if (sp) jumpToWorldCoord(sp[0], sp[2]);
});

focusFootprintBtn.addEventListener('click', () => {
  jumpToWorldCoord(
    worldState.targetX + worldState.outW * 0.5,
    worldState.targetZ + worldState.outL * 0.5
  );
});

rescanCenterBtn.addEventListener('click', () => {
  if (!worldState.worldPath) return;
  loadWorldTerrainMap({
    worldPath: worldState.worldPath,
    centerX: Math.round(worldState.camWorldX),
    centerZ: Math.round(worldState.camWorldZ),
    keepTarget: true,
    keepCamera: true,
  });
});

placeNearPlayerBtn.addEventListener('click', () => {
  if (!worldState.worldInfo) return;
  const p = worldState.worldInfo.playerPos || worldState.worldInfo.spawnPos;
  if (!p) return;
  worldState.targetX = p[0] + 12;
  worldState.targetZ = p[2] - Math.floor(worldState.outL * 0.5);
  jumpToWorldCoord(p[0], p[2]);
  updateFootprintGroundSnap({ syncInputs: true });
  drawWorldMapCanvas();
});

placeNearSpawnBtn.addEventListener('click', () => {
  if (!worldState.worldInfo) return;
  const sp = worldState.worldInfo.spawnPos;
  if (!sp) return;
  worldState.targetX = sp[0] + 12;
  worldState.targetZ = sp[2] - Math.floor(worldState.outL * 0.5);
  jumpToWorldCoord(sp[0], sp[2]);
  updateFootprintGroundSnap({ syncInputs: true });
  drawWorldMapCanvas();
});

for (const inp of [placeXInput, placeYInput, placeZInput]) {
  inp.addEventListener('input', () => {
    worldState.targetX = Math.floor(Number(placeXInput.value) || 0);
    worldState.targetZ = Math.floor(Number(placeZInput.value) || 0);
    if (inp === placeYInput) {
      autoGroundChk.checked = false;
      const enteredY = Number(placeYInput.value);
      worldState.requestedY = Number.isFinite(enteredY) ? Math.floor(enteredY) : 64;
      updateFootprintGroundSnap({ syncInputs: false });
      placeYInput.value = String(worldState.targetY);
    } else {
      updateFootprintGroundSnap({ syncInputs: false });
      if (autoGroundChk.checked) placeYInput.value = String(worldState.targetY);
    }
    drawWorldMapCanvas();
  });
}

autoGroundChk.addEventListener('change', () => {
  updateFootprintGroundSnap({ syncInputs: true });
  drawWorldMapCanvas();
});

groundOffsetInput.addEventListener('input', () => {
  if (autoGroundChk.checked) {
    updateFootprintGroundSnap({ syncInputs: true });
    drawWorldMapCanvas();
  }
});

autoSinkChk.addEventListener('change', () => {
  updateFootprintGroundSnap({ syncInputs: true });
  drawWorldMapCanvas();
});

topClearanceInput.addEventListener('input', () => {
  updateFootprintGroundSnap({ syncInputs: true });
  drawWorldMapCanvas();
});

for (const rbtn of document.querySelectorAll('[data-rot]')) {
  rbtn.addEventListener('click', () => {
    document.querySelectorAll('[data-rot]').forEach((b) => b.classList.remove('active'));
    rbtn.classList.add('active');
    const prevCenterX = worldState.targetX + worldState.outW * 0.5;
    const prevCenterZ = worldState.targetZ + worldState.outL * 0.5;
    worldState.rotation = Number(rbtn.dataset.rot) || 0;
    rebuildFootprintPreviewCanvas();
    worldState.targetX = Math.round(prevCenterX - worldState.outW * 0.5);
    worldState.targetZ = Math.round(prevCenterZ - worldState.outL * 0.5);
    updateFootprintGroundSnap({ syncInputs: true });
    drawWorldMapCanvas();
  });
}

mirrorXChk.addEventListener('change', () => {
  worldState.mirrorX = mirrorXChk.checked;
  rebuildFootprintPreviewCanvas();
  updateFootprintGroundSnap({ syncInputs: true });
  drawWorldMapCanvas();
});

function updateVoidFillUI() {
  const enabled = fillVoidChk.checked;
  const baseHollow = fillModeSelect.value === 'base_hollow';
  fillModeSelect.disabled = !enabled;
  fillBottomYInput.disabled = !enabled;
  fillBottomYField.classList.toggle('hidden', baseHollow);
  fillMaterialSelect.disabled = !enabled;
  if (enabled && !fillBottomYInput.value) {
    fillBottomYInput.value = String(worldState.worldInfo?.minY ?? -64);
  }
  voidFillHint.textContent = baseHollow
    ? '当前上方“基底 Y (高度)”就是模型底部高度；写入时只在基底 Y-1 铺一层指定材料，再把模型区块范围从基底 Y 一直清空到世界最高 Y，最后写入模型。勾选本项不会立即改动存档。'
    : '写入时会把底部 Y 到模型基底之间的原区块替换为底座材料。范围自动按模型实际占用的最小 XZ 区块矩形对齐到 16 格；勾选本项不会立即改动存档。';
  commitPlaceBtn.textContent = enabled && baseHollow
    ? '⚡ 写入模型 + 一层底座并挖空 (自动备份)'
    : '⚡ 写入存档地图 (自动备份)';
  updateCommitPlaceButtonState();
}

fillVoidChk.addEventListener('change', updateVoidFillUI);
fillModeSelect.addEventListener('change', updateVoidFillUI);
updateVoidFillUI();

commitPlaceBtn.addEventListener('click', async () => {
  if (!worldState.worldInfo || !state.currentGrid) return;
  commitPlaceBtn.disabled = true;
  const origLabel = commitPlaceBtn.textContent;
  commitPlaceBtn.textContent = '⏳ 正在备份并写入 .mca 区块...';

  try {
    const compactGrid = {
      width: state.currentGrid.width,
      height: state.currentGrid.height,
      length: state.currentGrid.length,
      blocks: state.currentGrid.blocks.map((b) => ({
        x: b.x,
        y: b.y,
        z: b.z,
        block: b.block.properties
          ? { id: b.block.id, properties: b.block.properties }
          : { id: b.block.id },
      })),
    };

    const res = await fetch('/api/worlds/place', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        worldPath: worldState.worldPath,
        grid: compactGrid,
        targetX: worldState.targetX,
        targetY: worldState.targetY,
        requestedBaseY: worldState.requestedY,
        targetZ: worldState.targetZ,
        rotation: worldState.rotation,
        mirrorX: worldState.mirrorX,
        includeAir: includeAirChk.checked,
        autoSink: autoSinkChk.checked,
        topClearanceLayers: getTopClearanceLayers(),
        fillVoid: fillVoidChk.checked,
        fillMode: fillModeSelect.value,
        fillBottomY: fillVoidChk.checked ? Number(fillBottomYInput.value) : null,
        fillMaterial: fillMaterialSelect.value,
        fillOverwrite: fillVoidChk.checked,
        label: (schemNameInput.value || 'Voxel_Build').trim(),
        maxBackups: getConfiguredMaxBackups(),
      }),
    });

    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);

    renderWorldBackupsUI(data.backups || []);
    markWorldPreviewDirty();

    const r = data.result;
    const pruneNote =
      r.prunedBackupIds?.length > 0 ? `（已自动清理 ${r.prunedBackupIds.length} 份超限旧备份）` : '';
    const fillNote = r.voidFill
      ? r.voidFill.mode === 'base_hollow'
        ? `，已铺一层底座并挖空 ${r.voidFill.width}×${r.voidFill.height}×${r.voidFill.length}（${r.voidFill.material.replace('minecraft:', '')}）`
        : `，已${r.voidFill.overwrite ? '覆盖填充' : '填充空气'} ${r.voidFill.width}×${r.voidFill.height}×${r.voidFill.length}（${r.voidFill.material.replace('minecraft:', '')}）`
      : '';
    const sinkNote = r.verticalPlacement?.settledBy > 0
      ? `，自动沉降 ${r.verticalPlacement.settledBy} 层至基底 Y=${r.verticalPlacement.baseY}`
      : '';
    showToast(
      `🎉 已写入存档！共放置 ${r.placedBlockCount} 方块${r.clearedBlockCount ? `，挖空 ${r.clearedBlockCount} 格` : ''}（跨 ${r.modifiedChunkCount} 个区块）${sinkNote}${fillNote}，已自动备份 .mca${pruneNote}。退出地图页签后刷新静态预览。`,
      4600
    );
  } catch (err) {
    showToast(`写入存档失败: ${err.message}`, 4500);
  } finally {
    commitPlaceBtn.textContent = origLabel;
    updateCommitPlaceButtonState();
  }
});

// ==================== Boot ====================
async function initApp() {
  resizeMcViewport();
  renderFamilyChipsUI();
  await Promise.all([refreshPresetsList(''), refreshLibraryAssets()]);

  // Open first asset (user's latest saved asset if any, else first built-in showcase)
  if (state.libraryAssets.length > 0) {
    await openAssetFromLibrary(state.libraryAssets[0]);
  }
}

initApp();
