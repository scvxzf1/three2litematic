#!/usr/bin/env node
/**
 * three2litematic CLI
 * Commands:
 *   convert <input.html|js|json> [-o out.litematic|.schem|.mcfunction] [options]
 *   inspect <file.litematic|.schem>
 *   serve   [--port 28741] [--host 127.0.0.1]
 *   palettes [--preset 1.21]
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import {
  VERSION_PRESETS,
  getFilteredPalette,
  convertToLitematic,
  decodeLitematic,
  decodeSpongeSchem,
} from '../core/index.js';
import { loadInputSource } from './scene-runner.js';
import { startWebServer } from './server.js';
import { listAllAssets, LIBRARY_ROOT } from './library-manager.js';
import {
  DEFAULT_MAX_BACKUPS,
  normalizeMaxBackups,
  discoverMinecraftWorlds,
  readWorldMetadata,
  renderWorldMapRegion,
  placeStructureInWorld,
  listWorldBackups,
  restoreWorldBackup,
  deleteWorldBackup,
  clearAllWorldBackups,
  pruneWorldBackups,
} from './mca-world.js';

function printHelp() {
  console.log(`
three2litematic — Three.js 像素/体素作品转 Minecraft 蓝图与存档地图直写工具

用法:
  three2litematic convert <input.html|js|json> [选项]
  three2litematic place <input.html|js|json|litematic|schem> --world <存档目录> [选项]
  three2litematic worlds
  three2litematic rollback --world <存档目录> [--backup <id>]
  three2litematic inspect <schematic.litematic|.schem>
  three2litematic library
  three2litematic serve [--port 28741] [--host 127.0.0.1]
  three2litematic palettes [--preset 1.21]

convert 选项:
  -o, --output <path>         输出文件路径 (后缀支持 .litematic / .schem / .mcfunction)
  -f, --format <fmt>          导出格式: litematic (默认) | schem | mcfunction
  -p, --preset <name>         MC 版本预设: 1.21 (默认) | 1.20.1 | 1.16.5 | classic
  -s, --scale <mode>          缩放模式: auto (默认) | 1:1 | fit
  -z, --size <number>         fit/auto 模式下的目标最大边长 (默认: 64)
      --slabs                 开启半砖 (0.5 格台阶) 坡面与拱顶拟合
      --dither <0-100>        开启 3D 有序混色抖动强度 (默认: 0)
      --brightness <-50..50>  源色彩亮度微调 (默认: 0)
      --saturation <0..200>   源色彩饱和度百分比 (默认: 100)
      --hollow                自动掏空完全被实心方块包裹的内部不可见方块
      --allow-gravity         允许匹配沙子/混凝土粉末等重力方块 (默认排除)
      --allow-expensive       允许匹配金块/钻石块/下界合金块等昂贵矿块 (默认排除)
      --prefer-scene          忽略 __VOXEL_DATA__，强制走 THREE.Scene 几何体体素化
      --disable <ids>         逗号分隔的禁用方块 ID
      --disable-family <fams> 逗号分隔的禁用材质大类 (如 wool,foliage,copper)
      --override <pairs>      手动替换方块映射 (如 green_wool=moss_block,calcite=quartz_block)
      --name <title>          自定义投影名称
      --author <name>         自定义作者名称
      --json                  以 JSON 格式输出转换摘要与材料表

place 离线写入存档选项:
  -w, --world <dir>           目标 Minecraft 存档根目录 (含 level.dat 与 region/)
      --at <x,y,z>            放置起点坐标 (例如 120,68,240 或 120,ground,240；默认置于玩家/出生点旁贴地)
      --offset-y <int>        贴地时的高度偏移 ΔY (默认: 0；浮空岛可设 +18)
      --auto-sink             超高建筑自动下调基底，确保顶部不超出存档高度上限
      --top-clearance-y <n>   建筑顶部额外留空 Y 层（需配合 --auto-sink，默认: 0）
      --rotate <0|90|180|270> 顺时针旋转角度 (默认: 0)
      --mirror                沿 X 轴左右镜像翻转
      --include-air           连同包围盒内部空气一并写入 (挖空地下室时使用)
      --fill-void             按模型占用区块范围向上填充空置域底座（仅填空气）
      --fill-mode <mode>      空置域模式：solid（整段填充）| base_hollow（一层底座并向上挖空）
      --fill-bottom-y <n>     空置域底座最低 Y（需低于模型基底 Y）
      --fill-material <id>   空置域底座材料（默认: minecraft:stone）
      --fill-overwrite       空置域填充时覆盖范围内原有方块
      --max-backups <n>       最大保留备份数，超出自动清理最早备份 (默认: 10)

rollback 选项:
      --delete <id>           手动删除指定备份（不改动当前地图）
      --clean-all             手动清空全部备份（不改动当前地图）
      --max-backups <n>       按上限清理旧备份（默认: 10）
`);
}

function formatStacks(count) {
  const stacks = Math.floor(count / 64);
  const rem = count % 64;
  if (stacks === 0) return `${rem} 个`;
  if (rem === 0) return `${stacks} 组`;
  return `${stacks} 组 + ${rem} 个`;
}

async function runConvert(rawArgs) {
  const { values, positionals } = parseArgs({
    args: rawArgs,
    allowPositionals: true,
    options: {
      output: { type: 'string', short: 'o' },
      format: { type: 'string', short: 'f' },
      preset: { type: 'string', short: 'p', default: '1.21' },
      scale: { type: 'string', short: 's', default: 'auto' },
      size: { type: 'string', short: 'z', default: '64' },
      slabs: { type: 'boolean', default: false },
      dither: { type: 'string', default: '0' },
      brightness: { type: 'string', default: '0' },
      saturation: { type: 'string', default: '100' },
      hollow: { type: 'boolean', default: false },
      'allow-gravity': { type: 'boolean', default: false },
      'allow-expensive': { type: 'boolean', default: false },
      'prefer-scene': { type: 'boolean', default: false },
      disable: { type: 'string', default: '' },
      'disable-family': { type: 'string', default: '' },
      override: { type: 'string', default: '' },
      name: { type: 'string' },
      author: { type: 'string' },
      json: { type: 'boolean', default: false },
    },
  });

  const inputPath = positionals[0];
  if (!inputPath) {
    console.error('错误: 请指定输入文件 (.html / .js / .json)');
    process.exit(1);
  }

  if (!VERSION_PRESETS[values.preset]) {
    console.error(`错误: 未知版本预设 "${values.preset}"。可选: ${Object.keys(VERSION_PRESETS).join(', ')}`);
    process.exit(1);
  }

  const absInput = path.resolve(inputPath);
  let format = (values.format || '').toLowerCase();
  if (!format && values.output) {
    const outExt = path.extname(values.output).toLowerCase().replace('.', '');
    if (outExt === 'schem' || outExt === 'mcfunction' || outExt === 'litematic') {
      format = outExt;
    }
  }
  if (!format) format = 'litematic';

  const defaultOut = path.join(
    path.dirname(absInput),
    `${path.basename(absInput, path.extname(absInput))}.${format}`
  );
  const absOutput = path.resolve(values.output || defaultOut);

  const disabledBlocks = values.disable
    ? values.disable
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => (s.startsWith('minecraft:') ? s : `minecraft:${s}`))
    : [];

  const disabledFamilies = values['disable-family']
    ? values['disable-family'].split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  const blockOverrides = {};
  if (values.override) {
    for (const pair of values.override.split(',')) {
      const [k, v] = pair.split('=').map((s) => s?.trim());
      if (k && v) blockOverrides[k] = v;
    }
  }

  const source = await loadInputSource(absInput);
  const result = await convertToLitematic({
    voxelData: values['prefer-scene'] ? null : source.voxelData,
    scene: source.scene,
    options: {
      format,
      versionPreset: values.preset,
      scaleMode: values.scale,
      targetSize: Number(values.size) || 64,
      useSlabs: values.slabs,
      ditherStrength: Number(values.dither) || 0,
      brightness: Number(values.brightness) || 0,
      saturation: Number(values.saturation ?? 100),
      hollowInterior: values.hollow,
      excludeGravity: !values['allow-gravity'],
      survivalFriendly: !values['allow-expensive'],
      disabledBlocks,
      disabledFamilies,
      blockOverrides,
      name: values.name || source.title || path.basename(absInput, path.extname(absInput)),
      author: values.author || 'three2litematic',
    },
  });

  await fs.mkdir(path.dirname(absOutput), { recursive: true });
  await fs.writeFile(absOutput, result.bytes);

  if (values.json) {
    console.log(
      JSON.stringify(
        {
          output: absOutput,
          format: result.format,
          byteSize: result.bytes.byteLength,
          mode: result.mode,
          preset: values.preset,
          dimensions: {
            width: result.grid.width,
            height: result.grid.height,
            length: result.grid.length,
          },
          totalBlocks: result.grid.blocks.length,
          slabCount: result.grid.slabCount,
          hollowedCount: result.grid.hollowedCount,
          materials: result.grid.materials,
        },
        null,
        2
      )
    );
    return;
  }

  console.log(`✅ 导出成功 [${result.format}]: ${absOutput} (${(result.bytes.byteLength / 1024).toFixed(1)} KB)`);
  console.log(`   提取模式: ${result.mode} | 版本预设: ${VERSION_PRESETS[values.preset].label}`);
  console.log(
    `   建筑尺寸: ${result.grid.width} × ${result.grid.height} × ${result.grid.length} (共 ${result.grid.blocks.length} 方块${
      result.grid.slabCount > 0 ? `，含半砖 ${result.grid.slabCount} 个` : ''
    }${result.grid.hollowedCount > 0 ? `，内部掏空省 ${result.grid.hollowedCount} 个` : ''})`
  );
  console.log(`\n📦 材料清单 (前 12 种，共 ${result.grid.materials.length} 种方块):`);
  for (const m of result.grid.materials.slice(0, 12)) {
    console.log(
      `   - ${m.nameZh.padEnd(10, ' ')} (${m.id}) : ${String(m.count).padStart(6, ' ')}  [${formatStacks(m.count)}]`
    );
  }
}

async function runInspect(rawArgs) {
  const filePath = rawArgs[0];
  if (!filePath) {
    console.error('错误: 请指定要查看的 .litematic 或 .schem 文件路径');
    process.exit(1);
  }
  const abs = path.resolve(filePath);
  const bytes = await fs.readFile(abs);
  const decoded = abs.toLowerCase().endsWith('.schem')
    ? await decodeSpongeSchem(bytes)
    : await decodeLitematic(bytes);
  const m = decoded.metadata;

  console.log(`📐 蓝图名称: ${m.name} (作者: ${m.author})`);
  console.log(`   格式版本: v${m.version} | MinecraftDataVersion: ${m.mcDataVersion}`);
  if (m.previewImageData) {
    const sq = Math.round(Math.sqrt(m.previewImageData.length));
    console.log(`   内嵌缩略图: ${sq}×${sq} ARGB 像素`);
  }
  console.log(`   尺寸 (X×Y×Z): ${decoded.width} × ${decoded.height} × ${decoded.length}`);
  console.log(`   非空气方块数: ${decoded.blocks.length} / 总体积 ${decoded.width * decoded.height * decoded.length}`);
  console.log(`\n📦 完整材料统计 (${decoded.materials.length} 种):`);
  for (const item of decoded.materials) {
    console.log(
      `   - ${item.nameZh.padEnd(10, ' ')} (${item.id.padEnd(34, ' ')}) : ${String(item.count).padStart(6, ' ')}  [${formatStacks(item.count)}]`
    );
  }
}

async function runServe(rawArgs) {
  const { values } = parseArgs({
    args: rawArgs,
    allowPositionals: true,
    options: {
      port: { type: 'string', short: 'p', default: '28741' },
      host: { type: 'string', short: 'h', default: '127.0.0.1' },
    },
  });
  const port = Number(values.port) || 28741;
  const { url } = await startWebServer({ port, host: values.host });
  console.log(`🚀 three2litematic Web 可视化工作台已启动: ${url}`);
  console.log(`   支持拖入/粘贴 Three.js HTML、实时对比原场景与 MC 方块预览、Y 层切片及多格式导出`);
}

async function runPalettes(rawArgs) {
  const { values } = parseArgs({
    args: rawArgs,
    allowPositionals: true,
    options: {
      preset: { type: 'string', short: 'p', default: '1.21' },
    },
  });
  const list = getFilteredPalette({ versionPreset: values.preset });
  console.log(`🎨 预设 [${values.preset}] 可用方块 (${list.length} 种):`);
  for (const blk of list) {
    console.log(`   ${blk.hex}  [${blk.family.padEnd(10, ' ')}]  ${blk.nameZh.padEnd(10, ' ')}  ${blk.id}`);
  }
}

async function runLibrary() {
  const assets = await listAllAssets();
  const userAssets = assets.filter((a) => a.kind === 'user');
  const builtinAssets = assets.filter((a) => a.kind === 'builtin');
  console.log(`📚 本地资产库目录: ${LIBRARY_ROOT}`);
  console.log(`   我的资产: ${userAssets.length} 个 | 内置示例: ${builtinAssets.length} 个\n`);
  for (const a of assets) {
    const tag = a.kind === 'user' ? (a.favorite ? '⭐ 我的资产' : '📁 我的资产') : '🏛️ 内置示例';
    const dimStr = a.dimensions
      ? `${a.dimensions.width}×${a.dimensions.height}×${a.dimensions.length} (${a.blockCount} 块)`
      : a.sourceExt.toUpperCase();
    const diskRel =
      a.kind === 'user'
        ? `library/assets/${a.id}/source.${a.sourceExt}`
        : `examples/${a.id.slice('example:'.length)}`;
    console.log(`   [${tag}] ${a.name.padEnd(28, ' ')} | ${dimStr.padEnd(22, ' ')} | ${diskRel}`);
  }
}

async function runWorlds() {
  const worlds = await discoverMinecraftWorlds();
  if (worlds.length === 0) {
    console.log('未在常见路径发现本地 Minecraft Java 版存档，请使用 --world <路径> 手动指定。');
    return;
  }
  console.log(`🗺️  自动发现本地 Minecraft 存档 (${worlds.length} 个):\n`);
  for (const w of worlds) {
    const inst = w.instanceName ? ` [${w.instanceName}]` : '';
    const dirHint = w.folderName && w.folderName !== w.levelName ? ` (${w.folderName})` : '';
    const pStr = w.playerPos ? `玩家:(${w.playerPos.join(', ')})` : '单人位置未知';
    console.log(`   - ${w.levelName}${dirHint}${inst} · MC ${w.mcVersionName} (DataVersion ${w.dataVersion})`);
    console.log(`     路径: ${w.worldPath}`);
    console.log(`     出生点:(${w.spawnPos.join(', ')}) | ${pStr} | 区域文件: ${w.regionCount} 个 | 备份: ${w.backups.length} 份\n`);
  }
}

async function runPlace(rawArgs) {
  const { values, positionals } = parseArgs({
    args: rawArgs,
    allowPositionals: true,
    options: {
      world: { type: 'string', short: 'w' },
      at: { type: 'string' },
      'offset-y': { type: 'string', default: '0' },
      'auto-sink': { type: 'boolean', default: false },
      'top-clearance-y': { type: 'string', default: '0' },
      rotate: { type: 'string', default: '0' },
      mirror: { type: 'boolean', default: false },
      'include-air': { type: 'boolean', default: false },
      'fill-void': { type: 'boolean', default: false },
      'fill-mode': { type: 'string', default: 'solid' },
      'fill-bottom-y': { type: 'string' },
      'fill-material': { type: 'string', default: 'minecraft:stone' },
      'fill-overwrite': { type: 'boolean', default: false },
      'max-backups': { type: 'string', default: String(DEFAULT_MAX_BACKUPS) },
      preset: { type: 'string', short: 'p', default: '1.21' },
      scale: { type: 'string', short: 's', default: 'auto' },
      size: { type: 'string', short: 'z', default: '64' },
      slabs: { type: 'boolean', default: false },
      hollow: { type: 'boolean', default: false },
      json: { type: 'boolean', default: false },
    },
  });

  const inputPath = positionals[0];
  if (!inputPath || !values.world) {
    console.error('错误: 请指定输入模型文件与 --world <存档目录>');
    process.exit(1);
  }

  const absInput = path.resolve(inputPath);
  const ext = path.extname(absInput).toLowerCase();
  let grid;
  let label = path.basename(absInput, ext);

  if (ext === '.litematic' || ext === '.schem') {
    const raw = await fs.readFile(absInput);
    grid = ext === '.schem' ? await decodeSpongeSchem(raw) : await decodeLitematic(raw);
    label = grid.metadata?.name || label;
  } else {
    const source = await loadInputSource(absInput);
    const conv = await convertToLitematic({
      voxelData: source.voxelData,
      scene: source.scene,
      options: {
        versionPreset: values.preset,
        scaleMode: values.scale,
        targetSize: Number(values.size) || 64,
        useSlabs: values.slabs,
        hollowInterior: values.hollow,
        name: source.title || label,
      },
    });
    grid = conv.grid;
    label = source.title || label;
  }

  const wInfo = await readWorldMetadata(values.world);
  const offsetY = Number(values['offset-y']) || 0;
  let tx;
  let ty;
  let tz;

  if (values.at) {
    const parts = values.at.split(',').map((s) => s.trim());
    if (parts.length < 3) {
      throw new Error('--at 参数格式应为 x,y,z 或 x,ground,z');
    }
    tx = Math.floor(Number(parts[0]));
    tz = Math.floor(Number(parts[2]));
    if (parts[1].toLowerCase() === 'ground' || parts[1].toLowerCase() === 'auto') {
      ty = null;
    } else {
      ty = Math.floor(Number(parts[1]));
    }
  } else {
    const anchor = wInfo.playerPos || wInfo.spawnPos || [0, 64, 0];
    tx = anchor[0] + 12;
    tz = anchor[2] + 12;
    ty = null;
  }

  if (ty === null) {
    const cx = tx + Math.floor(grid.width / 2);
    const cz = tz + Math.floor(grid.length / 2);
    const mapSample = await renderWorldMapRegion(wInfo.worldPath, {
      centerX: cx,
      centerZ: cz,
      spanChunks: 8,
    });
    const hBytes = Buffer.from(mapSample.heightsInt16Base64, 'base64');
    const heights = new Int16Array(hBytes.buffer, hBytes.byteOffset, hBytes.byteLength / 2);
    const lx = cx - mapSample.bounds.minX;
    const lz = cz - mapSample.bounds.minZ;
    const groundH =
      lx >= 0 && lx < mapSample.bounds.width && lz >= 0 && lz < mapSample.bounds.length
        ? heights[lz * mapSample.bounds.width + lx]
        : -32768;
    const baseGround = groundH !== -32768 ? groundH + 1 : (wInfo.playerPos?.[1] ?? wInfo.spawnPos[1]);
    ty = baseGround + offsetY;
  }

  const res = await placeStructureInWorld({
    worldPath: wInfo.worldPath,
    grid,
    targetX: tx,
    targetY: ty,
    targetZ: tz,
    rotation: Number(values.rotate) || 0,
    mirrorX: values.mirror,
    includeAir: values['include-air'],
    autoSink: values['auto-sink'],
    topClearanceLayers: Number(values['top-clearance-y']) || 0,
    fillVoid: values['fill-void'],
    fillMode: values['fill-mode'],
    fillBottomY: values['fill-bottom-y'] == null ? undefined : Number(values['fill-bottom-y']),
    fillMaterial: values['fill-material'],
    fillOverwrite: values['fill-overwrite'],
    label,
    maxBackups: Number(values['max-backups']) || DEFAULT_MAX_BACKUPS,
  });

  if (values.json) {
    console.log(JSON.stringify(res, null, 2));
    return;
  }

  console.log(`✅ 已离线写入存档「${wInfo.levelName}」(MC ${wInfo.mcVersionName})！`);
  const actualY = res.verticalPlacement?.baseY ?? ty;
  const sinkText = res.verticalPlacement?.settledBy > 0
    ? ` · 自动沉降 ${res.verticalPlacement.settledBy} 层`
    : '';
  console.log(`   放置坐标: X=${tx}, Y=${actualY}, Z=${tz} (旋转 ${Number(values.rotate) || 0}°${values.mirror ? ' · 左右镜像' : ''}${sinkText})`);
  const clearedText = res.clearedBlockCount ? ` · 挖空 ${res.clearedBlockCount} 格` : '';
  console.log(`   写入统计: ${res.placedBlockCount} 方块${clearedText} · 修改 ${res.modifiedChunkCount} 个区块`);
  console.log(`   自动备份: ${res.backup.id} (随时可执行 rollback 一键无损撤销)`);
}

async function runRollback(rawArgs) {
  const { values } = parseArgs({
    args: rawArgs,
    allowPositionals: true,
    options: {
      world: { type: 'string', short: 'w' },
      backup: { type: 'string', short: 'b' },
      delete: { type: 'string' },
      'clean-all': { type: 'boolean', default: false },
      'max-backups': { type: 'string' },
    },
  });
  if (!values.world) {
    console.error('错误: 请通过 --world <存档目录> 指定存档目录');
    process.exit(1);
  }
  if (values['clean-all']) {
    await clearAllWorldBackups(values.world);
    console.log('🧹 已清空该存档下的全部备份快照（未改动当前地图区块）。');
    return;
  }
  if (values.delete) {
    await deleteWorldBackup({ worldPath: values.world, backupId: values.delete });
    console.log(`🗑️ 已删除备份记录 [${values.delete}]（未改动当前地图区块）。`);
    return;
  }
  if (values['max-backups'] != null) {
    const result = await pruneWorldBackups(values.world, normalizeMaxBackups(values['max-backups']));
    console.log(`🧹 已按上限 ${result.maxBackups} 份清理 ${result.deletedIds.length} 份旧备份。`);
    return;
  }
  const backups = await listWorldBackups(values.world);
  if (backups.length === 0) {
    console.error('该存档下没有任何 .three2litematic-backups 备份记录。');
    process.exit(1);
  }
  const targetId = values.backup || backups[0].id;
  const restored = await restoreWorldBackup({ worldPath: values.world, backupId: targetId });
  console.log(`⏪ 已回滚恢复备份 [${restored.id}] (${restored.label})，还原文件: ${restored.files.join(', ')}`);
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  if (!cmd || cmd === '-h' || cmd === '--help' || cmd === 'help') {
    printHelp();
    return;
  }
  if (cmd === 'convert') {
    await runConvert(rest);
  } else if (cmd === 'place') {
    await runPlace(rest);
  } else if (cmd === 'worlds') {
    await runWorlds();
  } else if (cmd === 'rollback') {
    await runRollback(rest);
  } else if (cmd === 'inspect') {
    await runInspect(rest);
  } else if (cmd === 'library') {
    await runLibrary();
  } else if (cmd === 'serve' || cmd === 'start') {
    await runServe(rest);
  } else if (cmd === 'palettes') {
    await runPalettes(rest);
  } else if (cmd.endsWith('.html') || cmd.endsWith('.js') || cmd.endsWith('.json')) {
    await runConvert([cmd, ...rest]);
  } else {
    console.error(`未知子命令: ${cmd}`);
    printHelp();
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`❌ 执行失败: ${err.message}`);
  process.exit(1);
});
