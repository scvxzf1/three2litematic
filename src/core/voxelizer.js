/**
 * Dual-Mode Three.js -> Voxel Grid Extractor
 * - Mode 1 (Lossless): Structured `__VOXEL_DATA__` or 1:1 Axis-Aligned Box/InstancedMesh scenes
 * - Mode 2 (Mesh Voxelizer): Arbitrary Three.js BufferGeometries (spheres, cones, cylinders, rotated meshes)
 */

import { parseRgb, rgbToHex } from './color-matcher.js';

function isObjectVisible(obj) {
  let cur = obj;
  while (cur) {
    if (cur.visible === false) return false;
    if (cur.userData && cur.userData.ignoreSchematic === true) return false;
    cur = cur.parent;
  }
  return true;
}

function extractMaterialProps(mat, instanceRgb = null) {
  const m = mat || {};
  let rgb = [207, 213, 214];
  if (m.color != null) {
    if (typeof m.color.getHex === 'function') {
      rgb = parseRgb(m.color.getHex());
    } else {
      rgb = parseRgb(m.color);
    }
  }

  if (instanceRgb) {
    rgb = [
      Math.round((rgb[0] * instanceRgb[0]) / 255),
      Math.round((rgb[1] * instanceRgb[1]) / 255),
      Math.round((rgb[2] * instanceRgb[2]) / 255),
    ];
  }

  let emissive = null;
  let emissiveIntensity = m.emissiveIntensity ?? 1.0;
  if (m.emissive != null) {
    const eRgb =
      typeof m.emissive.getHex === 'function'
        ? parseRgb(m.emissive.getHex())
        : parseRgb(m.emissive, [0, 0, 0]);
    if (eRgb[0] > 5 || eRgb[1] > 5 || eRgb[2] > 5) {
      emissive = rgbToHex(eRgb);
    } else {
      emissiveIntensity = 0;
    }
  } else if (m.type === 'MeshBasicMaterial' && m.userData?.isLight) {
    emissive = rgbToHex(rgb);
    emissiveIntensity = 1.0;
  }

  const transparent = Boolean(m.transparent);
  const opacity = transparent ? (m.opacity ?? 1.0) : 1.0;

  return {
    color: rgbToHex(rgb),
    rgb,
    opacity,
    emissive,
    emissiveIntensity,
    block: m.userData?.block || null,
    isLight: Boolean(m.userData?.isLight),
    unlit: m.type === 'MeshBasicMaterial',
    side: m.side ?? 0,
  };
}

/**
 * Check if a 4x4 column-major matrix (Three.js Matrix4.elements) has only axis-aligned
 * rotation/scale (each upper-left 3x3 row/col has at most 1 non-zero entry).
 */
function isAxisAlignedMatrix(e, eps = 1e-3) {
  const cols = [
    [Math.abs(e[0]), Math.abs(e[1]), Math.abs(e[2])],
    [Math.abs(e[4]), Math.abs(e[5]), Math.abs(e[6])],
    [Math.abs(e[8]), Math.abs(e[9]), Math.abs(e[10])],
  ];
  for (const c of cols) {
    const maxV = Math.max(c[0], c[1], c[2]);
    if (maxV < 1e-6) return false;
    let nonZero = 0;
    for (let i = 0; i < 3; i++) {
      if (c[i] > maxV * eps) nonZero++;
    }
    if (nonZero !== 1) return false;
  }
  return true;
}

function transformPoint(e, x, y, z) {
  return [
    e[0] * x + e[4] * y + e[8] * z + e[12],
    e[1] * x + e[5] * y + e[9] * z + e[13],
    e[2] * x + e[6] * y + e[10] * z + e[14],
  ];
}

function multiplyMatrices4(a, b) {
  const out = new Float64Array(16);
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      out[col * 4 + row] =
        a[0 * 4 + row] * b[col * 4 + 0] +
        a[1 * 4 + row] * b[col * 4 + 1] +
        a[2 * 4 + row] * b[col * 4 + 2] +
        a[3 * 4 + row] * b[col * 4 + 3];
    }
  }
  return out;
}

