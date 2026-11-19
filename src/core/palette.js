/**
 * Minecraft Block & Slab Palette + Version Presets + Material Families
 * Isomorphic ES module (Browser + Node.js)
 */

export const VERSION_PRESETS = {
  '1.21': {
    key: '1.21',
    label: 'MC 1.21.x (现代全方块)',
    mcDataVersion: 3955,
    litematicVersion: 6,
    subVersion: 1,
    maxMinor: 21,
    classicOnly: false,
  },
  '1.20.1': {
    key: '1.20.1',
    label: 'MC 1.20.1 (主流整合包)',
    mcDataVersion: 3465,
    litematicVersion: 6,
    subVersion: 1,
    maxMinor: 20,
    classicOnly: false,
  },
  '1.16.5': {
    key: '1.16.5',
    label: 'MC 1.16.5+ (跨版本兼容)',
    mcDataVersion: 2586,
    litematicVersion: 5,
    subVersion: 0,
    maxMinor: 16,
    classicOnly: false,
  },
  classic: {
    key: 'classic',
    label: '纯像素画基础集 (混凝土/陶瓦/羊毛/玻璃/光源)',
    mcDataVersion: 2586,
    litematicVersion: 5,
    subVersion: 0,
    maxMinor: 16,
    classicOnly: true,
  },
};

export const BLOCK_FAMILIES = [
  { key: 'concrete', label: '混凝土' },
  { key: 'terracotta', label: '陶瓦' },
  { key: 'wool', label: '羊毛' },
  { key: 'wood', label: '木质' },
  { key: 'stone', label: '石砖/岩' },
  { key: 'copper', label: '铜系' },
  { key: 'foliage', label: '树叶/苔藓' },
  { key: 'glass', label: '玻璃/冰' },
  { key: 'light', label: '光源' },
];

function inferFamily(fullId, category) {
  if (category === 'translucent') return 'glass';
  if (category === 'emissive') return 'light';
  if (fullId.includes('concrete')) return 'concrete';
  if (fullId.includes('terracotta')) return 'terracotta';
  if (fullId.includes('_wool')) return 'wool';
  if (fullId.includes('planks') || fullId.includes('_wood') || fullId.includes('bamboo') || fullId.includes('_slab') && /(oak|spruce|birch|jungle|acacia|crimson|warped|mangrove|cherry)/.test(fullId)) {
    return 'wood';
  }
  if (fullId.includes('copper')) return 'copper';
  if (fullId.includes('leaves') || fullId.includes('moss_block') || fullId.includes('wart_block')) {
    return 'foliage';
  }
  return 'stone';
}

function b(id, nameZh, hex, opts = {}) {
  const fullId = id.startsWith('minecraft:') ? id : `minecraft:${id}`;
  const category = opts.category || 'solid';
  return {
    id: fullId,
    nameZh,
    hex: hex.toLowerCase(),
    category,
    family: opts.family || inferFamily(fullId, category),
    pattern: opts.pattern || 'smooth',
    minMinor: opts.minMinor ?? 12,
    classic: opts.classic ?? false,
    gravity: opts.gravity ?? false,
    expensive: opts.expensive ?? false,
    isSlab: opts.isSlab ?? false,
    opacity: opts.opacity ?? (category === 'translucent' ? 0.52 : 1.0),
    properties: opts.properties || null,
  };
}

