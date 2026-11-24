import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';

import {
  TAG,
  nbt,
  encodeNbt,
  decodeNbt,
  gzipCompress,
  gzipDecompress,
  packLitematicaBitArray,
  unpackLitematicaBitArray,
  createBlockMatcher,
  buildBlockGrid,
  encodeLitematic,
  decodeLitematic,
  encodeSpongeSchem,
  decodeSpongeSchem,
  encodeMcFunction,
  resolveVerticalPlacement,
  extractSceneVoxels,
  getBlockNameZh,
} from '../src/core/index.js';
import {
  saveUserAsset,
  listAllAssets,
  getCachedThumbPath,
  updateAssetMetadataOnly,
  batchExportAssets,
  deleteUserAsset,
  listPresets,
  savePreset,
  deletePreset,
} from '../src/cli/library-manager.js';
import {
  packChunkSectionIndices,
  unpackChunkSectionIndices,
  parseMcaBuffer,
  decodeChunkSlotNbt,
  encodeChunkSlotNbt,
  buildMcaBuffer,
  readWorldMetadata,
  renderWorldMapRegion,
  placeStructureInWorld,
  getStructurePlacementBounds,
  listWorldBackups,
  restoreWorldBackup,
  deleteWorldBackup,
  clearAllWorldBackups,
} from '../src/cli/mca-world.js';
import { loadInputSource } from '../src/cli/scene-runner.js';
import { diagnoseModelInput } from '../src/web/model-diagnostics.js';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

async function testNbtRoundTrip() {
  const sample = nbt.compound({
    b: nbt.byte(-12),
    s: nbt.short(32000),
    i: nbt.int(-123456789),
    l: nbt.long(-9007199254740993n),
    str: nbt.string('樱花灯塔_Test'),
    emptyList: nbt.list(TAG.COMPOUND, []),
    ints: nbt.intArray([0xff112233 | 0, 0xffaabbcc | 0]),
    longs: nbt.longArray([0n, 0xffffffffffffffffn, 0x123456789abcdef0n]),
  });

  const raw = encodeNbt(sample, '');
  const gz = await gzipCompress(raw);
  const ungz = await gzipDecompress(gz);
  const { root } = decodeNbt(ungz);
  assert.equal(root.value.b.value, -12);
  assert.equal(root.value.s.value, 32000);
  assert.equal(root.value.i.value, -123456789);
  assert.equal(root.value.l.value, -9007199254740993n);
  assert.equal(root.value.str.value, '樱花灯塔_Test');
  assert.equal(root.value.ints.value[0], 0xff112233 | 0);
  assert.equal(root.value.longs.value[1], 0xffffffffffffffffn);
  console.log('✓ NBT 二进制序列化 + IntArray/LongArray + Gzip 往返校验通过');
}

function testCrossBoundaryBitPacking() {
  for (const bitsPerEntry of [2, 3, 5, 6, 7, 9]) {
    const maxVal = (1 << bitsPerEntry) - 1;
    const volume = 300;
    const input = new Uint32Array(volume);
    for (let i = 0; i < volume; i++) {
      input[i] = (i * 37 + 13) % (maxVal + 1);
    }
    const packed = packLitematicaBitArray(input, bitsPerEntry);
    const unpacked = unpackLitematicaBitArray(packed, volume, bitsPerEntry);
    assert.deepEqual(Array.from(unpacked), Array.from(input), `Failed at bitsPerEntry=${bitsPerEntry}`);
  }
  console.log('✓ LitematicaBitArray 跨 64-bit 边界位压缩读写测试通过');
}

function testVerticalPlacementResolution() {
  const settled = resolveVerticalPlacement({
    requestedY: 300,
    minWorldY: -64,
    maxWorldY: 319,
    minStructureY: 0,
    maxStructureY: 371,
    topClearanceLayers: 8,
    autoSink: true,
  });
  assert.equal(settled.baseY, -60);
  assert.equal(settled.topY, 311);
  assert.equal(settled.settledBy, 360);

  assert.throws(
    () => resolveVerticalPlacement({
      requestedY: 300,
      minWorldY: -64,
      maxWorldY: 319,
      minStructureY: 0,
      maxStructureY: 371,
      topClearanceLayers: 8,
      autoSink: false,
    }),
    /建筑顶部将到达/
  );
  assert.throws(
    () => resolveVerticalPlacement({
      requestedY: 0,
      minWorldY: -64,
      maxWorldY: 319,
      minStructureY: 0,
      maxStructureY: 371,
      topClearanceLayers: 20,
      autoSink: true,
    }),
    /超过存档可建高度/
  );
  console.log('✓ 超高建筑自动沉降、顶部留空与高度不足保护校验通过');
}

