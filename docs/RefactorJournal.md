# Refactor Journal - Terraria Ultra Aesthetic Edition

## Overview

This document tracks the complete refactoring of Terraria Ultra from a 24,674-line single HTML file (`index (92).html`) into a well-organized multi-file project structure.

## Phase 0: Baseline Analysis

### Core Classes / Module Responsibility Map

| Module | Lines (approx) | Responsibility |
|--------|----------------|----------------|
| TU_Defensive | 2107-2548 | Type guards, assertions, safe math, boundary checks, input validation, world access, error reporting |
| EventManager | ~2520-2552 | Pub/sub event system with once/off support |
| ParticlePool | 2619-2670 | Object pool for particle reuse (eliminates GC stutter) |
| PERF_MONITOR | 2677-2680 | Delegate to PerfMonitor for FPS tracking |
| Utils/DOM/Pools | 3070-3807 | ObjectPool, VecPool, ArrayPool, MemoryManager, EventUtils, PerfMonitor, TextureCache, BatchRenderer, LazyLoader |
| GameSettings | 4100-4308 | Load/save/sanitize user settings from localStorage |
| Toast | 4315-4335 | Toast notification system |
| FullscreenManager | 4342-4405 | Fullscreen API wrapper with orientation lock |
| AudioManager | 4410-4540 | Web Audio API procedural sound effects |
| CONFIG/BLOCK | 5300-5422 | Game constants and block type enum (162 block types) |
| BLOCK_DATA | 5427-5700 | Block metadata (name, solid, transparent, light, hardness, color) |
| Lookup Tables | 5700-6756 | BLOCK_COLOR, BLOCK_HARDNESS, BLOCK_SOLID, BLOCK_LIGHT, BLOCK_TRANSPARENT |
| WorldGenerator | 6757-8750 | Procedural world generation with biomes, caves, structures, ores |
| NoiseGenerator | ~6757-6780 | Perlin/simplex noise for terrain generation |
| ParticleSystem | 8620-8783 | Visual particle effects for mining, placement, etc. |
| DroppedItem/Manager | 8789-9200 | Physics-based dropped items with spatial hashing |
| AmbientParticles | ~9050-9200 | DOM-based ambient visual effects (fireflies) |
| Player | 9200-9700 | Player entity with physics, collision, sprint, inventory |
| TouchController | 9700-10070 | Mobile virtual joystick and button input |
| Parallax Mountains | 10070-10380 | Procedural parallax mountain backdrop with chunk caching |
| Renderer | 10380-10850 | Canvas 2D renderer with DPR scaling, texture management |
| TextureGenerator | ~10850-11050 | Procedural block texture generation |
| CraftingSystem | 11050-11255 | Crafting recipe UI and logic |
| UIFlushScheduler | 11258-11310 | Batched DOM write scheduler |
| QualityManager | 11313-11700 | Adaptive quality/performance management |
| Minimap | 11700-12258 | Minimap rendering with dirty-update optimization |
| InventoryUI | 12352-12700 | Full inventory management UI |
| InputManager | 13000-13410 | Keyboard/mouse input handling with sprint detection |
| InventorySystem | 13418-13506 | Inventory item stacking and management logic |
| Game | 13513-14600+ | Core game class (init, loop, update, render, camera, mining, placement) |

### Dependency Graph Summary

```
Boot -> Game -> {
  Renderer -> TextureGenerator, TextureCache, ParallaxMountains
  Player -> CONFIG, Utils
  WorldGenerator -> NoiseGenerator, CONFIG, BLOCK
  InputManager -> CONFIG
  TouchController -> CONFIG
  CraftingSystem -> BLOCK_DATA, Game
  InventoryUI -> Game, BLOCK_DATA
  AudioManager -> GameSettings
  SaveSystem -> Game, localStorage, IndexedDB
  QualityManager -> Game, Renderer, GameSettings
  Minimap -> World, BLOCK_COLOR
  ParticleSystem -> Utils
  DroppedItemManager -> DroppedItem, BLOCK_DATA
  TileLogicEngine -> World, Worker
}
```

### Patch Chain End-Version Location Table

| Method | Original Class Location | Final Patch Location | Notes |
|--------|------------------------|---------------------|-------|
| Renderer.renderSky | 10537 | ~14851 | Patched with smooth sky transitions, star caching |
| Renderer.renderWorld | 10623 | ~16179 | Patched with chunk batching, weather LUT |
| Renderer.renderParallax | 10619 | ~14973 | Minor patch, delegates to renderParallaxMountains |
| Renderer.applyPostFX | N/A | ~15097 | Added by patch (vignette, grain, color grading) |
| Game.render | N/A | ~15166 | Complete override with mountain rendering, postFX |
| Game._updateWeather | N/A | ~15281 | Added by patch (dynamic weather system) |
| Game._spreadLight | N/A | ~24510 | Final patch with TypedArray visited marks |
| Game.init | 13677 | ~22707 | Wrapped for worker sync + perf timing |
| Game.loop | ~13800+ | Various | Wrapped for perf timing |
| SaveSystem.save | ~15946 | ~15946 | IDB backup + quota handling |
| TouchController.getInput | ~9700 | Not re-patched | Original zero-alloc version kept |