export const BLOCK_DATABASE = [
  // ==================== 16 Concrete ====================
  b('white_concrete', '白色混凝土', '#cfd5d6', { classic: true, pattern: 'smooth' }),
  b('light_gray_concrete', '淡灰色混凝土', '#7d7d73', { classic: true, pattern: 'smooth' }),
  b('gray_concrete', '灰色混凝土', '#36393d', { classic: true, pattern: 'smooth' }),
  b('black_concrete', '黑色混凝土', '#080a0f', { classic: true, pattern: 'smooth' }),
  b('brown_concrete', '棕色混凝土', '#603b1f', { classic: true, pattern: 'smooth' }),
  b('red_concrete', '红色混凝土', '#8e2121', { classic: true, pattern: 'smooth' }),
  b('orange_concrete', '橙色混凝土', '#e06101', { classic: true, pattern: 'smooth' }),
  b('yellow_concrete', '黄色混凝土', '#f1af15', { classic: true, pattern: 'smooth' }),
  b('lime_concrete', '黄绿色混凝土', '#5ea918', { classic: true, pattern: 'smooth' }),
  b('green_concrete', '绿色混凝土', '#495b24', { classic: true, pattern: 'smooth' }),
  b('cyan_concrete', '青色混凝土', '#157788', { classic: true, pattern: 'smooth' }),
  b('light_blue_concrete', '淡蓝色混凝土', '#2389c7', { classic: true, pattern: 'smooth' }),
  b('blue_concrete', '蓝色混凝土', '#2c2e8f', { classic: true, pattern: 'smooth' }),
  b('purple_concrete', '紫色混凝土', '#64209c', { classic: true, pattern: 'smooth' }),
  b('magenta_concrete', '品红色混凝土', '#a9309f', { classic: true, pattern: 'smooth' }),
  b('pink_concrete', '粉红色混凝土', '#d5658f', { classic: true, pattern: 'smooth' }),

  // ==================== 17 Terracotta ====================
  b('terracotta', '陶瓦', '#985e43', { classic: true, pattern: 'smooth' }),
  b('white_terracotta', '白色陶瓦', '#d1b2a1', { classic: true, pattern: 'smooth' }),
  b('light_gray_terracotta', '淡灰色陶瓦', '#876b62', { classic: true, pattern: 'smooth' }),
  b('gray_terracotta', '灰色陶瓦', '#392a23', { classic: true, pattern: 'smooth' }),
  b('black_terracotta', '黑色陶瓦', '#251610', { classic: true, pattern: 'smooth' }),
  b('brown_terracotta', '棕色陶瓦', '#4d3323', { classic: true, pattern: 'smooth' }),
  b('red_terracotta', '红色陶瓦', '#8f3d2e', { classic: true, pattern: 'smooth' }),
  b('orange_terracotta', '橙色陶瓦', '#a15325', { classic: true, pattern: 'smooth' }),
  b('yellow_terracotta', '黄色陶瓦', '#ba8523', { classic: true, pattern: 'smooth' }),
  b('lime_terracotta', '黄绿色陶瓦', '#677534', { classic: true, pattern: 'smooth' }),
  b('green_terracotta', '绿色陶瓦', '#4c532a', { classic: true, pattern: 'smooth' }),
  b('cyan_terracotta', '青色陶瓦', '#565b5b', { classic: true, pattern: 'smooth' }),
  b('light_blue_terracotta', '淡蓝色陶瓦', '#716c89', { classic: true, pattern: 'smooth' }),
  b('blue_terracotta', '蓝色陶瓦', '#4a3b5b', { classic: true, pattern: 'smooth' }),
  b('purple_terracotta', '紫色陶瓦', '#764656', { classic: true, pattern: 'smooth' }),
  b('magenta_terracotta', '品红色陶瓦', '#95586c', { classic: true, pattern: 'smooth' }),
  b('pink_terracotta', '粉红色陶瓦', '#a14e4e', { classic: true, pattern: 'smooth' }),

  // ==================== 16 Wool ====================
  b('white_wool', '白色羊毛', '#e9ecec', { classic: true, pattern: 'wool' }),
  b('light_gray_wool', '淡灰色羊毛', '#8e8e86', { classic: true, pattern: 'wool' }),
  b('gray_wool', '灰色羊毛', '#3e4447', { classic: true, pattern: 'wool' }),
  b('black_wool', '黑色羊毛', '#141519', { classic: true, pattern: 'wool' }),
  b('brown_wool', '棕色羊毛', '#724728', { classic: true, pattern: 'wool' }),
  b('red_wool', '红色羊毛', '#a12722', { classic: true, pattern: 'wool' }),
  b('orange_wool', '橙色羊毛', '#f07613', { classic: true, pattern: 'wool' }),
  b('yellow_wool', '黄色羊毛', '#f8c627', { classic: true, pattern: 'wool' }),
  b('lime_wool', '黄绿色羊毛', '#70b919', { classic: true, pattern: 'wool' }),
  b('green_wool', '绿色羊毛', '#546d1b', { classic: true, pattern: 'wool' }),
  b('cyan_wool', '青色羊毛', '#158991', { classic: true, pattern: 'wool' }),
  b('light_blue_wool', '淡蓝色羊毛', '#3aafd9', { classic: true, pattern: 'wool' }),
  b('blue_wool', '蓝色羊毛', '#35399d', { classic: true, pattern: 'wool' }),
  b('purple_wool', '紫色羊毛', '#792aac', { classic: true, pattern: 'wool' }),
  b('magenta_wool', '品红色羊毛', '#bd44b3', { classic: true, pattern: 'wool' }),
  b('pink_wool', '粉红色羊毛', '#ed8dac', { classic: true, pattern: 'wool' }),

  // ==================== Woods & Planks ====================
  b('oak_planks', '橡木木板', '#a2824e', { pattern: 'planks' }),
  b('spruce_planks', '云杉木板', '#725430', { pattern: 'planks' }),
  b('birch_planks', '白桦木板', '#c0af79', { pattern: 'planks' }),
  b('jungle_planks', '丛林木板', '#a07350', { pattern: 'planks' }),
  b('acacia_planks', '金合欢木板', '#a85a32', { pattern: 'planks' }),
  b('dark_oak_planks', '深色橡木木板', '#422b14', { pattern: 'planks' }),
  b('crimson_planks', '绯红木板', '#653046', { minMinor: 16, pattern: 'planks' }),
  b('warped_planks', '诡异木板', '#2b6863', { minMinor: 16, pattern: 'planks' }),
  b('mangrove_planks', '红树木板', '#753630', { minMinor: 19, pattern: 'planks' }),
  b('cherry_planks', '樱花木板', '#e2b2ac', { minMinor: 20, pattern: 'planks' }),
  b('bamboo_planks', '竹板', '#c1ad50', { minMinor: 20, pattern: 'planks' }),
  b('stripped_oak_wood', '去皮橡木', '#b19056', { pattern: 'planks' }),
  b('stripped_spruce_wood', '去皮云杉木', '#735934', { pattern: 'planks' }),
  b('stripped_dark_oak_wood', '去皮深色橡木', '#483824', { pattern: 'planks' }),
  b('oak_wood', '橡木（全树皮）', '#6d5532', { pattern: 'planks' }),
  b('spruce_wood', '云杉木（全树皮）', '#3a2510', { pattern: 'planks' }),
  b('birch_wood', '白桦木（全树皮）', '#d8d7d2', { pattern: 'planks' }),

  // ==================== Stones, Bricks & Architectural Blocks ====================
  b('stone', '石头', '#7d7d7d', { pattern: 'stone' }),
  b('smooth_stone', '平滑石头', '#9e9e9e', { pattern: 'smooth' }),
  b('cobblestone', '圆石', '#7f7f7f', { pattern: 'stone' }),
  b('stone_bricks', '石砖', '#7a797a', { pattern: 'bricks' }),
  b('mossy_stone_bricks', '苔石砖', '#737969', { pattern: 'bricks' }),
  b('andesite', '安山岩', '#888888', { pattern: 'stone' }),
  b('polished_andesite', '磨制安山岩', '#848685', { pattern: 'smooth' }),
  b('diorite', '闪长岩', '#bcbcbc', { pattern: 'stone' }),
  b('polished_diorite', '磨制闪长岩', '#c0c1c2', { pattern: 'smooth' }),
  b('granite', '花岗岩', '#956755', { pattern: 'stone' }),
  b('polished_granite', '磨制花岗岩', '#9a6a59', { pattern: 'smooth' }),
  b('bricks', '红砖块', '#966153', { pattern: 'bricks' }),
  b('sandstone', '砂岩', '#d8cb9b', { pattern: 'smooth' }),
  b('smooth_sandstone', '平滑砂岩', '#dfd6aa', { pattern: 'smooth' }),
  b('red_sandstone', '红砂岩', '#ba631d', { pattern: 'smooth' }),
  b('smooth_red_sandstone', '平滑红砂岩', '#b5611f', { pattern: 'smooth' }),
  b('quartz_block', '石英块', '#ebe5de', { pattern: 'smooth' }),
  b('smooth_quartz', '平滑石英块', '#ede6df', { pattern: 'smooth' }),
  b('purpur_block', '紫珀块', '#a97da9', { pattern: 'bricks' }),
  b('end_stone_bricks', '末地石砖', '#dae0a2', { pattern: 'bricks' }),
  b('prismarine', '海晶石', '#639c97', { pattern: 'stone' }),
  b('prismarine_bricks', '海晶石砖', '#63ab9e', { pattern: 'bricks' }),
  b('dark_prismarine', '暗海晶石', '#335b4b', { pattern: 'bricks' }),
  b('nether_bricks', '下界砖块', '#2c151a', { pattern: 'bricks' }),
  b('red_nether_bricks', '红色下界砖块', '#450709', { pattern: 'bricks' }),
  b('blackstone', '黑石', '#2a2328', { minMinor: 16, pattern: 'stone' }),
  b('polished_blackstone_bricks', '磨制黑石砖', '#302a31', { minMinor: 16, pattern: 'bricks' }),
  b('obsidian', '黑曜石', '#0f0a18', { pattern: 'stone' }),

  // 1.17+ Deepslate, Calcite, Tuff, Copper
  b('calcite', '方解石', '#dfe0dc', { minMinor: 17, pattern: 'stone' }),
  b('tuff', '凝灰岩', '#6c6d66', { minMinor: 17, pattern: 'stone' }),
  b('polished_deepslate', '磨制深板岩', '#484849', { minMinor: 17, pattern: 'smooth' }),
  b('deepslate_bricks', '深板岩砖', '#464647', { minMinor: 17, pattern: 'bricks' }),
  b('deepslate_tiles', '深板岩瓦', '#363637', { minMinor: 17, pattern: 'bricks' }),
  b('amethyst_block', '紫水晶块', '#8561bf', { minMinor: 17, pattern: 'stone' }),
  b('copper_block', '铜块', '#c06b4f', { minMinor: 17, pattern: 'smooth' }),
  b('exposed_copper', '斑驳的铜块', '#a17d67', { minMinor: 17, pattern: 'smooth' }),
  b('weathered_copper', '锈蚀的铜块', '#6c996e', { minMinor: 17, pattern: 'smooth' }),
  b('oxidized_copper', '氧化的铜块', '#52a284', { minMinor: 17, pattern: 'smooth' }),

  // 1.19+ Mud
  b('packed_mud', '泥坯', '#8e6a4f', { minMinor: 19, pattern: 'stone' }),
  b('mud_bricks', '泥砖', '#89674f', { minMinor: 19, pattern: 'bricks' }),
  b('mud', '泥巴', '#3c393c', { minMinor: 19, pattern: 'stone' }),

  // 1.21+ Tuff Bricks
  b('polished_tuff', '磨制凝灰岩', '#616863', { minMinor: 21, pattern: 'smooth' }),
  b('tuff_bricks', '凝灰岩砖', '#62665f', { minMinor: 21, pattern: 'bricks' }),

  // ==================== Natural & Foliage (persistent=true) ====================
  b('snow_block', '雪块', '#f9fefe', { pattern: 'smooth', family: 'stone' }),
  b('clay', '黏土块', '#a0a6b3', { pattern: 'smooth', family: 'stone' }),
  b('moss_block', '苔藓块', '#596d2d', { minMinor: 17, pattern: 'wool', family: 'foliage' }),
  b('oak_leaves', '橡树树叶', '#487626', { pattern: 'leaves', properties: { persistent: 'true' } }),
  b('spruce_leaves', '云杉树叶', '#365536', { pattern: 'leaves', properties: { persistent: 'true' } }),
  b('birch_leaves', '白桦树叶', '#5c7742', { pattern: 'leaves', properties: { persistent: 'true' } }),
  b('azalea_leaves', '杜鹃树叶', '#59732d', { minMinor: 17, pattern: 'leaves', properties: { persistent: 'true' } }),
  b('cherry_leaves', '樱花树叶', '#e5b1c7', { minMinor: 20, pattern: 'leaves', properties: { persistent: 'true' } }),
  b('nether_wart_block', '下界疣块', '#720202', { pattern: 'wool', family: 'foliage' }),
  b('warped_wart_block', '诡异疣块', '#167779', { minMinor: 16, pattern: 'wool', family: 'foliage' }),

  // ==================== Expensive Mineral Blocks ====================
  b('iron_block', '铁块', '#dcdcdc', { expensive: true, pattern: 'smooth' }),
  b('gold_block', '金块', '#f6d03d', { expensive: true, pattern: 'smooth' }),
  b('emerald_block', '绿宝石块', '#2acb57', { expensive: true, pattern: 'smooth' }),
  b('diamond_block', '钻石块', '#62ede4', { expensive: true, pattern: 'smooth' }),
  b('lapis_block', '青金石块', '#1e438c', { expensive: true, pattern: 'stone' }),
  b('redstone_block', '红石块', '#af1805', { expensive: true, pattern: 'smooth' }),
  b('netherite_block', '下界合金块', '#423d3f', { minMinor: 16, expensive: true, pattern: 'smooth' }),

  // ==================== Gravity Blocks ====================
  b('sand', '沙子', '#dbcfa3', { gravity: true, pattern: 'stone', family: 'stone' }),
  b('red_sand', '红沙', '#be6621', { gravity: true, pattern: 'stone', family: 'stone' }),
  b('gravel', '沙砾', '#837f7e', { gravity: true, pattern: 'stone', family: 'stone' }),
  b('white_concrete_powder', '白色混凝土粉末', '#e1e3e3', { gravity: true, pattern: 'stone' }),
  b('yellow_concrete_powder', '黄色混凝土粉末', '#e8c736', { gravity: true, pattern: 'stone' }),
  b('cyan_concrete_powder', '青色混凝土粉末', '#24939d', { gravity: true, pattern: 'stone' }),
  b('pink_concrete_powder', '粉红色混凝土粉末', '#e499b5', { gravity: true, pattern: 'stone' }),

  // ==================== Translucent Blocks ====================
  b('glass', '玻璃', '#d8f0f4', { category: 'translucent', classic: true, pattern: 'glass', opacity: 0.28 }),
  b('tinted_glass', '遮光玻璃', '#2c262e', { category: 'translucent', minMinor: 17, pattern: 'glass', opacity: 0.65 }),
  b('white_stained_glass', '白色染色玻璃', '#ffffff', { category: 'translucent', classic: true, pattern: 'glass', opacity: 0.52 }),
  b('light_gray_stained_glass', '淡灰色染色玻璃', '#999999', { category: 'translucent', classic: true, pattern: 'glass', opacity: 0.52 }),
  b('gray_stained_glass', '灰色染色玻璃', '#4c4c4c', { category: 'translucent', classic: true, pattern: 'glass', opacity: 0.55 }),
  b('black_stained_glass', '黑色染色玻璃', '#191919', { category: 'translucent', classic: true, pattern: 'glass', opacity: 0.62 }),
  b('brown_stained_glass', '棕色染色玻璃', '#664c33', { category: 'translucent', classic: true, pattern: 'glass', opacity: 0.55 }),
  b('red_stained_glass', '红色染色玻璃', '#993333', { category: 'translucent', classic: true, pattern: 'glass', opacity: 0.55 }),
  b('orange_stained_glass', '橙色染色玻璃', '#d87f33', { category: 'translucent', classic: true, pattern: 'glass', opacity: 0.52 }),
  b('yellow_stained_glass', '黄色染色玻璃', '#e5e533', { category: 'translucent', classic: true, pattern: 'glass', opacity: 0.50 }),
  b('lime_stained_glass', '黄绿色染色玻璃', '#7fcc19', { category: 'translucent', classic: true, pattern: 'glass', opacity: 0.52 }),
  b('green_stained_glass', '绿色染色玻璃', '#667f33', { category: 'translucent', classic: true, pattern: 'glass', opacity: 0.55 }),
  b('cyan_stained_glass', '青色染色玻璃', '#4c7f99', { category: 'translucent', classic: true, pattern: 'glass', opacity: 0.52 }),
  b('light_blue_stained_glass', '淡蓝色染色玻璃', '#6699d8', { category: 'translucent', classic: true, pattern: 'glass', opacity: 0.50 }),
  b('blue_stained_glass', '蓝色染色玻璃', '#334cb2', { category: 'translucent', classic: true, pattern: 'glass', opacity: 0.55 }),
  b('purple_stained_glass', '紫色染色玻璃', '#7f3fb2', { category: 'translucent', classic: true, pattern: 'glass', opacity: 0.55 }),
  b('magenta_stained_glass', '品红色染色玻璃', '#b24cd8', { category: 'translucent', classic: true, pattern: 'glass', opacity: 0.52 }),
  b('pink_stained_glass', '粉红色染色玻璃', '#f27fa5', { category: 'translucent', classic: true, pattern: 'glass', opacity: 0.50 }),
  b('ice', '冰', '#91b7fd', { category: 'translucent', pattern: 'glass', opacity: 0.65 }),

  // ==================== Emissive / Light-Emitting Blocks ====================
  b('sea_lantern', '海晶灯', '#acdbc2', { category: 'emissive', classic: true, pattern: 'glow' }),
  b('glowstone', '荧石', '#ab8354', { category: 'emissive', classic: true, pattern: 'glow' }),
  b('shroomlight', '菌光体', '#f09246', { category: 'emissive', minMinor: 16, classic: true, pattern: 'glow' }),
  b('ochre_froglight', '赭黄蛙明灯', '#faf5ce', { category: 'emissive', minMinor: 19, pattern: 'glow' }),
  b('verdant_froglight', '青翠蛙明灯', '#e5f4e4', { category: 'emissive', minMinor: 19, pattern: 'glow' }),
  b('pearlescent_froglight', '珠光蛙明灯', '#f5e0ef', { category: 'emissive', minMinor: 19, pattern: 'glow' }),
  b('jack_o_lantern', '南瓜灯', '#d6882c', { category: 'emissive', pattern: 'glow' }),
  b('redstone_lamp', '点亮的红石灯', '#9f6b3e', { category: 'emissive', classic: true, pattern: 'glow', properties: { lit: 'true' } }),
  b('magma_block', '岩浆块', '#8e3f1f', { category: 'emissive', pattern: 'glow' }),
  b('crying_obsidian', '哭泣的黑曜石', '#321056', { category: 'emissive', minMinor: 16, expensive: true, pattern: 'glow' }),
  b('copper_bulb', '点亮的铜灯', '#d48753', { category: 'emissive', minMinor: 21, pattern: 'glow', properties: { lit: 'true' } }),
];