function testLargeStructurePlacementBounds() {
  const blocks = new Array(30_000_000).fill({
    x: 0,
    y: 0,
    z: 0,
    block: { id: 'minecraft:stone' },
  });
  blocks[0] = { x: -100, y: -50, z: -80, block: { id: 'minecraft:stone' } };
  blocks[blocks.length - 1] = { x: 100, y: 50, z: 80, block: { id: 'minecraft:stone' } };
  blocks[15_000_000] = { x: -200, y: 900, z: 200, block: { id: 'minecraft:cave_air' } };
  blocks[15_000_001] = { x: 200, y: 700, z: 250, block: { id: 'minecraft:void_air' } };
  blocks[15_000_002] = { x: -300, y: 1000, z: -300, block: { id: 'minecraft:air' } };

  const bounds = getStructurePlacementBounds(blocks);
  assert.equal(bounds.solidBlockCount, 29_999_997);
  assert.equal(bounds.occupiedBlockCount, 29_999_999);
  assert.equal(bounds.minStructureY, -50);
  assert.equal(bounds.maxStructureY, 50);
  assert.equal(bounds.minModelX, -200);
  assert.equal(bounds.maxModelX, 200);
  assert.equal(bounds.minModelZ, -80);
  assert.equal(bounds.maxModelZ, 250);
  console.log('✓ 3000 万方块结构边界扫描回归测试通过');
}

function testNativeVoxelFaceMeshExtraction() {
  const positions = new Float32Array([
    0, 1, 1, 1, 1, 1, 1, 1, 0, 0, 1, 0,
    1, 1, 1, 2, 1, 1, 2, 1, 0, 1, 1, 0,
  ]);
  const colors = new Float32Array(24).fill(0.8);
  const indices = new Uint16Array([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]);
  const accessor = (array, size) => ({
    count: array.length / size,
    getX: (i) => array[i * size],
    getY: (i) => array[i * size + 1],
    getZ: (i) => array[i * size + 2],
  });
  const geometry = {
    type: 'BufferGeometry',
    attributes: {
      position: accessor(positions, 3),
      color: accessor(colors, 3),
    },
    index: { count: indices.length, getX: (i) => indices[i] },
    groups: [],
  };
  const mesh = {
    isMesh: true,
    visible: true,
    geometry,
    material: {
      type: 'MeshBasicMaterial',
      color: { getHex: () => 0xffffff },
      userData: {},
    },
    matrixWorld: {
      elements: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 10, 3, 5, 1],
    },
  };
  const extracted = extractSceneVoxels({
    traverse(callback) {
      callback(mesh);
    },
  });

  assert.equal(extracted.mode, 'native-voxel-mesh');
  assert.equal(extracted.effectiveScale, 1);
  assert.equal(extracted.voxels[0].unlit, true);
  const coords = extracted.voxels.map((voxel) => [voxel.x, voxel.y, voxel.z]).sort();
  assert.deepEqual(coords, [
    [10, 3, 5],
    [11, 3, 5],
  ]);
  const lightPriorityGrid = buildBlockGrid(extracted.voxels, {
    versionPreset: '1.21',
    preferLightBlocks: true,
  });
  const lightPriorityIds = new Set(
    createBlockMatcher({ versionPreset: '1.21' }).palette
      .filter((block) => block.category === 'emissive')
      .map((block) => block.id)
  );
  assert.ok(
    lightPriorityGrid.materials.every((material) => lightPriorityIds.has(material.id)),
    'Expected unlit voxel faces to prefer luminous blocks'
  );
  console.log('✓ 合并体素面网格 1:1 无损反推测试通过');
}

function testGroundBackdropPerSampleClipping() {
  const scene = new THREE.Scene();
  for (let x = 0; x < 2; x++) {
    for (let z = 0; z < 2; z++) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshBasicMaterial({ color: 0x8b5a2b })
      );
      mesh.position.set(x, 0.5, z);
      scene.add(mesh);
    }
  }

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1000, 1000),
    new THREE.MeshBasicMaterial({ color: 0x252429 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  scene.add(ground);

  const extracted = extractSceneVoxels(scene, { scaleMode: '1:1' });
  const xs = extracted.voxels.map((v) => v.x);
  const zs = extracted.voxels.map((v) => v.z);
  const width = Math.max(...xs) - Math.min(...xs) + 1;
  const length = Math.max(...zs) - Math.min(...zs) + 1;

  assert.ok(width < 20, `Giant ground plane must be clipped, got width ${width}`);
  assert.ok(length < 20, `Giant ground plane must be clipped, got length ${length}`);
  assert.ok(extracted.voxels.length < 1000, 'Ground plane must not rasterize the whole 1000×1000 area');
  console.log('✓ 巨型地面背景逐点裁剪测试通过');
}

function testModelSelfDiagnosisAndInMemoryRepair() {
  const report = diagnoseModelInput({
    sourceKind: 'json',
    voxelData: {
      name: 'Diagnosis_Test',
      voxels: [
        [0, 0, 0, '#8b5a2b'],
        [0, 0, 0, '#765132'],
        ['bad', 1, 0, '#ffffff'],
      ],
    },
    currentGrid: null,
    options: {},
  });

  assert.ok(report.repair, 'Valid structured entries should produce an in-memory repair candidate');
  assert.ok(report.findings.some((finding) => finding.text.includes('1 条坐标无效')));
  assert.ok(report.findings.some((finding) => finding.text.includes('1 个重复坐标')));
  assert.equal(report.repair.voxelData.voxels.length, 1, 'Repair candidate must filter invalid and duplicate coordinates');
  assert.equal(report.repair.voxelData.name, 'Diagnosis_Test');

  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0x8b5a2b })));
  const fallbackReport = diagnoseModelInput({
    sourceKind: 'html',
    voxelData: { voxels: [['bad', 0, 0, '#ffffff']] },
    capturedScene: scene,
    currentGrid: null,
    options: { scaleMode: '1:1', targetSize: 64 },
  });
  assert.equal(fallbackReport.repair?.forceScene, true, 'Invalid structured data should fall back to captured geometry');
  assert.equal(fallbackReport.repair?.options?.scaleMode, 'auto');
  console.log('✓ 模型自助诊断与内存态修复候选测试通过');
}

