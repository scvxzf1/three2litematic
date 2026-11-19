/**
 * Perceptual Color & Semantic Material Matcher (CIELAB + CIEDE2000)
 * Supports Brightness/Saturation color grading, 3D Ordered Bayer Dithering,
 * Translucent/Emissive routing, and Half-Slab color matching.
 */

import { BLOCK_BY_ID, getFilteredPalette, getFilteredSlabs, makeSlabVariant } from './palette.js';

export function parseRgb(input, fallback = [200, 200, 200]) {
  if (input == null) return fallback;

  if (typeof input === 'number' && Number.isFinite(input)) {
    const n = Math.max(0, Math.min(0xffffff, Math.floor(input)));
    return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
  }

  if (typeof input === 'string') {
    let s = input.trim();
    if (s.startsWith('#')) s = s.slice(1);
    else if (s.startsWith('0x') || s.startsWith('0X')) s = s.slice(2);

    if (/^[0-9a-fA-F]{3}$/.test(s)) {
      return [
        parseInt(s[0] + s[0], 16),
        parseInt(s[1] + s[1], 16),
        parseInt(s[2] + s[2], 16),
      ];
    }
    if (/^[0-9a-fA-F]{6,8}$/.test(s)) {
      return [
        parseInt(s.slice(0, 2), 16),
        parseInt(s.slice(2, 4), 16),
        parseInt(s.slice(4, 6), 16),
      ];
    }
    const rgbMatch = s.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
    if (rgbMatch) {
      return [
        clamp255(Number(rgbMatch[1])),
        clamp255(Number(rgbMatch[2])),
        clamp255(Number(rgbMatch[3])),
      ];
    }
    return fallback;
  }

  if (Array.isArray(input) && input.length >= 3) {
    const isUnit =
      input[0] <= 1 &&
      input[1] <= 1 &&
      input[2] <= 1 &&
      (input[0] % 1 !== 0 ||
        input[1] % 1 !== 0 ||
        input[2] % 1 !== 0 ||
        Math.max(input[0], input[1], input[2]) <= 1);
    const scale = isUnit ? 255 : 1;
    return [
      clamp255(input[0] * scale),
      clamp255(input[1] * scale),
      clamp255(input[2] * scale),
    ];
  }

  if (typeof input === 'object' && 'r' in input && 'g' in input && 'b' in input) {
    const maxC = Math.max(input.r, input.g, input.b);
    const scale = maxC <= 1 ? 255 : 1;
    return [
      clamp255(input.r * scale),
      clamp255(input.g * scale),
      clamp255(input.b * scale),
    ];
  }

  return fallback;
}

function clamp255(v) {
  return Math.max(0, Math.min(255, Math.round(Number(v) || 0)));
}

export function rgbToHex([r, g, b]) {
  return (
    '#' +
    clamp255(r).toString(16).padStart(2, '0') +
    clamp255(g).toString(16).padStart(2, '0') +
    clamp255(b).toString(16).padStart(2, '0')
  );
}

/**
 * Apply brightness (-50..+50), saturation (0..200, default 100), and 3D ordered Bayer dithering (0..100).
 */
const BAYER_2X2X2 = [
  0, 4,
  6, 2,
  5, 1,
  3, 7,
];

export function bayer3dThreshold(x, y, z) {
  // 4x4x4 recursive 3D Bayer matrix normalized to [-0.5, +0.5]
  const i0 = ((x & 1) << 2) | ((y & 1) << 1) | (z & 1);
  const i1 = (((x >> 1) & 1) << 2) | (((y >> 1) & 1) << 1) | ((z >> 1) & 1);
  const v = BAYER_2X2X2[i0] * 8 + BAYER_2X2X2[i1]; // 0..63
  return (v + 0.5) / 64 - 0.5;
}