// ==================== Vanilla Half-Slabs (0.5 Block Slope Fitting) ====================
export const SLAB_DATABASE = [
  b('oak_slab', '橡木台阶', '#a2824e', { isSlab: true, family: 'wood', pattern: 'planks' }),
  b('spruce_slab', '云杉木台阶', '#725430', { isSlab: true, family: 'wood', pattern: 'planks' }),
  b('birch_slab', '白桦木台阶', '#c0af79', { isSlab: true, family: 'wood', pattern: 'planks' }),
  b('jungle_slab', '丛林木台阶', '#a07350', { isSlab: true, family: 'wood', pattern: 'planks' }),
  b('acacia_slab', '金合欢木台阶', '#a85a32', { isSlab: true, family: 'wood', pattern: 'planks' }),
  b('dark_oak_slab', '深色橡木台阶', '#422b14', { isSlab: true, family: 'wood', pattern: 'planks' }),
  b('crimson_slab', '绯红木台阶', '#653046', { isSlab: true, minMinor: 16, family: 'wood', pattern: 'planks' }),
  b('warped_slab', '诡异木台阶', '#2b6863', { isSlab: true, minMinor: 16, family: 'wood', pattern: 'planks' }),
  b('mangrove_slab', '红树木台阶', '#753630', { isSlab: true, minMinor: 19, family: 'wood', pattern: 'planks' }),
  b('cherry_slab', '樱花木台阶', '#e2b2ac', { isSlab: true, minMinor: 20, family: 'wood', pattern: 'planks' }),
  b('bamboo_slab', '竹台阶', '#c1ad50', { isSlab: true, minMinor: 20, family: 'wood', pattern: 'planks' }),

  b('stone_slab', '石头台阶', '#7d7d7d', { isSlab: true, family: 'stone', pattern: 'stone' }),
  b('smooth_stone_slab', '平滑石头台阶', '#9e9e9e', { isSlab: true, family: 'stone', pattern: 'smooth' }),
  b('cobblestone_slab', '圆石台阶', '#7f7f7f', { isSlab: true, family: 'stone', pattern: 'stone' }),
  b('stone_brick_slab', '石砖台阶', '#7a797a', { isSlab: true, family: 'stone', pattern: 'bricks' }),
  b('mossy_stone_brick_slab', '苔石砖台阶', '#737969', { isSlab: true, family: 'stone', pattern: 'bricks' }),
  b('andesite_slab', '安山岩台阶', '#888888', { isSlab: true, family: 'stone', pattern: 'stone' }),
  b('polished_andesite_slab', '磨制安山岩台阶', '#848685', { isSlab: true, family: 'stone', pattern: 'smooth' }),
  b('diorite_slab', '闪长岩台阶', '#bcbcbc', { isSlab: true, family: 'stone', pattern: 'stone' }),
  b('polished_diorite_slab', '磨制闪长岩台阶', '#c0c1c2', { isSlab: true, family: 'stone', pattern: 'smooth' }),
  b('granite_slab', '花岗岩台阶', '#956755', { isSlab: true, family: 'stone', pattern: 'stone' }),
  b('brick_slab', '红砖台阶', '#966153', { isSlab: true, family: 'stone', pattern: 'bricks' }),
  b('sandstone_slab', '砂岩台阶', '#d8cb9b', { isSlab: true, family: 'stone', pattern: 'smooth' }),
  b('red_sandstone_slab', '红砂岩台阶', '#ba631d', { isSlab: true, family: 'stone', pattern: 'smooth' }),
  b('quartz_slab', '石英台阶', '#ebe5de', { isSlab: true, family: 'stone', pattern: 'smooth' }),
  b('purpur_slab', '紫珀台阶', '#a97da9', { isSlab: true, family: 'stone', pattern: 'bricks' }),
  b('prismarine_slab', '海晶石台阶', '#639c97', { isSlab: true, family: 'stone', pattern: 'stone' }),
  b('prismarine_brick_slab', '海晶石砖台阶', '#63ab9e', { isSlab: true, family: 'stone', pattern: 'bricks' }),
  b('dark_prismarine_slab', '暗海晶石台阶', '#335b4b', { isSlab: true, family: 'stone', pattern: 'bricks' }),
  b('nether_brick_slab', '下界砖台阶', '#2c151a', { isSlab: true, family: 'stone', pattern: 'bricks' }),
  b('blackstone_slab', '黑石台阶', '#2a2328', { isSlab: true, minMinor: 16, family: 'stone', pattern: 'stone' }),
  b('polished_blackstone_brick_slab', '磨制黑石砖台阶', '#302a31', { isSlab: true, minMinor: 16, family: 'stone', pattern: 'bricks' }),
  b('polished_deepslate_slab', '磨制深板岩台阶', '#484849', { isSlab: true, minMinor: 17, family: 'stone', pattern: 'smooth' }),
  b('deepslate_brick_slab', '深板岩砖台阶', '#464647', { isSlab: true, minMinor: 17, family: 'stone', pattern: 'bricks' }),
  b('deepslate_tile_slab', '深板岩瓦台阶', '#363637', { isSlab: true, minMinor: 17, family: 'stone', pattern: 'bricks' }),
  b('cut_copper_slab', '切制铜台阶', '#c06b4f', { isSlab: true, minMinor: 17, family: 'copper', pattern: 'bricks' }),
  b('weathered_cut_copper_slab', '锈蚀的切制铜台阶', '#6c996e', { isSlab: true, minMinor: 17, family: 'copper', pattern: 'bricks' }),
  b('oxidized_cut_copper_slab', '氧化的切制铜台阶', '#52a284', { isSlab: true, minMinor: 17, family: 'copper', pattern: 'bricks' }),
  b('mud_brick_slab', '泥砖台阶', '#89674f', { isSlab: true, minMinor: 19, family: 'stone', pattern: 'bricks' }),
  b('tuff_brick_slab', '凝灰岩砖台阶', '#62665f', { isSlab: true, minMinor: 21, family: 'stone', pattern: 'bricks' }),
];