async function testHeadlessPmremShim() {
  const tempFile = path.join(ROOT, 'test', '.tmp-pmrem.html');
  const html = `<!DOCTYPE html><html><body><script type="module">
import * as THREE from 'three';
const renderer = new THREE.WebGLRenderer();
const pmrem = new THREE.PMREMGenerator(renderer);
const envScene = new THREE.Scene();
envScene.add(new THREE.Mesh(new THREE.SphereGeometry(2), new THREE.MeshBasicMaterial()));
const target = pmrem.fromScene(envScene);
const scene = new THREE.Scene();
scene.environment = target.texture;
scene.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xff0000 })));
window.__VOXEL_DATA__ = { name: 'PMREM_Test', voxels: [[0, 0, 0, '#ff0000']] };
</script></body></html>`;

  await fs.writeFile(tempFile, html, 'utf-8');
  try {
    const source = await loadInputSource(tempFile);
    assert.equal(source.voxelData?.name, 'PMREM_Test');
    assert.equal(source.voxelData?.voxels?.length, 1);
  } finally {
    await fs.rm(tempFile, { force: true });
  }
  console.log('✓ CLI 无 GPU PMREM 环境贴图桩测试通过');
}

function testSemanticMatcherFamiliesAndDither() {
  const matcher121 = createBlockMatcher({ versionPreset: '1.21' });
  assert.equal(matcher121.matchVoxel({ color: '#e06101' }).id, 'minecraft:orange_concrete');
  assert.equal(matcher121.matchVoxel({ color: '#4c7f99', opacity: 0.5 }).id, 'minecraft:cyan_stained_glass');
  assert.equal(
    matcher121.matchVoxel({ color: '#acdbc2', emissive: '#acdbc2', emissiveIntensity: 0.9 }).id,
    'minecraft:sea_lantern'
  );

  // Family filter: disable all wool -> `#e9ecec` (white_wool) must match non-wool block
  const noWoolMatcher = createBlockMatcher({ versionPreset: '1.21', disabledFamilies: ['wool'] });
  const nonWool = noWoolMatcher.matchVoxel({ color: '#e9ecec' });
  assert.notEqual(nonWool.family, 'wool');

  const lightMatcher = createBlockMatcher({ versionPreset: '1.21', preferLightBlocks: true });
  assert.equal(lightMatcher.matchVoxel({ color: '#d8a71c' }).category, 'emissive');
  assert.equal(lightMatcher.matchVoxel({ color: '#bf7dff', unlit: true }).category, 'emissive');
  assert.notEqual(lightMatcher.matchVoxel({ color: '#efefef' }).category, 'emissive');

  // 3D Bayer dithering produces deterministic spatial mix on mid-gray tone
  const ditherVoxels = [];
  for (let x = 0; x < 4; x++) {
    for (let z = 0; z < 4; z++) {
      ditherVoxels.push({ x, y: 0, z, color: '#616161' });
    }
  }
  const ditherGrid = buildBlockGrid(ditherVoxels, { ditherStrength: 75 });
  assert.ok(ditherGrid.materials.length >= 2, 'Expected >=2 dithered block shades');

  console.log('✓ CIEDE2000 匹配、材质大类过滤与 3D 拜耳混色抖动测试通过');
}