function computePrimitiveWorldBox(geom, matElements) {
  const posAttr = geom.attributes?.position;
  if (!posAttr || posAttr.count === 0) return null;

  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  // Fast path for BoxGeometry using its 8 corners
  if (geom.type === 'BoxGeometry' && geom.parameters) {
    const hw = (geom.parameters.width ?? 1) * 0.5;
    const hh = (geom.parameters.height ?? 1) * 0.5;
    const hd = (geom.parameters.depth ?? 1) * 0.5;
    for (const sx of [-hw, hw]) {
      for (const sy of [-hh, hh]) {
        for (const sz of [-hd, hd]) {
          const [wx, wy, wz] = transformPoint(matElements, sx, sy, sz);
          if (wx < minX) minX = wx;
          if (wy < minY) minY = wy;
          if (wz < minZ) minZ = wz;
          if (wx > maxX) maxX = wx;
          if (wy > maxY) maxY = wy;
          if (wz > maxZ) maxZ = wz;
        }
      }
    }
    return { minX, minY, minZ, maxX, maxY, maxZ };
  }

  const count = posAttr.count;
  for (let i = 0; i < count; i++) {
    const [wx, wy, wz] = transformPoint(
      matElements,
      posAttr.getX(i),
      posAttr.getY(i),
      posAttr.getZ(i)
    );
    if (wx < minX) minX = wx;
    if (wy < minY) minY = wy;
    if (wz < minZ) minZ = wz;
    if (wx > maxX) maxX = wx;
    if (wy > maxY) maxY = wy;
    if (wz > maxZ) maxZ = wz;
  }
  return { minX, minY, minZ, maxX, maxY, maxZ };
}

function isNearInteger(value, epsilon = 1e-3) {
  return Math.abs(value - Math.round(value)) <= epsilon;
}

function getTriangleIndices(geometry, triangleIndex) {
  const indexAttr = geometry.index;
  return indexAttr
    ? [
        indexAttr.getX(triangleIndex * 3),
        indexAttr.getX(triangleIndex * 3 + 1),
        indexAttr.getX(triangleIndex * 3 + 2),
      ]
    : [triangleIndex * 3, triangleIndex * 3 + 1, triangleIndex * 3 + 2];
}

/**
 * A voxel-face mesh is a merged BufferGeometry whose triangles are individual
 * 1x1 cube faces on the integer grid. This is common in generated Three.js
 * scenes. Recovering the source cubes is lossless and avoids downscaling a
 * whole castle merely because it is made from one large geometry.
 */
function classifyVoxelFacePrimitive(primitive) {
  const { geom, matrix } = primitive;
  const pos = geom.attributes?.position;
  if (!pos) return { isVoxelFaceMesh: false, triangles: 0, faceTriangles: 0 };

  const triCount = geom.index
    ? Math.floor(geom.index.count / 3)
    : Math.floor(pos.count / 3);
  if (triCount === 0) return { isVoxelFaceMesh: false, triangles: 0, faceTriangles: 0 };

  let faceTriangles = 0;
  for (let t = 0; t < triCount; t++) {
    const [i0, i1, i2] = getTriangleIndices(geom, t);
    const a = transformPoint(matrix, pos.getX(i0), pos.getY(i0), pos.getZ(i0));
    const b = transformPoint(matrix, pos.getX(i1), pos.getY(i1), pos.getZ(i1));
    const c = transformPoint(matrix, pos.getX(i2), pos.getY(i2), pos.getZ(i2));

    if (![a, b, c].every((vertex) => vertex.every((value) => isNearInteger(value)))) continue;

    const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const cross = [
      ab[1] * ac[2] - ab[2] * ac[1],
      ab[2] * ac[0] - ab[0] * ac[2],
      ab[0] * ac[1] - ab[1] * ac[0],
    ];
    const axis = cross.findIndex((value) => Math.abs(value) > 0.5);
    if (axis < 0) continue;

    const tangentAxes = [0, 1, 2].filter((value) => value !== axis);
    if (tangentAxes.some((value) => ![a, b, c].every((vertex) => isNearInteger(vertex[value])))) {
      continue;
    }
    if (![a, b, c].every((vertex) => vertex[axis] === a[axis])) continue;

    const spansUnit = tangentAxes.every((value) => {
      const min = Math.min(a[value], b[value], c[value]);
      const max = Math.max(a[value], b[value], c[value]);
      return Math.abs(max - min - 1) <= 1e-3;
    });
    if (spansUnit) faceTriangles++;
  }

  return {
    isVoxelFaceMesh: faceTriangles >= 2 && faceTriangles / triCount >= 0.8,
    triangles: triCount,
    faceTriangles,
  };
}

function resolveTriangleMaterial(primitive, triangleIndex, indices) {
  const { geom, materials, matProps } = primitive;
  const groups = geom.groups && geom.groups.length > 0 ? geom.groups : null;
  const vColorAttr = geom.attributes.color || null;
  const [i0, i1, i2] = indices;

  let triMat = matProps;
  if (groups && materials.length > 1) {
    for (const group of groups) {
      if (triangleIndex * 3 >= group.start && triangleIndex * 3 < group.start + group.count) {
        triMat = extractMaterialProps(materials[group.materialIndex] || materials[0]);
        break;
      }
    }
  }

  if (!vColorAttr) return triMat;

  const cr = Math.max(vColorAttr.getX(i0), vColorAttr.getX(i1), vColorAttr.getX(i2)) * 255;
  const cg = Math.max(vColorAttr.getY(i0), vColorAttr.getY(i1), vColorAttr.getY(i2)) * 255;
  const cb = Math.max(vColorAttr.getZ(i0), vColorAttr.getZ(i1), vColorAttr.getZ(i2)) * 255;
  const blended = [
    Math.round((triMat.rgb[0] * cr) / 255),
    Math.round((triMat.rgb[1] * cg) / 255),
    Math.round((triMat.rgb[2] * cb) / 255),
  ];
  return { ...triMat, color: rgbToHex(blended), rgb: blended };
}

