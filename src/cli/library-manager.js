/**
 * Disk-Persisted Asset Library, Smart Version-Stamped Thumbnail Cache & Preset Manager
 *
 * Caching Policy:
 * - Every asset (`user` in `library/assets/<id>/` and `builtin` in `examples/`) has a deterministic
 *   `versionStamp` derived from file `mtimeMs` and `meta.updatedAt`.
 * - On first discovery (or whenever `versionStamp` changes due to an edit/save), a 240x152 isometric
 *   3D preview PNG + block dimensions are generated and cached on disk (`library/.cache/`).
 * - When opened in the WebGL Studio for the first time at that `versionStamp`, the cache can upgrade
 *   once to the textured WebGL snapshot (`thumbKind: 'webgl'`), and is NEVER regenerated again unless
 *   the asset is modified!
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  convertToLitematic,
  decodeLitematic,
  decodeSpongeSchem,
  encodeLitematic,
  encodeSpongeSchem,
  encodeMcFunction,
} from '../core/index.js';
import { loadInputSource } from './scene-runner.js';
import { createZipBuffer } from './zip.js';
import { renderGridThumbnailPng } from './thumbnail-renderer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../..');
export const LIBRARY_ROOT = path.join(PROJECT_ROOT, 'library');
const ASSETS_DIR = path.join(LIBRARY_ROOT, 'assets');
const CACHE_DIR = path.join(LIBRARY_ROOT, '.cache');
const CACHE_MANIFEST_FILE = path.join(CACHE_DIR, 'manifest.json');
const PRESETS_FILE = path.join(LIBRARY_ROOT, 'presets', 'presets.json');
const EXAMPLES_DIR = path.join(PROJECT_ROOT, 'examples');

const DEFAULT_PRESETS = [
  {
    id: 'preset-fireproof-survival',
    name: '🔥 生存防火·禁羊毛木质',
    builtIn: true,
    config: {
      useSlabs: false,
      hollowInterior: false,
      excludeGravity: true,
      survivalFriendly: true,
      brightness: 0,
      saturation: 100,
      ditherStrength: 0,
      disabledFamilies: ['wool', 'wood'],
      disabledBlocks: [],
      blockOverrides: {},
    },
  },
  {
    id: 'preset-gothic-deepslate',
    name: '🏰 暗黑哥特·深板岩混色',
    builtIn: true,
    config: {
      useSlabs: true,
      hollowInterior: false,
      excludeGravity: true,
      survivalFriendly: true,
      brightness: -14,
      saturation: 72,
      ditherStrength: 35,
      disabledFamilies: ['wool'],
      disabledBlocks: [],
      blockOverrides: {},
    },
  },
  {
    id: 'preset-pastel-terracotta',
    name: '🌸 柔和暖调·陶瓦方解石',
    builtIn: true,
    config: {
      useSlabs: true,
      hollowInterior: false,
      excludeGravity: true,
      survivalFriendly: true,
      brightness: 8,
      saturation: 85,
      ditherStrength: 15,
      disabledFamilies: ['wool'],
      disabledBlocks: [],
      blockOverrides: {
        'minecraft:stone_bricks': 'minecraft:calcite',
      },
    },
  },
  {
    id: 'preset-luminous-priority',
    name: '✨ 奥术高亮·光源优先',
    builtIn: true,
    config: {
      useSlabs: true,
      hollowInterior: false,
      excludeGravity: true,
      survivalFriendly: true,
      brightness: 4,
      saturation: 108,
      ditherStrength: 0,
      preferLightBlocks: true,
      disabledFamilies: ['wool'],
      disabledBlocks: [],
      blockOverrides: {},
    },
  },
];

export async function ensureLibraryDirs() {
  await fs.mkdir(ASSETS_DIR, { recursive: true });
  await fs.mkdir(CACHE_DIR, { recursive: true });
  await fs.mkdir(path.dirname(PRESETS_FILE), { recursive: true });
  try {
    await fs.access(PRESETS_FILE);
  } catch {
    await fs.writeFile(PRESETS_FILE, JSON.stringify(DEFAULT_PRESETS, null, 2), 'utf-8');
  }
}

async function readCacheManifest() {
  try {
    return JSON.parse(await fs.readFile(CACHE_MANIFEST_FILE, 'utf-8'));
  } catch {
    return {};
  }
}

async function writeCacheManifest(manifest) {
  await fs.writeFile(CACHE_MANIFEST_FILE, JSON.stringify(manifest, null, 2), 'utf-8');
}

function cacheThumbFilename(assetId) {
  const safe = String(assetId).replace(/[^a-zA-Z0-9\u4e00-\u9fa5._-]+/g, '__');
  return `${safe}.png`;
}

export function getCachedThumbPath(assetId) {
  return path.join(CACHE_DIR, cacheThumbFilename(assetId));
}

function sanitizeId(raw) {
  const cleaned = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return cleaned || 'asset';
}

function normalizeExt(ext) {
  const e = String(ext || 'html').toLowerCase().replace(/^\./, '');
  if (['html', 'htm', 'js', 'json', 'litematic', 'schem'].includes(e)) {
    return e === 'htm' ? 'html' : e;
  }
  return 'html';
}

async function fileExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function evaluateGridFromDisk(sourcePath, ext, cfg = {}) {
  if (ext === 'litematic' || ext === 'schem') {
    const raw = await fs.readFile(sourcePath);
    return ext === 'schem' ? decodeSpongeSchem(raw) : decodeLitematic(raw);
  }
  const src = await loadInputSource(sourcePath);
  const res = await convertToLitematic({
    voxelData: cfg?.preferScene ? null : src.voxelData,
    scene: src.scene,
    options: cfg || {},
  });
  return res.grid;
}

/**
 * List both user-saved library assets and built-in showcase examples.
 * Automatically builds & caches missing/outdated preview thumbnails ONCE, then reuses from disk!
 */