async function testSlabsOverridesPreviewAndExporters() {
  // Build a step + underside arch + manual override test scene
  const voxels = [
    // Base full block + exposed top half-height step (bottom slab)
    { x: 0, y: 0, z: 0, color: '#7a797a' },
    { x: 1, y: 0, z: 0, color: '#7a797a', subYMin: 0.0, subYMax: 0.45 },
    // Arch ceiling + underside half-height voxel below it (top slab)
    { x: 2, y: 2, z: 0, color: '#725430' },
    { x: 2, y: 1, z: 0, color: '#725430', subYMin: 0.55, subYMax: 1.0 },
    // Explicit wool to be manually overridden to moss_block
    { x: 3, y: 0, z: 0, block: 'minecraft:green_wool' },
    { x: 4, y: 0, z: 0, block: 'minecraft:green_wool' },
  ];

  const grid = buildBlockGrid(voxels, {
    useSlabs: true,
    blockOverrides: { 'minecraft:green_wool': 'minecraft:moss_block' },
  });

  assert.equal(grid.slabCount, 2, 'Expected 1 bottom slab + 1 top slab');
  const bottomSlab = grid.blocks.find((b) => b.x === 1 && b.y === 0);
  const topSlab = grid.blocks.find((b) => b.x === 2 && b.y === 1);
  assert.equal(bottomSlab.block.properties?.type, 'bottom');
  assert.equal(topSlab.block.properties?.type, 'top');

  const mossMat = grid.materials.find((m) => m.id === 'minecraft:moss_block');
  assert.ok(mossMat && mossMat.count === 2, 'Expected green_wool overridden to 2 moss_block');
  assert.ok(mossMat.overriddenFrom.includes('minecraft:green_wool'));

  // 1. Test Litematic with 140x140 PreviewImageData thumbnail
  const preview = new Int32Array(140 * 140).fill(0xff22aa55 | 0);
  const litBytes = await encodeLitematic(grid, {
    name: 'Full_Feature_Test',
    previewImageData: preview,
  });
  const decLit = await decodeLitematic(litBytes);
  assert.equal(decLit.metadata.previewImageData?.length, 19600);
  assert.equal(decLit.metadata.previewImageData[0], 0xff22aa55 | 0);
  assert.equal(decLit.blocks.length, 6);

  // 2. Test WorldEdit Sponge Schematic v2 (.schem) round-trip
  const schemBytes = await encodeSpongeSchem(grid, { name: 'Schem_Test' });
  const decSchem = await decodeSpongeSchem(schemBytes);
  assert.equal(decSchem.blocks.length, 6);
  const schemBottomSlab = decSchem.blocks.find((b) => b.x === 1 && b.y === 0);
  assert.equal(schemBottomSlab.block.properties?.type, 'bottom');

  const copperSchemBytes = await encodeSpongeSchem({
    width: 4,
    height: 1,
    length: 1,
    blocks: [
      { x: 0, y: 0, z: 0, block: { id: 'minecraft:waxed_cut_copper' } },
      { x: 1, y: 0, z: 0, block: { id: 'minecraft:waxed_exposed_copper' } },
      { x: 2, y: 0, z: 0, block: { id: 'minecraft:water' } },
      { x: 3, y: 0, z: 0, block: { id: 'minecraft:end_rod' } },
    ],
  });
  const copperSchem = await decodeSpongeSchem(copperSchemBytes);
  assert.equal(copperSchem.materials.find((m) => m.id === 'minecraft:waxed_cut_copper').nameZh, '涂蜡的切制铜块');
  assert.equal(copperSchem.materials.find((m) => m.id === 'minecraft:waxed_exposed_copper').nameZh, '涂蜡的斑驳铜块');
  assert.equal(copperSchem.materials.find((m) => m.id === 'minecraft:water').nameZh, '水');
  assert.equal(copperSchem.materials.find((m) => m.id === 'minecraft:end_rod').nameZh, '末地烛');
  assert.equal(getBlockNameZh('minecraft:waxed_weathered_cut_copper'), '涂蜡的锈蚀切制铜块');

  // 3. Test Vanilla .mcfunction RLE `/fill` compression
  const fnText = new TextDecoder().decode(encodeMcFunction(grid, { name: 'Fn_Test' }));
  assert.ok(
    fnText.includes('fill ~3 ~0 ~0 ~4 ~0 ~0 minecraft:moss_block'),
    'Expected contiguous X run of moss_block to compress into a single /fill command'
  );

  console.log('✓ 半砖坡面拟合、手动方块替换、140×140 缩略图、.schem 及 .mcfunction 导出验证通过');
}

async function testEndToEndExamples() {
  const outDir = path.join(ROOT, 'test', '.tmp-out');
  await fs.mkdir(outDir, { recursive: true });

  // 1. Skill structured scene -> .litematic
  const towerOut = path.join(outDir, 'cozy-lantern-tower.litematic');
  const scriptPath = path.join(
    ROOT,
    '.agents/skills/three-voxel-schematic/scripts/export-litematic.sh'
  );
  const { stdout: out1 } = await execFileAsync('bash', [
    scriptPath,
    path.join(ROOT, 'examples/cozy-lantern-tower.html'),
    '-o',
    towerOut,
    '--json',
  ]);
  const summary1 = JSON.parse(out1);
  assert.equal(summary1.mode, 'structured');
  assert.ok(summary1.totalBlocks > 800);

  // 2. Wild Three.js geometry scene -> .schem WITH --slabs enabled!
  const islandOut = path.join(outDir, 'floating-crystal-island.schem');
  const { stdout: out2 } = await execFileAsync('node', [
    path.join(ROOT, 'src/cli/index.js'),
    'convert',
    path.join(ROOT, 'examples/floating-crystal-island.html'),
    '-o',
    islandOut,
    '--size',
    '48',
    '--slabs',
    '--json',
  ]);
  const summary2 = JSON.parse(out2);
  assert.equal(summary2.format, 'schem');
  assert.equal(summary2.mode, 'mesh-voxelized');
  assert.ok(summary2.slabCount > 0, 'Expected wild island slopes/cone to generate half-slabs');

  const decodedSchem = await decodeSpongeSchem(await fs.readFile(islandOut));
  assert.equal(decodedSchem.blocks.length, summary2.totalBlocks);

  await fs.rm(outDir, { recursive: true, force: true });
  console.log(`✓ CLI 双模转换 + 野生浮空岛自动拟合半砖 (${summary2.slabCount} 个台阶) + .schem 回读通过`);
}

