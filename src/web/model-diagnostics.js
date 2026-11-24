import * as THREE from 'three';
import { buildBlockGrid, extractSceneVoxels, extractStructuredVoxels } from '../core/index.js';

function getVoxelList(raw) {
  if (Array.isArray(raw)) return raw;
  return Array.isArray(raw?.voxels) ? raw.voxels : [];
}

function inspectStructuredData(raw) {
  const list = getVoxelList(raw);
  const seen = new Set();
  let validCount = 0;
  let invalidCount = 0;
  let duplicateCount = 0;

  for (const item of list) {
    const coords = Array.isArray(item) ? item.slice(0, 3) : [item?.x, item?.y, item?.z];
    if (!coords.every(Number.isFinite)) {
      invalidCount++;
      continue;
    }
    validCount++;
    const key = coords.map((value) => Math.round(value)).join(',');
    if (seen.has(key)) duplicateCount++;
    seen.add(key);
  }

  let normalized = null;
  let error = null;
  if (list.length > 0) {
    try {
      normalized = extractStructuredVoxels(raw);
    } catch (err) {
      error = err.message;
    }
  }

  return { list, validCount, invalidCount, duplicateCount, normalized, error };
}

function inspectScene(scene) {
  const stats = { meshCount: 0, instanceCount: 0, vertexCount: 0, giantFlatBackgroundCount: 0 };
  if (!scene?.traverse) return stats;
  scene.updateMatrixWorld?.(true);

  scene.traverse((object) => {
    if ((!object.isMesh && !object.isInstancedMesh) || object.visible === false) return;
    const material = Array.isArray(object.material) ? object.material[0] : object.material;
    if (material?.side === 1 || /sky|skybox|skydome|stars|cloud_dome/i.test(object.name || '')) return;
    stats.meshCount++;
    if (object.isInstancedMesh) stats.instanceCount += object.count || 0;
    const position = object.geometry?.attributes?.position;
    stats.vertexCount += position?.count || object.count || 0;
    if (!object.isInstancedMesh && position?.count > 0 && position.count <= 10000) {
      const bounds = new THREE.Box3().setFromBufferAttribute(position).applyMatrix4(object.matrixWorld);
      const horizontalSpan = Math.max(bounds.max.x - bounds.min.x, bounds.max.z - bounds.min.z);
      const verticalSpan = bounds.max.y - bounds.min.y;
      if (horizontalSpan > 256 && verticalSpan <= Math.max(1.5, horizontalSpan * 0.03)) {
        stats.giantFlatBackgroundCount++;
      }
    }
  });
  return stats;
}

function describeGrid(grid) {
  if (!grid) return '尚未生成投影预览';
  return `${grid.width}×${grid.height}×${grid.length}，${grid.blocks?.length || 0} 个非空气方块`;
}

export function diagnoseModelInput({
  sourceKind,
  voxelData,
  capturedScene,
  importedGrid,
  currentGrid,
  sourceError = null,
  options = {},
}) {
  const findings = [];
  const structure = inspectStructuredData(voxelData);
  const scene = inspectScene(capturedScene);
  let repair = null;

  if (sourceError) findings.push({ tone: 'error', text: `场景脚本报错：${sourceError}` });

  if (importedGrid) {
    findings.push({ tone: 'info', text: `已解码蓝图：${describeGrid(importedGrid)}。该格式没有可安全重建的原始模型数据。` });
  } else if (!structure.list.length && scene.meshCount === 0) {
    findings.push({ tone: 'error', text: '当前没有可用体素数据或已捕获的可见网格；请等待模型生成完成后重新诊断。' });
  }

  if (structure.list.length > 0) {
    findings.push({
      tone: structure.validCount > 0 ? 'ok' : 'error',
      text: `结构化体素：${structure.list.length.toLocaleString()} 条，${structure.validCount.toLocaleString()} 条坐标有效。`,
    });
    if (structure.invalidCount > 0) {
      findings.push({ tone: 'warning', text: `发现 ${structure.invalidCount.toLocaleString()} 条坐标无效记录；通用修复会过滤它们。` });
    }
    if (structure.duplicateCount > 0) {
      findings.push({ tone: 'warning', text: `发现 ${structure.duplicateCount.toLocaleString()} 个重复坐标；通用修复会按坐标合并。` });
    }
    if (structure.error) findings.push({ tone: 'error', text: `结构化数据解析失败：${structure.error}` });
  } else if (scene.meshCount > 0) {
    findings.push({
      tone: 'warning',
      text: `没有结构化体素接口；捕获到 ${scene.meshCount} 个网格（${scene.instanceCount.toLocaleString()} 个实例），只能从 Three.js 几何体采样。`,
    });
    if (scene.giantFlatBackgroundCount > 0) {
      findings.push({ tone: 'warning', text: `检测到 ${scene.giantFlatBackgroundCount} 个巨型扁平背景网格；它可能把地面误采样成模型。通用修复会启用地面裁剪。` });
    }
  }

  if (scene.meshCount > 0 && structure.list.length > 0) {
    findings.push({ tone: 'info', text: `同时捕获到 ${scene.meshCount} 个网格；默认优先使用结构化体素，避免重复采样渲染网格。` });
  }

  if (currentGrid) {
    findings.push({
      tone: currentGrid.blocks?.length > 0 ? 'ok' : 'error',
      text: `当前投影结果：${describeGrid(currentGrid)}。`,
    });
  }

  if (sourceKind === 'html' && !structure.list.length && scene.meshCount > 0) {
    findings.push({ tone: 'info', text: '这是可运行的 Three.js 场景，不是损坏的模型文件；可用通用修复切换到背景过滤与自动尺度识别。' });
  }

  if (!importedGrid && structure.normalized?.voxels?.length > 0) {
    try {
      const candidate = buildBlockGrid(structure.normalized.voxels, options);
      if (candidate.blocks.length > 0) {
        repair = {
          voxelData: {
            ...structure.normalized.metadata,
            voxels: structure.normalized.voxels,
          },
          scene: null,
          forceScene: false,
          options: {},
          summary: '已过滤无效坐标并合并重复体素；源文件保持不变。',
        };
      }
    } catch {
      repair = null;
    }
  }

  if (!repair && !importedGrid && capturedScene && scene.meshCount > 0) {
    try {
      const sceneOptions = { ...options, scaleMode: 'auto', ignoreBackdrop: true };
      const candidate = extractSceneVoxels(capturedScene, sceneOptions);
      const grid = buildBlockGrid(candidate.voxels, options);
      if (grid.blocks.length > 0) {
        repair = {
          voxelData: null,
          scene: capturedScene,
          forceScene: true,
          options: { scaleMode: 'auto' },
          summary: `已启用背景过滤和自动尺度识别，候选结果 ${describeGrid(grid)}；源文件保持不变。`,
        };
      }
    } catch (err) {
      findings.push({ tone: 'error', text: `几何体通用修复无法建立候选结果：${err.message}` });
    }
  }

  if (!repair && !findings.some((finding) => finding.tone === 'error')) {
    findings.push({ tone: 'info', text: '未找到可自动修复的数据异常。可以继续调整提取模式或尺度参数。' });
  }

  const hasError = findings.some((finding) => finding.tone === 'error');
  const hasWarning = findings.some((finding) => finding.tone === 'warning');
  return {
    summary: hasError ? '发现阻断项' : hasWarning ? '发现可处理项' : '未发现明显问题',
    findings,
    repair,
    sourceStats: { structuredCount: structure.list.length, ...scene },
  };
}