export async function listAllAssets() {
  await ensureLibraryDirs();
  const manifest = await readCacheManifest();
  let manifestDirty = false;
  const items = [];

  // 1. User library assets (`library/assets/<id>/meta.json`)
  const assetDirs = await fs.readdir(ASSETS_DIR, { withFileTypes: true }).catch(() => []);
  for (const dirent of assetDirs) {
    if (!dirent.isDirectory()) continue;
    const id = dirent.name;
    const assetDir = path.join(ASSETS_DIR, id);
    const metaPath = path.join(assetDir, 'meta.json');
    try {
      const meta = JSON.parse(await fs.readFile(metaPath, 'utf-8'));
      const ext = meta.sourceExt || 'html';
      const sourcePath = path.join(assetDir, `source.${ext}`);
      const thumbPath = path.join(assetDir, 'thumbnail.png');

      const srcStat = await fs.stat(sourcePath).catch(() => null);
      const versionStamp = Math.max(
        srcStat ? Math.round(srcStat.mtimeMs) : 0,
        meta.updatedAt || 0
      );

      let cachedEntry = manifest[id];
      const thumbExists = await fileExists(thumbPath);
      const isUpToDate =
        thumbExists && cachedEntry && cachedEntry.versionStamp === versionStamp;

      if (!isUpToDate && srcStat) {
        // Only regenerate if thumbnail is missing OR source/config was updated since last cache!
        const thumbStat = thumbExists ? await fs.stat(thumbPath).catch(() => null) : null;
        const sourceEditedDirectly =
          thumbStat && Math.round(srcStat.mtimeMs) > Math.round(thumbStat.mtimeMs) + 200;

        if (!thumbExists || sourceEditedDirectly || !meta.dimensions) {
          try {
            const grid = await evaluateGridFromDisk(sourcePath, ext, meta.config || {});
            const png = renderGridThumbnailPng(grid, 240, 152);
            await fs.writeFile(thumbPath, png);
            meta.dimensions = { width: grid.width, height: grid.height, length: grid.length };
            meta.blockCount = grid.blocks.length;
            meta.materialCount = grid.materials.length;
            await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
            cachedEntry = {
              versionStamp,
              thumbKind: 'software',
              dimensions: meta.dimensions,
              blockCount: meta.blockCount,
              materialCount: meta.materialCount,
            };
          } catch {
            cachedEntry = { versionStamp, thumbKind: thumbExists ? 'webgl' : 'none' };
          }
        } else {
          // User just saved from WebGL (thumbnail.png already freshly written alongside meta.json!)
          cachedEntry = {
            versionStamp,
            thumbKind: cachedEntry?.thumbKind || 'webgl',
            dimensions: meta.dimensions,
            blockCount: meta.blockCount,
            materialCount: meta.materialCount,
          };
        }
        manifest[id] = cachedEntry;
        manifestDirty = true;
      }

      const finalHasThumb = await fileExists(thumbPath);
      items.push({
        ...meta,
        id,
        kind: 'user',
        versionStamp,
        thumbKind: cachedEntry?.thumbKind || (finalHasThumb ? 'webgl' : 'none'),
        sourceUrl: `/api/library/assets/${encodeURIComponent(id)}/source`,
        thumbnailUrl: finalHasThumb
          ? `/api/library/assets/${encodeURIComponent(id)}/thumbnail?v=${versionStamp}`
          : null,
      });
    } catch {
      // Skip incomplete folder
    }
  }

  items.sort((a, b) => {
    if (Boolean(b.favorite) !== Boolean(a.favorite)) return b.favorite ? 1 : -1;
    return (b.updatedAt || 0) - (a.updatedAt || 0);
  });

  // 2. Built-in examples (`examples/*.html` / `*.json`) with persistent version-stamped thumbnail cache!
  const exFiles = await fs.readdir(EXAMPLES_DIR).catch(() => []);
  for (const fname of exFiles.sort()) {
    if (!fname.endsWith('.html') && !fname.endsWith('.json')) continue;
    const id = `example:${fname}`;
    const ext = path.extname(fname).slice(1).toLowerCase();
    const baseName = path.basename(fname, path.extname(fname));
    const fullExPath = path.join(EXAMPLES_DIR, fname);
    const stat = await fs.stat(fullExPath).catch(() => null);
    const versionStamp = stat ? Math.round(stat.mtimeMs) : 0;

    const cachedThumbPath = getCachedThumbPath(id);
    let cachedEntry = manifest[id];
    const thumbExists = await fileExists(cachedThumbPath);

    if (!thumbExists || !cachedEntry || cachedEntry.versionStamp !== versionStamp) {
      // Build cached preview & dimensions ONCE for this file mtime!
      try {
        const grid = await evaluateGridFromDisk(fullExPath, ext, {});
        const png = renderGridThumbnailPng(grid, 240, 152);
        await fs.writeFile(cachedThumbPath, png);
        cachedEntry = {
          versionStamp,
          thumbKind: 'software',
          dimensions: { width: grid.width, height: grid.height, length: grid.length },
          blockCount: grid.blocks.length,
          materialCount: grid.materials.length,
        };
        manifest[id] = cachedEntry;
        manifestDirty = true;
      } catch {
        cachedEntry = {
          versionStamp,
          thumbKind: 'none',
          dimensions: null,
          blockCount: null,
          materialCount: null,
        };
      }
    }

    const hasExThumb = await fileExists(cachedThumbPath);
    items.push({
      id,
      name: baseName,
      kind: 'builtin',
      sourceExt: ext,
      tags: ['内置示例'],
      favorite: false,
      versionStamp,
      thumbKind: cachedEntry.thumbKind || 'software',
      dimensions: cachedEntry.dimensions || null,
      blockCount: cachedEntry.blockCount ?? null,
      materialCount: cachedEntry.materialCount ?? null,
      config: null,
      createdAt: versionStamp,
      updatedAt: versionStamp,
      sourceUrl: `/examples/${encodeURIComponent(fname)}`,
      thumbnailUrl: hasExThumb
        ? `/api/library/cache-thumb/${encodeURIComponent(id)}?v=${versionStamp}`
        : null,
    });
  }

  if (manifestDirty) {
    await writeCacheManifest(manifest);
  }

  return items;
}

