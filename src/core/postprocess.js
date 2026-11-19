/**
 * Voxel Grid Post-Processing:
 * - Origin normalization (min -> 0,0,0)
 * - Minecraft Block Matching (CIEDE2000 + brightness/saturation/3D dithering + glass/light routing)
 * - Optional Half-Slab (0.5 block) slope & arch fitting (`useSlabs`)
 * - Manual Block Remapping (`blockOverrides`)
 * - Optional Hollow Interior Optimization (`hollowInterior`)
 */

import { BLOCK_BY_ID, makeSlabVariant } from './palette.js';
import { createBlockMatcher } from './color-matcher.js';
import { computeMaterialList } from './litematic.js';

function normalizeOverrideMap(overrides) {
  const out = new Map();
  if (!overrides) return out;
  const entries = overrides instanceof Map ? overrides.entries() : Object.entries(overrides);
  for (const [fromId, toId] of entries) {
    if (!fromId || !toId) continue;
    const normFrom = fromId.startsWith('minecraft:') ? fromId : `minecraft:${fromId}`;
    const normTo = toId.startsWith('minecraft:') ? toId : `minecraft:${toId}`;
    if (normFrom !== normTo && BLOCK_BY_ID.has(normTo)) {
      out.set(normFrom, normTo);
    }
  }
  return out;
}

export function buildBlockGrid(rawVoxels, options = {}) {
  const {
    hollowInterior = false,
    useSlabs = false,
    blockOverrides = null,
  } = options;

  if (!Array.isArray(rawVoxels) || rawVoxels.length === 0) {
    return {
      width: 1,
      height: 1,
      length: 1,
      blocks: [],
      materials: [],
      hollowedCount: 0,
      slabCount: 0,
    };
  }

  const matcher = createBlockMatcher(options);
  const overrideMap = normalizeOverrideMap(blockOverrides);

  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  const coordMap = new Map();
  for (const v of rawVoxels) {
    const ix = Math.round(v.x);
    const iy = Math.round(v.y);
    const iz = Math.round(v.z);
    coordMap.set(`${ix},${iy},${iz}`, { ...v, x: ix, y: iy, z: iz });
    if (ix < minX) minX = ix;
    if (iy < minY) minY = iy;
    if (iz < minZ) minZ = iz;
    if (ix > maxX) maxX = ix;
    if (iy > maxY) maxY = iy;
    if (iz > maxZ) maxZ = iz;
  }

  const width = Math.max(1, maxX - minX + 1);
  const height = Math.max(1, maxY - minY + 1);
  const length = Math.max(1, maxZ - minZ + 1);

  const matchedMap = new Map();
  for (const v of coordMap.values()) {
    const nx = v.x - minX;
    const ny = v.y - minY;
    const nz = v.z - minZ;
    const block = matcher.matchVoxel(v, nx, ny, nz);
    matchedMap.set(`${nx},${ny},${nz}`, {
      x: nx,
      y: ny,
      z: nz,
      rawVoxel: v,
      block,
      sourceColor: v.color || block.hex,
      overriddenFrom: null,
    });
  }

  // Optional 0.5-block Half-Slab fitting on exposed top slopes and underside arches
  let slabCount = 0;
  if (useSlabs) {
    for (const item of matchedMap.values()) {
      const { x, y, z, rawVoxel, block } = item;
      if (block.category !== 'solid' || block.pattern === 'leaves') continue;

      const above = matchedMap.get(`${x},${y + 1},${z}`);
      const below = matchedMap.get(`${x},${y - 1},${z}`);
      const syMin = rawVoxel.subYMin ?? 0;
      const syMax = rawVoxel.subYMax ?? 1;

      if (!above && syMax <= 0.56) {
        const slab = matcher.matchSlabIfClose(rawVoxel, block, 'bottom', x, y, z);
        if (slab) {
          item.block = slab;
          slabCount++;
        }
      } else if (!below && above && syMin >= 0.44) {
        const slab = matcher.matchSlabIfClose(rawVoxel, block, 'top', x, y, z);
        if (slab) {
          item.block = slab;
          slabCount++;
        }
      }
    }
  }

  // Apply manual user block overrides (`fromId -> toId`)
  if (overrideMap.size > 0) {
    for (const item of matchedMap.values()) {
      const origId = item.block.id;
      const targetId = overrideMap.get(origId);
      if (!targetId) continue;
      const targetBase = BLOCK_BY_ID.get(targetId);
      if (!targetBase) continue;

      item.overriddenFrom = origId;
      if (targetBase.isSlab) {
        const half = item.block.slabHalf || 'bottom';
        item.block = makeSlabVariant(targetBase, half);
      } else {
        item.block = targetBase;
      }
    }
  }

  // Clean up temporary rawVoxel reference
  for (const item of matchedMap.values()) {
    delete item.rawVoxel;
  }

  let hollowedCount = 0;
  let finalBlocks;

  if (hollowInterior && matchedMap.size > 8) {
    const isOpaqueOccluder = (entry) =>
      Boolean(
        entry &&
          entry.block.category !== 'translucent' &&
          entry.block.pattern !== 'leaves' &&
          !entry.block.isSlab
      );

    finalBlocks = [];
    for (const item of matchedMap.values()) {
      if (!isOpaqueOccluder(item)) {
        finalBlocks.push(item);
        continue;
      }
      const { x, y, z } = item;
      const fullyEnclosedByOpaque =
        isOpaqueOccluder(matchedMap.get(`${x + 1},${y},${z}`)) &&
        isOpaqueOccluder(matchedMap.get(`${x - 1},${y},${z}`)) &&
        isOpaqueOccluder(matchedMap.get(`${x},${y + 1},${z}`)) &&
        isOpaqueOccluder(matchedMap.get(`${x},${y - 1},${z}`)) &&
        isOpaqueOccluder(matchedMap.get(`${x},${y},${z + 1}`)) &&
        isOpaqueOccluder(matchedMap.get(`${x},${y},${z - 1}`));

      if (fullyEnclosedByOpaque) {
        hollowedCount++;
      } else {
        finalBlocks.push(item);
      }
    }
  } else {
    finalBlocks = Array.from(matchedMap.values());
  }

  return {
    width,
    height,
    length,
    blocks: finalBlocks,
    materials: computeMaterialList(finalBlocks),
    hollowedCount,
    slabCount,
  };
}
