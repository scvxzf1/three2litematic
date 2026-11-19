# Minecraft Voxel Palette & Architectural Design Reference

Use these calibrated hex colors, block IDs, and structural rules when authoring Three.js voxel scenes intended for `.litematic` export.

---

## 1. Material Semantics (`VoxelWorld` Material Descriptor)

Define reusable material constants at the top of your scene script:

```js
const MAT = {
  // Solid structural blocks (explicit block ID guarantees 100% deterministic MC block)
  stoneBrick:  { color: '#7a797a', block: 'minecraft:stone_bricks' },
  mossyBrick:  { color: '#737969', block: 'minecraft:mossy_stone_bricks' },
  deepslate:   { color: '#363637', block: 'minecraft:deepslate_tiles' },
  spruceLog:   { color: '#3a2510', block: 'minecraft:spruce_wood' },
  oakPlank:    { color: '#a2824e', block: 'minecraft:oak_planks' },
  whiteWall:   { color: '#d1b2a1', block: 'minecraft:white_terracotta' },
  calciteWall: { color: '#dfe0dc', block: 'minecraft:calcite' },

  // Translucent blocks (opacity < 0.82 -> Stained Glass / Ice)
  warmWindow:  { color: '#e5e533', opacity: 0.50, block: 'minecraft:yellow_stained_glass' },
  cyanGlass:   { color: '#4c7f99', opacity: 0.52, block: 'minecraft:cyan_stained_glass' },
  water:       { color: '#6699d8', opacity: 0.55, block: 'minecraft:light_blue_stained_glass' },

  // Emissive light blocks (isLight: true -> Froglights / Sea Lantern / Shroomlight)
  warmLight:   { color: '#faf5ce', emissive: '#ffcf6e', emissiveIntensity: 0.9, isLight: true, block: 'minecraft:ochre_froglight' },
  lanternCore: { color: '#f09246', emissive: '#ff8822', emissiveIntensity: 1.0, isLight: true, block: 'minecraft:shroomlight' },
  coolLight:   { color: '#acdbc2', emissive: '#88ffee', emissiveIntensity: 0.9, isLight: true, block: 'minecraft:sea_lantern' },
};
```

> **Tip**: Even if you omit `block` and only pass `{ color: '#e06101' }`, `three2litematic` will automatically match the closest Minecraft block in CIELAB (`CIEDE2000`) perceptual space, and if a user exports for older MC (`1.16.5`), newer blocks like `ochre_froglight` gracefully fall back to `glowstone` or `shroomlight`.

---

## 2. Curated Architectural Palettes

### Medieval / Cozy Timber Cottage
- **Foundation**: `deepslate_bricks` (`#464647`), `stone_bricks` (`#7a797a`), `mossy_stone_bricks` (`#737969`), `cobblestone` (`#7f7f7f`)
- **Timber Frame**: `spruce_wood` (`#3a2510`), `stripped_spruce_wood` (`#735934`)
- **Infill Walls**: `white_terracotta` (`#d1b2a1`), `calcite` (`#dfe0dc`), `birch_planks` (`#c0af79`)
- **Roof**: `dark_prismarine` (`#335b4b`) OR `red_terracotta` (`#8f3d2e`) + `bricks` (`#966153`) OR `crimson_planks` (`#653046`)
- **Lighting**: `shroomlight` (`#f09246`) / `ochre_froglight` (`#faf5ce`)

### East Asian / Pagoda / Blossom Pavilion
- **Base Terrace**: `polished_diorite` (`#c0c1c2`), `smooth_quartz` (`#ede6df`), `stone_bricks` (`#7a797a`)
- **Pillars**: `red_concrete` (`#8e2121`), `mangrove_planks` (`#753630`)
- **Eaves & Roof**: `deepslate_tiles` (`#363637`), `polished_blackstone_bricks` (`#302a31`), `oxidized_copper` (`#52a284`)
- **Foliage**: `cherry_leaves` (`#e5b1c7`), `cherry_planks` (`#e2b2ac`), `azalea_leaves` (`#59732d`)

### Cyberpunk / Neon Pixel Art / Sci-Fi
- **Dark Hull**: `black_concrete` (`#080a0f`), `gray_concrete` (`#36393d`), `obsidian` (`#0f0a18`)
- **Neon Accents (Emissive)**: `sea_lantern` (`#acdbc2`), `pearlescent_froglight` (`#f5e0ef`), `verdant_froglight` (`#e5f4e4`), `shroomlight` (`#f09246`)
- **Holograms / Visors (Translucent)**: `cyan_stained_glass` (`#4c7f99`), `magenta_stained_glass` (`#b24cd8`), `lime_stained_glass` (`#7fcc19`)

---

## 3. Scale & Craftsmanship Guidelines

1. **Choose the right footprint**:
   - **Small prop / character statue**: `16×24×16` to `32×40×32`
   - **Single building / diorama**: `32×40×32` to `56×64×56`
   - **Monumental castle / island**: `64×80×64` to `112×96×112`
2. **Depth & Relief (Avoid flat walls!)**:
   - Place timber pillars **1 block proud** (outward) or recess walls & stained-glass windows **1 block inward**.
   - Overhang roofs by **1–2 blocks** past the wall plane.
3. **Texture Subtlety (Texturing / Gradient)**:
   - Use deterministic coordinate hashing `(x * 73 + y * 31 + z * 17) % 7 === 0` to mix 15–20% secondary weathered blocks (`mossy_stone_bricks` into `stone_bricks`, `andesite` into `stone`) near ground level (`y <= 4`).
4. **Survival Buildability**:
   - Use `world.hollowBox(...)` for rooms, towers, and thick pedestals instead of solid `fillBox(...)` so interior spaces stay hollow.
   - Leaves in `three2litematic` automatically carry `persistent=true`, so tree canopies do not require adjacent wood logs inside every leaf cluster.
   - Avoid floating `sand` or `concrete_powder`; use `sandstone` or `concrete` instead.