/**
 * Upgrade an asset's cached thumbnail to a crisp WebGL-rendered PNG ONCE per `versionStamp`.
 * Subsequent loads at the same `versionStamp` skip re-uploading completely!
 */
export async function cacheWebglThumbnailForAsset(assetId, { versionStamp, thumbnailDataUrl }) {
  if (!thumbnailDataUrl || !thumbnailDataUrl.startsWith('data:image/png;base64,')) {
    return { updated: false };
  }
  await ensureLibraryDirs();
  const manifest = await readCacheManifest();
  const pngBuf = Buffer.from(thumbnailDataUrl.slice('data:image/png;base64,'.length), 'base64');

  if (String(assetId).startsWith('example:')) {
    const fname = path.basename(String(assetId).slice('example:'.length));
    const stat = await fs.stat(path.join(EXAMPLES_DIR, fname)).catch(() => null);
    if (!stat) return { updated: false };
    const currentStamp = Math.round(stat.mtimeMs);
    if (versionStamp && Number(versionStamp) !== currentStamp) {
      return { updated: false };
    }
    if (manifest[assetId]?.versionStamp === currentStamp && manifest[assetId]?.thumbKind === 'webgl') {
      return { updated: false, cached: true };
    }
    await fs.writeFile(getCachedThumbPath(assetId), pngBuf);
    manifest[assetId] = {
      ...(manifest[assetId] || {}),
      versionStamp: currentStamp,
      thumbKind: 'webgl',
    };
    await writeCacheManifest(manifest);
    return { updated: true, versionStamp: currentStamp };
  }

  // User asset
  const info = await getAssetMetaAndPaths(assetId);
  const srcStat = await fs.stat(info.sourcePath).catch(() => null);
  const currentStamp = Math.max(
    srcStat ? Math.round(srcStat.mtimeMs) : 0,
    info.meta.updatedAt || 0
  );
  if (manifest[info.id]?.versionStamp === currentStamp && manifest[info.id]?.thumbKind === 'webgl') {
    return { updated: false, cached: true };
  }
  await fs.writeFile(info.thumbPath, pngBuf);
  manifest[info.id] = {
    ...(manifest[info.id] || {}),
    versionStamp: currentStamp,
    thumbKind: 'webgl',
  };
  await writeCacheManifest(manifest);
  return { updated: true, versionStamp: currentStamp };
}