function extractVoxelFacePrimitive(primitive, voxelMap, exactKeys) {
  const { geom, matrix } = primitive;
  const pos = geom.attributes.position;
  const triCount = geom.index ? Math.floor(geom.index.count / 3) : Math.floor(pos.count / 3);

  for (let t = 0; t < triCount; t++) {
    const indices = getTriangleIndices(geom, t);
    const a = transformPoint(matrix, pos.getX(indices[0]), pos.getY(indices[0]), pos.getZ(indices[0]));
    const b = transformPoint(matrix, pos.getX(indices[1]), pos.getY(indices[1]), pos.getZ(indices[1]));
    const c = transformPoint(matrix, pos.getX(indices[2]), pos.getY(indices[2]), pos.getZ(indices[2]));
    if (![a, b, c].every((vertex) => vertex.every((value) => isNearInteger(value)))) continue;

    const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const cross = [
      ab[1] * ac[2] - ab[2] * ac[1],
      ab[2] * ac[0] - ab[0] * ac[2],
      ab[0] * ac[1] - ab[1] * ac[0],
    ];
    const axis = cross.findIndex((value) => Math.abs(value) > 0.5);
    if (axis < 0 || !isNearInteger(a[axis])) continue;

    const tangentAxes = [0, 1, 2].filter((value) => value !== axis);
    if (tangentAxes.some((value) => ![a, b, c].every((vertex) => isNearInteger(vertex[value])))) {
      continue;
    }
    const minU = Math.round(Math.min(a[tangentAxes[0]], b[tangentAxes[0]], c[tangentAxes[0]]));
    const minV = Math.round(Math.min(a[tangentAxes[1]], b[tangentAxes[1]], c[tangentAxes[1]]));
    const maxU = Math.round(Math.max(a[tangentAxes[0]], b[tangentAxes[0]], c[tangentAxes[0]]));
    const maxV = Math.round(Math.max(a[tangentAxes[1]], b[tangentAxes[1]], c[tangentAxes[1]]));
    if (maxU - minU !== 1 || maxV - minV !== 1) continue;

    const normalSign = cross[axis] > 0 ? 1 : -1;
    const plane = Math.round(a[axis]);
    const voxel = [0, 0, 0];
    voxel[axis] = normalSign > 0 ? plane - 1 : plane;
    voxel[tangentAxes[0]] = minU;
    voxel[tangentAxes[1]] = minV;

    const matProps = resolveTriangleMaterial(primitive, t, indices);
    const key = `${voxel[0]},${voxel[1]},${voxel[2]}`;
    if (!voxelMap.has(key)) {
      voxelMap.set(key, {
        x: voxel[0],
        y: voxel[1],
        z: voxel[2],
        color: matProps.color,
        block: matProps.block,
        opacity: matProps.opacity,
        emissive: matProps.emissive,
        emissiveIntensity: matProps.emissiveIntensity,
        isLight: Boolean(matProps.isLight),
        unlit: Boolean(matProps.unlit),
        subYMin: 0,
        subYMax: 1,
      });
      exactKeys.add(key);
    }
  }
}

/**
 * Mode 1a: Normalize explicit structured `__VOXEL_DATA__` produced by Skill or JSON.
 */
