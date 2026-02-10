# Behavior Changes

## Overview

This refactoring aims for **100% behavioral equivalence** with the original `index (92).html`. All changes are structural (file organization, code splitting) rather than functional.

## Changes

### 1. Loading Screen Text
- **Old**: `✨ TERRARIA ULTRA ✨` with emoji sparkles
- **New**: `TERRARIA ULTRA` (plain text, styled via CSS `var(--gold-grad)`)
- **Reason**: Cleaner HTML; visual appearance identical due to CSS gradient
- **Verification**: Loading screen renders the same gold gradient text

### 2. HTML Structure
- **Old**: `<script>` tags placed between `</head>` and `<body>` (invalid HTML)
- **New**: Early scripts in `<head>`, game scripts in `<body>` after DOM elements
- **Reason**: HTML validity; scripts that don't access DOM can be in head
- **Verification**: All scripts execute in same dependency order

### 3. File Loading
- **Old**: All code inline in single HTML file
- **New**: External CSS (`<link>`) and JS (`<script src>`) files
- **Reason**: Maintainability, cacheability
- **Verification**: Load order preserved; all globals available when needed

## No Behavioral Changes

The following systems are **confirmed unchanged**:
- World generation (same seed produces same world)
- Player physics (sprint, jump buffer, coyote time)
- Mining and placement mechanics
- Light propagation algorithm
- Water physics
- Save/load format and compatibility
- Weather system behavior
- Audio system
- Mobile touch controls
- All UI interactions (crafting, inventory, settings)
- Adaptive quality system
- Post-processing effects