export async function getAssetMetaAndPaths(id) {
  await ensureLibraryDirs();
  const safe = path.basename(id);
  const dir = path.join(ASSETS_DIR, safe);
  const metaPath = path.join(dir, 'meta.json');
  const meta = JSON.parse(await fs.readFile(metaPath, 'utf-8'));
  const sourcePath = path.join(dir, `source.${meta.sourceExt || 'html'}`);
  const thumbPath = path.join(dir, 'thumbnail.png');
  return { id: safe, dir, metaPath, sourcePath, thumbPath, meta };
}

/**
 * Create or update a user asset on disk (`source.<ext>`, `meta.json`, and cached `thumbnail.png`).
 */
export async function saveUserAsset({
  id = null,
  name = 'Untitled_Voxel_Asset',
  sourceExt = 'html',
  sourceText = null,
  sourceBase64 = null,
  thumbnailDataUrl = null,
  tags = [],
  favorite = undefined,
  dimensions = null,
  blockCount = null,
  materialCount = null,
  config = null,
}) {
  await ensureLibraryDirs();

  const ext = normalizeExt(sourceExt);
  let targetId = id && !String(id).startsWith('example:') ? path.basename(id) : null;
  let existingMeta = null;

  if (targetId) {
    try {
      const loaded = await getAssetMetaAndPaths(targetId);
      existingMeta = loaded.meta;
    } catch {
      existingMeta = null;
    }
  }

  if (!targetId) {
    const slug = sanitizeId(name);
    const shortRand = crypto.randomBytes(2).toString('hex');
    targetId = `${slug}-${shortRand}`;
  }

  const assetDir = path.join(ASSETS_DIR, targetId);
  await fs.mkdir(assetDir, { recursive: true });

  const finalExt = sourceText != null || sourceBase64 != null ? ext : (existingMeta?.sourceExt || ext);
  const sourcePath = path.join(assetDir, `source.${finalExt}`);
  const thumbPath = path.join(assetDir, 'thumbnail.png');

  if (sourceBase64 != null) {
    const cleanB64 = sourceBase64.replace(/^data:[^;]+;base64,/, '');
    await fs.writeFile(sourcePath, Buffer.from(cleanB64, 'base64'));
  } else if (sourceText != null) {
    await fs.writeFile(sourcePath, String(sourceText), 'utf-8');
  }

  let finalDims = dimensions ?? existingMeta?.dimensions ?? null;
  let finalBlockCount = blockCount ?? existingMeta?.blockCount ?? null;
  let finalMatCount = materialCount ?? existingMeta?.materialCount ?? null;
  let thumbKind = 'webgl';

  if (thumbnailDataUrl && thumbnailDataUrl.startsWith('data:image/png;base64,')) {
    const b64 = thumbnailDataUrl.slice('data:image/png;base64,'.length);
    await fs.writeFile(thumbPath, Buffer.from(b64, 'base64'));
    thumbKind = 'webgl';
  }

  // If batch-imported without WebGL thumbnail or without dimensions, evaluate & render cached preview once!
  if (!thumbnailDataUrl || finalDims == null || finalBlockCount == null) {
    try {
      const grid = await evaluateGridFromDisk(sourcePath, finalExt, config || existingMeta?.config || {});
      finalDims = { width: grid.width, height: grid.height, length: grid.length };
      finalBlockCount = grid.blocks.length;
      finalMatCount = grid.materials.length;
      if (!thumbnailDataUrl) {
        const png = renderGridThumbnailPng(grid, 240, 152);
        await fs.writeFile(thumbPath, png);
        thumbKind = 'software';
      }
    } catch {
      // Leave null if draft fails evaluation
    }
  }

  const now = Date.now();
  const nextMeta = {
    id: targetId,
    name: String(name || existingMeta?.name || targetId).trim(),
    sourceExt: finalExt,
    tags: Array.isArray(tags) ? tags : (existingMeta?.tags || []),
    favorite: favorite !== undefined ? Boolean(favorite) : Boolean(existingMeta?.favorite),
    dimensions: finalDims,
    blockCount: finalBlockCount,
    materialCount: finalMatCount,
    config: config !== undefined ? (config || existingMeta?.config || null) : (existingMeta?.config || null),
    createdAt: existingMeta?.createdAt || now,
    updatedAt: now,
  };

  await fs.writeFile(path.join(assetDir, 'meta.json'), JSON.stringify(nextMeta, null, 2), 'utf-8');

  const srcStat = await fs.stat(sourcePath).catch(() => null);
  const versionStamp = Math.max(srcStat ? Math.round(srcStat.mtimeMs) : 0, now);
  const manifest = await readCacheManifest();
  manifest[targetId] = {
    versionStamp,
    thumbKind,
    dimensions: finalDims,
    blockCount: finalBlockCount,
    materialCount: finalMatCount,
  };
  await writeCacheManifest(manifest);

  return nextMeta;
}

