/**
 * Offline Minecraft World (.mca Anvil Region & level.dat) Inspector, 2D Map Renderer & Safe Structure Placer
 *
 * Supports:
 * - Modern Chunk NBT (`MC 1.18 ~ 1.21.11+`, `sections[].block_states`, Y = -64..319, `d.spawn.pos` & `SpawnX/Y/Z`)
 * - Legacy Chunk NBT (`MC 1.16.5 ~ 1.17.1`, `Level.Sections[].Palette/BlockStates`, Y = 0..255)
 * - 2D Hillshaded Top-Down World Terrain Map + Heightmap extraction
 * - 0° / 90° / 180° / 270° Structure Rotation & X-Mirroring (including directional blockstate properties!)
 * - Atomic `.mca` Backup & 1-Click Rollback (`<world>/.three2litematic-backups/`)
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import zlib from 'node:zlib';
import { TAG, nbt, encodeNbt, decodeNbt, gzipDecompress } from '../core/nbt.js';
import { BLOCK_BY_ID } from '../core/palette.js';
import { parseRgb } from '../core/color-matcher.js';
import { resolveVerticalPlacement } from '../core/placement.js';
import { encodePngRgba } from './thumbnail-renderer.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const PROJECT_ROOT = path.resolve(__dirname, '../..');

// ==================== Terrain Cartography Palette ====================
const TERRAIN_HEX_OVERRIDES = {
  'minecraft:grass_block': '#6ab04c',
  'minecraft:podzol': '#6d5032',
  'minecraft:mycelium': '#7b6d78',
  'minecraft:dirt_path': '#a68953',
  'minecraft:farmland': '#734f2c',
  'minecraft:dirt': '#866043',
  'minecraft:coarse_dirt': '#77553b',
  'minecraft:rooted_dirt': '#866348',
  'minecraft:water': '#2b6cb0',
  'minecraft:bubble_column': '#2b6cb0',
  'minecraft:lava': '#ea580c',
  'minecraft:bedrock': '#4b5563',
  'minecraft:sand': '#e2d49b',
  'minecraft:red_sand': '#bf6724',
  'minecraft:gravel': '#858180',
  'minecraft:snow': '#f4f9fc',
  'minecraft:snow_block': '#f4f9fc',
  'minecraft:powder_snow': '#f4f9fc',
  'minecraft:ice': '#8ab4f8',
  'minecraft:packed_ice': '#7aa5f0',
  'minecraft:blue_ice': '#6094ea',
  'minecraft:oak_leaves': '#487d28',
  'minecraft:spruce_leaves': '#335936',
  'minecraft:birch_leaves': '#5f8042',
  'minecraft:jungle_leaves': '#428422',
  'minecraft:acacia_leaves': '#577a28',
  'minecraft:dark_oak_leaves': '#38661e',
  'minecraft:mangrove_leaves': '#4b7a29',
  'minecraft:azalea_leaves': '#5c7c2f',
  'minecraft:flowering_azalea_leaves': '#726b5c',
  'minecraft:cherry_leaves': '#e7b2c9',
  'minecraft:pale_oak_leaves': '#8a9188',
  'minecraft:oak_log': '#6d5532',
  'minecraft:spruce_log': '#3b2713',
  'minecraft:birch_log': '#d6d5d0',
  'minecraft:jungle_log': '#59461c',
  'minecraft:acacia_log': '#676056',
  'minecraft:dark_oak_log': '#3c2e1a',
  'minecraft:cherry_log': '#38222c',
};

const IGNORED_SURFACE_DECOR = new Set([
  'minecraft:air',
  'minecraft:cave_air',
  'minecraft:void_air',
  'minecraft:light',
  'minecraft:short_grass',
  'minecraft:grass',
  'minecraft:tall_grass',
  'minecraft:fern',
  'minecraft:large_fern',
  'minecraft:dead_bush',
  'minecraft:seagrass',
  'minecraft:tall_seagrass',
  'minecraft:kelp',
  'minecraft:kelp_plant',
  'minecraft:vine',
  'minecraft:glow_lichen',
  'minecraft:lily_pad',
  'minecraft:sugar_cane',
  'minecraft:dandelion',
  'minecraft:poppy',
  'minecraft:blue_orchid',
  'minecraft:allium',
  'minecraft:azure_bluet',
  'minecraft:oxeye_daisy',
  'minecraft:cornflower',
  'minecraft:pink_petals',
  'minecraft:leaf_litter',
  'minecraft:wildflowers',
  'minecraft:bush',
  'minecraft:firefly_bush',
]);

function getTerrainRgb(blockId) {
  if (TERRAIN_HEX_OVERRIDES[blockId]) {
    return parseRgb(TERRAIN_HEX_OVERRIDES[blockId]);
  }
  const db = BLOCK_BY_ID.get(blockId);
  if (db) return parseRgb(db.hex);

  // Heuristic fallbacks for slabs/stairs/walls/ores not explicitly in table
  if (blockId.includes('deepslate')) return [66, 66, 70];
  if (blockId.includes('stone') || blockId.includes('andesite') || blockId.includes('cobble')) return [124, 124, 126];
  if (blockId.includes('sand')) return [218, 204, 154];
  if (blockId.includes('oak') || blockId.includes('spruce') || blockId.includes('wood') || blockId.includes('planks')) return [142, 108, 66];
  if (blockId.includes('copper')) return [172, 108, 82];
  if (blockId.includes('prismarine')) return [78, 152, 142];
  if (blockId.includes('cherry')) return [226, 176, 188];
  if (blockId.includes('leaves') || blockId.includes('moss')) return [76, 122, 46];
  if (blockId.includes('terracotta')) return [152, 94, 68];
  if (blockId.includes('quartz') || blockId.includes('diorite') || blockId.includes('calcite')) return [220, 218, 214];
  return [135, 138, 142];
}

// ==================== Chunk Section Bit-Packing (MC 1.16 ~ 1.21.11+) ====================
export function computeChunkSectionBits(paletteSize) {
  if (paletteSize <= 1) return 0;
  return Math.max(4, 32 - Math.clz32(paletteSize - 1));
}

export function unpackChunkSectionIndices(longArray, paletteSize, dataVersion = 3955) {
  const out = new Uint16Array(4096);
  if (paletteSize <= 1 || !longArray || longArray.length === 0) return out;

  const bits = computeChunkSectionBits(paletteSize);
  const mask = (1n << BigInt(bits)) - 1n;

  if (dataVersion < 2529) {
    // Legacy pre-1.16 spanning bit array
    for (let i = 0; i < 4096; i++) {
      const bitPos = i * bits;
      const startIdx = Math.floor(bitPos / 64);
      const startOff = bitPos % 64;
      let val = BigInt.asUintN(64, longArray[startIdx] ?? 0n) >> BigInt(startOff);
      if (startOff + bits > 64 && startIdx + 1 < longArray.length) {
        val |= BigInt.asUintN(64, longArray[startIdx + 1]) << BigInt(64 - startOff);
      }
      out[i] = Number(val & mask);
    }
    return out;
  }

  // Standard MC 1.16+ non-spanning bit array
  const valuesPerLong = Math.floor(64 / bits);
  for (let i = 0; i < 4096; i++) {
    const longIdx = Math.floor(i / valuesPerLong);
    if (longIdx >= longArray.length) break;
    const bitOff = (i % valuesPerLong) * bits;
    const raw = BigInt.asUintN(64, longArray[longIdx]);
    out[i] = Number((raw >> BigInt(bitOff)) & mask);
  }
  return out;
}

export function packChunkSectionIndices(indices, paletteSize) {
  if (paletteSize <= 1) return null;
  const bits = computeChunkSectionBits(paletteSize);
  const valuesPerLong = Math.floor(64 / bits);
  const totalLongs = Math.ceil(4096 / valuesPerLong);
  const out = new BigUint64Array(totalLongs);
  const mask = (1n << BigInt(bits)) - 1n;

  for (let i = 0; i < 4096; i++) {
    const v = indices[i];
    if (v === 0) continue;
    const longIdx = Math.floor(i / valuesPerLong);
    const bitOff = (i % valuesPerLong) * bits;
    out[longIdx] |= (BigInt(v) & mask) << BigInt(bitOff);
  }
  return out;
}

// ==================== Anvil (.mca) Binary Reader & Writer ====================
/**
 * Parse an `.mca` region buffer into a 1024-entry array of raw compressed sector chunks.
 */
