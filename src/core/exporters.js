/**
 * Multi-Format Minecraft Schematic Exporters & Importers:
 * 1. Sponge Schematic v2 (`.schem`) — WorldEdit / FAWE / Axiom / Amulet standard
 * 2. Vanilla Minecraft Datapack Function (`.mcfunction`) — Zero-mod `/fill` + `/setblock` RLE script
 */

import { TAG, nbt, encodeNbt, decodeNbt, gzipCompress, gzipDecompress } from './nbt.js';
import { VERSION_PRESETS, BLOCK_BY_ID, getBlockNameZh } from './palette.js';
import { canonicalBlockKey, computeMaterialList } from './litematic.js';

/**
 * Encode normalized block grid into Sponge Schematic v2 (`.schem`) Gzipped Uint8Array.
 */
export async function encodeSpongeSchem(grid, meta = {}) {
  const width = Math.max(1, Math.min(32767, Math.floor(grid.width)));
  const height = Math.max(1, Math.min(32767, Math.floor(grid.height)));
  const length = Math.max(1, Math.min(32767, Math.floor(grid.length)));
  const volume = width * height * length;

  const preset = VERSION_PRESETS[meta.versionPreset] || VERSION_PRESETS['1.21'];
  const name = meta.name || 'ThreeJS_Voxel_Build';
  const author = meta.author || 'three2litematic';
  const now = BigInt(meta.timestamp ?? Date.now());

  const paletteMap = new Map([['minecraft:air', 0]]);
  const indices = new Uint32Array(volume);

  for (const item of grid.blocks || []) {
    const x = Math.floor(item.x);
    const y = Math.floor(item.y);
    const z = Math.floor(item.z);
    if (x < 0 || x >= width || y < 0 || y >= height || z < 0 || z >= length) continue;

    const blk = item.block;
    if (!blk || blk.id === 'minecraft:air') continue;

    const stateStr = canonicalBlockKey(blk.id, blk.properties);
    let idx = paletteMap.get(stateStr);
    if (idx === undefined) {
      idx = paletteMap.size;
      paletteMap.set(stateStr, idx);
    }

    // Sponge Schematic v2 index order: x + z * Width + y * Width * Length
    const flatIdx = (y * length + z) * width + x;
    indices[flatIdx] = idx;
  }

  // Size the VarInt stream first so large schematics avoid a boxed JS number array.
  let varintByteCount = 0;
  for (let i = 0; i < volume; i++) {
    let v = indices[i] >>> 0;
    while ((v & ~0x7f) !== 0) {
      v >>>= 7;
      varintByteCount++;
    }
    varintByteCount++;
  }

  const varintBytes = new Uint8Array(varintByteCount);
  let varintOffset = 0;
  for (let i = 0; i < volume; i++) {
    let v = indices[i] >>> 0;
    while ((v & ~0x7f) !== 0) {
      varintBytes[varintOffset++] = (v & 0x7f) | 0x80;
      v >>>= 7;
    }
    varintBytes[varintOffset++] = v & 0x7f;
  }

  const paletteCompound = {};
  for (const [stateKey, idx] of paletteMap.entries()) {
    paletteCompound[stateKey] = nbt.int(idx);
  }

  const root = nbt.compound({
    Version: nbt.int(2),
    DataVersion: nbt.int(preset.mcDataVersion),
    Width: nbt.short(width),
    Height: nbt.short(height),
    Length: nbt.short(length),
    Offset: nbt.intArray([0, 0, 0]),
    PaletteMax: nbt.int(paletteMap.size),
    Palette: nbt.compound(paletteCompound),
    BlockData: nbt.byteArray(new Int8Array(varintBytes.buffer)),
    BlockEntities: nbt.list(TAG.COMPOUND, []),
    Metadata: nbt.compound({
      Name: nbt.string(name),
      Author: nbt.string(author),
      Date: nbt.long(now),
      WEOffsetX: nbt.int(0),
      WEOffsetY: nbt.int(0),
      WEOffsetZ: nbt.int(0),
    }),
  });

  const rawNbt = encodeNbt(root, 'Schematic');
  return gzipCompress(rawNbt);
}

/**
 * Decode a Sponge Schematic v2/v3 `.schem` buffer into normalized blocks + metadata.
 */