export function extractStructuredVoxels(raw, options = {}) {
  const list = Array.isArray(raw) ? raw : raw?.voxels;
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error('结构化体素数据为空（未找到有效的 voxels 数组）。');
  }

  const scale = Math.max(1, Math.round(Number(options.structuredScale) || 1));
  const voxelMap = new Map();

  for (const item of list) {
    if (!item) continue;
    let x, y, z, desc;
    if (Array.isArray(item)) {
      [x, y, z] = item;
      const fourth = item[3];
      desc =
        typeof fourth === 'string' && fourth.startsWith('minecraft:')
          ? { block: fourth }
          : typeof fourth === 'object' && fourth !== null
          ? fourth
          : { color: fourth };
    } else {
      x = item.x;
      y = item.y;
      z = item.z;
      desc = item;
    }

    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue;
    const baseX = Math.round(x) * scale;
    const baseY = Math.round(y) * scale;
    const baseZ = Math.round(z) * scale;

    for (let dx = 0; dx < scale; dx++) {
      for (let dy = 0; dy < scale; dy++) {
        for (let dz = 0; dz < scale; dz++) {
          const vx = baseX + dx;
          const vy = baseY + dy;
          const vz = baseZ + dz;
          voxelMap.set(`${vx},${vy},${vz}`, {
            x: vx,
            y: vy,
            z: vz,
            color: desc.color ?? null,
            block: desc.block ?? null,
            opacity: desc.opacity ?? 1.0,
            emissive: desc.emissive ?? null,
            emissiveIntensity: desc.emissiveIntensity ?? (desc.isLight ? 1.0 : 0.0),
            isLight: Boolean(desc.isLight),
            unlit: Boolean(desc.unlit),
            slab: desc.slab || null,
            subYMin: desc.slab === 'top' ? 0.5 : 0.0,
            subYMax: desc.slab === 'bottom' ? 0.5 : 1.0,
          });
        }
      }
    }
  }

  return {
    mode: 'structured',
    metadata: !Array.isArray(raw)
      ? {
          name: raw.name || null,
          author: raw.author || null,
          description: raw.description || null,
        }
      : {},
    voxels: Array.from(voxelMap.values()),
  };
}

/**
 * Mode 1b + Mode 2: Extract voxels from any live or shimmed THREE.Scene!
 */