export const BLOCK_BY_ID = new Map(
  [...BLOCK_DATABASE, ...SLAB_DATABASE].map((entry) => [entry.id, entry])
);

const COPPER_BLOCK_NAMES_ZH = {
  copper_block: '铜块',
  exposed_copper: '斑驳的铜块',
  weathered_copper: '锈蚀的铜块',
  oxidized_copper: '氧化的铜块',
  cut_copper: '切制铜块',
  exposed_cut_copper: '斑驳的切制铜块',
  weathered_cut_copper: '锈蚀的切制铜块',
  oxidized_cut_copper: '氧化的切制铜块',
  chiseled_copper: '錾制铜块',
  exposed_chiseled_copper: '斑驳的錾制铜块',
  weathered_chiseled_copper: '锈蚀的錾制铜块',
  oxidized_chiseled_copper: '氧化的錾制铜块',
  copper_grate: '铜格栅',
  exposed_copper_grate: '斑驳的铜格栅',
  weathered_copper_grate: '锈蚀的铜格栅',
  oxidized_copper_grate: '氧化的铜格栅',
  copper_bulb: '铜灯泡',
  exposed_copper_bulb: '斑驳的铜灯泡',
  weathered_copper_bulb: '锈蚀的铜灯泡',
  oxidized_copper_bulb: '氧化的铜灯泡',
  copper_door: '铜门',
  exposed_copper_door: '斑驳的铜门',
  weathered_copper_door: '锈蚀的铜门',
  oxidized_copper_door: '氧化的铜门',
  copper_trapdoor: '铜活板门',
  exposed_copper_trapdoor: '斑驳的铜活板门',
  weathered_copper_trapdoor: '锈蚀的铜活板门',
  oxidized_copper_trapdoor: '氧化的铜活板门',
};