async function testLibraryAndPresetsCrud() {
  const saved = await saveUserAsset({
    name: 'UnitTest_Mini_Shrine',
    sourceExt: 'json',
    sourceText: JSON.stringify({
      name: 'UnitTest_Mini_Shrine',
      voxels: [
        { x: 0, y: 0, z: 0, block: 'minecraft:stone_bricks' },
        { x: 1, y: 0, z: 0, block: 'minecraft:ochre_froglight' },
      ],
    }),
    config: {
      versionPreset: '1.21',
      useSlabs: true,
      disabledFamilies: ['wool'],
      blockOverrides: { 'minecraft:stone_bricks': 'minecraft:calcite' },
    },
  });

  assert.ok(saved.id);
  assert.equal(saved.blockCount, 2);

  await updateAssetMetadataOnly(saved.id, { favorite: true, name: 'UnitTest_Renamed' });
  const all = await listAllAssets();
  const found = all.find((a) => a.id === saved.id);
  assert.ok(found && found.favorite && found.name === 'UnitTest_Renamed');
  assert.ok(found.thumbnailUrl, 'User asset must have auto-generated cached thumbnail');

  // Verify ALL built-in examples also auto-generated cached thumbnails & dimensions on first listAllAssets()
  const builtins = all.filter((a) => a.kind === 'builtin');
  assert.ok(builtins.length >= 3);
  for (const ex of builtins) {
    assert.ok(ex.thumbnailUrl, `Expected cached thumbnailUrl for ${ex.id}`);
    assert.ok(ex.blockCount > 100, `Expected cached blockCount for ${ex.id}`);
    const thumbFile = getCachedThumbPath(ex.id);
    const pngBytes = await fs.readFile(thumbFile);
    assert.equal(pngBytes[0], 0x89);
    assert.equal(pngBytes[1], 0x50); // 'P'
  }

  // Verify second call to listAllAssets() reuses cached PNG without rewriting it!
  const sampleThumbPath = getCachedThumbPath(builtins[0].id);
  const mtime1 = (await fs.stat(sampleThumbPath)).mtimeMs;
  await new Promise((r) => setTimeout(r, 25));
  await listAllAssets();
  const mtime2 = (await fs.stat(sampleThumbPath)).mtimeMs;
  assert.equal(mtime1, mtime2, 'Cached thumbnail should NOT be rewritten when model is unchanged');

  // Batch export 2 items -> PKZIP buffer (`PK\x03\x04`)
  const zipRes = await batchExportAssets([saved.id, 'example:cozy-lantern-tower.html'], 'litematic');
  assert.equal(zipRes.isZip, true);
  assert.equal(zipRes.buffer[0], 0x50);
  assert.equal(zipRes.buffer[1], 0x4b);

  await deleteUserAsset(saved.id);

  const customPreset = await savePreset({
    name: 'Test_Preset',
    config: { disabledFamilies: ['wool'] },
  });
  const presetsAfterSave = await listPresets();
  assert.ok(presetsAfterSave.some((p) => p.id === customPreset.id));
  assert.ok(presetsAfterSave.some((p) => p.id === 'preset-luminous-priority'));
  await deletePreset(customPreset.id);

  console.log('✓ 本地资产库落盘 CRUD、配置记忆、ZIP 批量导出与可复用预设测试通过');
}

async function createSyntheticWorld(dir, { modern = true } = {}) {
  await fs.rm(dir, { recursive: true, force: true });
  await fs.mkdir(path.join(dir, 'region'), { recursive: true });

  const dv = modern ? 4671 : 2586;
  const dataFields = {
    DataVersion: nbt.int(dv),
    LevelName: nbt.string(modern ? 'TestWorld_121' : 'TestWorld_1165'),
    LastPlayed: nbt.long(BigInt(Date.now())),
    Version: nbt.compound({
      Id: nbt.int(dv),
      Name: nbt.string(modern ? '1.21.11' : '1.16.5'),
    }),
    Player: nbt.compound({
      Pos: nbt.list(TAG.DOUBLE, [nbt.double(20.5), nbt.double(68.0), nbt.double(20.5)]),
    }),
  };

  if (modern) {
    dataFields.spawn = nbt.compound({
      pos: nbt.intArray([16, 68, 16]),
    });
  } else {
    dataFields.SpawnX = nbt.int(16);
    dataFields.SpawnY = nbt.int(68);
    dataFields.SpawnZ = nbt.int(16);
  }

  const levelNbt = encodeNbt(nbt.compound({ Data: nbt.compound(dataFields) }), '');
  await fs.writeFile(path.join(dir, 'level.dat'), await gzipCompress(levelNbt));

  // Build region r.0.0.mca with 2x2 generated 'full' chunks (cx=0..1, cz=0..1) + 1 'biomes' proto-chunk (cx=2, cz=0)
  const slots = new Array(1024).fill(null);

  const grassIndices = new Uint16Array(4096);
  // Fill ly = 3 (world Y = 64 + 3 = 67) with palette index 1 (grass_block)
  for (let lz = 0; lz < 16; lz++) {
    for (let lx = 0; lx < 16; lx++) {
      grassIndices[(3 * 16 + lz) * 16 + lx] = 1;
    }
  }
  const packedGrass = packChunkSectionIndices(grassIndices, 2);
  const palEntries = [
    nbt.compound({ Name: nbt.string('minecraft:air') }),
    nbt.compound({ Name: nbt.string('minecraft:grass_block') }),
  ];

  for (let cz = 0; cz < 2; cz++) {
    for (let cx = 0; cx < 2; cx++) {
      let chunkRoot;
      if (modern) {
        chunkRoot = nbt.compound({
          DataVersion: nbt.int(dv),
          xPos: nbt.int(cx),
          yPos: nbt.int(-4),
          zPos: nbt.int(cz),
          Status: nbt.string('minecraft:full'),
          isLightOn: nbt.byte(1),
          sections: nbt.list(TAG.COMPOUND, [
            // Lighting-only bottom section Y=-5 (no block_states, just like real 1.21 worlds!)
            nbt.compound({ Y: nbt.byte(-5) }),
            nbt.compound({
              Y: nbt.byte(4),
              block_states: nbt.compound({
                palette: nbt.list(TAG.COMPOUND, palEntries),
                data: nbt.longArray(packedGrass),
              }),
            }),
          ]),
        });
      } else {
        chunkRoot = nbt.compound({
          DataVersion: nbt.int(dv),
          Level: nbt.compound({
            xPos: nbt.int(cx),
            zPos: nbt.int(cz),
            Status: nbt.string('full'),
            isLightOn: nbt.byte(1),
            Sections: nbt.list(TAG.COMPOUND, [
              nbt.compound({
                Y: nbt.byte(4),
                Palette: nbt.list(TAG.COMPOUND, palEntries),
                BlockStates: nbt.longArray(packedGrass),
              }),
            ]),
          }),
        });
      }
      slots[cz * 32 + cx] = encodeChunkSlotNbt(chunkRoot);
    }
  }

  // Add an ungenerated border proto-chunk at (cx=2, cz=0) with Status = 'minecraft:biomes'
  if (modern) {
    slots[0 * 32 + 2] = encodeChunkSlotNbt(
      nbt.compound({
        DataVersion: nbt.int(dv),
        xPos: nbt.int(2),
        zPos: nbt.int(0),
        Status: nbt.string('minecraft:biomes'),
        sections: nbt.list(TAG.COMPOUND, [
          nbt.compound({
            Y: nbt.byte(4),
            block_states: nbt.compound({
              palette: nbt.list(TAG.COMPOUND, palEntries),
              data: nbt.longArray(packedGrass),
            }),
          }),
        ]),
      })
    );
  }

  const mcaBuf = buildMcaBuffer(slots);
  const mcaPath = path.join(dir, 'region', 'r.0.0.mca');
  await fs.writeFile(mcaPath, mcaBuf);
  return { mcaPath, origMcaBytes: mcaBuf };
}