export async function decodeSpongeSchem(bytes) {
  const uncompressed = await gzipDecompress(bytes);
  const { root } = decodeNbt(uncompressed);
  // Sponge v3 sometimes nests inside `Schematic` key; v2 has fields at root
  const r = root.value.Schematic?.value || root.value;

  const width = (r.Width?.value ?? 1) & 0xffff;
  const height = (r.Height?.value ?? 1) & 0xffff;
  const length = (r.Length?.value ?? 1) & 0xffff;
  const volume = width * height * length;

  const blocksContainer = r.Blocks?.value || r;
  const palTag = blocksContainer.Palette?.value || r.Palette?.value || {};
  const rawData = blocksContainer.Data?.value || r.BlockData?.value || new Int8Array(0);
  const u8 = new Uint8Array(rawData.buffer, rawData.byteOffset, rawData.byteLength);

  const idByIndex = new Map();
  for (const [stateStr, idxTag] of Object.entries(palTag)) {
    idByIndex.set(idxTag.value, stateStr);
  }

  function parseBlockStateString(stateStr) {
    const bracketIdx = stateStr.indexOf('[');
    const id = bracketIdx >= 0 ? stateStr.slice(0, bracketIdx) : stateStr;
    let properties = null;
    if (bracketIdx >= 0 && stateStr.endsWith(']')) {
      properties = {};
      const inner = stateStr.slice(bracketIdx + 1, -1);
      for (const pair of inner.split(',')) {
        const [k, v] = pair.split('=');
        if (k && v !== undefined) properties[k.trim()] = v.trim();
      }
    }
    const db = BLOCK_BY_ID.get(id);
    const isSlab = Boolean(db?.isSlab || (id.endsWith('_slab') && properties?.type !== 'double'));
    const slabHalf = isSlab ? (properties?.type === 'top' ? 'top' : 'bottom') : null;
    return {
      id,
      nameZh: getBlockNameZh(id),
      hex: db?.hex || '#b0b0b0',
      category: db?.category || 'solid',
      family: db?.family || 'stone',
      pattern: db?.pattern || 'smooth',
      opacity: db?.opacity ?? 1.0,
      isSlab,
      slabHalf,
      properties: properties || db?.properties || null,
    };
  }

  const resolvedPalette = new Map();
  for (const [idx, str] of idByIndex.entries()) {
    resolvedPalette.set(idx, parseBlockStateString(str));
  }

  const blocks = [];
  let cursor = 0;
  for (let i = 0; i < volume && cursor < u8.length; i++) {
    let val = 0;
    let shift = 0;
    while (cursor < u8.length) {
      const b = u8[cursor++];
      val |= (b & 0x7f) << shift;
      if ((b & 0x80) === 0) break;
      shift += 7;
    }

    const blk = resolvedPalette.get(val);
    if (!blk || blk.id === 'minecraft:air') continue;

    const x = i % width;
    const z = Math.floor(i / width) % length;
    const y = Math.floor(i / (width * length));
    blocks.push({ x, y, z, block: blk });
  }

  const m = r.Metadata?.value || {};
  return {
    metadata: {
      name: m.Name?.value || 'Imported_Schem',
      author: m.Author?.value || 'WorldEdit',
      version: r.Version?.value ?? 2,
      mcDataVersion: r.DataVersion?.value ?? 3955,
    },
    width,
    height,
    length,
    blocks,
    materials: computeMaterialList(blocks),
  };
}

/**
 * Generate a vanilla Minecraft `.mcfunction` file using X-axis Run-Length `/fill`
 * compression so large builds execute cleanly in unmodded Minecraft!
 */
export function encodeMcFunction(grid, meta = {}) {
  const width = Math.max(1, Math.floor(grid.width));
  const height = Math.max(1, Math.floor(grid.height));
  const length = Math.max(1, Math.floor(grid.length));
  const name = meta.name || 'ThreeJS_Voxel_Build';

  // Index by (y, z, x) for contiguous X-run compression
  const cellState = new Map();
  const stateByBlock = new Map();
  for (const item of grid.blocks || []) {
    if (!item.block || item.block.id === 'minecraft:air') continue;
    const x = Math.floor(item.x);
    const y = Math.floor(item.y);
    const z = Math.floor(item.z);
    if (x < 0 || x >= width || y < 0 || y >= height || z < 0 || z >= length) continue;
    let state = stateByBlock.get(item.block);
    if (state === undefined) {
      state = canonicalBlockKey(item.block.id, item.block.properties);
      stateByBlock.set(item.block, state);
    }
    cellState.set((y * length + z) * width + x, state);
  }

  const commands = [
    `# Generated by three2litematic: ${name}`,
    `# Dimensions: ${width}x${height}x${length} (${grid.blocks?.length || 0} blocks)`,
    `# Usage: Place inside <world>/datapacks/<pack>/data/<ns>/function/build.mcfunction and run /function <ns>:build`,
    '',
  ];

  for (let y = 0; y < height; y++) {
    for (let z = 0; z < length; z++) {
      let x = 0;
      const rowOffset = (y * length + z) * width;
      while (x < width) {
        const state = cellState.get(rowOffset + x);
        if (!state) {
          x++;
          continue;
        }
        let xEnd = x;
        while (xEnd + 1 < width && cellState.get(rowOffset + xEnd + 1) === state) {
          xEnd++;
        }
        if (xEnd > x) {
          commands.push(`fill ~${x} ~${y} ~${z} ~${xEnd} ~${y} ~${z} ${state}`);
        } else {
          commands.push(`setblock ~${x} ~${y} ~${z} ${state}`);
        }
        x = xEnd + 1;
      }
    }
  }

  return new TextEncoder().encode(commands.join('\n') + '\n');
}