export function extractSceneVoxels(scene, options = {}) {
  const {
    scaleMode = 'auto', // 'auto' | '1:1' | 'fit'
    targetSize = 64,
    ignoreBackdrop = true,
  } = options;

  if (!scene || typeof scene.traverse !== 'function') {
    throw new Error('无效的 THREE.Scene 对象。');
  }

  if (typeof scene.updateMatrixWorld === 'function') {
    scene.updateMatrixWorld(true);
  }

  const primitives = [];

  scene.traverse((obj) => {
    if (!isObjectVisible(obj)) return;
    if (obj.isLine || obj.isPoints || obj.isSprite || obj.isLight || obj.isCamera) return;
    if (!obj.isMesh && !obj.isInstancedMesh) return;
    const geom = obj.geometry;
    if (!geom || !geom.attributes?.position) return;

    const baseMaterials = Array.isArray(obj.material) ? obj.material : [obj.material];
    // Skip BackSide sky domes (side === 1 in Three.js)
    if (ignoreBackdrop && baseMaterials[0]?.side === 1) return;
    if (ignoreBackdrop && /sky|skybox|skydome|stars|cloud_dome/i.test(obj.name || '')) return;

    const worldEls = obj.matrixWorld?.elements || [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];

    if (obj.isInstancedMesh && Number.isFinite(obj.count) && obj.count > 0) {
      const instArr = obj.instanceMatrix?.array;
      const colorArr = obj.instanceColor?.array;
      for (let i = 0; i < obj.count; i++) {
        const localEls = instArr
          ? instArr.subarray(i * 16, i * 16 + 16)
          : [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
        const combined = multiplyMatrices4(worldEls, localEls);
        const bbox = computePrimitiveWorldBox(geom, combined);
        if (!bbox) continue;

        let instRgb = null;
        if (colorArr) {
          instRgb = [
            Math.round(Math.max(0, Math.min(1, colorArr[i * 3])) * 255),
            Math.round(Math.max(0, Math.min(1, colorArr[i * 3 + 1])) * 255),
            Math.round(Math.max(0, Math.min(1, colorArr[i * 3 + 2])) * 255),
          ];
        }
        const matProps = extractMaterialProps(baseMaterials[0], instRgb);
        if (obj.userData?.block && !matProps.block) matProps.block = obj.userData.block;

        primitives.push({
          geom,
          materials: baseMaterials,
          matProps,
          matrix: combined,
          bbox,
          isAlignedBox: geom.type === 'BoxGeometry' && isAxisAlignedMatrix(combined),
        });
      }
    } else {
      const bbox = computePrimitiveWorldBox(geom, worldEls);
      if (!bbox) return;
      const matProps = extractMaterialProps(baseMaterials[0], null);
      if (obj.userData?.block && !matProps.block) matProps.block = obj.userData.block;

      primitives.push({
        geom,
        materials: baseMaterials,
        matProps,
        matrix: worldEls,
        bbox,
        isAlignedBox: geom.type === 'BoxGeometry' && isAxisAlignedMatrix(worldEls),
      });
    }
  });

  if (primitives.length === 0) {
    throw new Error('Three.js 场景中未检测到任何可见的 3D Mesh 网格。');
  }

  const voxelFacePrimitives = [];
  for (const primitive of primitives) {
    const classification = classifyVoxelFacePrimitive(primitive);
    if (classification.isVoxelFaceMesh) voxelFacePrimitives.push(primitive);
  }

  if (voxelFacePrimitives.length > 0) {
    const voxelMap = new Map();
    const exactKeys = new Set();

    for (const primitive of voxelFacePrimitives) {
      extractVoxelFacePrimitive(primitive, voxelMap, exactKeys);
    }

    if (voxelMap.size > 0) {
      let minX = Infinity, minY = Infinity, minZ = Infinity;
      let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
      for (const voxel of voxelMap.values()) {
        if (voxel.x < minX) minX = voxel.x;
        if (voxel.y < minY) minY = voxel.y;
        if (voxel.z < minZ) minZ = voxel.z;
        if (voxel.x > maxX) maxX = voxel.x;
        if (voxel.y > maxY) maxY = voxel.y;
        if (voxel.z > maxZ) maxZ = voxel.z;
      }

      const span = Math.max(maxX - minX + 1, maxY - minY + 1, maxZ - minZ + 1);
      const margin = Math.max(4, span * 0.12);
      const hybridPrimitives = primitives.filter((primitive) => {
        if (voxelFacePrimitives.includes(primitive)) return false;
        const bbox = primitive.bbox;
        return (
          bbox.minX >= minX - margin &&
          bbox.maxX <= maxX + 1 + margin &&
          bbox.minY >= minY - margin &&
          bbox.maxY <= maxY + 1 + margin &&
          bbox.minZ >= minZ - margin &&
          bbox.maxZ <= maxZ + 1 + margin
        );
      });

      for (const primitive of hybridPrimitives) {
        const { geom, matrix } = primitive;
        const pos = geom.attributes.position;
        const triCount = geom.index
          ? Math.floor(geom.index.count / 3)
          : Math.floor(pos.count / 3);

        for (let t = 0; t < triCount; t++) {
          const indices = getTriangleIndices(geom, t);
          const world = indices.map((index) =>
            transformPoint(matrix, pos.getX(index), pos.getY(index), pos.getZ(index))
          );
          const [w0, w1, w2] = world;
          const triMat = resolveTriangleMaterial(primitive, t, indices);

          const e1Len = Math.hypot(w1[0] - w0[0], w1[1] - w0[1], w1[2] - w0[2]);
          const e2Len = Math.hypot(w2[0] - w0[0], w2[1] - w0[1], w2[2] - w0[2]);
          const e3Len = Math.hypot(w2[0] - w1[0], w2[1] - w1[1], w2[2] - w1[2]);
          const step = 0.45;
          const stepsU = Math.min(256, Math.max(1, Math.ceil(e1Len / step)));
          const stepsV = Math.min(256, Math.max(1, Math.ceil(Math.max(e2Len, e3Len) / step)));

          for (let su = 0; su <= stepsU; su++) {
            const u = su / stepsU;
            const maxSv = Math.ceil((1 - u) * stepsV);
            for (let sv = 0; sv <= maxSv; sv++) {
              const v = stepsV === 0 ? 0 : Math.min(1 - u, sv / stepsV);
              const w = 1 - u - v;
              const px = Math.floor(w * w0[0] + u * w1[0] + v * w2[0]);
              const py = Math.floor(w * w0[1] + u * w1[1] + v * w2[1]);
              const pz = Math.floor(w * w0[2] + u * w1[2] + v * w2[2]);
              if (
                px < minX - margin || px > maxX + margin ||
                py < minY - margin || py > maxY + margin ||
                pz < minZ - margin || pz > maxZ + margin
              ) {
                continue;
              }

              const key = `${px},${py},${pz}`;
              if (exactKeys.has(key)) continue;
              voxelMap.set(key, {
                x: px,
                y: py,
                z: pz,
                color: triMat.color,
                block: triMat.block,
                opacity: triMat.opacity,
                emissive: triMat.emissive,
                emissiveIntensity: triMat.emissiveIntensity,
                isLight: Boolean(triMat.isLight),
                unlit: Boolean(triMat.unlit),
                subYMin: 0,
                subYMax: 1,
              });
            }
          }
        }
      }

      return {
        mode: 'native-voxel-mesh',
        effectiveScale: 1,
        metadata: {},
        voxels: Array.from(voxelMap.values()),
      };
    }
  }

  // Detect & clip/ignore giant flat ground backdrops so main subject keeps full resolution
  let activePrimitives = primitives;
  let groundClipBounds = null;

  if (ignoreBackdrop && primitives.length >= 4) {
    // Use the median span instead of an upper percentile. With only a few
    // primitives, an upper percentile can select the giant ground plane
    // itself and then fail to recognize it as an outlier.
    const spans = primitives
      .map((p) => Math.max(p.bbox.maxX - p.bbox.minX, p.bbox.maxZ - p.bbox.minZ))
      .sort((a, b) => a - b);
    const coreSpan = spans[Math.floor(spans.length * 0.5)] || spans[spans.length - 1];

    const corePrims = primitives.filter((p) => {
      const spanXZ = Math.max(p.bbox.maxX - p.bbox.minX, p.bbox.maxZ - p.bbox.minZ);
      const spanY = p.bbox.maxY - p.bbox.minY;
      const isGiantFlatPlane = spanXZ > Math.max(40, coreSpan * 3.5) && spanY <= Math.max(1.5, spanXZ * 0.03);
      const isGiantSphere = spanXZ > Math.max(80, coreSpan * 6);
      return !isGiantFlatPlane && !isGiantSphere;
    });

    if (corePrims.length > 0 && corePrims.length < primitives.length) {
      let cMinX = Infinity, cMinZ = Infinity, cMaxX = -Infinity, cMaxZ = -Infinity;
      for (const p of corePrims) {
        if (p.bbox.minX < cMinX) cMinX = p.bbox.minX;
        if (p.bbox.minZ < cMinZ) cMinZ = p.bbox.minZ;
        if (p.bbox.maxX > cMaxX) cMaxX = p.bbox.maxX;
        if (p.bbox.maxZ > cMaxZ) cMaxZ = p.bbox.maxZ;
      }
      const margin = Math.max(2, (cMaxX - cMinX) * 0.08);
      groundClipBounds = {
        minX: cMinX - margin,
        maxX: cMaxX + margin,
        minZ: cMinZ - margin,
        maxZ: cMaxZ + margin,
      };
      // Keep non-giant spheres; clip giant flat ground planes to core footprint!
      activePrimitives = primitives.filter((p) => {
        const spanXZ = Math.max(p.bbox.maxX - p.bbox.minX, p.bbox.maxZ - p.bbox.minZ);
        const spanY = p.bbox.maxY - p.bbox.minY;
        const isGiantSphere = spanXZ > Math.max(80, coreSpan * 6) && spanY > spanXZ * 0.3;
        return !isGiantSphere;
      });
    }
  }

  // Compute overall scene bounding box (applying groundClipBounds if present)
  let sMinX = Infinity, sMinY = Infinity, sMinZ = Infinity;
  let sMaxX = -Infinity, sMaxY = -Infinity, sMaxZ = -Infinity;
  let alignedIntegerBoxCount = 0;

  for (const p of activePrimitives) {
    const bx0 = groundClipBounds ? Math.max(p.bbox.minX, groundClipBounds.minX) : p.bbox.minX;
    const bx1 = groundClipBounds ? Math.min(p.bbox.maxX, groundClipBounds.maxX) : p.bbox.maxX;
    const bz0 = groundClipBounds ? Math.max(p.bbox.minZ, groundClipBounds.minZ) : p.bbox.minZ;
    const bz1 = groundClipBounds ? Math.min(p.bbox.maxZ, groundClipBounds.maxZ) : p.bbox.maxZ;
    if (bx0 > bx1 || bz0 > bz1) continue;

    if (bx0 < sMinX) sMinX = bx0;
    if (p.bbox.minY < sMinY) sMinY = p.bbox.minY;
    if (bz0 < sMinZ) sMinZ = bz0;
    if (bx1 > sMaxX) sMaxX = bx1;
    if (p.bbox.maxY > sMaxY) sMaxY = p.bbox.maxY;
    if (bz1 > sMaxZ) sMaxZ = bz1;

    if (p.isAlignedBox) {
      const dx = p.bbox.maxX - p.bbox.minX;
      const dy = p.bbox.maxY - p.bbox.minY;
      const dz = p.bbox.maxZ - p.bbox.minZ;
      const nearInt =
        Math.abs(dx - Math.round(dx)) < 0.08 &&
        Math.abs(dy - Math.round(dy)) < 0.08 &&
        Math.abs(dz - Math.round(dz)) < 0.08 &&
        dx >= 0.85 && dy >= 0.85 && dz >= 0.85;
      if (nearInt) alignedIntegerBoxCount++;
    }
  }

  const maxSpan = Math.max(sMaxX - sMinX, sMaxY - sMinY, sMaxZ - sMinZ, 1e-3);
  const alignedRatio = alignedIntegerBoxCount / activePrimitives.length;

  let effectiveScale = 1.0;
  let detectedMode = 'mesh-voxelized';

  if (scaleMode === '1:1') {
    effectiveScale = 1.0;
    detectedMode = 'grid-1to1';
  } else if (scaleMode === 'fit') {
    effectiveScale = Math.max(1, Number(targetSize) || 64) / maxSpan;
    detectedMode = 'mesh-voxelized';
  } else {
    // 'auto': if predominantly integer-sized aligned boxes within reasonable build dimensions, keep 1:1!
    if (alignedRatio >= 0.75 && maxSpan >= 3 && maxSpan <= 256) {
      effectiveScale = 1.0;
      detectedMode = 'grid-1to1';
    } else {
      effectiveScale = Math.max(4, Number(targetSize) || 64) / maxSpan;
      detectedMode = 'mesh-voxelized';
    }
  }

  const voxelMap = new Map();
  const maxGridCoord = 384; // Safety cap per axis

  function setVoxel(vx, vy, vz, matProps, subY0 = 0, subY1 = 1) {
    if (
      Math.abs(vx) > 4096 ||
      Math.abs(vy) > 4096 ||
      Math.abs(vz) > 4096
    ) {
      return;
    }
    const key = `${vx},${vy},${vz}`;
    const prev = voxelMap.get(key);
    voxelMap.set(key, {
      x: vx,
      y: vy,
      z: vz,
      color: matProps.color,
      block: matProps.block,
      opacity: matProps.opacity,
      emissive: matProps.emissive,
      emissiveIntensity: matProps.emissiveIntensity,
      isLight: Boolean(matProps.isLight),
      unlit: Boolean(matProps.unlit),
      subYMin: prev ? Math.min(prev.subYMin, subY0) : subY0,
      subYMax: prev ? Math.max(prev.subYMax, subY1) : subY1,
    });
  }

  // Sort primitives from largest volume to smallest so fine architectural details overwrite coarse base blocks!
  const sortedPrimitives = [...activePrimitives].sort((a, b) => {
    const volA = (a.bbox.maxX - a.bbox.minX) * (a.bbox.maxY - a.bbox.minY) * (a.bbox.maxZ - a.bbox.minZ);
    const volB = (b.bbox.maxX - b.bbox.minX) * (b.bbox.maxY - b.bbox.minY) * (b.bbox.maxZ - b.bbox.minZ);
    return volB - volA;
  });

  for (const p of sortedPrimitives) {
    let bx0 = p.bbox.minX;
    let bx1 = p.bbox.maxX;
    let bz0 = p.bbox.minZ;
    let bz1 = p.bbox.maxZ;
    if (groundClipBounds) {
      bx0 = Math.max(bx0, groundClipBounds.minX);
      bx1 = Math.min(bx1, groundClipBounds.maxX);
      bz0 = Math.max(bz0, groundClipBounds.minZ);
      bz1 = Math.min(bz1, groundClipBounds.maxZ);
      if (bx0 > bx1 || bz0 > bz1) continue;
    }

    if (p.isAlignedBox) {
      // Exact AABB rasterization with sub-voxel Y bounds for half-height eaves/steps
      const rawY0 = (p.bbox.minY - sMinY) * effectiveScale;
      const rawY1 = (p.bbox.maxY - sMinY) * effectiveScale;
      const eps = 0.05;
      const gx0 = Math.round((bx0 - sMinX) * effectiveScale + eps);
      const gx1 = Math.max(gx0, Math.round((bx1 - sMinX) * effectiveScale - eps) - 1);
      const gy0 = Math.floor(rawY0 + eps);
      const gy1 = Math.max(gy0, Math.ceil(rawY1 - eps) - 1);
      const gz0 = Math.round((bz0 - sMinZ) * effectiveScale + eps);
      const gz1 = Math.max(gz0, Math.round((bz1 - sMinZ) * effectiveScale - eps) - 1);

      const capX1 = Math.min(gx1, gx0 + maxGridCoord);
      const capY1 = Math.min(gy1, gy0 + maxGridCoord);
      const capZ1 = Math.min(gz1, gz0 + maxGridCoord);

      for (let vy = gy0; vy <= capY1; vy++) {
        const sy0 = Math.max(0, Math.min(1, rawY0 - vy));
        const sy1 = Math.max(0, Math.min(1, rawY1 - vy));
        for (let vx = gx0; vx <= capX1; vx++) {
          for (let vz = gz0; vz <= capZ1; vz++) {
            setVoxel(vx, vy, vz, p.matProps, sy0, sy1);
          }
        }
      }
      continue;
    }

    // Mode 2: General Triangle Surface Rasterization (handles spheres, cones, cylinders, rotated meshes, vertex colors)
    const geom = p.geom;
    const pos = geom.attributes.position;
    const vColorAttr = geom.attributes.color || null;
    const indexAttr = geom.index;
    const triCount = indexAttr ? Math.floor(indexAttr.count / 3) : Math.floor(pos.count / 3);
    const groups = geom.groups && geom.groups.length > 0 ? geom.groups : null;

    function getMaterialForVertexIndex(vertIdx) {
      if (!groups || p.materials.length <= 1) return p.matProps;
      for (const g of groups) {
        if (vertIdx >= g.start && vertIdx < g.start + g.count) {
          return extractMaterialProps(p.materials[g.materialIndex] || p.materials[0]);
        }
      }
      return p.matProps;
    }

    for (let t = 0; t < triCount; t++) {
      const i0 = indexAttr ? indexAttr.getX(t * 3) : t * 3;
      const i1 = indexAttr ? indexAttr.getX(t * 3 + 1) : t * 3 + 1;
      const i2 = indexAttr ? indexAttr.getX(t * 3 + 2) : t * 3 + 2;

      const w0 = transformPoint(p.matrix, pos.getX(i0), pos.getY(i0), pos.getZ(i0));
      const w1 = transformPoint(p.matrix, pos.getX(i1), pos.getY(i1), pos.getZ(i1));
      const w2 = transformPoint(p.matrix, pos.getX(i2), pos.getY(i2), pos.getZ(i2));

      // Clip triangles completely outside groundClipBounds
      if (groundClipBounds) {
        if (
          Math.max(w0[0], w1[0], w2[0]) < groundClipBounds.minX ||
          Math.min(w0[0], w1[0], w2[0]) > groundClipBounds.maxX ||
          Math.max(w0[2], w1[2], w2[2]) < groundClipBounds.minZ ||
          Math.min(w0[2], w1[2], w2[2]) > groundClipBounds.maxZ
        ) {
          continue;
        }
      }

      const v0x = (w0[0] - sMinX) * effectiveScale;
      const v0y = (w0[1] - sMinY) * effectiveScale;
      const v0z = (w0[2] - sMinZ) * effectiveScale;

      const v1x = (w1[0] - sMinX) * effectiveScale;
      const v1y = (w1[1] - sMinY) * effectiveScale;
      const v1z = (w1[2] - sMinZ) * effectiveScale;

      const v2x = (w2[0] - sMinX) * effectiveScale;
      const v2y = (w2[1] - sMinY) * effectiveScale;
      const v2z = (w2[2] - sMinZ) * effectiveScale;

      let triMat = getMaterialForVertexIndex(t * 3);
      if (vColorAttr) {
        const cr = ((vColorAttr.getX(i0) + vColorAttr.getX(i1) + vColorAttr.getX(i2)) / 3) * 255;
        const cg = ((vColorAttr.getY(i0) + vColorAttr.getY(i1) + vColorAttr.getY(i2)) / 3) * 255;
        const cb = ((vColorAttr.getZ(i0) + vColorAttr.getZ(i1) + vColorAttr.getZ(i2)) / 3) * 255;
        const blended = [
          Math.round((triMat.rgb[0] * cr) / 255),
          Math.round((triMat.rgb[1] * cg) / 255),
          Math.round((triMat.rgb[2] * cb) / 255),
        ];
        triMat = { ...triMat, color: rgbToHex(blended), rgb: blended };
      }

      const e1Len = Math.hypot(v1x - v0x, v1y - v0y, v1z - v0z);
      const e2Len = Math.hypot(v2x - v0x, v2y - v0y, v2z - v0z);
      const e3Len = Math.hypot(v2x - v1x, v2y - v1y, v2z - v1z);

      const step = 0.45;
      const stepsU = Math.min(256, Math.max(1, Math.ceil(e1Len / step)));
      const stepsV = Math.min(256, Math.max(1, Math.ceil(Math.max(e2Len, e3Len) / step)));

      for (let su = 0; su <= stepsU; su++) {
        const u = su / stepsU;
        const maxSv = Math.ceil((1 - u) * stepsV);
        for (let sv = 0; sv <= maxSv; sv++) {
          const v = stepsV === 0 ? 0 : Math.min(1 - u, sv / stepsV);
          const w = 1 - u - v;
          const fx = w * v0x + u * v1x + v * v2x;
          const fy = w * v0y + u * v1y + v * v2y;
          const fz = w * v0z + u * v1z + v * v2z;

          // A giant ground triangle can cross the whole clip box while all
          // three of its vertices remain outside. Clip per sample instead of
          // only rejecting triangles that are entirely outside.
          if (groundClipBounds) {
            const wx = fx + sMinX;
            const wz = fz + sMinZ;
            if (
              wx < groundClipBounds.minX ||
              wx > groundClipBounds.maxX ||
              wz < groundClipBounds.minZ ||
              wz > groundClipBounds.maxZ
            ) {
              continue;
            }
          }

          const px = Math.floor(fx);
          const py = Math.floor(fy);
          const pz = Math.floor(fz);
          const fracY = fy - py;
          setVoxel(px, py, pz, triMat, fracY, fracY);
        }
      }
    }
  }

  return {
    mode: detectedMode,
    effectiveScale,
    metadata: {},
    voxels: Array.from(voxelMap.values()),
  };
}