### Behavior Baseline Checklist

- [x] Loading screen with progress bar
- [x] World generation with biomes (tundra, snow, forest, plains, jungle, desert, etc.)
- [x] Player movement (walk, jump, sprint with coyote time + jump buffer)
- [x] Block mining with progress bar
- [x] Block placement with right click
- [x] Light propagation (BFS with visited stamp)
- [x] Water physics (via TileLogicEngine worker/idle fallback)
- [x] UI: Health/Mana bars, Hotbar, Minimap
- [x] Crafting system with recipe UI
- [x] Inventory management (drag, split, sort)
- [x] Save/Load (localStorage + IndexedDB backup)
- [x] Weather system (rain, snow, thunder, blood moon)
- [x] Day/night cycle with sky transitions
- [x] Mobile touch controls (joystick, buttons, crosshair)
- [x] Settings panel (DPR, particles, PostFX, etc.)
- [x] Fullscreen support
- [x] Toast notifications
- [x] Adaptive quality (auto-downgrade on low FPS)
- [x] Parallax mountain backdrop
- [x] Post-processing effects (vignette, grain, color grading)

## Phase 1: Safe Cleanup

### Actions Taken

1. **File renamed**: `index (92).html` -> kept as reference; new `index.html` created
2. **Dead code identified**: RingBuffer (0 runtime references outside definition), BatchRenderer (superseded by bucket rendering), LazyLoader (0 references) - kept in extraction for safety, flagged for removal
3. **Utility dedup**: `safeGet`, `clamp`, `lerp` exist in both TU_Defensive and safe-utils; safe-utils uses `typeof window.xxx === 'undefined'` guards to avoid overriding
4. **VecPool.release**: Already uses `_pooled` tag (O(1)) in extracted version
5. **ArrayPool.release**: Already uses `_pooled` tag (O(1)) in extracted version
6. **PerfMonitor.getMinFPS**: Uses `Math.max(...validSamples)` - safe because `_maxSamples` is 60, well within call stack limits

## Phase 2: CSS Consolidation

### Files Created

| File | Content | Lines |
|------|---------|-------|
| css/variables.css | Merged `:root` variables | 55 |
| css/inline-components.css | Toast, overlays, top buttons | 1 (minified) |
| css/hud.css | Stats bars, hotbar, slots, mining bar | 464 |
| css/hud-extras.css | Info panel, fullscreen btn, FPS, time | 90 |
| css/loading.css | Loading screen styles | 167 |
| css/mobile.css | Joystick, action buttons, crosshair | 170 |
| css/responsive.css | Media query breakpoints | 141 |
| css/mobile-overrides.css | html.is-mobile overrides | 120 |
| css/rotate-hint.css | Landscape rotation prompt | 39 |
| css/crafting.css | Crafting overlay and panel | 314 |
| css/effects.css | Fireflies, rain, snow, weather filter | 108 |
| css/ui-misc.css | Item hints, help panel | 59 |
| css/frost-theme.css | Glass morphism theme | 215 |
| css/performance.css | Low-power / low-quality CSS | 71 |
| css/perf-optimization.css | Containment, GPU hints, reduced motion | 38 |

## Phase 3: Code Organization

### Multi-file Structure

The monolithic file has been split into 50+ organized files across the following directories:

```
css/          - 15 CSS files (organized by concern)
js/core/      - Defensive infrastructure, utilities, constants, error handling
js/systems/   - Settings, audio, fullscreen, quality, weather, tile logic, save
js/engine/    - Game class, renderer, world generator, parallax, patches
js/entities/  - Player, particles, dropped items, ambient effects
js/ui/        - Toast, crafting, inventory, minimap, UX wiring
js/input/     - Input manager, touch controller
js/performance/ - Particle pool, perf monitor
js/workers/   - Worker client for off-thread rendering/generation
js/boot/      - Bootstrap, loading, health check
docs/         - Documentation
```

### Load Order

The new `index.html` loads scripts in the exact same dependency order as the original file, ensuring behavioral equivalence. CSS is loaded via `<link>` tags in `<head>`, and JS via `<script>` tags in `<body>` after the DOM elements they reference.

## Phase 4-8: Notes

### World Data Structure
The world currently uses Array-of-Arrays for tiles/light/walls. The `renderWorld` method already supports a `tilesFlat`/`lightFlat` path for TypedArray-based access. Full migration to flat TypedArrays throughout is flagged for future work.

### Render Pipeline
The renderer already implements:
- Chunk-based tile batching (16x16 tile chunks cached to offscreen canvases)
- Dark alpha LUT (Float32Array) with weather integration
- Texture caching with LRU eviction
- Parallax mountain chunk caching
- PostFX pipeline (vignette, grain, color grading)

### Architecture
The Game class has been extracted but remains monolithic. Key subsystems (Camera, Physics, Lighting, Mining) are flagged for further decomposition. The EventManager exists but is underutilized for cross-system communication.

## Verification Results

- [x] All CSS extracted and organized into 15 files
- [x] All JS extracted and organized into 50+ files
- [x] New index.html loads all files in correct dependency order
- [x] No script/style tag leakage in extracted files
- [x] HTML structure preserved (all DOM elements, overlays, HUD)
- [x] Original file preserved as reference