async function testWorldMapEditorModernAndLegacy() {
  const dir121 = path.join(ROOT, 'test', '.tmp-world-121');
  const dir116 = path.join(ROOT, 'test', '.tmp-world-116');

  try {
    // 1. Test Modern 1.21.11 World (d.spawn.pos + sections[].block_states + proto-chunk filtering)
    const { mcaPath: mca121, origMcaBytes: orig121 } = await createSyntheticWorld(dir121, { modern: true });
    const meta121 = await readWorldMetadata(dir121);
    assert.deepEqual(meta121.spawnPos, [16, 68, 16]);
    assert.deepEqual(meta121.playerPos, [21, 68, 21]);
    assert.equal(meta121.minY, -64);

    const map121 = await renderWorldMapRegion(dir121, { centerX: 16, centerZ: 16, spanChunks: 8 });
    assert.equal(map121.generatedChunkCount, 4, 'Must render 4 full chunks and ignore biomes proto-chunk');
    assert.ok(map121.mapPngDataUrl.startsWith('data:image/png;base64,'));

    const hBytes = Buffer.from(map121.heightsInt16Base64, 'base64');
    const heights = new Int16Array(hBytes.buffer, hBytes.byteOffset, hBytes.byteLength / 2);
    const sampleH = heights[(8 - map121.bounds.minZ) * map121.bounds.width + (8 - map121.bounds.minX)];
    const protoH = heights[(8 - map121.bounds.minZ) * map121.bounds.width + (36 - map121.bounds.minX)];
    assert.equal(sampleH, 67, 'Surface grass height must be Y=67');
    assert.equal(protoH, -32768, 'Proto-chunk must be marked ungenerated (-32768)');

    // Place a structure with 90° CW rotation + directional blockstates + high Y section creation
    const testGrid = {
      width: 2,
      height: 20,
      length: 3,
      blocks: [
        { x: 0, y: 0, z: 0, block: { id: 'minecraft:oak_stairs', properties: { facing: 'north', half: 'bottom' } } },
        { x: 1, y: 19, z: 2, block: { id: 'minecraft:oak_log', properties: { axis: 'x' } } },
      ],
    };

    const placed121 = await placeStructureInWorld({
      worldPath: dir121,
      grid: testGrid,
      targetX: 10,
      targetY: 68,
      targetZ: 10,
      rotation: 90,
      mirrorX: false,
      label: 'Pagoda_Test',
    });
    assert.equal(placed121.placedBlockCount, 2);
    assert.equal(placed121.modifiedChunkCount, 1);

    // Verify chunk NBT inside modified r.0.0.mca
    const editedSlots = parseMcaBuffer(await fs.readFile(mca121));
    const editedChunk = decodeChunkSlotNbt(editedSlots[0]);
    assert.equal(editedChunk.value.isLightOn.value, 0, 'isLightOn must be reset to 0 for clean relight');
    const sec4 = editedChunk.value.sections.value.find((s) => s.value.Y?.value === 4);
    const pal4 = sec4.value.block_states.value.palette.value;
    const stairEntry = pal4.find((p) => p.value.Name.value === 'minecraft:oak_stairs');
    assert.ok(stairEntry, 'oak_stairs must be injected into section Y=4 palette');
    assert.equal(stairEntry.value.Properties.value.facing.value, 'east', 'north rotated 90° CW must become east');

    // Verify new sky section Y=5 (for world Y = 68 + 19 = 87) was auto-created with rotated log axis='z'!
    const sec5 = editedChunk.value.sections.value.find((s) => s.value.Y?.value === 5);
    assert.ok(sec5, 'New upper section Y=5 must be created automatically');
    const logEntry = sec5.value.block_states.value.palette.value.find((p) => p.value.Name.value === 'minecraft:oak_log');
    assert.equal(logEntry.value.Properties.value.axis.value, 'z', 'axis=x rotated 90° CW must become axis=z');

    // Rollback backup and verify byte-for-byte restoration!
    await restoreWorldBackup({ worldPath: dir121, backupId: placed121.backup.id });
    const restored121 = await fs.readFile(mca121);
    assert.equal(Buffer.compare(restored121, orig121), 0, 'Restored 1.21 .mca must match original bytes 100%');

    const settledTower = await placeStructureInWorld({
      worldPath: dir121,
      grid: {
        width: 1,
        height: 300,
        length: 1,
        blocks: [{ x: 0, y: 299, z: 0, block: { id: 'minecraft:sea_lantern' } }],
      },
      targetX: 5,
      targetY: 12,
      requestedBaseY: 100,
      targetZ: 5,
      autoSink: true,
      topClearanceLayers: 8,
      label: 'Settled_Tower_Test',
    });
    assert.equal(settledTower.verticalPlacement.baseY, 12);
    assert.equal(settledTower.verticalPlacement.topY, 311);
    assert.equal(settledTower.verticalPlacement.settledBy, 88);
    await restoreWorldBackup({ worldPath: dir121, backupId: settledTower.backup.id });

    await assert.rejects(
      () => placeStructureInWorld({
        worldPath: dir121,
        grid: {
          width: 1,
          height: 300,
          length: 1,
          blocks: [{ x: 0, y: 299, z: 0, block: { id: 'minecraft:sea_lantern' } }],
        },
        targetX: 5,
        targetY: 100,
        targetZ: 5,
        label: 'Unsettled_Tower_Test',
      }),
      /建筑顶部将到达/
    );

    // 2. Test Legacy 1.16.5 World (Level.Sections[].Palette / BlockStates)
    const { mcaPath: mca116, origMcaBytes: orig116 } = await createSyntheticWorld(dir116, { modern: false });
    const placed116 = await placeStructureInWorld({
      worldPath: dir116,
      grid: {
        width: 1,
        height: 1,
        length: 1,
        blocks: [{ x: 0, y: 0, z: 0, block: { id: 'minecraft:sea_lantern' } }],
      },
      targetX: 5,
      targetY: 68,
      targetZ: 5,
      label: 'Lantern_1165',
    });
    assert.equal(placed116.placedBlockCount, 1);

    const slots116 = parseMcaBuffer(await fs.readFile(mca116));
    const chunk116 = decodeChunkSlotNbt(slots116[0]);
    const legacySec4 = chunk116.value.Level.value.Sections.value.find((s) => s.value.Y?.value === 4);
    const pal116 = legacySec4.value.Palette.value;
    const lanternIdx = pal116.findIndex((p) => p.value.Name.value === 'minecraft:sea_lantern');
    assert.ok(lanternIdx > 0, 'sea_lantern must exist in legacy Level.Sections[].Palette');
    const unpacked116 = unpackChunkSectionIndices(legacySec4.value.BlockStates.value, pal116.length, 2586);
    // world (5, 68, 5) -> lx=5, ly=4, lz=5
    assert.equal(unpacked116[(4 * 16 + 5) * 16 + 5], lanternIdx);

    await restoreWorldBackup({ worldPath: dir116, backupId: placed116.backup.id });
    const restored116 = await fs.readFile(mca116);
    assert.equal(Buffer.compare(restored116, orig116), 0, 'Restored 1.16.5 .mca must match original bytes 100%');

    // 2.5 Test void-domain fill: chunk-aligned XZ footprint, custom bottom Y, air-only writes
    const voidFill = await placeStructureInWorld({
      worldPath: dir121,
      grid: {
        width: 2,
        height: 1,
        length: 2,
        blocks: [{ x: 0, y: 0, z: 0, block: { id: 'minecraft:gold_block' } }],
      },
      targetX: 17,
      targetY: 68,
      targetZ: 17,
      fillVoid: true,
      fillBottomY: 64,
      fillMaterial: 'minecraft:stone',
      label: 'Void_Fill_Test',
    });
    assert.equal(voidFill.voidFill.width, 16, 'Void fill width must align to the occupied chunk');
    assert.equal(voidFill.voidFill.length, 16, 'Void fill length must align to the occupied chunk');
    assert.equal(voidFill.voidFill.bottomY, 64);
    assert.equal(voidFill.voidFill.topY, 68);
    assert.equal(voidFill.voidFill.height, 4);
    assert.ok(voidFill.voidFill.requestedBlockCount >= 16 * 16 * 4);
    assert.equal(voidFill.placedBlockCount, voidFill.voidFill.requestedBlockCount + 1, 'Empty sections must receive the fill material and the model block');

    // 2.6 Test base-hollow variant: one material layer under the model and air above it
    const baseHollow = await placeStructureInWorld({
      worldPath: dir121,
      grid: {
        width: 1,
        height: 1,
        length: 1,
        blocks: [{ x: 0, y: 0, z: 0, block: { id: 'minecraft:gold_block' } }],
      },
      targetX: 5,
      targetY: 68,
      targetZ: 5,
      fillVoid: true,
      fillMode: 'base_hollow',
      fillBottomY: -64,
      fillMaterial: 'minecraft:stone',
      label: 'Base_Hollow_Test',
    });
    assert.equal(baseHollow.voidFill.mode, 'base_hollow');
    assert.equal(baseHollow.voidFill.modelBaseY, 68);
    assert.equal(baseHollow.voidFill.bottomY, 67);
    assert.equal(baseHollow.voidFill.topY, 320);
    assert.equal(baseHollow.voidFill.height, 253);
    assert.equal(baseHollow.placedBlockCount, 16 * 16 + 1, 'Base hollow must place exactly one floor layer plus the model');
    assert.equal(baseHollow.clearedBlockCount, 16 * 16 * (320 - 68) - 1, 'The model cell replaces one cleared air cell');

    const hollowSlots = parseMcaBuffer(await fs.readFile(mca121));
    const hollowChunk = decodeChunkSlotNbt(hollowSlots[0]);
    const hollowSection = hollowChunk.value.sections.value.find((s) => s.value.Y?.value === 4);
    assert.ok(hollowSection, 'Base hollow must modify the target chunk section');
    const hollowPalette = hollowSection.value.block_states.value.palette.value;
    const hollowIndices = unpackChunkSectionIndices(
      hollowSection.value.block_states.value.data?.value || null,
      hollowPalette.length,
      4189
    );
    const hollowBlockIdAt = (x, y, z) => {
      const idx = ((y * 16 + z) * 16) + x;
      return hollowPalette[hollowIndices[idx]].value.Name.value;
    };
    assert.equal(hollowBlockIdAt(6, 3, 6), 'minecraft:stone', 'Floor layer must be written to the original chunk');
    assert.equal(hollowBlockIdAt(5, 4, 5), 'minecraft:gold_block', 'Model must be written over the hollowed area');
    assert.equal(hollowBlockIdAt(6, 4, 6), 'minecraft:air', 'The model footprint above the floor must be cleared to air');

    // 3. Test Default Max 10 Backups Auto-Pruning + Manual Single/All Cleanup (without reverting world!)
    for (let i = 1; i <= 12; i++) {
      await placeStructureInWorld({
        worldPath: dir121,
        grid: {
          width: 1,
          height: 1,
          length: 1,
          blocks: [{ x: 0, y: 0, z: 0, block: { id: 'minecraft:gold_block' } }],
        },
        targetX: i,
        targetY: 68,
        targetZ: 2,
        label: `Build_${i}`,
      });
    }

    const after12 = await listWorldBackups(dir121);
    assert.equal(after12.length, 10, 'Default maxBackups=10 must automatically prune oldest 2 backups');
    assert.equal(after12[0].label, 'Build_12', 'Newest backup must be Build_12');
    assert.equal(after12[9].label, 'Build_3', 'Oldest retained backup must be Build_3');
    assert.ok(after12[0].totalBytes > 0, 'Backup metadata must track totalBytes');

    // Manually delete single backup without reverting world
    const afterSingleDel = await deleteWorldBackup({ worldPath: dir121, backupId: after12[0].id });
    assert.equal(afterSingleDel.length, 9);
    const mcaBeforeClear = await fs.readFile(mca121);

    // Manually clear all backups without reverting world
    const afterClearAll = await clearAllWorldBackups(dir121);
    assert.equal(afterClearAll.length, 0);
    assert.equal((await listWorldBackups(dir121)).length, 0);
    const mcaAfterClear = await fs.readFile(mca121);
    assert.equal(Buffer.compare(mcaAfterClear, mcaBeforeClear), 0, 'Manual backup cleanup must NOT revert world .mca');

    console.log('✓ 离线存档地图编辑器 (MC 1.21.11 + 1.16.5 + 10份上限自动轮替 + 手动清理/一键回滚) 测试通过');
  } finally {
    await fs.rm(dir121, { recursive: true, force: true });
    await fs.rm(dir116, { recursive: true, force: true });
  }
}

async function run() {
  await testNbtRoundTrip();
  testCrossBoundaryBitPacking();
  testVerticalPlacementResolution();
  testLargeStructurePlacementBounds();
  testNativeVoxelFaceMeshExtraction();
  testGroundBackdropPerSampleClipping();
  testModelSelfDiagnosisAndInMemoryRepair();
  await testHeadlessPmremShim();
  testSemanticMatcherFamiliesAndDither();
  await testSlabsOverridesPreviewAndExporters();
  await testEndToEndExamples();
  await testLibraryAndPresetsCrud();
  await testWorldMapEditorModernAndLegacy();
  console.log('\n🎉 全部自动化测试通过！');
}

run().catch((err) => {
  console.error('❌ 测试未通过:', err);
  process.exit(1);
});
