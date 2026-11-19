/**
 * Litematica (.litematic) Encoder, Decoder & Material List Calculator
 * Supports LitematicaBitArray, v5/v6 NBT, half-slab states, and Metadata.PreviewImageData!
 */

import { TAG, nbt, encodeNbt, decodeNbt, gzipCompress, gzipDecompress } from './nbt.js';
import { VERSION_PRESETS, BLOCK_BY_ID, getBlockNameZh } from './palette.js';

export function computeBitsPerEntry(paletteSize) {
  if (paletteSize <= 1) return 2;
  return Math.max(2, 32 - Math.clz32(paletteSize - 1));
}

export function packLitematicaBitArray(indices, bitsPerEntry) {
  const volume = indices.length;
  const totalBits = volume * bitsPerEntry;
  const numLongs = Math.ceil(totalBits / 64);
  const longs = new BigUint64Array(numLongs);
  const mask = (1n << BigInt(bitsPerEntry)) - 1n;

  for (let i = 0; i < volume; i++) {
    const raw = indices[i];
    if (raw === 0) continue;
    const val = BigInt(raw) & mask;
    const bitPos = i * bitsPerEntry;
    const startIdx = Math.floor(bitPos / 64);
    const startOffset = bitPos % 64;

    longs[startIdx] |= (val << BigInt(startOffset)) & 0xffffffffffffffffn;
    if (startOffset + bitsPerEntry > 64) {
      const bitsWritten = 64 - startOffset;
      longs[startIdx + 1] |= (val >> BigInt(bitsWritten)) & (mask >> BigInt(bitsWritten));
    }
  }

  return longs;
}

export function unpackLitematicaBitArray(longArray, volume, bitsPerEntry) {
  const out = new Uint32Array(volume);
  const mask = (1n << BigInt(bitsPerEntry)) - 1n;

  for (let i = 0; i < volume; i++) {
    const bitPos = i * bitsPerEntry;
    const startIdx = Math.floor(bitPos / 64);
    const startOffset = bitPos % 64;

    const w0 = startIdx < longArray.length ? BigInt.asUintN(64, longArray[startIdx]) : 0n;
    let val = w0 >> BigInt(startOffset);

    if (startOffset + bitsPerEntry > 64 && startIdx + 1 < longArray.length) {
      const w1 = BigInt.asUintN(64, longArray[startIdx + 1]);
      const bitsRead = 64 - startOffset;
      val |= w1 << BigInt(bitsRead);
    }

    out[i] = Number(val & mask);
  }

  return out;
}

export function canonicalBlockKey(id, properties) {
  if (!properties || Object.keys(properties).length === 0) return id;
  const sorted = Object.keys(properties)
    .sort()
    .map((k) => `${k}=${properties[k]}`)
    .join(',');
  return `${id}[${sorted}]`;
}

/**
 * Encode normalized block grid into a Gzipped `.litematic` Uint8Array.
 * Supports optional square `meta.previewImageData` (`Int32Array` of `0xAARRGGBB` pixels, e.g. `140x140`).
 */