const BLOCK_NAME_ZH_OVERRIDES = new Map();
BLOCK_NAME_ZH_OVERRIDES.set('minecraft:water', '水');
BLOCK_NAME_ZH_OVERRIDES.set('minecraft:lava', '熔岩');
BLOCK_NAME_ZH_OVERRIDES.set('minecraft:end_rod', '末地烛');
for (const [id, nameZh] of Object.entries(COPPER_BLOCK_NAMES_ZH)) {
  BLOCK_NAME_ZH_OVERRIDES.set(`minecraft:${id}`, nameZh);
}

const WAXED_COPPER_BLOCK_NAMES_ZH = {
  copper_block: '涂蜡的铜块',
  exposed_copper: '涂蜡的斑驳铜块',
  weathered_copper: '涂蜡的锈蚀铜块',
  oxidized_copper: '涂蜡的氧化铜块',
  cut_copper: '涂蜡的切制铜块',
  exposed_cut_copper: '涂蜡的斑驳切制铜块',
  weathered_cut_copper: '涂蜡的锈蚀切制铜块',
  oxidized_cut_copper: '涂蜡的氧化切制铜块',
  chiseled_copper: '涂蜡的錾制铜块',
  exposed_chiseled_copper: '涂蜡的斑驳錾制铜块',
  weathered_chiseled_copper: '涂蜡的锈蚀錾制铜块',
  oxidized_chiseled_copper: '涂蜡的氧化錾制铜块',
  copper_grate: '涂蜡的铜格栅',
  exposed_copper_grate: '涂蜡的斑驳铜格栅',
  weathered_copper_grate: '涂蜡的锈蚀铜格栅',
  oxidized_copper_grate: '涂蜡的氧化铜格栅',
  copper_bulb: '涂蜡的铜灯泡',
  exposed_copper_bulb: '涂蜡的斑驳铜灯泡',
  weathered_copper_bulb: '涂蜡的锈蚀铜灯泡',
  oxidized_copper_bulb: '涂蜡的氧化铜灯泡',
  copper_door: '涂蜡的铜门',
  exposed_copper_door: '涂蜡的斑驳铜门',
  weathered_copper_door: '涂蜡的锈蚀铜门',
  oxidized_copper_door: '涂蜡的氧化铜门',
  copper_trapdoor: '涂蜡的铜活板门',
  exposed_copper_trapdoor: '涂蜡的斑驳铜活板门',
  weathered_copper_trapdoor: '涂蜡的锈蚀铜活板门',
  oxidized_copper_trapdoor: '涂蜡的氧化铜活板门',
};
for (const [id, nameZh] of Object.entries(WAXED_COPPER_BLOCK_NAMES_ZH)) {
  BLOCK_NAME_ZH_OVERRIDES.set(`minecraft:waxed_${id}`, nameZh);
}