export function parseMcaBuffer(buf) {
  const u8 = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  const slots = new Array(1024).fill(null);
  if (u8.length < 8192) return slots;

  for (let i = 0; i < 1024; i++) {
    const loc = u8.readUInt32BE(i * 4);
    const sectorOffset = loc >>> 8;
    const sectorCount = loc & 0xff;
    const timestamp = u8.readUInt32BE(4096 + i * 4);

    if (sectorOffset >= 2 && sectorCount > 0) {
      const byteStart = sectorOffset * 4096;
      if (byteStart + 5 <= u8.length) {
        const exactLen = u8.readUInt32BE(byteStart);
        const compressionType = u8[byteStart + 4];
        const dataEnd = byteStart + 4 + exactLen;
        if (exactLen > 1 && dataEnd <= u8.length) {
          slots[i] = {
            compressionType,
            compressedPayload: u8.subarray(byteStart + 5, dataEnd),
            timestamp,
          };
        }
      }
    }
  }
  return slots;
}

export function decodeChunkSlotNbt(slot) {
  if (!slot) return null;
  let uncompressed;
  if (slot.compressionType === 2) {
    uncompressed = zlib.inflateSync(slot.compressedPayload);
  } else if (slot.compressionType === 1) {
    uncompressed = zlib.gunzipSync(slot.compressedPayload);
  } else if (slot.compressionType === 3) {
    uncompressed = slot.compressedPayload;
  } else {
    throw new Error(`未知的区块压缩类型: ${slot.compressionType}`);
  }
  return decodeNbt(uncompressed).root;
}

export function encodeChunkSlotNbt(rootCompound, timestamp = Math.floor(Date.now() / 1000)) {
  const rawNbt = encodeNbt(rootCompound, '');
  const compressed = zlib.deflateSync(rawNbt, { level: 6 });
  return {
    compressionType: 2, // Standard Zlib (RFC 1950)
    compressedPayload: compressed,
    timestamp: timestamp >>> 0,
  };
}

/**
 * Serialize 1024 chunk slots back into a 4096-byte sector-aligned `.mca` Buffer.
 */
export function buildMcaBuffer(slots) {
  const locHeader = Buffer.alloc(4096);
  const timeHeader = Buffer.alloc(4096);
  const sectorChunks = [locHeader, timeHeader];
  let currentSector = 2;

  for (let i = 0; i < 1024; i++) {
    const slot = slots[i];
    if (!slot || !slot.compressedPayload) continue;

    const payloadLen = slot.compressedPayload.length + 1; // +1 for compressionType byte
    const totalBytes = 4 + payloadLen;
    const sectorsNeeded = Math.ceil(totalBytes / 4096);
    if (sectorsNeeded > 255) {
      throw new Error(`区块 ${i} 超过 Anvil 255 扇区上限`);
    }

    const padded = Buffer.alloc(sectorsNeeded * 4096);
    padded.writeUInt32BE(payloadLen, 0);
    padded[4] = slot.compressionType;
    Buffer.from(slot.compressedPayload).copy(padded, 5);

    const locEntry = ((currentSector & 0xffffff) << 8) | (sectorsNeeded & 0xff);
    locHeader.writeUInt32BE(locEntry >>> 0, i * 4);
    timeHeader.writeUInt32BE((slot.timestamp || Math.floor(Date.now() / 1000)) >>> 0, i * 4);

    sectorChunks.push(padded);
    currentSector += sectorsNeeded;
  }

  return Buffer.concat(sectorChunks);
}

// ==================== World Discovery & Metadata ====================
async function fileExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

