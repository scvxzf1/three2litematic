---
name: three-voxel-schematic
description: >-
  Generates Minecraft-aligned Three.js pixel/voxel 3D web scenes and converts
  Three.js works into Litematica (.litematic) schematics. Activate this skill
  whenever the user asks to create 3D pixel art, voxel buildings, blocky Three.js
  scenes, or export/convert Three.js scenes into Minecraft Litematica projections.
---

# Three.js Voxel Art & Litematica Schematic Workflow

Follow this workflow to generate clean, architecturally rich Three.js voxel scenes that map **1:1 losslessly** to Minecraft blocks and `.litematic` schematics.

## Step 1: Select Palette & Proportions

1. Read [mc-palette-guide.md](./references/mc-palette-guide.md) to pick authentic Minecraft hex colors, material categories (`solid`, `translucent` stained glass, `emissive` light blocks), and target dimensions.
2. Start from the starter HTML scaffold in [voxel-scene-template.html](./resources/voxel-scene-template.html). Keep `VoxelWorld` intact and implement the build inside Section 1.

## Step 2: Authoring Rules for High-Quality Voxel Builds

1. **Integer Grid Only**: Place all voxels via `VoxelWorld` integer coordinates `(x, y, z)` (`y >= 0` upward). Always keep `window.__VOXEL_DATA__ = world.exportData();` so `three2litematic` bypasses mesh resampling for a 1:1 lossless export.
2. **Architectural Depth & Layering**:
   - Never leave large flat single-color walls. Recess windows (`opacity: 0.5`) or inset wall panels by 1 block relative to corner pillars/frames.
   - Add roof overhangs (1–2 blocks beyond walls), trims, eaves, chimneys, lanterns (`isLight: true`), and ground landscaping (paths, bushes, water/glass ponds).
   - Mix 15–20% weathered variation into stone/brick surfaces using deterministic coordinate math (avoid `Math.random()` without a fixed seed so CLI & Web preview produce identical schematics!).
3. **Survival-Friendly Structure**:
   - Use `world.hollowBox(...)` or hollow `world.cylinder(..., true)` for rooms and thick volumes so interiors are not packed solid with thousands of wasted blocks.
   - Do not place unsupported floating gravity blocks (`sand`, `gravel`, `concrete_powder`).

## Step 3: Export & Validate `.litematic`

1. Save the generated `.html` file (e.g., `examples/<name>.html` or user's requested path).
2. Run the conversion helper script to generate and validate the `.litematic` schematic:
   ```bash
   bash .agents/skills/three-voxel-schematic/scripts/export-litematic.sh <path/to/scene.html>
   ```
   - Optional flags: `-o <out.litematic>`, `--preset 1.21|1.20.1|1.16.5|classic`, `--hollow`.
3. Verify the CLI output reports `提取模式: structured`, reasonable dimensions, and expected block counts (`inspect` subcommand: `npx three2litematic inspect <file.litematic>`).
4. If the user wants to visually inspect, slice layers, or tweak block substitutions interactively, start or point them to `npm run serve` (`http://127.0.0.1:28741`).
