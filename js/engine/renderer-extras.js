                const cool = Utils.clamp(night * 0.9, 0, 1);

                const d = Utils.clamp(depth01 || 0, 0, 1);
                const underground = Utils.smoothstep(0.22, 0.62, d);

                ctx.save();
                ctx.setTransform(1, 0, 0, 1, 0, 0);

                // A) Mode 2: Bloom
                if (mode >= 2) {
                    const pp = this._pp;
                    if (pp && pp.canvas && pp.ctx) {
                        const bctx = pp.ctx;
                        bctx.setTransform(1, 0, 0, 1, 0, 0);
                        bctx.globalCompositeOperation = 'copy';
                        bctx.filter = 'none';
                        bctx.globalAlpha = 1;
                        bctx.drawImage(canvas, 0, 0);

                        // Grading
                        const contrast = 1.05 + warm * 0.03 + night * 0.06 + underground * 0.03;
                        const saturate = 1.07 + warm * 0.05 + cool * 0.03 - underground * 0.05;
                        const brightness = 1.01 + warm * 0.015 - cool * 0.008 - underground * 0.015;

                        ctx.globalCompositeOperation = 'copy';
                        ctx.filter = `contrast(${contrast.toFixed(3)}) saturate(${saturate.toFixed(3)}) brightness(${brightness.toFixed(3)})`;
                        ctx.drawImage(pp.canvas, 0, 0);
                        ctx.filter = 'none';

                        // Bloom
                        // (simplified for conciseness, assuming similar logic to v3)
                        const bloomBase = 0.33 + night * 0.10 + underground * 0.06;
                        const blur1 = Math.max(1, Math.round(2.5 * dpr));

                        ctx.globalCompositeOperation = 'screen';
                        ctx.filter = `blur(${blur1}px) brightness(1.2)`;
                        ctx.globalAlpha = bloomBase;
                        ctx.drawImage(pp.canvas, 0, 0);

                        ctx.filter = 'none';
                        ctx.globalCompositeOperation = 'source-over';
                        ctx.globalAlpha = 1;
                    }
                }

                // B) Fog, Vignette, Grain (simplified)
                const fogAmt = Utils.smoothstep(0.18, 0.62, d) * (0.60 + night * 0.25);
                if (fogAmt > 0) {
                    const fog = ctx.createLinearGradient(0, hPx * 0.4, 0, hPx);
                    fog.addColorStop(0, 'rgba(30,20,50,0)');
                    fog.addColorStop(1, `rgba(30,20,50,${(0.25 * fogAmt).toFixed(2)})`);
                    ctx.globalCompositeOperation = 'source-over';
                    ctx.fillStyle = fog;
                    ctx.fillRect(0, 0, wPx, hPx);
                }

                const vig = (0.2 + night * 0.2) * (mode === 1 ? 0.9 : 1);
                if (vig > 0.01) {
                    // simplified vignette
                    const vg = ctx.createRadialGradient(wPx / 2, hPx / 2, wPx * 0.3, wPx / 2, hPx / 2, wPx * 0.8);
                    vg.addColorStop(0, 'rgba(0,0,0,0)');
                    vg.addColorStop(1, `rgba(0,0,0,${vig.toFixed(2)})`);
                    ctx.fillStyle = vg;
                    ctx.fillRect(0, 0, wPx, hPx);
                }

                ctx.restore();
            }

            postProcess(time = 0.5) {
                this.applyPostFX(time, 0, false);
            }

            // --- Helper Methods (Consolidated from patches) ---

            renderBackgroundCached(cam, time, drawParallax = true) {
                // ── Mountain Rendering Patch v2 ──
                // This method now ONLY caches the sky gradient + celestial bodies.
                // Mountains are drawn exclusively by Game.prototype.render after
                // this method returns, eliminating double-draw and cache-desync bugs.
                this._ensureBgCache();
                const bg = this._bgCache;
                if (!bg || !bg.canvas || !bg.ctx) {
                    this.renderSky(cam, time);
                    // Mountains intentionally NOT drawn here; Game.render handles them.
                    return;
                }

                this._resizeBgCache();

                const now = performance.now();
                const dt = now - (bg.lastAt || 0);
                const refreshInterval = this.lowPower ? 4600 : 750;
                const t = (typeof time === 'number' && isFinite(time)) ? time : (bg.lastTime || 0);

                // Check triggers
                const bucket = this._getSkyBucket(t);
                const bucketChanged = (bucket !== bg.lastBucket);
                const skyKey = this._getSkyKey(t, bucket);
                const skyKeyChanged = (skyKey != null && skyKey !== bg.lastSkyKey);
                const timeChanged = Math.abs(t - (bg.lastTime || 0)) > (this.lowPower ? 0.018 : 0.01);
                const needUpdate = !!bg.dirty || bucketChanged || skyKeyChanged || (dt >= refreshInterval && timeChanged);

                if (needUpdate) {
                    bg.dirty = false;
                    bg.lastAt = now;
                    bg.lastTime = t;
                    bg.lastBucket = bucket;
                    bg.lastSkyKey = skyKey;

                    const origCtx = this.ctx;
                    this.ctx = bg.ctx;
                    this._bgCacheDrawing = true;
                    try {
                        bg.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
                        bg.ctx.imageSmoothingEnabled = false;
                        bg.ctx.clearRect(0, 0, this.w, this.h);
                        this.renderSky(cam, t); // Only sky, not parallax
                    } finally {
                        this._bgCacheDrawing = false;
                        this.ctx = origCtx;
                    }
                }

                this.ctx.drawImage(bg.canvas, 0, 0, this.w, this.h);
                // Mountains intentionally NOT drawn here; Game.render handles them.
            }

            _ensureBgCache() {
                if (this._bgCache) return;
                const c = document.createElement('canvas');
                c.width = this.canvas.width;
                c.height = this.canvas.height;
                this._bgCache = {
                    canvas: c,
                    ctx: c.getContext('2d', { alpha: false }),
                    wPx: c.width,
                    hPx: c.height,
                    dirty: true
                };
            }

            _resizeBgCache() {
                const bg = this._bgCache;
                if (!bg) return;
                const w = this.canvas.width;
                const h = this.canvas.height;
                if (bg.wPx !== w || bg.hPx !== h) {
                    bg.canvas.width = w;
                    bg.canvas.height = h;
                    bg.wPx = w;
                    bg.hPx = h;
                    bg.dirty = true;
                }
            }

            _getSkyBucket(t) {
                // Simple bucket to avoid thrashing
                return (t * 100) | 0;
            }

            _getSkyKey(t, bucket) {
                // Simplified signature for sky color
                return bucket;
            }

            _ensureTexArray() {
                if (!this.textures || typeof this.textures.get !== 'function') return null;
                if (this._texArr && this._texArrMap === this.textures) return this._texArr;
                this._texArr = new Array(256).fill(null);
                try { this.textures.forEach((v, k) => { this._texArr[k & 255] = v; }); } catch (_) { }
                this._texArrMap = this.textures;
                return this._texArr;
            }

            _getBucketState() {
                if (this._tileBuckets) return this._tileBuckets;
                this._tileBuckets = {
                    glowKeys: [],
                    glowLists: new Array(256),
                    darkKeys: [],
                    darkLists: new Array(256),
                    reset() {
                        for (let i = 0; i < this.glowKeys.length; i++) this.glowLists[this.glowKeys[i]].length = 0;
                        for (let i = 0; i < this.darkKeys.length; i++) this.darkLists[this.darkKeys[i]].length = 0;
                        this.glowKeys.length = 0;
                        this.darkKeys.length = 0;
                    }
                };
                for (let i = 0; i < 256; i++) {
                    this._tileBuckets.glowLists[i] = [];
                    this._tileBuckets.darkLists[i] = [];
                }
                return this._tileBuckets;
            }
        }

        // ═══════════════════════════════════════════════════════════════════════════════
        //                                   配方数据
        // ═══════════════════════════════════════════════════════════════════════════════