export async function readWorldMetadata(worldPath) {
  const absWorld = path.resolve(worldPath);
  const levelDatPath = path.join(absWorld, 'level.dat');
  const rawLevel = await fs.readFile(levelDatPath);
  const ungz = await gzipDecompress(rawLevel);
  const { root } = decodeNbt(ungz);
  const d = root.value.Data?.value || root.value;

  const dataVersion = d.DataVersion?.value ?? d.Version?.value?.Id?.value ?? 3955;
  const mcVersionName = d.Version?.value?.Name?.value || (dataVersion >= 2844 ? '1.18+' : '1.16+');
  const levelName = d.LevelName?.value || path.basename(absWorld);
  const lastPlayed = Number(d.LastPlayed?.value ?? 0);

  // Spawn position: supports both 1.21.9+ `d.spawn.pos` IntArray AND classic `SpawnX/SpawnY/SpawnZ`!
  let spawnPos = [0, 64, 0];
  if (d.spawn?.value?.pos?.value && d.spawn.value.pos.value.length >= 3) {
    const p = d.spawn.value.pos.value;
    spawnPos = [Number(p[0]), Number(p[1]), Number(p[2])];
  } else if (d.SpawnX != null && d.SpawnZ != null) {
    spawnPos = [d.SpawnX.value, d.SpawnY?.value ?? 64, d.SpawnZ.value];
  }

  let playerPos = null;
  if (d.Player?.value?.Pos?.value && d.Player.value.Pos.value.length >= 3) {
    const pp = d.Player.value.Pos.value;
    playerPos = [
      Math.round(Number(pp[0].value)),
      Math.round(Number(pp[1].value)),
      Math.round(Number(pp[2].value)),
    ];
  }

  const regionDir = path.join(absWorld, 'region');
  const regFiles = (await fs.readdir(regionDir).catch(() => [])).filter((f) => f.endsWith('.mca'));

  // Check if session.lock was touched very recently (warning hint)
  const lockStat = await fs.stat(path.join(absWorld, 'session.lock')).catch(() => null);
  const possiblyActiveInGame = Boolean(lockStat && Date.now() - lockStat.mtimeMs < 5000);

  const backups = await listWorldBackups(absWorld);
  const parentDirName = path.basename(path.dirname(absWorld));
  const grandParentName = path.basename(path.dirname(path.dirname(absWorld)));
  const instanceName =
    parentDirName === 'saves' && grandParentName && grandParentName !== '.minecraft'
      ? grandParentName
      : '';

  return {
    worldPath: absWorld,
    folderName: path.basename(absWorld),
    instanceName,
    levelName,
    mcVersionName,
    dataVersion,
    isModern118: dataVersion >= 2844,
    minY: dataVersion >= 2844 ? -64 : 0,
    maxY: dataVersion >= 2844 ? 319 : 255,
    spawnPos,
    playerPos,
    regionCount: regFiles.length,
    possiblyActiveInGame,
    lastPlayed,
    backups,
  };
}

/**
 * Scan standard `.minecraft/saves` AND HMCL version-isolated `versions/<ver>/saves` directories!
 */
export async function discoverMinecraftWorlds() {
  const home = os.homedir();
  const mcRoots = [
    path.join(home, '.minecraft'),
    path.resolve(PROJECT_ROOT, '../HMCL/.minecraft'),
    path.resolve(PROJECT_ROOT, '../.minecraft'),
  ];

  const candidateSaveDirs = [];
  for (const mcRoot of mcRoots) {
    if (!(await fileExists(mcRoot))) continue;
    candidateSaveDirs.push(path.join(mcRoot, 'saves'));

    const versionsDir = path.join(mcRoot, 'versions');
    const verEntries = await fs.readdir(versionsDir, { withFileTypes: true }).catch(() => []);
    for (const ve of verEntries) {
      if (ve.isDirectory()) {
        candidateSaveDirs.push(path.join(versionsDir, ve.name, 'saves'));
      }
    }
  }

  const worlds = [];
  const seenPaths = new Set();

  for (const savesDir of candidateSaveDirs) {
    const entries = await fs.readdir(savesDir, { withFileTypes: true }).catch(() => []);
    for (const ent of entries) {
      if (!ent.isDirectory()) continue;
      const wPath = path.resolve(savesDir, ent.name);
      if (seenPaths.has(wPath)) continue;
      if (!(await fileExists(path.join(wPath, 'level.dat')))) continue;
      seenPaths.add(wPath);
      try {
        const info = await readWorldMetadata(wPath);
        worlds.push(info);
      } catch {
        // Ignore corrupted or non-Java-Edition world folders
      }
    }
  }

  worlds.sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0));
  return worlds;
}

// ==================== Unified Section Reader (1.16.5~1.17 & 1.18~1.21.11+) ====================
function isChunkGeneratedFull(chunkRoot) {
  const r = chunkRoot?.value;
  if (!r) return false;
  const status = String(r.Status?.value || r.Level?.value?.Status?.value || '').toLowerCase();
  if (status) {
    return (
      status === 'full' ||
      status === 'minecraft:full' ||
      status.endsWith(':full') ||
      status.includes('postprocessed')
    );
  }
  const secs = r.sections?.value || r.Level?.value?.Sections?.value || [];
  return secs.some((s) => {
    const pal = s.value?.block_states?.value?.palette?.value || s.value?.Palette?.value;
    return (
      Array.isArray(pal) &&
      pal.some((p) => p.value?.Name?.value && p.value.Name.value !== 'minecraft:air')
    );
  });
}

function extractChunkSections(chunkRoot, fallbackDataVersion = 3955) {
  const r = chunkRoot.value;
  const dv = r.DataVersion?.value ?? fallbackDataVersion;
  const isModern = Boolean(r.sections);
  const rawSections = isModern ? r.sections.value : (r.Level?.value?.Sections?.value || []);

  const parsed = [];
  for (const secTag of rawSections) {
    const sv = secTag.value;
    if (sv.Y == null) continue;
    const secY = sv.Y.value; // Signed byte (-4..19 in 1.18+, 0..15 in 1.16~1.17)

    let paletteTags = null;
    let dataLongs = null;

    if (isModern && sv.block_states?.value) {
      paletteTags = sv.block_states.value.palette?.value || null;
      dataLongs = sv.block_states.value.data?.value || null;
    } else if (!isModern && sv.Palette?.value) {
      paletteTags = sv.Palette.value;
      dataLongs = sv.BlockStates?.value || null;
    }

    if (!paletteTags || paletteTags.length === 0) continue;
    const paletteIds = paletteTags.map((p) => p.value.Name?.value || 'minecraft:air');
    // Skip sections that are 100% air
    if (paletteIds.length === 1 && IGNORED_SURFACE_DECOR.has(paletteIds[0])) continue;

    parsed.push({
      secY,
      paletteIds,
      indices: unpackChunkSectionIndices(dataLongs, paletteIds.length, dv),
    });
  }

  // Sort top-down (highest Y first) for fast surface scanning
  parsed.sort((a, b) => b.secY - a.secY);
  return parsed;
}

// ==================== 2D Hillshaded World Terrain Map Renderer ====================
/**
 * Render a `spanChunks x spanChunks` (default 32x32 chunks = 512x512 blocks) top-down terrain map!
 */
