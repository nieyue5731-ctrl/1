#!/bin/bash
# Extraction script for Terraria Ultra refactoring
# Extracts CSS and JS sections from the monolithic HTML file

SRC="index (92).html"

# === CSS EXTRACTION ===
# Extract lines 17-1755 (main styles) + 1757-1977 (frost theme) + 1978-2056 (perf) + 2058-2098 (perf opt)
echo "Extracting CSS..."

# Variables and reset (lines 19-73)
sed -n '19,73p' "$SRC" > css/variables.css

# HUD styles (lines 75-538)
sed -n '75,538p' "$SRC" > css/hud.css

# Loading screen (lines 540-706)
sed -n '540,706p' "$SRC" > css/loading.css

# Mobile controls (lines 708-877)
sed -n '708,877p' "$SRC" > css/mobile.css

# Desktop info, fullscreen, FPS, time (lines 879-968)
sed -n '879,968p' "$SRC" > css/hud-extras.css

# Responsive (lines 970-1110)
sed -n '970,1110p' "$SRC" > css/responsive.css

# Mobile overrides via is-mobile class (lines 1112-1231)
sed -n '1112,1231p' "$SRC" > css/mobile-overrides.css

# Rotate hint (lines 1233-1271)
sed -n '1233,1271p' "$SRC" > css/rotate-hint.css

# Crafting UI (lines 1273-1586)
sed -n '1273,1586p' "$SRC" > css/crafting.css

# Effects (lines 1588-1695)
sed -n '1588,1695p' "$SRC" > css/effects.css

# Misc UI (lines 1697-1755) 
sed -n '1697,1755p' "$SRC" > css/ui-misc.css

# Frost theme (lines 1762-1977, skip the style tag)
sed -n '1762,1976p' "$SRC" > css/frost-theme.css

# Performance mode (lines 1985-2056)
sed -n '1985,2055p' "$SRC" > css/performance.css

# Performance optimization (lines 2060-2098)
sed -n '2060,2097p' "$SRC" > css/perf-optimization.css

# First style block (line 17 - inline styles for top buttons, toast, overlays)
# This is a single long line, extract it specially
sed -n '17p' "$SRC" | sed 's/^.*<style[^>]*>//;s/<\/style>.*$//' > css/inline-components.css

echo "CSS extraction complete."

# === JS EXTRACTION ===
echo "Extracting JS..."

# TU_Defensive (lines 2107-2548)
sed -n '2107,2548p' "$SRC" > js/core/defensive.js

# Safe utilities + RingBuffer (lines 2555-2613)
sed -n '2555,2613p' "$SRC" > js/core/safe-utils.js

# ParticlePool (lines 2619-2670)
sed -n '2619,2670p' "$SRC" > js/performance/particle-pool.js

# PERF_MONITOR delegate (lines 2677-2680)
sed -n '2677,2680p' "$SRC" > js/performance/perf-monitor-delegate.js

# Core namespace, Utils, DOM, pools, PerfMonitor, TextureCache, BatchRenderer, LazyLoader (lines 3070-3807)
# This section starts after the body elements
sed -n '3070,3807p' "$SRC" > js/core/utils-and-pools.js

# Naming aliases (lines 3812-3830)
sed -n '3812,3830p' "$SRC" > js/core/naming-aliases.js

# Loading particles (lines 3847-3880)
sed -n '3847,3880p' "$SRC" > js/boot/loading-particles.js

# GameSettings (lines 4100-4308) 
sed -n '4100,4308p' "$SRC" > js/systems/settings.js

# Toast (lines 4315-4335)
sed -n '4315,4335p' "$SRC" > js/ui/toast.js

# FullscreenManager (lines 4342-4405)
sed -n '4342,4405p' "$SRC" > js/systems/fullscreen.js

# AudioManager (lines 4410-4540)
sed -n '4410,4540p' "$SRC" > js/systems/audio.js