export async function updateAssetMetadataOnly(id, patch = {}) {
  const { dir, metaPath, meta } = await getAssetMetaAndPaths(id);
  const configChanged = patch.config !== undefined;
  const updated = {
    ...meta,
    ...(patch.name !== undefined ? { name: String(patch.name).trim() || meta.name } : {}),
    ...(patch.favorite !== undefined ? { favorite: Boolean(patch.favorite) } : {}),
    ...(patch.tags !== undefined ? { tags: Array.isArray(patch.tags) ? patch.tags : meta.tags } : {}),
    ...(configChanged ? { config: patch.config } : {}),
    // Only bump updatedAt on content/config change so mere rename/favorite doesn't invalidate cached thumbnail!
    updatedAt: configChanged ? Date.now() : (meta.updatedAt || Date.now()),
  };
  await fs.writeFile(metaPath, JSON.stringify(updated, null, 2), 'utf-8');
  return { ...updated, dir };
}

export async function deleteUserAsset(id) {
  await ensureLibraryDirs();
  const safe = path.basename(id);
  const dir = path.join(ASSETS_DIR, safe);
  await fs.rm(dir, { recursive: true, force: true });
  const manifest = await readCacheManifest();
  if (manifest[safe]) {
    delete manifest[safe];
    await writeCacheManifest(manifest);
  }
}