export async function renderWorldMapRegion(worldPath, options = {}) {
  const worldInfo = await readWorldMetadata(worldPath);
  const spanChunks = Math.max(8, Math.min(48, Number(options.spanChunks) || 32));
  const defaultFocus = worldInfo.playerPos || worldInfo.spawnPos || [0, 64, 0];

  const centerChunkX =
    options.centerX != null ? Math.floor(Number(options.centerX) / 16) : Math.floor(defaultFocus[0] / 16);
  const centerChunkZ =
    options.centerZ != null ? Math.floor(Number(options.centerZ) / 16) : Math.floor(defaultFocus[2] / 16);

  const startChunkX = centerChunkX - Math.floor(spanChunks / 2);
  const startChunkZ = centerChunkZ - Math.floor(spanChunks / 2);
  const mapBlocksW = spanChunks * 16;
  const mapBlocksL = spanChunks * 16;
  const minBlockX = startChunkX * 16;
  const minBlockZ = startChunkZ * 16;

  // Heightmap (`-32768` = ungenerated void chunk) + RGB buffer
  const surfaceHeights = new Int16Array(mapBlocksW * mapBlocksL).fill(-32768);
  const baseRgbBuf = new Uint8Array(mapBlocksW * mapBlocksL * 3);
  const waterDepthBuf = new Uint8Array(mapBlocksW * mapBlocksL);

  // Group needed chunks by region `(rx, rz)` so each `.mca` file is read only ONCE!
  const chunksByRegion = new Map();
  for (let dz = 0; dz < spanChunks; dz++) {
    for (let dx = 0; dx < spanChunks; dx++) {
      const cx = startChunkX + dx;
      const cz = startChunkZ + dz;
      const rx = Math.floor(cx / 32);
      const rz = Math.floor(cz / 32);
      const rKey = `${rx},${rz}`;
      if (!chunksByRegion.has(rKey)) chunksByRegion.set(rKey, { rx, rz, list: [] });
      chunksByRegion.get(rKey).list.push({ cx, cz, dx, dz });
    }
  }

  let generatedChunkCount = 0;

  for (const { rx, rz, list } of chunksByRegion.values()) {
    const mcaPath = path.join(worldInfo.worldPath, 'region', `r.${rx}.${rz}.mca`);
    let mcaBuf;
    try {
      mcaBuf = await fs.readFile(mcaPath);
    } catch {
      continue;
    }

    const slots = parseMcaBuffer(mcaBuf);
    for (const { cx, cz, dx, dz } of list) {
      const localCx = ((cx % 32) + 32) % 32;
      const localCz = ((cz % 32) + 32) % 32;
      const slot = slots[localCz * 32 + localCx];
      if (!slot) continue;

      let chunkRoot;
      try {
        chunkRoot = decodeChunkSlotNbt(slot);
      } catch {
        continue;
      }
      if (!isChunkGeneratedFull(chunkRoot)) continue;

      generatedChunkCount++;
      const sections = extractChunkSections(chunkRoot, worldInfo.dataVersion);
      if (sections.length === 0) continue;

      for (let lz = 0; lz < 16; lz++) {
        const mapZ = dz * 16 + lz;
        for (let lx = 0; lx < 16; lx++) {
          const mapX = dx * 16 + lx;
          const cellIdx = mapZ * mapBlocksW + mapX;

          let topBlockId = null;
          let topY = worldInfo.minY;
          let waterDepth = 0;

          // Scan downward from highest section
          outer: for (let s = 0; s < sections.length; s++) {
            const sec = sections[s];
            const baseSecY = sec.secY * 16;
            for (let ly = 15; ly >= 0; ly--) {
              const pIdx = sec.indices[(ly * 16 + lz) * 16 + lx];
              const bId = sec.paletteIds[pIdx] || 'minecraft:air';
              if (IGNORED_SURFACE_DECOR.has(bId)) continue;

              if (bId === 'minecraft:water' || bId === 'minecraft:bubble_column') {
                if (waterDepth === 0) {
                  topBlockId = 'minecraft:water';
                  topY = baseSecY + ly;
                }
                waterDepth++;
                continue;
              }

              if (waterDepth > 0) {
                // Reached sea/river bed under water
                break outer;
              }

              topBlockId = bId;
              topY = baseSecY + ly;
              break outer;
            }
          }

          if (topBlockId) {
            surfaceHeights[cellIdx] = topY;
            waterDepthBuf[cellIdx] = Math.min(255, waterDepth);
            const [r, g, b] = getTerrainRgb(topBlockId);
            baseRgbBuf[cellIdx * 3] = r;
            baseRgbBuf[cellIdx * 3 + 1] = g;
            baseRgbBuf[cellIdx * 3 + 2] = b;
          }
        }
      }
    }
  }

  // Compose final RGBA PNG with Northwest Hillshade Relief & Water Depth Shading!
  const rgba = new Uint8Array(mapBlocksW * mapBlocksL * 4);
  for (let z = 0; z < mapBlocksL; z++) {
    for (let x = 0; x < mapBlocksW; x++) {
      const idx = z * mapBlocksW + x;
      const outIdx = idx * 4;
      const h = surfaceHeights[idx];

      if (h === -32768) {
        // Ungenerated chunk checkerboard pattern (#111621 / #151b28)
        const checker = ((x >> 4) + (z >> 4)) & 1;
        const c = checker ? 21 : 16;
        rgba[outIdx] = c;
        rgba[outIdx + 1] = c + 4;
        rgba[outIdx + 2] = c + 12;
        rgba[outIdx + 3] = 255;
        continue;
      }

      let r = baseRgbBuf[idx * 3];
      let g = baseRgbBuf[idx * 3 + 1];
      let b = baseRgbBuf[idx * 3 + 2];

      const wDepth = waterDepthBuf[idx];
      if (wDepth > 0) {
        // Darker deep ocean vs bright shallow shoreline
        const depthShade = Math.max(0.58, 1.06 - wDepth * 0.032);
        r *= depthShade;
        g *= depthShade;
        b *= depthShade;
      } else {
        // Northwest hillshade from neighbor elevations
        const hWest = x > 0 && surfaceHeights[idx - 1] !== -32768 ? surfaceHeights[idx - 1] : h;
        const hNorth = z > 0 && surfaceHeights[idx - mapBlocksW] !== -32768 ? surfaceHeights[idx - mapBlocksW] : h;
        const slope = (h - hWest) + (h - hNorth);
        const shade = Math.max(0.72, Math.min(1.26, 1.0 + slope * 0.065));
        r *= shade;
        g *= shade;
        b *= shade;
      }

      rgba[outIdx] = Math.max(0, Math.min(255, Math.round(r)));
      rgba[outIdx + 1] = Math.max(0, Math.min(255, Math.round(g)));
      rgba[outIdx + 2] = Math.max(0, Math.min(255, Math.round(b)));
      rgba[outIdx + 3] = 255;
    }
  }

  const pngBuf = encodePngRgba(mapBlocksW, mapBlocksL, rgba);
  const heightsBytes = new Uint8Array(
    surfaceHeights.buffer,
    surfaceHeights.byteOffset,
    surfaceHeights.byteLength
  );

  return {
    worldInfo,
    generatedChunkCount,
    bounds: {
      minX: minBlockX,
      minZ: minBlockZ,
      width: mapBlocksW,
      length: mapBlocksL,
    },
    mapPngDataUrl: `data:image/png;base64,${pngBuf.toString('base64')}`,
    heightsInt16Base64: Buffer.from(heightsBytes).toString('base64'),
  };
}

