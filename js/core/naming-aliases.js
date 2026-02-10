        (() => {
            'use strict';
            const TU = window.TU = window.TU || {};

            // Canonical, search-friendly aliases (non-breaking): they resolve lazily.
            const defineAlias = (aliasName, targetGetter) => {
                try {
                    if (Object.prototype.hasOwnProperty.call(TU, aliasName)) return;
                    Object.defineProperty(TU, aliasName, { configurable: true, enumerable: false, get: targetGetter });
                } catch (e) { if (typeof console !== 'undefined' && console.debug) console.debug('[Debug] Silently caught:', e); }
            };

            defineAlias('Constants', () => TU.CONFIG ?? window.CONFIG);
            defineAlias('Blocks', () => TU.BLOCK ?? window.BLOCK);
            defineAlias('GameCore', () => TU.Game);
            defineAlias('RendererSystem', () => TU.Renderer);
            defineAlias('WorldGeneratorSystem', () => TU.WorldGenerator);
            defineAlias('TileLogicSystem', () => TU.TileLogicEngine);
        })();