export function getBlockNameZh(id, fallback = '') {
  const fullId = String(id || 'minecraft:unknown').includes(':')
    ? String(id)
    : `minecraft:${id}`;
  return (
    BLOCK_BY_ID.get(fullId)?.nameZh ||
    BLOCK_NAME_ZH_OVERRIDES.get(fullId) ||
    fallback ||
    fullId.replace('minecraft:', '')
  );
}

export function getFilteredPalette(options = {}) {
  const {
    versionPreset = '1.21',
    excludeGravity = true,
    survivalFriendly = true,
    disabledBlocks = new Set(),
    disabledFamilies = new Set(),
  } = options;

  const preset = VERSION_PRESETS[versionPreset] || VERSION_PRESETS['1.21'];
  const disabledSet = disabledBlocks instanceof Set ? disabledBlocks : new Set(disabledBlocks);
  const disabledFamSet = disabledFamilies instanceof Set ? disabledFamilies : new Set(disabledFamilies);

  return BLOCK_DATABASE.filter((blk) => {
    if (blk.minMinor > preset.maxMinor) return false;
    if (preset.classicOnly && !blk.classic) return false;
    if (excludeGravity && blk.gravity) return false;
    if (survivalFriendly && blk.expensive) return false;
    if (disabledFamSet.has(blk.family)) return false;
    if (disabledSet.has(blk.id)) return false;
    return true;
  });
}