// ==================== Structure Transform (Rotation & Mirroring) ====================
const FACING_CW = { north: 'east', east: 'south', south: 'west', west: 'north' };
const FACING_MIRROR_X = { east: 'west', west: 'east', north: 'north', south: 'south' };

export function transformStructureGrid(grid, { rotation = 0, mirrorX = false } = {}) {
  const rotSteps = (((Math.round(rotation / 90) % 4) + 4) % 4);
  const W = grid.width;
  const H = grid.height;
  const L = grid.length;

  const outW = rotSteps % 2 === 1 ? L : W;
  const outL = rotSteps % 2 === 1 ? W : L;

  const transformedBlocks = grid.blocks.map((item) => {
    let x = mirrorX ? W - 1 - item.x : item.x;
    let z = item.z;

    for (let r = 0; r < rotSteps; r++) {
      // 90° CW in top-down view (+X East/right, +Z South/down): (x, z) -> (curSpanZ - 1 - z, x)
      const curSpanZ = r % 2 === 1 ? W : L;
      const rx = curSpanZ - 1 - z;
      const rz = x;
      x = rx;
      z = rz;
    }

    let props = item.block.properties ? { ...item.block.properties } : null;
    if (props) {
      if (mirrorX && props.facing && FACING_MIRROR_X[props.facing]) {
        props.facing = FACING_MIRROR_X[props.facing];
      }
      for (let r = 0; r < rotSteps; r++) {
        if (props.facing && FACING_CW[props.facing]) {
          props.facing = FACING_CW[props.facing];
        }
        if (props.axis === 'x') props.axis = 'z';
        else if (props.axis === 'z') props.axis = 'x';
      }
    }

    return {
      x,
      y: item.y,
      z,
      block: props ? { ...item.block, properties: props } : item.block,
    };
  });

  return {
    width: outW,
    height: H,
    length: outL,
    blocks: transformedBlocks,
  };
}

// ==================== Safe Atomic Structure Placement + Backup / Rollback ====================
export const DEFAULT_MAX_BACKUPS = 10;
export const MAX_BACKUPS_LIMIT = 50;

let lastBackupTs = 0;
function nextMonotonicTimestamp() {
  const now = Date.now();
  lastBackupTs = now > lastBackupTs ? now : lastBackupTs + 1;
  return lastBackupTs;
}

function getBackupsRoot(worldPath) {
  return path.join(path.resolve(worldPath), '.three2litematic-backups');
}

export function normalizeMaxBackups(value = DEFAULT_MAX_BACKUPS) {
  if (value == null || value === '') return DEFAULT_MAX_BACKUPS;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_MAX_BACKUPS;
  return Math.max(1, Math.min(MAX_BACKUPS_LIMIT, Math.floor(parsed)));
}

function getSafeBackupId(backupId) {
  const rawId = String(backupId ?? '');
  const safeId = path.basename(rawId);
  if (!safeId || safeId === '.' || safeId === '..' || safeId !== rawId || /[\\/]/.test(rawId)) {
    throw new Error('无效的备份 ID');
  }
  return safeId;
}

export async function listWorldBackups(worldPath) {
  const bRoot = getBackupsRoot(worldPath);
  const dirs = await fs.readdir(bRoot, { withFileTypes: true }).catch(() => []);
  const list = [];
  for (const d of dirs) {
    if (!d.isDirectory()) continue;
    const bDir = path.join(bRoot, d.name);
    try {
      const m = JSON.parse(await fs.readFile(path.join(bDir, 'backup.json'), 'utf-8'));
      if (m.totalBytes == null && Array.isArray(m.files)) {
        let sum = 0;
        for (const f of m.files) {
          const st = await fs.stat(path.join(bDir, path.basename(f))).catch(() => null);
          if (st) sum += st.size;
        }
        m.totalBytes = sum;
      }
      list.push({ ...m, id: d.name });
    } catch {
      // Skip incomplete backup
    }
  }
  list.sort((a, b) => {
    const timestampDiff = Number(b.timestamp || 0) - Number(a.timestamp || 0);
    return timestampDiff || String(b.id).localeCompare(String(a.id));
  });
  return list;
}

/**
 * Enforce backup retention cap (default: keep latest 10 backups, delete older ones).
 */
export async function pruneWorldBackups(worldPath, maxBackups = DEFAULT_MAX_BACKUPS) {
  const cap = normalizeMaxBackups(maxBackups);
  const bRoot = getBackupsRoot(worldPath);
  const all = await listWorldBackups(worldPath);
  const deletedIds = [];

  if (all.length > cap) {
    for (const stale of all.slice(cap)) {
      const safeId = getSafeBackupId(stale.id);
      await fs.rm(path.join(bRoot, safeId), { recursive: true, force: true });
      deletedIds.push(safeId);
    }
  }

  return {
    maxBackups: cap,
    deletedIds,
    backups: all.slice(0, cap),
  };
}

/**
 * Manually delete a single backup snapshot without altering the world's `.mca` region files.
 */
export async function deleteWorldBackup({ worldPath, backupId }) {
  const bRoot = getBackupsRoot(worldPath);
  const safeId = getSafeBackupId(backupId);
  await fs.rm(path.join(bRoot, safeId), { recursive: true, force: true });
  return listWorldBackups(worldPath);
}

/**
 * Manually clear all backup snapshots for a world without altering its `.mca` region files.
 */
export async function clearAllWorldBackups(worldPath) {
  const bRoot = getBackupsRoot(worldPath);
  await fs.rm(bRoot, { recursive: true, force: true });
  return [];
}

function makePaletteEntryNbt(id, properties) {
  const fields = { Name: nbt.string(id) };
  if (properties && Object.keys(properties).length > 0) {
    const pObj = {};
    for (const [k, v] of Object.entries(properties)) {
      pObj[k] = nbt.string(String(v));
    }
    fields.Properties = nbt.compound(pObj);
  }
  return nbt.compound(fields);
}

function canonicalPaletteKey(id, properties) {
  if (!properties || Object.keys(properties).length === 0) return id;
  const s = Object.keys(properties).sort().map((k) => `${k}=${properties[k]}`).join(',');
  return `${id}[${s}]`;
}

