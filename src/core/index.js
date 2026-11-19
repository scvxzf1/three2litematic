export {
  VERSION_PRESETS,
  BLOCK_FAMILIES,
  BLOCK_DATABASE,
  SLAB_DATABASE,
  BLOCK_BY_ID,
  getBlockNameZh,
  getFilteredPalette,
  getFilteredSlabs,
  makeSlabVariant,
} from './palette.js';
export {
  parseRgb,
  rgbToHex,
  rgbToLab,
  deltaE2000,
  bayer3dThreshold,
  gradeAndDitherRgb,
  createBlockMatcher,
} from './color-matcher.js';
export { TAG, nbt, encodeNbt, decodeNbt, gzipCompress, gzipDecompress } from './nbt.js';
export {
  computeBitsPerEntry,
  packLitematicaBitArray,
  unpackLitematicaBitArray,
  canonicalBlockKey,
  encodeLitematic,
  decodeLitematic,
  computeMaterialList,
} from './litematic.js';
export { encodeSpongeSchem, decodeSpongeSchem, encodeMcFunction } from './exporters.js';
export { extractStructuredVoxels, extractSceneVoxels } from './voxelizer.js';
export { buildBlockGrid } from './postprocess.js';
export { resolveVerticalPlacement } from './placement.js';

import { extractStructuredVoxels, extractSceneVoxels } from './voxelizer.js';
import { buildBlockGrid } from './postprocess.js';
import { encodeLitematic } from './litematic.js';
import { encodeSpongeSchem, encodeMcFunction } from './exporters.js';

/**
 * End-to-end conversion from either structured voxel data or a THREE.Scene
 * into block grid preview data and `.litematic` / `.schem` / `.mcfunction` bytes.
 */
export async function convertToLitematic({ voxelData = null, scene = null, options = {} }) {
  let extracted;
  if (voxelData && (Array.isArray(voxelData) || Array.isArray(voxelData.voxels))) {
    extracted = extractStructuredVoxels(voxelData, options);
  } else if (scene) {
    extracted = extractSceneVoxels(scene, options);
  } else {
    throw new Error('未提供有效的 __VOXEL_DATA__ 或 THREE.Scene 数据。');
  }

  const grid = buildBlockGrid(extracted.voxels, options);
  const meta = {
    name: options.name || extracted.metadata?.name || 'ThreeJS_Voxel_Build',
    author: options.author || extracted.metadata?.author || 'three2litematic',
    description: options.description || extracted.metadata?.description || '',
    versionPreset: options.versionPreset || '1.21',
    previewImageData: options.previewImageData || null,
  };

  const format = (options.format || 'litematic').toLowerCase();
  let bytes;
  if (format === 'schem') {
    bytes = await encodeSpongeSchem(grid, meta);
  } else if (format === 'mcfunction') {
    bytes = encodeMcFunction(grid, meta);
  } else {
    bytes = await encodeLitematic(grid, meta);
  }

  return {
    format,
    mode: extracted.mode,
    effectiveScale: extracted.effectiveScale ?? 1,
    rawVoxelCount: extracted.voxels.length,
    grid,
    meta,
    bytes,
  };
}
