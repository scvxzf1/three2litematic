/**
 * Zero-Dependency Server-Side Isometric 3D Voxel Thumbnail Renderer & PNG Encoder
 * Generates crisp 2x-supersampled 240x152 PNG previews for any schematic/HTML/JSON asset
 * in ~10ms, cached on disk and regenerated ONLY when the asset is modified.
 */

import zlib from 'node:zlib';
import { parseRgb } from '../core/index.js';

function makePngChunk(typeStr, dataBuf) {
  const typeBuf = Buffer.from(typeStr, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(dataBuf.length, 0);

  const crcInput = Buffer.concat([typeBuf, dataBuf]);
  const crc = zlib.crc32(crcInput) >>> 0;
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc, 0);

  return Buffer.concat([lenBuf, typeBuf, dataBuf, crcBuf]);
}

/**
 * Encode raw RGBA Uint8Array into a valid compressed PNG Buffer.
 */
export function encodePngRgba(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8-bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const rawScanlines = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (stride + 1);
    rawScanlines[rowStart] = 0; // Filter type 0 (None)
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(rawScanlines, rowStart + 1);
  }

  const compressed = zlib.deflateSync(rawScanlines, { level: 6 });
  return Buffer.concat([
    signature,
    makePngChunk('IHDR', ihdr),
    makePngChunk('IDAT', compressed),
    makePngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function fillConvexQuad(buf, W, H, pts, r, g, b, alpha) {
  let minY = H - 1;
  let maxY = 0;
  for (let i = 0; i < 4; i++) {
    const py = pts[i][1];
    if (py < minY) minY = py;
    if (py > maxY) maxY = py;
  }
  const yStart = Math.max(0, Math.ceil(minY));
  const yEnd = Math.min(H - 1, Math.floor(maxY));
  if (yStart > yEnd) return;

  const cr = Math.max(0, Math.min(255, Math.round(r)));
  const cg = Math.max(0, Math.min(255, Math.round(g)));
  const cb = Math.max(0, Math.min(255, Math.round(b)));

  for (let y = yStart; y <= yEnd; y++) {
    const scanY = y + 0.5;
    let xMin = Infinity;
    let xMax = -Infinity;

    for (let i = 0; i < 4; i++) {
      const [x1, y1] = pts[i];
      const [x2, y2] = pts[(i + 1) & 3];
      if ((y1 <= scanY && y2 > scanY) || (y2 <= scanY && y1 > scanY)) {
        const t = (scanY - y1) / (y2 - y1);
        const ix = x1 + t * (x2 - x1);
        if (ix < xMin) xMin = ix;
        if (ix > xMax) xMax = ix;
      }
    }

    const xs = Math.max(0, Math.ceil(xMin - 0.5));
    const xe = Math.min(W - 1, Math.floor(xMax + 0.5));
    if (alpha >= 0.99) {
      for (let x = xs; x <= xe; x++) {
        const idx = (y * W + x) * 4;
        buf[idx] = cr;
        buf[idx + 1] = cg;
        buf[idx + 2] = cb;
        buf[idx + 3] = 255;
      }
    } else {
      const invA = 1 - alpha;
      for (let x = xs; x <= xe; x++) {
        const idx = (y * W + x) * 4;
        buf[idx] = Math.round(cr * alpha + buf[idx] * invA);
        buf[idx + 1] = Math.round(cg * alpha + buf[idx + 1] * invA);
        buf[idx + 2] = Math.round(cb * alpha + buf[idx + 2] * invA);
        buf[idx + 3] = 255;
      }
    }
  }
}

/**
 * Render a normalized block grid into a crisp 2x-supersampled PNG Buffer (`240x152`).
 */
export function renderGridThumbnailPng(grid, outWidth = 240, outHeight = 152) {
  const ss = 2; // 2x supersampling for clean anti-aliased isometric edges
  const W = outWidth * ss;
  const H = outHeight * ss;
  const buf = new Uint8Array(W * H * 4);

  // Paint dark studio radial gradient background (#1d283b center -> #0d121c outer)
  const cxBg = W * 0.5;
  const cyBg = H * 0.46;
  const maxR = Math.hypot(cxBg, cyBg);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const t = Math.min(1, Math.hypot(x - cxBg, y - cyBg) / maxR);
      const idx = (y * W + x) * 4;
      buf[idx] = Math.round(29 * (1 - t) + 12 * t);
      buf[idx + 1] = Math.round(40 * (1 - t) + 17 * t);
      buf[idx + 2] = Math.round(59 * (1 - t) + 27 * t);
      buf[idx + 3] = 255;
    }
  }

  const blocks = grid?.blocks || [];
  if (blocks.length === 0) {
    return encodePngRgba(outWidth, outHeight, downsample2x(buf, outWidth, outHeight));
  }

  // Fast neighbor map to cull blocks completely hidden from the (+X, +Y, +Z) isometric camera!
  const width = Math.max(1, grid.width);
  const height = Math.max(1, grid.height);
  const length = Math.max(1, grid.length);
  const occ = new Uint8Array(width * height * length);

  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (
      b.block.category !== 'translucent' &&
      b.block.pattern !== 'leaves' &&
      !b.block.isSlab &&
      b.x >= 0 && b.x < width && b.y >= 0 && b.y < height && b.z >= 0 && b.z < length
    ) {
      occ[(b.y * length + b.z) * width + b.x] = 1;
    }
  }

  const isOpaqueAt = (x, y, z) => {
    if (x < 0 || x >= width || y < 0 || y >= height || z < 0 || z >= length) return false;
    return occ[(y * length + z) * width + x] === 1;
  };

  // Only blocks with at least one camera-facing face (+X, +Y, or +Z) unoccluded can be seen!
  const visible = [];
  let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;

  for (let i = 0; i < blocks.length; i++) {
    const item = blocks[i];
    const { x, y, z, block } = item;
    const hideTop = !block.isSlab && isOpaqueAt(x, y + 1, z);
    const hideRight = !block.isSlab && isOpaqueAt(x + 1, y, z);
    const hideLeft = !block.isSlab && isOpaqueAt(x, y, z + 1);
    if (hideTop && hideRight && hideLeft) continue;

    visible.push({ item, hideTop, hideRight, hideLeft });

    // Bounds in unscaled isometric space
    const u0 = x - (z + 1);
    const u1 = x + 1 - z;
    const v0 = (x + z) * 0.5 - (y + 1) * 1.05;
    const v1 = (x + 1 + z + 1) * 0.5 - y * 1.05;
    if (u0 < minU) minU = u0;
    if (u1 > maxU) maxU = u1;
    if (v0 < minV) minV = v0;
    if (v1 > maxV) maxV = v1;
  }

  // Exact back-to-front topological sort for (+X, +Y, +Z) orthographic camera: x + y + z ascending!
  visible.sort((a, b) => a.item.x + a.item.y + a.item.z - (b.item.x + b.item.y + b.item.z));

  const spanU = Math.max(1, maxU - minU);
  const spanV = Math.max(1, maxV - minV);
  const scale = Math.min((W * 0.84) / spanU, (H * 0.86) / spanV);
  const midU = (minU + maxU) * 0.5;
  const midV = (minV + maxV) * 0.5;

  const project = (wx, wy, wz) => [
    W * 0.5 + (wx - wz - midU) * scale,
    H * 0.5 + ((wx + wz) * 0.5 - wy * 1.05 - midV) * scale,
  ];

  const rgbCache = new Map();
  const getRgb = (hex) => {
    let c = rgbCache.get(hex);
    if (!c) {
      c = parseRgb(hex);
      rgbCache.set(hex, c);
    }
    return c;
  };

  for (let i = 0; i < visible.length; i++) {
    const { item, hideTop, hideRight, hideLeft } = visible[i];
    const { x, y, z, block } = item;
    const [r, g, b] = getRgb(block.hex);

    const isSlab = Boolean(block.isSlab);
    const y0 = isSlab && block.slabHalf === 'top' ? y + 0.5 : y;
    const y1 = isSlab && block.slabHalf !== 'top' ? y + 0.5 : y + 1;

    const isGlass = block.category === 'translucent';
    const isLight = block.category === 'emissive';
    const alpha = isGlass ? 0.46 : 1.0;

    // 7 visible corners of box [x..x+1, y0..y1, z..z+1]
    const pTopBack = project(x, y1, z);
    const pTopRight = project(x + 1, y1, z);
    const pTopFront = project(x + 1, y1, z + 1);
    const pTopLeft = project(x, y1, z + 1);

    const pBotRight = project(x + 1, y0, z);
    const pBotFront = project(x + 1, y0, z + 1);
    const pBotLeft = project(x, y0, z + 1);

    if (!hideLeft) {
      const sh = isLight ? 1.08 : 0.82;
      fillConvexQuad(buf, W, H, [pTopLeft, pTopFront, pBotFront, pBotLeft], r * sh, g * sh, b * sh, alpha);
    }
    if (!hideRight) {
      const sh = isLight ? 1.02 : 0.65;
      fillConvexQuad(buf, W, H, [pTopFront, pTopRight, pBotRight, pBotFront], r * sh, g * sh, b * sh, alpha);
    }
    if (!hideTop) {
      const sh = isLight ? 1.22 : 1.06;
      fillConvexQuad(buf, W, H, [pTopBack, pTopRight, pTopFront, pTopLeft], r * sh, g * sh, b * sh, alpha);
    }
  }

  return encodePngRgba(outWidth, outHeight, downsample2x(buf, outWidth, outHeight));
}

function downsample2x(hiBuf, outW, outH) {
  const inW = outW * 2;
  const out = new Uint8Array(outW * outH * 4);
  for (let y = 0; y < outH; y++) {
    const r0 = (y * 2) * inW * 4;
    const r1 = (y * 2 + 1) * inW * 4;
    for (let x = 0; x < outW; x++) {
      const c0 = x * 2 * 4;
      const c1 = (x * 2 + 1) * 4;
      const di = (y * outW + x) * 4;
      out[di] = (hiBuf[r0 + c0] + hiBuf[r0 + c1] + hiBuf[r1 + c0] + hiBuf[r1 + c1] + 2) >> 2;
      out[di + 1] = (hiBuf[r0 + c0 + 1] + hiBuf[r0 + c1 + 1] + hiBuf[r1 + c0 + 1] + hiBuf[r1 + c1 + 1] + 2) >> 2;
      out[di + 2] = (hiBuf[r0 + c0 + 2] + hiBuf[r0 + c1 + 2] + hiBuf[r1 + c0 + 2] + hiBuf[r1 + c1 + 2] + 2) >> 2;
      out[di + 3] = 255;
    }
  }
  return out;
}