# CONFIG + BLOCK + BLOCK_DATA + lookups (lines 5300-6756)
sed -n '5300,6756p' "$SRC" > js/core/constants.js

# WorldGenerator + NoiseGenerator (lines 6757-8750)
sed -n '6757,8750p' "$SRC" > js/engine/world-generator.js

# ParticleSystem (lines 8754-8783)
sed -n '8620,8783p' "$SRC" > js/entities/particle-system.js

# DroppedItem + DroppedItemManager (lines 8789-9200)
sed -n '8789,9200p' "$SRC" > js/entities/dropped-items.js

# Player (lines 9200-9700)
sed -n '9200,9700p' "$SRC" > js/entities/player.js

# TouchController (lines 9700-10070)
sed -n '9700,10070p' "$SRC" > js/input/touch-controller.js

# Parallax mountains (lines 10070-10380)
sed -n '10070,10380p' "$SRC" > js/engine/parallax.js

# RenderBatcher + Renderer (lines 10380-10850)
sed -n '10380,10850p' "$SRC" > js/engine/renderer.js

# CraftingSystem (lines 11050-11255)
sed -n '11050,11255p' "$SRC" > js/ui/crafting-ui.js

# UIFlushScheduler (lines 11258-11310)
sed -n '11258,11310p' "$SRC" > js/systems/ui-flush.js

# QualityManager (lines 11313-11700)
sed -n '11313,11700p' "$SRC" > js/systems/quality.js

# Minimap (lines 11700-12258)
sed -n '11700,12258p' "$SRC" > js/ui/minimap.js

# Minimap toggle (lines 12261-12348)
sed -n '12261,12348p' "$SRC" > js/ui/minimap-toggle.js

# InventoryUI (lines 12352-12700)
sed -n '12352,12700p' "$SRC" > js/ui/inventory-ui.js

# InputManager (lines 13000-13410)
sed -n '13000,13410p' "$SRC" > js/input/input-manager.js

# InventorySystem (lines 13418-13506)
sed -n '13418,13506p' "$SRC" > js/systems/inventory.js

# Game class (lines 13513-14600)
sed -n '13513,14600p' "$SRC" > js/engine/game.js

# Patches - visual/render (lines 14600-15260)
sed -n '14600,15260p' "$SRC" > js/engine/patches-render.js

# Patches - weather/inventory (lines 15263-16035)
sed -n '15263,16035p' "$SRC" > js/systems/patches-weather-save.js

# Patches - chunk batching (lines 16037-16400)
sed -n '16037,16400p' "$SRC" > js/engine/patches-chunks.js

# Patches - tile logic (lines 16400-17320)
sed -n '16400,17320p' "$SRC" > js/systems/tile-logic-engine.js

# Patches - weather canvas FX (lines 18090-18600)
sed -n '18090,18600p' "$SRC" > js/systems/weather-canvas-fx.js

# Patches - worker client (lines 18600-22775)
sed -n '18600,22775p' "$SRC" > js/workers/worker-client.js

# Patches - error guards (lines 22780-22850)
sed -n '22780,22850p' "$SRC" > js/core/error-guards.js

# Patches - structures/biomes/sprint (remaining patches)
sed -n '22850,24440p' "$SRC" > js/engine/patches-misc.js

# Bootstrap (lines 24443-24472)
sed -n '24443,24472p' "$SRC" > js/boot/boot.js

# Runtime optimization patch (lines 24475-24497)
sed -n '24475,24497p' "$SRC" > js/engine/patches-runtime-opt.js

# Final spreadlight patch (lines 24499-24601)
sed -n '24499,24601p' "$SRC" > js/engine/patches-spreadlight.js

# Cleanup and health check (lines 24604-24668)
sed -n '24604,24668p' "$SRC" > js/boot/health-check.js

echo "JS extraction complete."
echo "Files created in css/ and js/ directories."
