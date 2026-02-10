                                                    if (Renderer && CONFIG && Utils && BLOCK && BL && !Renderer.prototype.__chunkBatchSafeV2Installed) {
                                                        Renderer.prototype.__chunkBatchSafeV2Installed = true;
                                                        // 配置
                                                        Renderer.prototype.__cb2_cfg = Renderer.prototype.__cb2_cfg || { tiles: 16, maxHigh: 180, maxLow: 90 };

                                                        function _cb2_key(cx, cy) { return cx + ',' + cy; }

                                                        function _cb2_buildDarkLUT(levels, nightBonus) {
                                                            var lut = new Float32Array(256);
                                                            for (var i = 0; i < 256; i++) {
                                                                var darkness = 1 - (i / levels);
                                                                var totalDark = darkness * 0.6 + nightBonus;
                                                                if (totalDark > 0.88) totalDark = 0.88;
                                                                lut[i] = (totalDark > 0.05) ? totalDark : 0;
                                                            }
                                                            return lut;
                                                        }

                                                        Renderer.prototype.__cb2_ensureCache = function (world) {
                                                            if (!this.__cb2_chunkMap || this.__cb2_chunkWorld !== world) {
                                                                this.__cb2_chunkWorld = world;
                                                                this.__cb2_chunkMap = new Map();
                                                                this.__cb2_chunkFrame = 0;
                                                            }
                                                            if (!this.__cb2_chunkFrame) this.__cb2_chunkFrame = 0;
                                                        };

                                                        Renderer.prototype.invalidateAllChunks = function () {
                                                            if (!this.__cb2_chunkMap) return;
                                                            this.__cb2_chunkMap.forEach(function (e) { e.dirty = true; });
                                                        };

                                                        Renderer.prototype.invalidateTile = function (tx, ty) {
                                                            if (!this.__cb2_chunkMap) return;
                                                            var cfg = this.__cb2_cfg || { tiles: 16 };
                                                            var cts = (cfg.tiles | 0) || 16;
                                                            var cx = (tx / cts) | 0;
                                                            var cy = (ty / cts) | 0;
                                                            var key = _cb2_key(cx, cy);
                                                            var e = this.__cb2_chunkMap.get(key);
                                                            if (e) e.dirty = true;
                                                        };

                                                        Renderer.prototype.__cb2_evictIfNeeded = function () {
                                                            var map = this.__cb2_chunkMap;
                                                            if (!map) return;

                                                            var cfg = this.__cb2_cfg || {};
                                                            var max = (this.lowPower ? (cfg.maxLow || 90) : (cfg.maxHigh || 180)) | 0;
                                                            if (map.size <= max) return;

                                                            // 简单 LRU：移除 lastUsed 最小的若干个
                                                            var arr = Array.from(map.values());
                                                            arr.sort(function (a, b) { return (a.lastUsed || 0) - (b.lastUsed || 0); });
                                                            var removeN = Math.min(arr.length, map.size - max);
                                                            for (var i = 0; i < removeN; i++) {
                                                                map.delete(arr[i].key);
                                                            }
                                                        };

                                                        Renderer.prototype.__cb2_rebuildChunk = function (entry, world) {
                                                            var cfg = this.__cb2_cfg || {};
                                                            var cts = (cfg.tiles | 0) || 16;
                                                            var ts = CONFIG.TILE_SIZE;

                                                            var startX = entry.cx * cts;
                                                            var startY = entry.cy * cts;
                                                            var endX = Math.min(world.w, startX + cts);
                                                            var endY = Math.min(world.h, startY + cts);

                                                            var ctx = entry.ctx;
                                                            ctx.clearRect(0, 0, entry.canvas.width, entry.canvas.height);
                                                            ctx.imageSmoothingEnabled = false;

                                                            var tiles = world.tiles;
                                                            var texGen = this.textures;

                                                            for (var x = startX; x < endX; x++) {
                                                                var colTiles = tiles[x];
                                                                var dx = (x - startX) * ts;
                                                                for (var y = startY; y < endY; y++) {
                                                                    var id = colTiles[y];
                                                                    if (id === BLOCK.AIR) continue;

                                                                    // 为了保证“发光方块”外观 100% 与原实现一致：glow 块不烘焙进 chunk，交给后续逐 tile 绘制
                                                                    if (BL && BL[id] > 5) continue;

                                                                    var tex = texGen.get(id);
                                                                    if (tex) ctx.drawImage(tex, dx, (y - startY) * ts);
                                                                }
                                                            }

                                                            entry.dirty = false;
                                                        };

                                                        Renderer.prototype.__cb2_getEntry = function (world, cx, cy) {
                                                            this.__cb2_ensureCache(world);

                                                            var cfg = this.__cb2_cfg || {};
                                                            var cts = (cfg.tiles | 0) || 16;

                                                            // 世界边界外不建条目
                                                            if (cx < 0 || cy < 0) return null;
                                                            if (cx * cts >= world.w || cy * cts >= world.h) return null;

                                                            var map = this.__cb2_chunkMap;
                                                            var key = _cb2_key(cx, cy);
                                                            var entry = map.get(key);
                                                            if (!entry) {
                                                                var size = cts * CONFIG.TILE_SIZE;

                                                                var canvas = document.createElement('canvas');
                                                                canvas.width = size;
                                                                canvas.height = size;

                                                                var cctx = canvas.getContext('2d', { alpha: true });
                                                                if (!cctx) return null;

                                                                cctx.imageSmoothingEnabled = false;

                                                                entry = {
                                                                    key: key,
                                                                    cx: cx,
                                                                    cy: cy,
                                                                    canvas: canvas,
                                                                    ctx: cctx,
                                                                    dirty: true,
                                                                    lastUsed: 0
                                                                };
                                                                map.set(key, entry);

                                                                this.__cb2_evictIfNeeded();
                                                            }

                                                            this.__cb2_chunkFrame = (this.__cb2_chunkFrame + 1) | 0;
                                                            entry.lastUsed = this.__cb2_chunkFrame;

                                                            if (entry.dirty) this.__cb2_rebuildChunk(entry, world);
                                                            return entry;
                                                        };

                                                        // 用 chunk batching 包装 renderWorld：保持原视觉（暗角/发光/遮罩）完全一致
                                                        Renderer.prototype.renderWorld = function (world, cam, time) {
                                                            // Chunk batching only: no legacy fallback path.
                                                            if (!world || !world.tiles || !world.light || !this.textures || !BL || !Utils || !CONFIG) return;

                                                            try {
                                                                var ctx = this.ctx;
                                                                var ts = CONFIG.TILE_SIZE;

                                                                var startX = Math.floor(cam.x / ts) - 1;
                                                                var startY = Math.floor(cam.y / ts) - 1;
                                                                var endX = startX + Math.ceil(this.w / ts) + 2;
                                                                var endY = startY + Math.ceil(this.h / ts) + 2;

                                                                if (startX < 0) startX = 0;
                                                                if (startY < 0) startY = 0;
                                                                if (endX >= world.w) endX = world.w - 1;
                                                                if (endY >= world.h) endY = world.h - 1;

                                                                var tiles = world.tiles;
                                                                var light = world.light;

                                                                var camCeilX = Math.ceil(cam.x);
                                                                var camCeilY = Math.ceil(cam.y);

                                                                // 复用/重建 LUT（与原 renderWorld 公式一致） + 天气联动（BLOCK_LIGHT_LUT）
                                                                var night = Utils.nightFactor(time);
                                                                var qNight = Math.round(night * 100) / 100;
                                                                var levels = CONFIG.LIGHT_LEVELS;

                                                                // 天气联动参数（由 Game._updateWeather 写入）
                                                                var wf = window.TU_WEATHER_FX || null;
                                                                var wType = (wf && wf.type) ? wf.type : 'clear';
                                                                var wGloom = (wf && typeof wf.gloom === 'number') ? wf.gloom : 0;
                                                                var wFlash = (wf && typeof wf.lightning === 'number') ? wf.lightning : 0;
                                                                if (wGloom < 0) wGloom = 0;
                                                                if (wGloom > 1) wGloom = 1;
                                                                if (wFlash < 0) wFlash = 0;
                                                                if (wFlash > 1) wFlash = 1;
                                                                var wKey = wType + ':' + ((wGloom * 100) | 0) + ':' + ((wFlash * 100) | 0) + ':' + qNight + ':' + levels;

                                                                if (!this._darkAlphaLUTDay || this._darkAlphaLUTLevels !== levels) {
                                                                    this._darkAlphaLUTLevels = levels;
                                                                    this._darkAlphaLUTDay = _cb2_buildDarkLUT(levels, 0);
                                                                    this._darkAlphaLUTNight = _cb2_buildDarkLUT(levels, 0.2);
                                                                }
                                                                var lut = this._darkAlphaLUTBlend;
                                                                if (!lut || this._darkAlphaLUTBlendWeatherKey !== wKey || this._darkAlphaLUTBlendNight !== qNight || this._darkAlphaLUTBlendLevels !== levels) {
                                                                    lut = this._darkAlphaLUTBlend || (this._darkAlphaLUTBlend = new Float32Array(256));
                                                                    var dayL = this._darkAlphaLUTDay;
                                                                    var nightL = this._darkAlphaLUTNight;
                                                                    var lv = levels || 1;
                                                                    var gloom = wGloom;
                                                                    var flash = wFlash;
                                                                    var th = 0.05 - gloom * 0.02;
                                                                    if (th < 0.02) th = 0.02;

                                                                    for (var i = 0; i < 256; i++) {
                                                                        var v = dayL[i] + (nightL[i] - dayL[i]) * qNight;

                                                                        // gloom：让暗部更“压抑”，并在强天气下略微压亮部
                                                                        if (gloom > 0.001) {
                                                                            var light01 = i / lv;
                                                                            if (light01 < 0) light01 = 0;
                                                                            if (light01 > 1) light01 = 1;
                                                                            var sh = 1 - light01;
                                                                            v += gloom * (0.08 + 0.22 * sh);
                                                                            v *= (1 + gloom * 0.18);
                                                                        }

                                                                        // lightning flash：短促减弱暗角（模拟闪电照亮）
                                                                        if (flash > 0.001) {
                                                                            v *= (1 - flash * 0.75);
                                                                            v -= flash * 0.08;
                                                                        }

                                                                        if (v > 0.92) v = 0.92;
                                                                        if (v < th) v = 0;
                                                                        lut[i] = v;
                                                                    }
                                                                    this._darkAlphaLUTBlendNight = qNight;
                                                                    this._darkAlphaLUTBlendLevels = levels;
                                                                    this._darkAlphaLUTBlendWeatherKey = wKey;
                                                                }

                                                                // 暴露到全局：便于在 Renderer 之外做联动/调试
                                                                window.BLOCK_LIGHT_LUT = lut;

                                                                // 重置关键状态（避免其它渲染残留影响 chunk draw）
                                                                ctx.globalCompositeOperation = 'source-over';
                                                                ctx.globalAlpha = 1;
                                                                ctx.shadowBlur = 0;

                                                                // 1) 画 chunk（非发光方块）
                                                                var cfg = this.__cb2_cfg || { tiles: 16 };
                                                                var cts = (cfg.tiles | 0) || 16;

                                                                var cStartX = (startX / cts) | 0;
                                                                var cStartY = (startY / cts) | 0;
                                                                var cEndX = (endX / cts) | 0;
                                                                var cEndY = (endY / cts) | 0;

                                                                for (var cy = cStartY; cy <= cEndY; cy++) {
                                                                    for (var cx = cStartX; cx <= cEndX; cx++) {
                                                                        var e = this.__cb2_getEntry(world, cx, cy);
                                                                        if (!e) continue;
                                                                        ctx.drawImage(e.canvas, cx * cts * ts - camCeilX, cy * cts * ts - camCeilY);
                                                                    }
                                                                }

                                                                // 2) 逐 tile：只补画“发光方块” + 画暗角遮罩（保持和原 renderWorld 一样）
                                                                ctx.globalAlpha = 1;
                                                                ctx.fillStyle = (wf && wf.shadowColor) ? wf.shadowColor : 'rgb(10,5,20)';

                                                                for (var x = startX; x <= endX; x++) {
                                                                    var colTiles = tiles[x];
                                                                    var colLight = light[x];
                                                                    for (var y = startY; y <= endY; y++) {
                                                                        var block = colTiles[y];
                                                                        if (block === BLOCK.AIR) continue;

                                                                        var px = x * ts - camCeilX;
                                                                        var py = y * ts - camCeilY;

                                                                        // 发光方块：按原逻辑绘制（shadowBlur）
                                                                        var bl = BL[block] | 0;
                                                                        if (bl > 5) {
                                                                            var tex = this.textures.get(block);
                                                                            if (this.enableGlow && tex) {
                                                                                ctx.save();
                                                                                ctx.shadowColor = (BC && BC[block]) ? BC[block] : '#fff';
                                                                                ctx.shadowBlur = bl * 2;
                                                                                ctx.drawImage(tex, px, py);
                                                                                ctx.restore();
                                                                            } else if (tex) {
                                                                                ctx.drawImage(tex, px, py);
                                                                            }
                                                                        }

                                                                        var a = lut[colLight[y]];
                                                                        if (a) {
                                                                            ctx.globalAlpha = a;
                                                                            ctx.fillRect(px, py, ts, ts);
                                                                            ctx.globalAlpha = 1;
                                                                        }
                                                                    }
                                                                }

                                                                ctx.globalAlpha = 1;
                                                            } catch (e) {
                                                                // 一旦异常：永久降级回原 renderWorld，避免“渲染出问题但还能玩”的体验
                                                                this.__disableChunkBatching = true;
                                                                try { console.warn('[chunkBatchSafeV2] disabled:', e); } catch (e) { if (typeof console !== 'undefined' && console.debug) console.debug('[Debug] Silently caught:', e); }
                                                                return orig && orig.call(this, world, cam, time);
                                                            }
                                                        };

                                                        // 与 tile 改动联动：markTile 时让 chunk 失效（更稳）
                                                        if (SaveSystem && SaveSystem.prototype && typeof SaveSystem.prototype.markTile === 'function') {
                                                            if (!SaveSystem.prototype.__cb2_markTileWrapped) {
                                                                SaveSystem.prototype.__cb2_markTileWrapped = true;
                                                                var _oldMarkTile = SaveSystem.prototype.markTile;
                                                                SaveSystem.prototype.markTile = function (x, y, newId) {
                                                                    _oldMarkTile.call(this, x, y, newId);
                                                                    try {
                                                                        var r = this.game && this.game.renderer;
                                                                        if (r && typeof r.invalidateTile === 'function') r.invalidateTile(x, y);
                                                                    } catch (e) { if (typeof console !== 'undefined' && console.debug) console.debug('[Debug] Silently caught:', e); }
                                                                };
                                                            }
                                                        }

                                                        // 读档后：整体失效一次（避免 chunk 里残留旧世界）
                                                        if (SaveSystem && SaveSystem.prototype && typeof SaveSystem.prototype.importLoaded === 'function') {
                                                            if (!SaveSystem.prototype.__cb2_importWrapped) {
                                                                SaveSystem.prototype.__cb2_importWrapped = true;
                                                                var _oldImportLoaded = SaveSystem.prototype.importLoaded;
                                                                SaveSystem.prototype.importLoaded = function (save) {
                                                                    _oldImportLoaded.call(this, save);
                                                                    try {
                                                                        var r = this.game && this.game.renderer;
                                                                        if (r && typeof r.invalidateAllChunks === 'function') r.invalidateAllChunks();
                                                                    } catch (e) { if (typeof console !== 'undefined' && console.debug) console.debug('[Debug] Silently caught:', e); }
                                                                };
                                                            }
                                                        }
                                                    }

                                                    // ───────────────────────── Pickup Animation (safe v2) ─────────────────────────
                                                    if (!FLAGS.disablePickupAnim && DroppedItem && DroppedItem.prototype && DroppedItemManager && DroppedItemManager.prototype) {
                                                        if (!DroppedItem.prototype.__pickupAnimSafeV2Installed) {
                                                            DroppedItem.prototype.__pickupAnimSafeV2Installed = true;

                                                            // 开始拾取动画
                                                            DroppedItem.prototype.startPickup = function (player) {
                                                                if (this._pickup) return;
                                                                this._pickup = {
                                                                    t: 0,
                                                                    dur: 240, // ms
                                                                    sx: this.x,
                                                                    sy: this.y,
                                                                    phase: Math.random() * Math.PI * 2
                                                                };
                                                                // 动画期间不受物理/磁吸干扰
                                                                this.vx = 0;
                                                                this.vy = 0;
                                                                this.rotation = 0;
                                                                this.grounded = false;
                                                            };

                                                            // 拾取动画期间不再重复触发拾取
                                                            if (typeof DroppedItem.prototype.canPickup === 'function') {
                                                                var _oldCanPickup = DroppedItem.prototype.canPickup;
                                                                DroppedItem.prototype.canPickup = function (player) {
                                                                    if (this._pickup) return false;
                                                                    return _oldCanPickup.call(this, player);
                                                                };
                                                            }

                                                            // easeOutBack
                                                            function easeOutBack(x) {
                                                                var c1 = 1.70158;
                                                                var c3 = c1 + 1;
                                                                        var py = y * ts - camCeilY;

                                                                        // 发光方块：按原逻辑绘制（shadowBlur）
                                                                        var bl = BL[block] | 0;
                                                                        if (bl > 5) {
                                                                            var tex = this.textures.get(block);
                                                                            if (this.enableGlow && tex) {
                                                                                ctx.save();
                                                                                ctx.shadowColor = (BC && BC[block]) ? BC[block] : '#fff';
                                                                                ctx.shadowBlur = bl * 2;
                                                                                ctx.drawImage(tex, px, py);
                                                                                ctx.restore();
                                                                            } else if (tex) {
                                                                                ctx.drawImage(tex, px, py);
                                                                            }
                                                                        }

                                                                        var a = lut[colLight[y]];
                                                                        if (a) {
                                                                            ctx.globalAlpha = a;
                                                                            ctx.fillRect(px, py, ts, ts);
                                                                            ctx.globalAlpha = 1;
                                                                        }
                                                                    }
                                                                }

                                                                ctx.globalAlpha = 1;
                                                            } catch (e) {
                                                                // 一旦异常：永久降级回原 renderWorld，避免“渲染出问题但还能玩”的体验
                                                                this.__disableChunkBatching = true;
                                                                try { console.warn('[chunkBatchSafeV2] disabled:', e); } catch (e) { if (typeof console !== 'undefined' && console.debug) console.debug('[Debug] Silently caught:', e); }
                                                                return orig && orig.call(this, world, cam, time);
                                                            }
                                                        };

                                                        // 与 tile 改动联动：markTile 时让 chunk 失效（更稳）
                                                        if (SaveSystem && SaveSystem.prototype && typeof SaveSystem.prototype.markTile === 'function') {
                                                            if (!SaveSystem.prototype.__cb2_markTileWrapped) {
                                                                SaveSystem.prototype.__cb2_markTileWrapped = true;
                                                                var _oldMarkTile = SaveSystem.prototype.markTile;
                                                                SaveSystem.prototype.markTile = function (x, y, newId) {
                                                                    _oldMarkTile.call(this, x, y, newId);
                                                                    try {
                                                                        var r = this.game && this.game.renderer;
                                                                        if (r && typeof r.invalidateTile === 'function') r.invalidateTile(x, y);
                                                                    } catch (e) { if (typeof console !== 'undefined' && console.debug) console.debug('[Debug] Silently caught:', e); }
                                                                };
                                                            }
                                                        }

                                                        // 读档后：整体失效一次（避免 chunk 里残留旧世界）
                                                        if (SaveSystem && SaveSystem.prototype && typeof SaveSystem.prototype.importLoaded === 'function') {
                                                            if (!SaveSystem.prototype.__cb2_importWrapped) {
                                                                SaveSystem.prototype.__cb2_importWrapped = true;
                                                                var _oldImportLoaded = SaveSystem.prototype.importLoaded;
                                                                SaveSystem.prototype.importLoaded = function (save) {
                                                                    _oldImportLoaded.call(this, save);
                                                                    try {
                                                                        var r = this.game && this.game.renderer;
                                                                        if (r && typeof r.invalidateAllChunks === 'function') r.invalidateAllChunks();
                                                                    } catch (e) { if (typeof console !== 'undefined' && console.debug) console.debug('[Debug] Silently caught:', e); }
                                                                };
                                                            }
                                                        }
                                                    }

                                                    // ───────────────────────── Pickup Animation (safe v2) ─────────────────────────
                                                    if (!FLAGS.disablePickupAnim && DroppedItem && DroppedItem.prototype && DroppedItemManager && DroppedItemManager.prototype) {
                                                        if (!DroppedItem.prototype.__pickupAnimSafeV2Installed) {
                                                            DroppedItem.prototype.__pickupAnimSafeV2Installed = true;

                                                            // 开始拾取动画
                                                            DroppedItem.prototype.startPickup = function (player) {
                                                                if (this._pickup) return;
                                                                this._pickup = {
                                                                    t: 0,
                                                                    dur: 240, // ms
                                                                    sx: this.x,
                                                                    sy: this.y,
                                                                    phase: Math.random() * Math.PI * 2
                                                                };
                                                                // 动画期间不受物理/磁吸干扰
                                                                this.vx = 0;
                                                                this.vy = 0;
                                                                this.rotation = 0;
                                                                this.grounded = false;
                                                            };

                                                            // 拾取动画期间不再重复触发拾取
                                                            if (typeof DroppedItem.prototype.canPickup === 'function') {
                                                                var _oldCanPickup = DroppedItem.prototype.canPickup;
                                                                DroppedItem.prototype.canPickup = function (player) {
                                                                    if (this._pickup) return false;
                                                                    return _oldCanPickup.call(this, player);
                                                                };
                                                            }

                                                            // easeOutBack
                                                            function easeOutBack(x) {
                                                                var c1 = 1.70158;
