/**
 * Local HTTP Server for three2litematic Web Studio + Asset Library & Preset APIs
 */

import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  listAllAssets,
  getAssetMetaAndPaths,
  getCachedThumbPath,
  cacheWebglThumbnailForAsset,
  saveUserAsset,
  updateAssetMetadataOnly,
  deleteUserAsset,
  batchExportAssets,
  listPresets,
  savePreset,
  deletePreset,
} from './library-manager.js';
import {
  DEFAULT_MAX_BACKUPS,
  discoverMinecraftWorlds,
  renderWorldMapRegion,
  placeStructureInWorld,
  listWorldBackups,
  restoreWorldBackup,
  pruneWorldBackups,
  deleteWorldBackup,
  clearAllWorldBackups,
} from './mca-world.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../..');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.litematic': 'application/octet-stream',
  '.schem': 'application/octet-stream',
  '.mcfunction': 'text/plain; charset=utf-8',
  '.zip': 'application/zip',
};

function sendJson(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-cache',
  });
  res.end(JSON.stringify(data));
}

function readJsonBody(req, maxBytes = 32 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(new Error('请求体过大（超过 32MB 限制）'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf-8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (err) {
        reject(new Error(`无效的 JSON 请求体: ${err.message}`));
      }
    });
    req.on('error', reject);
  });
}