export async function batchExportAssets(assetIds, format = 'litematic', fallbackPreset = '1.21') {
  const fmt = ['litematic', 'schem', 'mcfunction'].includes(format) ? format : 'litematic';
  const exportedFiles = [];

  for (const rawId of assetIds) {
    let sourcePath;
    let ext;
    let assetName;
    let cfg = {};

    if (String(rawId).startsWith('example:')) {
      const fname = path.basename(String(rawId).slice('example:'.length));
      sourcePath = path.join(EXAMPLES_DIR, fname);
      ext = path.extname(fname).slice(1).toLowerCase();
      assetName = path.basename(fname, path.extname(fname));
    } else {
      const info = await getAssetMetaAndPaths(rawId);
      sourcePath = info.sourcePath;
      ext = info.meta.sourceExt;
      assetName = info.meta.name || info.id;
      cfg = info.meta.config || {};
    }

    const safeFileBase = assetName.replace(/[^\w\u4e00-\u9fa5-]+/g, '_') || 'schematic';
    let outBytes;

    if (ext === 'litematic' || ext === 'schem') {
      const rawBuf = await fs.readFile(sourcePath);
      const grid = ext === 'schem' ? await decodeSpongeSchem(rawBuf) : await decodeLitematic(rawBuf);
      const meta = {
        name: safeFileBase,
        versionPreset: cfg.versionPreset || fallbackPreset,
        author: 'three2litematic',
      };
      if (fmt === 'schem') outBytes = await encodeSpongeSchem(grid, meta);
      else if (fmt === 'mcfunction') outBytes = encodeMcFunction(grid, meta);
      else outBytes = await encodeLitematic(grid, meta);
    } else {
      const loaded = await loadInputSource(sourcePath);
      const res = await convertToLitematic({
        voxelData: cfg.preferScene ? null : loaded.voxelData,
        scene: loaded.scene,
        options: {
          ...cfg,
          format: fmt,
          versionPreset: cfg.versionPreset || fallbackPreset,
          name: safeFileBase,
        },
      });
      outBytes = res.bytes;
    }

    exportedFiles.push({
      name: `${safeFileBase}.${fmt}`,
      data: outBytes,
    });
  }

  if (exportedFiles.length === 1) {
    return {
      isZip: false,
      filename: exportedFiles[0].name,
      buffer: Buffer.from(exportedFiles[0].data),
    };
  }

  const seen = new Map();
  for (const f of exportedFiles) {
    const count = seen.get(f.name) || 0;
    seen.set(f.name, count + 1);
    if (count > 0) {
      const dot = f.name.lastIndexOf('.');
      f.name = `${f.name.slice(0, dot)}_${count + 1}${f.name.slice(dot)}`;
    }
  }

  return {
    isZip: true,
    filename: `three2litematic-batch-${fmt}.zip`,
    buffer: createZipBuffer(exportedFiles),
  };
}

// ==================== Style & Override Presets CRUD ====================
export async function listPresets() {
  await ensureLibraryDirs();
  try {
    const list = JSON.parse(await fs.readFile(PRESETS_FILE, 'utf-8'));
    if (!Array.isArray(list)) return DEFAULT_PRESETS;
    return [...DEFAULT_PRESETS, ...list.filter((preset) => !preset.builtIn)];
  } catch {
    return DEFAULT_PRESETS;
  }
}

export async function savePreset({ name, config }) {
  const presets = await listPresets();
  const id = `preset-${sanitizeId(name)}-${crypto.randomBytes(2).toString('hex')}`;
  const entry = {
    id,
    name: String(name || '自定义预设').trim(),
    builtIn: false,
    createdAt: Date.now(),
    config,
  };
  presets.push(entry);
  await fs.writeFile(PRESETS_FILE, JSON.stringify(presets, null, 2), 'utf-8');
  return entry;
}

export async function deletePreset(id) {
  const presets = await listPresets();
  const filtered = presets.filter((p) => p.id !== id || p.builtIn);
  await fs.writeFile(PRESETS_FILE, JSON.stringify(filtered, null, 2), 'utf-8');
  return filtered;
}
