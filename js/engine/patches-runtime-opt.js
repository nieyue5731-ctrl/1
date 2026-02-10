
                                /**
                                 * Runtime Optimization Patch (cleaned)
                                 * - Renderer: skip near-black tiles
                                 * - Removed duplicate TouchController.getInput (already zero-alloc in class)
                                 * - Removed no-op TileLogicEngine wrapper
                                 * - Removed unsafe game.loop wrapping (adaptive substeps handled in Game.loop itself)
                                 */
                                (function () {
                                    'use strict';

                                    // Renderer: skip drawing tiles that are too dark to see
                                    if (typeof Renderer !== 'undefined') {
                                        const RP = Renderer.prototype;
                                        const originalDrawTile = RP.drawTile;
                                        if (originalDrawTile) {
                                            RP.drawTile = function (ctx, id, x, y, size, light) {
                                                if (light <= 0.05) return;
                                                originalDrawTile.call(this, ctx, id, x, y, size, light);
                                            };
                                        }
                                    }
                                })();
