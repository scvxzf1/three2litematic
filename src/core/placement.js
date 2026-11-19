export function resolveVerticalPlacement({
  requestedY,
  minWorldY,
  maxWorldY,
  minStructureY,
  maxStructureY,
  topClearanceLayers = 0,
  autoSink = false,
}) {
  const values = [requestedY, minWorldY, maxWorldY, minStructureY, maxStructureY, topClearanceLayers];
  if (!values.every(Number.isInteger)) {
    throw new Error('建筑高度、存档高度和顶部留空层数必须是有效整数');
  }
  if (maxWorldY < minWorldY || maxStructureY < minStructureY) {
    throw new Error('存档或建筑的垂直高度范围无效');
  }
  if (topClearanceLayers < 0) {
    throw new Error('顶部留空层数不能小于 0');
  }

  const worldHeight = maxWorldY - minWorldY + 1;
  const structureHeight = maxStructureY - minStructureY + 1;
  const minimumBaseY = minWorldY - minStructureY;
  const maximumBaseY = maxWorldY - topClearanceLayers - maxStructureY;
  if (structureHeight + topClearanceLayers > worldHeight || maximumBaseY < minimumBaseY) {
    throw new Error(
      `建筑高 ${structureHeight} 层，加上顶部留空 ${topClearanceLayers} 层后，超过存档可建高度 ${worldHeight} 层`
    );
  }

  const baseY = autoSink ? Math.min(requestedY, maximumBaseY) : requestedY;
  if (baseY < minimumBaseY) {
    throw new Error(`建筑底部将低于存档下限 Y=${minWorldY}，无法完整放置`);
  }
  if (baseY > maximumBaseY) {
    const topY = baseY + maxStructureY;
    throw new Error(
      `建筑顶部将到达 Y=${topY}，超过预留顶部空间后的最高位置 Y=${maxWorldY - topClearanceLayers}；请降低基底 Y`
    );
  }

  return {
    requestedY,
    baseY,
    minWorldY,
    maxWorldY,
    minStructureY,
    maxStructureY,
    topY: baseY + maxStructureY,
    topClearanceLayers,
    settledBy: requestedY - baseY,
    worldHeight,
    structureHeight,
  };
}