export function gradeAndDitherRgb(rgb, { brightness = 0, saturation = 100, ditherStrength = 0 }, x = 0, y = 0, z = 0) {
  let [r, g, b] = rgb;

  if (brightness !== 0) {
    const shift = (brightness / 100) * 255;
    r += shift;
    g += shift;
    b += shift;
  }

  if (saturation !== 100) {
    const sat = Math.max(0, saturation / 100);
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    r = lum + (r - lum) * sat;
    g = lum + (g - lum) * sat;
    b = lum + (b - lum) * sat;
  }

  if (ditherStrength > 0) {
    const spread = (ditherStrength / 100) * 44; // up to ±22 sRGB levels across 3D Bayer grid
    const delta = bayer3dThreshold(x, y, z) * spread;
    r += delta;
    g += delta;
    b += delta;
  }

  return [clamp255(r), clamp255(g), clamp255(b)];
}

export function rgbToLab([r, g, b]) {
  let sr = r / 255;
  let sg = g / 255;
  let sb = b / 255;

  sr = sr > 0.04045 ? Math.pow((sr + 0.055) / 1.055, 2.4) : sr / 12.92;
  sg = sg > 0.04045 ? Math.pow((sg + 0.055) / 1.055, 2.4) : sg / 12.92;
  sb = sb > 0.04045 ? Math.pow((sb + 0.055) / 1.055, 2.4) : sb / 12.92;

  const x = (sr * 0.4124564 + sg * 0.3575761 + sb * 0.1804375) / 0.95047;
  const y = (sr * 0.2126729 + sg * 0.7151522 + sb * 0.072175) / 1.0;
  const z = (sr * 0.0193339 + sg * 0.119192 + sb * 0.9503041) / 1.08883;

  const fx = x > 0.008856 ? Math.cbrt(x) : 7.787 * x + 16 / 116;
  const fy = y > 0.008856 ? Math.cbrt(y) : 7.787 * y + 16 / 116;
  const fz = z > 0.008856 ? Math.cbrt(z) : 7.787 * z + 16 / 116;

  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export function deltaE2000(lab1, lab2) {
  const [L1, a1, b1] = lab1;
  const [L2, a2, b2] = lab2;

  const avgL = (L1 + L2) * 0.5;
  const C1 = Math.hypot(a1, b1);
  const C2 = Math.hypot(a2, b2);
  const avgC = (C1 + C2) * 0.5;

  const avgC7 = Math.pow(avgC, 7);
  const G = 0.5 * (1 - Math.sqrt(avgC7 / (avgC7 + 6103515625)));

  const a1p = (1 + G) * a1;
  const a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1);
  const C2p = Math.hypot(a2p, b2);
  const avgCp = (C1p + C2p) * 0.5;

  const rad2deg = 180 / Math.PI;
  const deg2rad = Math.PI / 180;

  let h1p = C1p === 0 ? 0 : Math.atan2(b1, a1p) * rad2deg;
  if (h1p < 0) h1p += 360;
  let h2p = C2p === 0 ? 0 : Math.atan2(b2, a2p) * rad2deg;
  if (h2p < 0) h2p += 360;

  const dLp = L2 - L1;
  const dCp = C2p - C1p;

  let dhp = 0;
  if (C1p * C2p !== 0) {
    if (Math.abs(h2p - h1p) <= 180) dhp = h2p - h1p;
    else if (h2p - h1p > 180) dhp = h2p - h1p - 360;
    else dhp = h2p - h1p + 360;
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(dhp * 0.5 * deg2rad);

  let avgHp = h1p + h2p;
  if (C1p * C2p === 0) avgHp = h1p + h2p;
  else if (Math.abs(h1p - h2p) <= 180) avgHp = (h1p + h2p) * 0.5;
  else if (h1p + h2p < 360) avgHp = (h1p + h2p + 360) * 0.5;
  else avgHp = (h1p + h2p - 360) * 0.5;

  const T =
    1 -
    0.17 * Math.cos((avgHp - 30) * deg2rad) +
    0.24 * Math.cos(2 * avgHp * deg2rad) +
    0.32 * Math.cos((3 * avgHp + 6) * deg2rad) -
    0.2 * Math.cos((4 * avgHp - 63) * deg2rad);

  const dTheta = 30 * Math.exp(-Math.pow((avgHp - 275) / 25, 2));
  const avgCp7 = Math.pow(avgCp, 7);
  const RC = 2 * Math.sqrt(avgCp7 / (avgCp7 + 6103515625));

  const avgLm50Sq = Math.pow(avgL - 50, 2);
  const SL = 1 + (0.015 * avgLm50Sq) / Math.sqrt(20 + avgLm50Sq);
  const SC = 1 + 0.045 * avgCp;
  const SH = 1 + 0.015 * avgCp * T;
  const RT = -Math.sin(2 * dTheta * deg2rad) * RC;

  const termL = dLp / SL;
  const termC = dCp / SC;
  const termH = dHp / SH;

  return Math.sqrt(termL * termL + termC * termC + termH * termH + RT * termC * termH);
}

export function createBlockMatcher(options = {}) {
  const brightness = Number(options.brightness) || 0;
  const saturation = options.saturation != null ? Number(options.saturation) : 100;
  const ditherStrength = Number(options.ditherStrength) || 0;
  const preferLightBlocks = Boolean(options.preferLightBlocks);
  const lightPromotionTolerance = Number(options.lightPromotionTolerance ?? 18);
  const hasGradingOrDither = brightness !== 0 || saturation !== 100 || ditherStrength > 0;

  const palette = getFilteredPalette(options).map((blk) => {
    const rgb = parseRgb(blk.hex);
    return { ...blk, rgb, lab: rgbToLab(rgb) };
  });

  const slabs = getFilteredSlabs(options).map((blk) => {
    const rgb = parseRgb(blk.hex);
    return { ...blk, rgb, lab: rgbToLab(rgb) };
  });

  const activeById = new Map(palette.map((b) => [b.id, b]));
  const activeSlabById = new Map(slabs.map((b) => [b.id, b]));
  const byCategory = {
    solid: palette.filter((b) => b.category === 'solid'),
    translucent: palette.filter((b) => b.category === 'translucent'),
    emissive: palette.filter((b) => b.category === 'emissive'),
  };

  const cache = new Map();

  function findClosestWithDist(rgb, list) {
    const candidates = list.length > 0 ? list : palette;
    if (candidates.length === 0) {
      throw new Error('当前过滤条件下没有可用的 Minecraft 方块，请放宽过滤设置或恢复材质大类。');
    }
    const targetLab = rgbToLab(rgb);
    let best = candidates[0];
    let bestDist = Infinity;

    for (let i = 0; i < candidates.length; i++) {
      const d = deltaE2000(targetLab, candidates[i].lab);
      if (d < bestDist) {
        bestDist = d;
        best = candidates[i];
      }
    }
    return { best, dist: bestDist };
  }

  function matchVoxel(voxel, gx = 0, gy = 0, gz = 0) {
    // 1. Honor explicit Minecraft block ID unless grading/dither is actively changing colors or block is filtered out
    if (voxel.block && typeof voxel.block === 'string' && !hasGradingOrDither) {
      const normalizedId = voxel.block.startsWith('minecraft:')
        ? voxel.block
        : `minecraft:${voxel.block}`;

      if (activeById.has(normalizedId)) {
        return activeById.get(normalizedId);
      }
      if (activeSlabById.has(normalizedId)) {
        return makeSlabVariant(activeSlabById.get(normalizedId), voxel.slab === 'top' ? 'top' : 'bottom');
      }

      const known = BLOCK_BY_ID.get(normalizedId);
      if (known && !voxel.color) {
        const rgb = parseRgb(known.hex);
        return findClosestWithDist(rgb, byCategory[known.category] || palette).best;
      }
    }

    const fallbackHex =
      voxel.block && BLOCK_BY_ID.get(voxel.block.startsWith('minecraft:') ? voxel.block : `minecraft:${voxel.block}`)?.hex;
    let baseRgb = parseRgb(voxel.color || fallbackHex, [207, 213, 214]);
    if (hasGradingOrDither) {
      baseRgb = gradeAndDitherRgb(baseRgb, { brightness, saturation, ditherStrength }, gx, gy, gz);
    }

    const opacity = voxel.opacity ?? 1.0;
    const emissiveRgb = voxel.emissive != null ? parseRgb(voxel.emissive, [0, 0, 0]) : [0, 0, 0];
    const emissiveIntensity = voxel.emissiveIntensity ?? (voxel.emissive ? 1.0 : 0.0);
    const emissiveLum = (emissiveRgb[0] * 0.299 + emissiveRgb[1] * 0.587 + emissiveRgb[2] * 0.114) / 255;
    const baseLum = (baseRgb[0] * 0.299 + baseRgb[1] * 0.587 + baseRgb[2] * 0.114) / 255;
    const chroma = Math.max(...baseRgb) - Math.min(...baseRgb);
    const prefersEmissive =
      preferLightBlocks &&
      (voxel.isLight || (voxel.unlit && (baseLum >= 0.15 || chroma >= 30)));

    let targetCategory = 'solid';
    let matchRgb = baseRgb;

    if (prefersEmissive || (emissiveIntensity >= 0.35 && emissiveLum >= 0.12)) {
      targetCategory = 'emissive';
      const w = Math.min(1, emissiveIntensity * 0.75);
      matchRgb = [
        clamp255(baseRgb[0] * (1 - w) + emissiveRgb[0] * w),
        clamp255(baseRgb[1] * (1 - w) + emissiveRgb[1] * w),
        clamp255(baseRgb[2] * (1 - w) + emissiveRgb[2] * w),
      ];
    } else if (opacity < 0.82) {
      targetCategory = 'translucent';
      const maxC = Math.max(...baseRgb);
      const minC = Math.min(...baseRgb);
      if (opacity < 0.36 && maxC - minC < 35 && activeById.has('minecraft:glass')) {
        return activeById.get('minecraft:glass');
      }
    }

    const promoteToLight =
      preferLightBlocks &&
      targetCategory === 'solid' &&
      opacity >= 0.82 &&
      baseLum >= 0.38 &&
      chroma >= 45;
    const key = `${targetCategory}:${promoteToLight ? 1 : 0}:${matchRgb[0]},${matchRgb[1]},${matchRgb[2]}`;
    const cached = cache.get(key);
    if (cached) return cached;

    const solidMatch = findClosestWithDist(matchRgb, byCategory[targetCategory]);
    let matched = solidMatch.best;
    if (promoteToLight && byCategory.emissive.length > 0) {
      const lightMatch = findClosestWithDist(matchRgb, byCategory.emissive);
      if (lightMatch.dist <= solidMatch.dist + lightPromotionTolerance) {
        matched = lightMatch.best;
      }
    }
    cache.set(key, matched);
    return matched;
  }

  /**
   * Try matching a half-slab ('bottom' or 'top') if its perceptual color is reasonably close
   * to the target RGB compared to the matched full solid block.
   */
  function matchSlabIfClose(voxel, solidBlock, half = 'bottom', gx = 0, gy = 0, gz = 0) {
    if (slabs.length === 0) return null;
    let rgb = parseRgb(voxel.color || solidBlock.hex, solidBlock.rgb || [128, 128, 128]);
    if (hasGradingOrDither) {
      rgb = gradeAndDitherRgb(rgb, { brightness, saturation, ditherStrength }, gx, gy, gz);
    }
    const targetLab = rgbToLab(rgb);
    const solidDist = deltaE2000(targetLab, solidBlock.lab || rgbToLab(parseRgb(solidBlock.hex)));
    const { best, dist } = findClosestWithDist(rgb, slabs);

    // Only substitute a slab if its color does not drastically degrade hue (e.g. avoid turning lime grass gray)
    if (dist <= Math.max(14, solidDist + 10.5)) {
      return makeSlabVariant(best, half);
    }
    return null;
  }

  return {
    palette,
    slabs,
    matchVoxel,
    matchSlabIfClose,
  };
}