export function getFilteredSlabs(options = {}) {
  const {
    versionPreset = '1.21',
    disabledBlocks = new Set(),
    disabledFamilies = new Set(),
  } = options;

  const preset = VERSION_PRESETS[versionPreset] || VERSION_PRESETS['1.21'];
  if (preset.classicOnly) return [];
  const disabledSet = disabledBlocks instanceof Set ? disabledBlocks : new Set(disabledBlocks);
  const disabledFamSet = disabledFamilies instanceof Set ? disabledFamilies : new Set(disabledFamilies);

  return SLAB_DATABASE.filter((blk) => {
    if (blk.minMinor > preset.maxMinor) return false;
    if (disabledFamSet.has(blk.family)) return false;
    if (disabledSet.has(blk.id)) return false;
    return true;
  });
}

/**
 * Instantiate a bottom or top slab block variant with exact blockstate properties.
 */
export function makeSlabVariant(slabEntry, half = 'bottom') {
  const suffix = half === 'top' ? ' (上半砖)' : ' (下半砖)';
  return {
    ...slabEntry,
    isSlab: true,
    slabHalf: half,
    nameZh: slabEntry.nameZh.endsWith(')') ? slabEntry.nameZh : `${slabEntry.nameZh}${suffix}`,
    properties: {
      ...(slabEntry.properties || {}),
      type: half,
      waterlogged: 'false',
    },
  };
}