export function startWebServer({ port = 28741, host = '127.0.0.1' } = {}) {
  const server = http.createServer(async (req, res) => {
    try {
      const urlObj = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      let reqPath = decodeURIComponent(urlObj.pathname);
      const method = (req.method || 'GET').toUpperCase();

      // ==================== API Routes ====================
      if (reqPath === '/api/examples' && method === 'GET') {
        const examplesDir = path.join(PROJECT_ROOT, 'examples');
        const entries = await fs.readdir(examplesDir).catch(() => []);
        const files = entries
          .filter((f) => f.endsWith('.html') || f.endsWith('.json'))
          .sort()
          .map((f) => ({ name: f, url: `/examples/${f}` }));
        sendJson(res, 200, { examples: files });
        return;
      }

      if (reqPath === '/api/library/assets' && method === 'GET') {
        const assets = await listAllAssets();
        sendJson(res, 200, { assets });
        return;
      }

      if (reqPath === '/api/library/assets' && method === 'POST') {
        const body = await readJsonBody(req);
        const saved = await saveUserAsset(body);
        sendJson(res, 200, { asset: saved });
        return;
      }

      if (reqPath === '/api/library/batch-export' && method === 'POST') {
        const body = await readJsonBody(req);
        if (!Array.isArray(body.ids) || body.ids.length === 0) {
          sendJson(res, 400, { error: '请至少选择一个资产进行导出' });
          return;
        }
        const exported = await batchExportAssets(
          body.ids,
          body.format || 'litematic',
          body.fallbackPreset || '1.21'
        );
        res.writeHead(200, {
          'Content-Type': exported.isZip ? 'application/zip' : 'application/octet-stream',
          'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(exported.filename)}`,
          'X-Export-Filename': encodeURIComponent(exported.filename),
        });
        res.end(exported.buffer);
        return;
      }

      const cacheThumbMatch = reqPath.match(/^\/api\/library\/cache-thumb\/(.+)$/);
      if (cacheThumbMatch) {
        const assetId = cacheThumbMatch[1];
        if (method === 'GET') {
          const buf = await fs.readFile(getCachedThumbPath(assetId));
          const hasVer = urlObj.searchParams.has('v');
          res.writeHead(200, {
            'Content-Type': 'image/png',
            'Cache-Control': hasVer ? 'public, max-age=31536000, immutable' : 'no-cache',
          });
          res.end(buf);
          return;
        }
        if (method === 'POST') {
          const body = await readJsonBody(req);
          const result = await cacheWebglThumbnailForAsset(assetId, body);
          sendJson(res, 200, result);
          return;
        }
      }

      const assetSubMatch = reqPath.match(/^\/api\/library\/assets\/([^/]+)(?:\/(source|thumbnail))?$/);
      if (assetSubMatch) {
        const assetId = assetSubMatch[1];
        const subResource = assetSubMatch[2] || null;

        if (subResource === 'source' && method === 'GET') {
          const info = await getAssetMetaAndPaths(assetId);
          const buf = await fs.readFile(info.sourcePath);
          const ext = info.meta.sourceExt || 'html';
          res.writeHead(200, {
            'Content-Type': MIME_TYPES[`.${ext}`] || 'application/octet-stream',
            'X-Asset-Ext': ext,
            'Cache-Control': 'no-cache',
          });
          res.end(buf);
          return;
        }

        if (subResource === 'thumbnail' && method === 'GET') {
          const info = await getAssetMetaAndPaths(assetId);
          const buf = await fs.readFile(info.thumbPath);
          const hasVer = urlObj.searchParams.has('v');
          res.writeHead(200, {
            'Content-Type': 'image/png',
            'Cache-Control': hasVer ? 'public, max-age=31536000, immutable' : 'no-cache',
          });
          res.end(buf);
          return;
        }

        if (!subResource && method === 'PATCH') {
          const body = await readJsonBody(req);
          const updated = await updateAssetMetadataOnly(assetId, body);
          sendJson(res, 200, { asset: updated });
          return;
        }

        if (!subResource && method === 'DELETE') {
          await deleteUserAsset(assetId);
          sendJson(res, 200, { ok: true });
          return;
        }
      }

      if (reqPath === '/api/presets' && method === 'GET') {
        const presets = await listPresets();
        sendJson(res, 200, { presets });
        return;
      }

      if (reqPath === '/api/presets' && method === 'POST') {
        const body = await readJsonBody(req);
        const preset = await savePreset(body);
        sendJson(res, 200, { preset });
        return;
      }

      const presetDelMatch = reqPath.match(/^\/api\/presets\/([^/]+)$/);
      if (presetDelMatch && method === 'DELETE') {
        const presets = await deletePreset(presetDelMatch[1]);
        sendJson(res, 200, { presets });
        return;
      }

      // ==================== Offline World Map Editor Routes ====================
      if (reqPath === '/api/worlds/discover' && method === 'GET') {
        const worlds = await discoverMinecraftWorlds();
        sendJson(res, 200, { worlds });
        return;
      }

      if (reqPath === '/api/worlds/map' && method === 'POST') {
        const body = await readJsonBody(req);
        if (!body.worldPath) {
          sendJson(res, 400, { error: '请指定 Minecraft 存档文件夹路径 (worldPath)' });
          return;
        }
        const mapData = await renderWorldMapRegion(body.worldPath, {
          centerX: body.centerX,
          centerZ: body.centerZ,
          spanChunks: body.spanChunks,
        });
        sendJson(res, 200, mapData);
        return;
      }

      if (reqPath === '/api/worlds/place' && method === 'POST') {
        const body = await readJsonBody(req, 64 * 1024 * 1024);
        if (!body.worldPath) {
          sendJson(res, 400, { error: '请先选择目标 Minecraft 存档' });
          return;
        }
        if (!body.grid || !Array.isArray(body.grid.blocks) || body.grid.blocks.length === 0) {
          sendJson(res, 400, { error: '当前没有可写入存档的建筑体素网格' });
          return;
        }
        const result = await placeStructureInWorld({
          worldPath: body.worldPath,
          grid: body.grid,
          targetX: body.targetX,
          targetY: body.targetY,
          requestedBaseY: body.requestedBaseY,
          targetZ: body.targetZ,
          rotation: body.rotation || 0,
          mirrorX: Boolean(body.mirrorX),
          includeAir: Boolean(body.includeAir),
          autoSink: Boolean(body.autoSink),
          topClearanceLayers: body.topClearanceLayers ?? 0,
          fillVoid: Boolean(body.fillVoid),
          fillMode: body.fillMode,
          fillBottomY: body.fillBottomY,
          fillMaterial: body.fillMaterial,
          fillOverwrite: Boolean(body.fillOverwrite),
          label: body.label || 'Voxel_Build',
          maxBackups: body.maxBackups ?? DEFAULT_MAX_BACKUPS,
        });
        const backups = await listWorldBackups(body.worldPath);
        sendJson(res, 200, { result, backups });
        return;
      }

      if (reqPath === '/api/worlds/restore' && method === 'POST') {
        const body = await readJsonBody(req);
        if (!body.worldPath || !body.backupId) {
          sendJson(res, 400, { error: '缺少 worldPath 或 backupId 参数' });
          return;
        }
        const restored = await restoreWorldBackup({
          worldPath: body.worldPath,
          backupId: body.backupId,
        });
        const backups = await listWorldBackups(body.worldPath);
        sendJson(res, 200, { restored, backups });
        return;
      }

      if (reqPath === '/api/worlds/backups/cleanup' && method === 'POST') {
        const body = await readJsonBody(req);
        if (!body.worldPath) {
          sendJson(res, 400, { error: '缺少 worldPath 参数' });
          return;
        }
        let backups;
        let deletedCount = 0;
        if (body.clearAll) {
          const prev = await listWorldBackups(body.worldPath);
          backups = await clearAllWorldBackups(body.worldPath);
          deletedCount = prev.length - backups.length;
        } else if (body.backupId) {
          const prev = await listWorldBackups(body.worldPath);
          backups = await deleteWorldBackup({
            worldPath: body.worldPath,
            backupId: body.backupId,
          });
          deletedCount = Math.max(0, prev.length - backups.length);
        } else if (body.maxBackups != null) {
          const pruned = await pruneWorldBackups(body.worldPath, body.maxBackups);
          backups = pruned.backups;
          deletedCount = pruned.deletedIds.length;
        } else {
          sendJson(res, 400, { error: '请指定 backupId、clearAll 或 maxBackups' });
          return;
        }
        sendJson(res, 200, { ok: true, deletedCount, backups });
        return;
      }

      // ==================== Static & Root Icon Shortcuts ====================
      if (reqPath === '/' || reqPath === '/index.html') {
        reqPath = '/src/web/index.html';
      } else if (reqPath === '/favicon.ico') {
        reqPath = '/src/web/assets/favicon.ico';
      } else if (reqPath === '/manifest.webmanifest') {
        reqPath = '/src/web/assets/manifest.webmanifest';
      } else if (reqPath === '/style.css' || reqPath === '/app.js') {
        reqPath = `/src/web${reqPath}`;
      }

      const safeRel = path.normalize(reqPath).replace(/^(\.\.(\/|\\|$))+/, '');
      const fullPath = path.resolve(PROJECT_ROOT, '.' + safeRel);

      if (!fullPath.startsWith(PROJECT_ROOT)) {
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Forbidden');
        return;
      }

      const stat = await fs.stat(fullPath);
      if (stat.isDirectory()) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not found');
        return;
      }

      const ext = path.extname(fullPath).toLowerCase();
      const mime = MIME_TYPES[ext] || 'application/octet-stream';
      const content = await fs.readFile(fullPath);

      res.writeHead(200, {
        'Content-Type': mime,
        'Cache-Control': 'no-cache',
      });
      res.end(content);
    } catch (err) {
      if (req.url?.startsWith('/api/')) {
        sendJson(res, 500, { error: err.message });
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(`Not Found: ${err.message}`);
      }
    }
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      resolve({
        server,
        url: `http://${host}:${port}`,
      });
    });
  });
}