export async function encodeLitematic(grid, meta = {}) {
  const width = Math.max(1, Math.floor(grid.width));
  const height = Math.max(1, Math.floor(grid.height));
  const length = Math.max(1, Math.floor(grid.length));
  const volume = width * height * length;

  const preset = VERSION_PRESETS[meta.versionPreset] || VERSION_PRESETS['1.21'];
  const name = meta.name || 'ThreeJS_Voxel_Build';
  const regionName = meta.regionName || name;
  const author = meta.author || 'three2litematic';
  const description =
    meta.description ||
    `Converted from Three.js voxel scene (${width}x${height}x${length}) via three2litematic`;
  const now = BigInt(meta.timestamp ?? Date.now());

  const paletteEntries = [{ id: 'minecraft:air', properties: null }];
  const paletteIndexMap = new Map([['minecraft:air', 0]]);

  const indices = new Uint32Array(volume);
  let nonAirCount = 0;

  for (const item of grid.blocks || []) {
    const x = Math.floor(item.x);
    const y = Math.floor(item.y);
    const z = Math.floor(item.z);
    if (x < 0 || x >= width || y < 0 || y >= height || z < 0 || z >= length) continue;

    const blk = item.block;
    if (!blk || blk.id === 'minecraft:air') continue;

    const key = canonicalBlockKey(blk.id, blk.properties);
    let palIdx = paletteIndexMap.get(key);
    if (palIdx === undefined) {
      palIdx = paletteEntries.length;
      paletteEntries.push({ id: blk.id, properties: blk.properties || null });
      paletteIndexMap.set(key, palIdx);
    }

    const flatIdx = (y * length + z) * width + x;
    if (indices[flatIdx] === 0) nonAirCount++;
    indices[flatIdx] = palIdx;
  }

  const bitsPerEntry = computeBitsPerEntry(paletteEntries.length);
  const packedLongs = packLitematicaBitArray(indices, bitsPerEntry);

  const nbtPalette = paletteEntries.map((entry) => {
    const fields = { Name: nbt.string(entry.id) };
    if (entry.properties && Object.keys(entry.properties).length > 0) {
      const propTags = {};
      for (const [k, v] of Object.entries(entry.properties)) {
        propTags[k] = nbt.string(String(v));
      }
      fields.Properties = nbt.compound(propTags);
    }
    return nbt.compound(fields);
  });

  const regionCompound = nbt.compound({
    Position: nbt.compound({
      x: nbt.int(0),
      y: nbt.int(0),
      z: nbt.int(0),
    }),
    Size: nbt.compound({
      x: nbt.int(width),
      y: nbt.int(height),
      z: nbt.int(length),
    }),
    BlockStatePalette: nbt.list(TAG.COMPOUND, nbtPalette),
    BlockStates: nbt.longArray(packedLongs),
    Entities: nbt.list(TAG.COMPOUND, []),
    TileEntities: nbt.list(TAG.COMPOUND, []),
    PendingBlockTicks: nbt.list(TAG.COMPOUND, []),
    PendingFluidTicks: nbt.list(TAG.COMPOUND, []),
  });

  const metadataFields = {
    Name: nbt.string(name),
    Author: nbt.string(author),
    Description: nbt.string(description),
    RegionCount: nbt.int(1),
    TotalVolume: nbt.int(volume),
    TotalBlocks: nbt.int(nonAirCount),
    TimeCreated: nbt.long(now),
    TimeModified: nbt.long(now),
    EnclosingSize: nbt.compound({
      x: nbt.int(width),
      y: nbt.int(height),
      z: nbt.int(length),
    }),
  };

  if (meta.previewImageData && meta.previewImageData.length > 0) {
    const sq = Math.round(Math.sqrt(meta.previewImageData.length));
    if (sq * sq === meta.previewImageData.length) {
      metadataFields.PreviewImageData = nbt.intArray(meta.previewImageData);
    }
  }

  const rootFields = {
    MinecraftDataVersion: nbt.int(preset.mcDataVersion),
    Version: nbt.int(preset.litematicVersion),
  };
  if (preset.subVersion > 0) {
    rootFields.SubVersion = nbt.int(preset.subVersion);
  }
  rootFields.Metadata = nbt.compound(metadataFields);
  rootFields.Regions = nbt.compound({
    [regionName]: regionCompound,
  });

  const rawNbt = encodeNbt(nbt.compound(rootFields), '');
  return gzipCompress(rawNbt);
}

/**
 * Decode any `.litematic` binary buffer back into normalized blocks + metadata.
 */
