# three2litematic

将 AI 生成的 **Three.js 像素/体素风 3D 网页作品** 转换为 Minecraft **Litematica (`.litematic`)** 全息投影文件的独立工具（包含 **Web 可视化预览工作台** + **CLI 命令行** + **配套生成 Skill**）。

---

## ✨ 核心特性

- **双模提取引擎（共用同构核心 `src/core/`）**
  - **1:1 无损直通模式**：配合项目内置 Skill 生成的 Three.js 场景（挂载 `window.__VOXEL_DATA__` 或原生整数网格 `BoxGeometry` / `InstancedMesh`），零重采样失真 1:1 导出。
  - **通用网格体素化模式**：丢入任意野生 Three.js `.html`（含球体、圆锥、圆柱、圆环、旋转网格等），自动抓取 `THREE.Scene` 进行三角面片体素化与超大背景地面裁剪。
- **CIEDE2000 感知色差 + 材质语义映射**
  - 实心材质 → 混凝土 / 陶瓦 / 羊毛 / 木石砖瓦（~120 种原版完整方块）
  - 半透明材质 (`opacity < 0.82`) → 16 色染色玻璃 / 遮光玻璃 / 冰
  - 自发光材质 (`emissive` / `isLight`) → 赭黄/青翠/珠光蛙明灯、海晶灯、菌光体、荧石
  - 树叶自动附带 `persistent=true` 属性，在游戏内放置绝不腐烂消失。
- **多版本预设与生存优化**
  - 支持切换 `1.21`、`1.20.1`、`1.16.5` 及 `classic`（纯像素画基础集），高版本方块在导出低版本投影时自动感知色差降级替代。
  - 支持排除悬空重力方块、排除昂贵矿块、**一键掏空内部不可见实心方块 (`--hollow`)** 以及在网页材料表中**点击禁用任意单个方块实时重匹配**。

---

## 🚀 快速开始

### 0. 从应用菜单启动（Linux / KDE）

已安装 **three2litematic 工作台** 应用菜单快捷方式。点击后会打开 Konsole，自动启动本地前后端并显示实时日志，同时打开 `http://127.0.0.1:28741/`；关闭该终端会自动停止项目服务。

也可以直接运行：

```bash
./scripts/launch-desktop.sh
```

### 1. 启动 Web 可视化预览工作台

```bash
npm run serve
```

浏览器打开 `http://127.0.0.1:28741` 即可：
- 分屏实时对比 **原 Three.js 场景** 与 **Minecraft 方块投影预览**（内置 16×16 像素风程序化方块纹理）
- Minecraft 预览支持 **🧱 材质模式 / 🎨 颜色模式** 一键切换；材质模式使用内置 `Voxel Craft 16px` 像素材质包，颜色模式显示方块代表色
- 拖动 **🔪 Y 层切片滑块** 逐层检查内部结构
- 在存档写入面板启用**超高建筑自动沉降**，按目标存档高度上限自动下调基底，并可自定义建筑顶部留空层数，避免高塔被世界高度裁切
- 查看精确到“几组 + 几个”的生存材料表，点击禁用不想用的方块实时替换
- 拖入/粘贴 `.html`、`.json`，或直接导入 `.litematic` / `.schem` 蓝图；大型二进制蓝图默认只读结构摘要，按需生成或释放 3D 网格以降低显存占用
- 选择目标格式后点击 **🔍 预览格式**，先查看尺寸、方块数、目标版本等轻量摘要；点击下载时才在内存中转写一次，并提示实际文件大小，不生成临时文件
- 一键下载 `.litematic` / `.schem` / `.mcfunction` 蓝图，或切入 **🗺️ 放入存档** 面板，在 **2D 等高阴影地形图** 上直接拖拽选点、旋转 `0°/90°/180°/270°`、自动贴合地表高度并将建筑直接写入 Minecraft 存档区块（免进游戏粘贴不卡顿，自带 `.mca` 区域文件自动备份与一键无损回滚）！

### 2. CLI 命令行转换、存档地图直写与回滚

```bash
# 扫描发现本地所有 Minecraft Java 版存档（支持 .minecraft 与 HMCL 版本隔离目录）
npm run worlds

# 将作品直接离线写入存档地图（自动贴合玩家旁地表高度、顺时针旋转 90° 并自动备份受影响的 .mca 文件）
npm run place -- ./examples/cloudsea-pagoda-sanctuary.html --world "/path/to/saves/新的世界" --rotate 90

# 超高建筑自动下沉，并在世界高度上限下方保留 8 层空间
npm run place -- ./arcane_spire.schem --world "/path/to/saves/新的世界" --auto-sink --top-clearance-y 8

# 空置域：按模型实际占用的 XZ 区块矩形，从 Y=0 填充到模型基底 Y=80
# 只填空气，不覆盖已有地形；底材可替换为任意项目支持的普通实体方块
npm run place -- ./examples/cloudsea-pagoda-sanctuary.html --world "/path/to/saves/新的世界" --at 0,80,0 --fill-void --fill-bottom-y 0 --fill-material minecraft:stone --fill-overwrite

> 修改存档写入逻辑后，需要关闭并重新打开项目启动终端，让后端重新加载；然后刷新网页，再次点击「一键写入存档地图」。之前已经完成的写入不会自动补填。

# 一键无损回滚最近一次存档写入操作
npm run rollback -- --world "/path/to/saves/新的世界"

# 手动删除一份备份，或清空全部备份（均不改动当前地图区块）
npm run rollback -- --world "/path/to/saves/新的世界" --delete <backup-id>
npm run rollback -- --world "/path/to/saves/新的世界" --clean-all

# 按指定上限清理旧备份；写入存档时默认最多保留 10 份
npm run rollback -- --world "/path/to/saves/新的世界" --max-backups 10

# 转换 Skill 标准体素作品 (1:1 无损)
npm run convert -- ./examples/cozy-lantern-tower.html -o ./cozy-lantern-tower.litematic

# 转换任意野生 Three.js 几何体作品，开启半砖坡面拟合 + 3D 混色抖动并掏空内部实心块
npm run convert -- ./examples/floating-crystal-island.html --size 64 --slabs --dither 30 --hollow

# 导出 WorldEdit / Axiom 通用的 .schem 格式或原版免 Mod 的 .mcfunction 命令函数
npm run convert -- ./examples/cozy-lantern-tower.html -o ./cozy-lantern-tower.schem
npm run convert -- ./examples/cozy-lantern-tower.html -o ./cozy-lantern-tower.mcfunction

# 禁用整类材质（如羊毛防火）或手动指定方块替换
npm run convert -- ./examples/cozy-lantern-tower.html --disable-family wool --override moss_block=lime_concrete

# 查看任意 .litematic 或 .schem 投影文件的尺寸、缩略图与完整生存材料清单
npm run inspect -- ./examples/cozy-lantern-tower.litematic
```

### 3. 使用配套项目级 Skill 生成新作

在本目录 `/mnt/SD_Dataset/three2litematic` 下打开工作区对话，项目级 Skill（`.agents/skills/three-voxel-schematic/SKILL.md`）会自动被发现。你可以直接对 Agent 说：

> “帮我生成一个像素风日式温泉旅馆 / 赛博朋克霓虹街角 / 浮空魔法钟楼 Three.js 网页，并导出 `.litematic` 投影文件。”

Agent 会自动遵循 MC 调色板与整数体素规范生成交互式 Three.js 网页，并调用脚本直接产出 `.litematic` 文件。