/**
 * Inject a 3D block grid into an existing Minecraft save world safely with automatic `.mca` backup!
 */
export async function placeStructureInWorld({
  worldPath,
  grid,
  targetX,
  targetY,
  requestedBaseY = null,
  targetZ,
  rotation = 0,
  mirrorX = false,
  includeAir = false,
  autoSink = false,
  topClearanceLayers = 0,
  fillVoid = false,
  fillMode = 'solid',
  fillBottomY = null,
  fillMaterial = 'minecraft:stone',
  fillOverwrite = true,
  label = 'Voxel_Structure',
  maxBackups = DEFAULT_MAX_BACKUPS,
}) {
  const worldInfo = await readWorldMetadata(worldPath);
  if (worldInfo.possiblyActiveInGame) {
    throw new Error('检测到 Minecraft 仍在打开此存档，请保存后退回主菜单，再执行写入');
  }
  const rotated = transformStructureGrid(grid, { rotation, mirrorX });

  const rawTargetX = Number(targetX);
  const rawTargetZ = Number(targetZ);
  const rawTargetY = Number(requestedBaseY ?? targetY);
  const baseX = Number.isFinite(rawTargetX) ? Math.floor(rawTargetX) : 0;
  const baseZ = Number.isFinite(rawTargetZ) ? Math.floor(rawTargetZ) : 0;
  const requestedPlacementY = Number.isFinite(rawTargetY) ? Math.floor(rawTargetY) : 64;
  const solidBlocks = rotated.blocks.filter(
    (item) => item.block && !['minecraft:air', 'minecraft:cave_air', 'minecraft:void_air'].includes(item.block.id)
  );
  if (solidBlocks.length === 0) {
    throw new Error('当前模型没有可用于确定垂直放置范围的实体方块');
  }
  const minStructureY = Math.min(...solidBlocks.map((item) => item.y));
  const maxStructureY = Math.max(...solidBlocks.map((item) => item.y));
  const verticalPlacement = resolveVerticalPlacement({
    requestedY: requestedPlacementY,
    minWorldY: worldInfo.minY,
    maxWorldY: worldInfo.maxY,
    minStructureY,
    maxStructureY,
    topClearanceLayers: Number(topClearanceLayers),
    autoSink: Boolean(autoSink),
  });
  const baseY = verticalPlacement.baseY;

  let voidFillPlan = null;
  if (fillVoid) {
    const mode = fillMode === 'base_hollow' ? 'base_hollow' : 'solid';
    const fillId = String(fillMaterial || 'minecraft:stone').startsWith('minecraft:')
      ? String(fillMaterial || 'minecraft:stone')
      : `minecraft:${fillMaterial}`;
    const fillDefinition = BLOCK_BY_ID.get(fillId);
    if (!fillDefinition || fillDefinition.isSlab || fillDefinition.category !== 'solid') {
      throw new Error(`无效的空置域底部材料：${fillId}（请选择普通不透明方块）`);
    }
    const requestedBottomY = mode === 'solid' ? Math.floor(Number(fillBottomY)) : baseY - 1;
    if (!Number.isFinite(requestedBottomY)) throw new Error('空置域底部 Y 必须是有效整数');
    const occupied = rotated.blocks.filter((item) => item.block && item.block.id !== 'minecraft:air');
    if (occupied.length === 0) {
      throw new Error('当前模型没有可用于确定空置域范围的实体方块');
    }
    const minModelX = Math.min(...occupied.map((item) => item.x));
    const maxModelX = Math.max(...occupied.map((item) => item.x));
    const minModelZ = Math.min(...occupied.map((item) => item.z));
    const maxModelZ = Math.max(...occupied.map((item) => item.z));
    const minChunkX = Math.floor((baseX + minModelX) / 16);
    const maxChunkX = Math.floor((baseX + maxModelX) / 16);
    const minChunkZ = Math.floor((baseZ + minModelZ) / 16);
    const maxChunkZ = Math.floor((baseZ + maxModelZ) / 16);
    const bottomY = Math.max(worldInfo.minY, requestedBottomY);
    const topY = mode === 'base_hollow'
      ? worldInfo.maxY + 1
      : Math.min(worldInfo.maxY + 1, baseY);
    const width = (maxChunkX - minChunkX + 1) * 16;
    const length = (maxChunkZ - minChunkZ + 1) * 16;
    const height = Math.max(0, topY - bottomY);
    const blockCount = width * length * height;
    if (height <= 0 || (mode === 'base_hollow' && baseY <= worldInfo.minY)) {
      throw new Error(`空置域底部 Y (${requestedBottomY}) 必须低于模型基底 Y (${baseY})`);
    }
    if (blockCount > 8_000_000) {
      throw new Error(`空置域填充范围过大（${blockCount.toLocaleString()} 方块），请提高底部 Y 或缩小模型范围`);
    }
    voidFillPlan = {
      mode,
      id: fillId,
      block: { id: fillId, properties: fillDefinition.properties || null },
      requestedBottomY,
      bottomY,
      topY,
      minChunkX,
      maxChunkX,
      minChunkZ,
      maxChunkZ,
      width,
      length,
      height,
      blockCount,
    };
  }

  // Build map of blocks to write: chunkKey "cx,cz" -> sectionY -> Map<cellIdx, { id, properties }>
  const editsByRegion = new Map();

  function queueBlockWrite(wx, wy, wz, blockObj, { onlyAir = false } = {}) {
    if (wy < worldInfo.minY || wy > worldInfo.maxY) return;
    const cx = Math.floor(wx / 16);
    const cz = Math.floor(wz / 16);
    const rx = Math.floor(cx / 32);
    const rz = Math.floor(cz / 32);
    const secY = Math.floor(wy / 16);

    const lx = ((wx % 16) + 16) % 16;
    const ly = ((wy % 16) + 16) % 16;
    const lz = ((wz % 16) + 16) % 16;
    const cellIdx = (ly * 16 + lz) * 16 + lx;

    const rKey = `${rx},${rz}`;
    if (!editsByRegion.has(rKey)) editsByRegion.set(rKey, { rx, rz, chunks: new Map() });
    const regGroup = editsByRegion.get(rKey);

    const cKey = `${cx},${cz}`;
    if (!regGroup.chunks.has(cKey)) regGroup.chunks.set(cKey, { cx, cz, sections: new Map(), overwrittenCoords: new Set() });
    const chunkGroup = regGroup.chunks.get(cKey);
    if (!onlyAir) chunkGroup.overwrittenCoords.add(`${wx},${wy},${wz}`);

    if (!chunkGroup.sections.has(secY)) chunkGroup.sections.set(secY, new Map());
    chunkGroup.sections.get(secY).set(cellIdx, onlyAir ? { ...blockObj, onlyAir: true } : blockObj);
  }

  if (voidFillPlan) {
    const startY = voidFillPlan.mode === 'base_hollow' ? voidFillPlan.bottomY : voidFillPlan.bottomY;
    const endY = voidFillPlan.mode === 'base_hollow' ? voidFillPlan.bottomY + 1 : voidFillPlan.topY;
    for (let wy = startY; wy < endY; wy++) {
      for (let wz = voidFillPlan.minChunkZ * 16; wz <= voidFillPlan.maxChunkZ * 16 + 15; wz++) {
        for (let wx = voidFillPlan.minChunkX * 16; wx <= voidFillPlan.maxChunkX * 16 + 15; wx++) {
          queueBlockWrite(wx, wy, wz, voidFillPlan.block, { onlyAir: !fillOverwrite });
        }
      }
    }
    if (voidFillPlan.mode === 'base_hollow') {
      for (let wy = baseY; wy < voidFillPlan.topY; wy++) {
        for (let wz = voidFillPlan.minChunkZ * 16; wz <= voidFillPlan.maxChunkZ * 16 + 15; wz++) {
          for (let wx = voidFillPlan.minChunkX * 16; wx <= voidFillPlan.maxChunkX * 16 + 15; wx++) {
            queueBlockWrite(wx, wy, wz, { id: 'minecraft:air', properties: null });
          }
        }
      }
    }
  }

  if (includeAir) {
    const occupied = new Map();
    for (const item of rotated.blocks) {
      occupied.set(`${item.x},${item.y},${item.z}`, item.block);
    }
    for (let y = 0; y < rotated.height; y++) {
      for (let z = 0; z < rotated.length; z++) {
        for (let x = 0; x < rotated.width; x++) {
          const blk = occupied.get(`${x},${y},${z}`) || { id: 'minecraft:air', properties: null };
          queueBlockWrite(baseX + x, baseY + y, baseZ + z, blk);
        }
      }
    }
  } else {
    for (const item of rotated.blocks) {
      if (!item.block || item.block.id === 'minecraft:air') continue;
      queueBlockWrite(baseX + item.x, baseY + item.y, baseZ + item.z, item.block);
    }
  }

  if (editsByRegion.size === 0) {
    throw new Error('没有位于有效世界高度范围内的方块可写入。');
  }

  // Verify target region files exist before mutating anything
  const regionDir = path.join(worldInfo.worldPath, 'region');
  const touchedMcaFiles = [];
  for (const { rx, rz } of editsByRegion.values()) {
    const fname = `r.${rx}.${rz}.mca`;
    const fpath = path.join(regionDir, fname);
    if (!(await fileExists(fpath))) {
      throw new Error(
        `目标位置跨越了尚未探索生成的区域文件 (${fname})。请先在已生成的绿色地图区域内选点摆放！`
      );
    }
    touchedMcaFiles.push(fname);
  }

  // 1. Create Atomic Backup of all touched `.mca` files BEFORE writing!
  const now = nextMonotonicTimestamp();
  const safeLabel = String(label || 'Structure').replace(/[^\w\u4e00-\u9fa5-]+/g, '_').slice(0, 32);
  const backupId = `${now}_${safeLabel}`;
  const backupDir = path.join(getBackupsRoot(worldInfo.worldPath), backupId);
  await fs.mkdir(backupDir, { recursive: true });

  let totalBytes = 0;
  for (const fname of touchedMcaFiles) {
    const srcFile = path.join(regionDir, fname);
    const st = await fs.stat(srcFile);
    totalBytes += st.size;
    await fs.copyFile(srcFile, path.join(backupDir, fname));
  }

  let placedBlockCount = 0;
  let clearedBlockCount = 0;
  let skippedUngeneratedChunks = 0;
  let modifiedChunkCount = 0;

  // 2. Apply edits per `.mca` region file
  for (const { rx, rz, chunks } of editsByRegion.values()) {
    const fname = `r.${rx}.${rz}.mca`;
    const mcaPath = path.join(regionDir, fname);
    const rawMca = await fs.readFile(mcaPath);
    const slots = parseMcaBuffer(rawMca);

    for (const { cx, cz, sections: secEdits, overwrittenCoords } of chunks.values()) {
      const localCx = ((cx % 32) + 32) % 32;
      const localCz = ((cz % 32) + 32) % 32;
      const slotIdx = localCz * 32 + localCx;
      const slot = slots[slotIdx];

      if (!slot) {
        skippedUngeneratedChunks++;
        continue;
      }

      const chunkRoot = decodeChunkSlotNbt(slot);
      if (!isChunkGeneratedFull(chunkRoot)) {
        skippedUngeneratedChunks++;
        continue;
      }

      const r = chunkRoot.value;
      const dv = r.DataVersion?.value ?? worldInfo.dataVersion;
      const isModern = Boolean(r.sections);

      // Force Minecraft's native Starlight/Vanilla engine to cleanly recalculate sky & block lighting + heightmaps!
      if (isModern) {
        r.isLightOn = nbt.byte(0);
        delete r.Heightmaps;
        if (r.block_entities?.value) {
          r.block_entities.value = r.block_entities.value.filter((be) => {
            const bx = be.value?.x?.value;
            const by = be.value?.y?.value;
            const bz = be.value?.z?.value;
            return !overwrittenCoords.has(`${bx},${by},${bz}`);
          });
        }
      } else if (r.Level?.value) {
        r.Level.value.isLightOn = nbt.byte(0);
        delete r.Level.value.Heightmaps;
        if (r.Level.value.TileEntities?.value) {
          r.Level.value.TileEntities.value = r.Level.value.TileEntities.value.filter((be) => {
            const bx = be.value?.x?.value;
            const by = be.value?.y?.value;
            const bz = be.value?.z?.value;
            return !overwrittenCoords.has(`${bx},${by},${bz}`);
          });
        }
      }

      const sectionList = isModern ? r.sections.value : r.Level.value.Sections.value;
      const sampleBiomeTag = isModern
        ? sectionList.find((s) => s.value?.biomes)?.value?.biomes
        : null;

      for (const [secY, cellMap] of secEdits.entries()) {
        let secTag = sectionList.find((s) => s.value?.Y?.value === secY);
        if (!secTag) {
          // Create new 16x16x16 section (e.g. high sky tower above existing sections)
          if (isModern) {
            secTag = nbt.compound({
              Y: nbt.byte(secY),
              biomes: sampleBiomeTag || nbt.compound({
                palette: nbt.list(TAG.STRING, [nbt.string('minecraft:plains')]),
              }),
              block_states: nbt.compound({
                palette: nbt.list(TAG.COMPOUND, [makePaletteEntryNbt('minecraft:air', null)]),
              }),
            });
          } else {
            secTag = nbt.compound({
              Y: nbt.byte(secY),
              Palette: nbt.list(TAG.COMPOUND, [makePaletteEntryNbt('minecraft:air', null)]),
            });
          }
          sectionList.push(secTag);
        }

        const sv = secTag.value;
        // Strip stale cached light arrays on touched section so Minecraft relights cleanly
        delete sv.BlockLight;
        delete sv.SkyLight;

        let palList;
        let curLongs;
        if (isModern) {
          if (!sv.block_states) {
            sv.block_states = nbt.compound({
              palette: nbt.list(TAG.COMPOUND, [makePaletteEntryNbt('minecraft:air', null)]),
            });
          }
          palList = sv.block_states.value.palette.value;
          curLongs = sv.block_states.value.data?.value || null;
        } else {
          if (!sv.Palette) {
            sv.Palette = nbt.list(TAG.COMPOUND, [makePaletteEntryNbt('minecraft:air', null)]);
          }
          palList = sv.Palette.value;
          curLongs = sv.BlockStates?.value || null;
        }

        const indices = unpackChunkSectionIndices(curLongs, palList.length, dv);
        const keyToPalIdx = new Map();
        palList.forEach((pTag, idx) => {
          const pv = pTag.value;
          const props = {};
          if (pv.Properties?.value) {
            for (const [pk, pval] of Object.entries(pv.Properties.value)) {
              props[pk] = pval.value;
            }
          }
          keyToPalIdx.set(canonicalPaletteKey(pv.Name.value, props), idx);
        });

        for (const [cellIdx, blk] of cellMap.entries()) {
          const currentPaletteEntry = palList[indices[cellIdx]];
          const currentBlockId = currentPaletteEntry?.value?.Name?.value || 'minecraft:air';
          if (blk.onlyAir && !['minecraft:air', 'minecraft:cave_air', 'minecraft:void_air'].includes(currentBlockId)) {
            continue;
          }
          const cKey = canonicalPaletteKey(blk.id, blk.properties);
          let pIdx = keyToPalIdx.get(cKey);
          if (pIdx === undefined) {
            pIdx = palList.length;
            palList.push(makePaletteEntryNbt(blk.id, blk.properties));
            keyToPalIdx.set(cKey, pIdx);
          }
          indices[cellIdx] = pIdx;
          if (blk.id === 'minecraft:air') {
            clearedBlockCount++;
          } else {
            placedBlockCount++;
          }
        }

        const repacked = packChunkSectionIndices(indices, palList.length);
        if (isModern) {
          sv.block_states.value.palette = nbt.list(TAG.COMPOUND, palList);
          if (repacked) {
            sv.block_states.value.data = nbt.longArray(repacked);
          } else {
            delete sv.block_states.value.data;
          }
        } else {
          sv.Palette = nbt.list(TAG.COMPOUND, palList);
          if (repacked) {
            sv.BlockStates = nbt.longArray(repacked);
          } else {
            delete sv.BlockStates;
          }
        }
      }

      // Keep sections sorted ascending by Y
      sectionList.sort((a, b) => (a.value.Y?.value ?? 0) - (b.value.Y?.value ?? 0));
      slots[slotIdx] = encodeChunkSlotNbt(chunkRoot);
      modifiedChunkCount++;
    }

    const updatedMcaBuf = buildMcaBuffer(slots);
    const tmpPath = `${mcaPath}.tmp.${process.pid}`;
    await fs.writeFile(tmpPath, updatedMcaBuf);
    await fs.rename(tmpPath, mcaPath);
  }

  if (modifiedChunkCount === 0) {
    // Clean up unused backup if all target chunks were ungenerated void
    await fs.rm(backupDir, { recursive: true, force: true });
    throw new Error('目标选区内的区块均尚未在游戏内探索生成，请在有地形颜色的已生成区块上放置！');
  }

  const backupMeta = {
    id: backupId,
    timestamp: now,
    label,
    targetPos: [baseX, baseY, baseZ],
    dimensions: { width: rotated.width, height: rotated.height, length: rotated.length },
    placedBlockCount,
    clearedBlockCount,
    modifiedChunkCount,
    files: touchedMcaFiles,
    totalBytes,
  };
  await fs.writeFile(path.join(backupDir, 'backup.json'), JSON.stringify(backupMeta, null, 2), 'utf-8');

  // Enforce maxBackups retention cap (default: keep latest 10 backups, auto-delete older ones)
  const pruned = await pruneWorldBackups(worldInfo.worldPath, maxBackups);

  return {
    backup: backupMeta,
    placedBlockCount,
    clearedBlockCount,
    modifiedChunkCount,
    skippedUngeneratedChunks,
    verticalPlacement,
    voidFill: voidFillPlan
      ? {
          material: voidFillPlan.id,
          mode: voidFillPlan.mode,
          modelBaseY: baseY,
          bottomY: voidFillPlan.bottomY,
          topY: voidFillPlan.topY,
          width: voidFillPlan.width,
          length: voidFillPlan.length,
          height: voidFillPlan.height,
          requestedBlockCount: voidFillPlan.blockCount,
          overwrite: Boolean(fillOverwrite),
        }
      : null,
    prunedBackupIds: pruned.deletedIds,
  };
}

/**
 * Atomically restore `.mca` region files from a backup snapshot!
 */
export async function restoreWorldBackup({ worldPath, backupId }) {
  const absWorld = path.resolve(worldPath);
  const safeId = getSafeBackupId(backupId);
  const backupDir = path.join(getBackupsRoot(absWorld), safeId);
  const meta = JSON.parse(await fs.readFile(path.join(backupDir, 'backup.json'), 'utf-8'));

  const regionDir = path.join(absWorld, 'region');
  for (const fname of meta.files || []) {
    const safeFile = path.basename(String(fname));
    if (!safeFile || safeFile !== String(fname) || !/^r\.\-?\d+\.\-?\d+\.mca$/.test(safeFile)) {
      throw new Error(`备份包含无效区域文件: ${fname}`);
    }
    const src = path.join(backupDir, safeFile);
    const dst = path.join(regionDir, safeFile);
    const tmp = `${dst}.restore.${process.pid}`;
    await fs.copyFile(src, tmp);
    await fs.rename(tmp, dst);
  }

  await fs.rm(backupDir, { recursive: true, force: true });
  return meta;
}