export async function decodeLitematic(bytes) {
  const uncompressed = await gzipDecompress(bytes);
  const { root } = decodeNbt(uncompressed);
  const r = root.value;

  const version = r.Version?.value ?? 5;
  const subVersion = r.SubVersion?.value ?? 0;
  const mcDataVersion = r.MinecraftDataVersion?.value ?? 2586;
  const m = r.Metadata?.value || {};

  const metadata = {
    name: m.Name?.value || 'Unnamed',
    author: m.Author?.value || 'Unknown',
    description: m.Description?.value || '',
    totalVolume: Number(m.TotalVolume?.value ?? 0),
    totalBlocks: Number(m.TotalBlocks?.value ?? 0),
    version,
    subVersion,
    mcDataVersion,
    previewImageData: m.PreviewImageData?.value || null,
  };

  const regionsMap = r.Regions?.value || {};
  const allBlocks = [];
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  for (const [, regTag] of Object.entries(regionsMap)) {
    const reg = regTag.value;
    const pos = reg.Position?.value || {};
    const size = reg.Size?.value || {};

    const posX = pos.x?.value ?? 0;
    const posY = pos.y?.value ?? 0;
    const posZ = pos.z?.value ?? 0;

    const rawSizeX = size.x?.value ?? 0;
    const rawSizeY = size.y?.value ?? 0;
    const rawSizeZ = size.z?.value ?? 0;

    const sizeX = Math.abs(rawSizeX);
    const sizeY = Math.abs(rawSizeY);
    const sizeZ = Math.abs(rawSizeZ);
    const volume = sizeX * sizeY * sizeZ;
    if (volume === 0) continue;

    const originX = rawSizeX < 0 ? posX + rawSizeX + 1 : posX;
    const originY = rawSizeY < 0 ? posY + rawSizeY + 1 : posY;
    const originZ = rawSizeZ < 0 ? posZ + rawSizeZ + 1 : posZ;

    const paletteList = (reg.BlockStatePalette?.value || []).map((entryTag) => {
      const e = entryTag.value;
      const id = e.Name?.value || 'minecraft:air';
      let properties = null;
      if (e.Properties?.value) {
        properties = {};
        for (const [pk, pv] of Object.entries(e.Properties.value)) {
          properties[pk] = pv.value;
        }
      }
      const dbEntry = BLOCK_BY_ID.get(id);
      const isSlab = Boolean(
        dbEntry?.isSlab ||
          (id.endsWith('_slab') && properties?.type !== 'double')
      );
      const slabHalf = isSlab ? (properties?.type === 'top' ? 'top' : 'bottom') : null;

      return {
        id,
        nameZh: getBlockNameZh(id),
        hex: dbEntry?.hex || '#b0b0b0',
        category: dbEntry?.category || 'solid',
        family: dbEntry?.family || 'stone',
        pattern: dbEntry?.pattern || 'smooth',
        opacity: dbEntry?.opacity ?? 1.0,
        isSlab,
        slabHalf,
        properties: properties || dbEntry?.properties || null,
      };
    });

    const bitsPerEntry = computeBitsPerEntry(paletteList.length);
    const longArray = reg.BlockStates?.value || new BigUint64Array(0);
    const indices = unpackLitematicaBitArray(longArray, volume, bitsPerEntry);

    for (let y = 0; y < sizeY; y++) {
      for (let z = 0; z < sizeZ; z++) {
        const rowOffset = (y * sizeZ + z) * sizeX;
        for (let x = 0; x < sizeX; x++) {
          const palIdx = indices[rowOffset + x];
          const blk = paletteList[palIdx];
          if (!blk || blk.id === 'minecraft:air') continue;

          const wx = originX + x;
          const wy = originY + y;
          const wz = originZ + z;

          if (wx < minX) minX = wx;
          if (wy < minY) minY = wy;
          if (wz < minZ) minZ = wz;
          if (wx > maxX) maxX = wx;
          if (wy > maxY) maxY = wy;
          if (wz > maxZ) maxZ = wz;

          allBlocks.push({ x: wx, y: wy, z: wz, block: blk });
        }
      }
    }
  }

  let width = 1, height = 1, length = 1;
  if (allBlocks.length > 0) {
    for (const item of allBlocks) {
      item.x -= minX;
      item.y -= minY;
      item.z -= minZ;
    }
    width = maxX - minX + 1;
    height = maxY - minY + 1;
    length = maxZ - minZ + 1;
  }

  return {
    metadata,
    width,
    height,
    length,
    blocks: allBlocks,
    materials: computeMaterialList(allBlocks),
  };
}

/**
 * Summarize required Minecraft blocks into stacks (x64) and shulker boxes (x1728).
 */
export function computeMaterialList(blocks) {
  const counts = new Map();
  for (const item of blocks) {
    const blk = item.block;
    if (!blk || blk.id === 'minecraft:air') continue;
    const prev = counts.get(blk.id);
    if (prev) {
      prev.count += 1;
      if (item.overriddenFrom) prev.overriddenFromSet.add(item.overriddenFrom);
    } else {
      const db = BLOCK_BY_ID.get(blk.id);
      const baseNameZh = getBlockNameZh(
        blk.id,
        blk.nameZh?.replace(/\s*\([上下]半砖\)$/, '')
      );
      const overriddenFromSet = new Set();
      if (item.overriddenFrom) overriddenFromSet.add(item.overriddenFrom);

      counts.set(blk.id, {
        id: blk.id,
        nameZh: baseNameZh,
        hex: blk.hex || db?.hex || '#b0b0b0',
        category: blk.category || db?.category || 'solid',
        family: blk.family || db?.family || 'stone',
        isSlab: Boolean(blk.isSlab || db?.isSlab),
        count: 1,
        overriddenFromSet,
      });
    }
  }

  return Array.from(counts.values())
    .sort((a, b) => b.count - a.count)
    .map(({ overriddenFromSet, ...entry }) => ({
      ...entry,
      overriddenFrom: Array.from(overriddenFromSet),
      stacks: Math.floor(entry.count / 64),
      remainder: entry.count % 64,
      shulkerBoxes: Number((entry.count / 1728).toFixed(2)),
    }));
}
