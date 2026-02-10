        const RenderBatcher = {
            _batches: new Map(),

            begin() {
                this._batches.clear();
            },

            add(texture, x, y, alpha = 1) {
                if (!this._batches.has(texture)) {
                    this._batches.set(texture, []);
                }
                this._batches.get(texture).push({ x, y, alpha });
            },

            render(ctx) {
                for (const [texture, positions] of this._batches) {
                    ctx.save();
                    for (const pos of positions) {
                        if (pos.alpha !== 1) {
                            ctx.globalAlpha = pos.alpha;
                        }
                        ctx.drawImage(texture, pos.x, pos.y);
                        if (pos.alpha !== 1) {
                            ctx.globalAlpha = 1;
                        }
                    }
                    ctx.restore();
                }
            }
        };

        class Renderer {
            constructor(canvas) {
                this.canvas = canvas;
                this.ctx = null;
                if (canvas && canvas.getContext) {
                    try { this.ctx = canvas.getContext('2d', { alpha: false, desynchronized: true }); } catch (e) { if (typeof console !== 'undefined' && console.debug) console.debug('[Debug] Silently caught:', e); }
                    if (!this.ctx) {
                        try { this.ctx = canvas.getContext('2d', { alpha: false }); } catch (e) { if (typeof console !== 'undefined' && console.debug) console.debug('[Debug] Silently caught:', e); }
                    }
                }
                if (!this.ctx) {
                    throw new Error('Canvas 2D context 初始化失败');
                }
                this._pp = {
                    canvas: document.createElement('canvas'),
                    ctx: null,
                    noise: document.createElement('canvas'),
                    nctx: null,
                    seed: 0,
                    _bloom: null
                };
                this._pp.ctx = this._pp.canvas.getContext('2d', { alpha: false });
                this._pp.nctx = this._pp.noise.getContext('2d', { alpha: true });
                this.textures = new TextureGenerator();
                this.enableGlow = true;
                this.lowPower = false;
                this.resolutionScale = 1;

                // Sprint Blur Props
                this._speedBlurAmt = 0;
                this._speedBlurDirX = 1;
                this._speedBlurBuf = null;

                // Caches
                this._tileBuckets = null;
                this._texArr = null;

                this.resize();
                this._resizeRAF = 0;
                this._resizeRafCb = this._resizeRafCb || (() => {
                    this._resizeRAF = 0;
                    this.resize();
                });
                this._onResize = this._onResize || (() => {
                    if (this._resizeRAF) return;
                    this._resizeRAF = requestAnimationFrame(this._resizeRafCb);
                });
                window.addEventListener('resize', this._onResize, { passive: true });
                window.addEventListener('orientationchange', this._onResize, { passive: true });
            }

            resize() {
                const gs = (window.GAME_SETTINGS || {});
                const effCap = (gs && typeof gs.__dprCapEffective === 'number') ? gs.__dprCapEffective : null;
                const dprCap = (effCap && effCap > 0) ? effCap : ((gs && gs.dprCap) ? gs.dprCap : 2);

                // 基础 DPR（用户上限 + 设备 DPR）
                const baseDpr = Math.min(window.devicePixelRatio || 1, dprCap);

                // 动态分辨率：通过 resolutionScale 调节负载，但要避免“半像素/非整数像素映射”造成的 tile 缝闪烁
                const scale = (typeof this.resolutionScale === 'number' && isFinite(this.resolutionScale)) ? this.resolutionScale : 1;

                // 目标 DPR（先算，再做量化）
                let desiredDpr = Math.max(0.5, Math.min(3, baseDpr * scale));

                // 关键修复：把 DPR 量化到 0.25 步进（16px tile * 0.25 = 4px，能显著降低 tile 边缘采样/拼缝闪动）
                const DPR_STEP = 0.25;
                desiredDpr = Math.round(desiredDpr / DPR_STEP) * DPR_STEP;
                desiredDpr = Math.max(0.5, Math.min(3, desiredDpr));

                const wCss = window.innerWidth;
                const hCss = window.innerHeight;

                // 关键修复：先按宽度取整得到像素尺寸，再反算“真实 DPR”，并用同一个 DPR 推导高度
                // 这样 setTransform 与 canvas 实际像素比例严格一致，避免每次 resize 的四舍五入误差引起的网格线闪动
                const wPx = Math.max(1, Math.round(wCss * desiredDpr));
                const dprActual = wPx / Math.max(1, wCss);
                const hPx = Math.max(1, Math.round(hCss * dprActual));

                // 史诗级优化：避免重复 resize 触发导致的 canvas 反复重分配（极容易引发卡顿/闪黑）
                if (this.canvas.width === wPx && this.canvas.height === hPx && this.w === wCss && this.h === hCss && Math.abs((this.dpr || 0) - dprActual) < 1e-6) {
                    return;
                }

                this.dpr = dprActual;

                // 画布内部像素缩放（动态分辨率）：不影响 UI 布局，只影响渲染负载
                this.canvas.width = wPx;
                this.canvas.height = hPx;
                this.canvas.style.width = wCss + 'px';
                this.canvas.style.height = hCss + 'px';

                // PostFX 缓冲区尺寸跟随主画布（像素级）
                if (this._pp && this._pp.canvas) {
                    this._pp.canvas.width = this.canvas.width;
                    this._pp.canvas.height = this.canvas.height;
                    // 噪点纹理固定较小尺寸，按需重建
                    const n = this._pp.noise;
                    const nSize = 256;
                    if (n.width !== nSize || n.height !== nSize) {
                        n.width = nSize; n.height = nSize;
                        this._pp.seed = 0;
                    }
                }

                // 用真实 DPR 做变换（与实际像素尺寸一致）
                this.ctx.setTransform(dprActual, 0, 0, dprActual, 0, 0);
                this.ctx.imageSmoothingEnabled = false;

                // w/h 仍以 CSS 像素作为世界视窗单位
                this.w = wCss;
                this.h = hCss;
            }

            setResolutionScale(scale01) {
                const s = Math.max(0.5, Math.min(1, Number(scale01) || 1));
                if (Math.abs((this.resolutionScale || 1) - s) < 0.001) return;
                this.resolutionScale = s;
                this.resize();
            }

            clear() {
                this.ctx.fillStyle = '#000';
                this.ctx.fillRect(0, 0, this.w, this.h);
            }

            renderSky(cam, time) {
                const ctx = this.ctx;
                // Ultra Visual FX v3 Sky Logic
                const kfs = this._skyKeyframes || (this._skyKeyframes = [
                    { t: 0.00, c: ['#0c0c1e', '#1a1a2e', '#16213e'] },
                    { t: 0.22, c: ['#0c0c1e', '#1a1a2e', '#16213e'] },
                    { t: 0.30, c: ['#1a1a2e', '#4a1942', '#ff6b6b'] },
                    { t: 0.36, c: ['#74b9ff', '#81ecec', '#dfe6e9'] },
                    { t: 0.64, c: ['#74b9ff', '#81ecec', '#dfe6e9'] },
                    { t: 0.72, c: ['#6c5ce7', '#fd79a8', '#ffeaa7'] },
                    { t: 0.78, c: ['#0c0c1e', '#1a1a2e', '#16213e'] },
                    { t: 1.00, c: ['#0c0c1e', '#1a1a2e', '#16213e'] }
                ]);

                let i = 0;
                while (i < kfs.length - 2 && time >= kfs[i + 1].t) i++;
                const k0 = kfs[i], k1 = kfs[i + 1];
                const u = (k1.t === k0.t) ? 0 : Math.max(0, Math.min(1, (time - k0.t) / (k1.t - k0.t)));
                const eased = u * u * (3 - 2 * u); // smoothstep
                const colors = k0.c.map((c, idx) => Utils.lerpColor(c, k1.c[idx], eased));

                const grad = ctx.createLinearGradient(0, 0, 0, this.h * 0.75);
                grad.addColorStop(0, colors[0]);
                grad.addColorStop(0.5, colors[1]);
                grad.addColorStop(1, colors[2]);
                ctx.fillStyle = grad;
                ctx.fillRect(0, 0, this.w, this.h);

                const night = Utils.nightFactor(time);
                // Stars
                if (night > 0.01) {
                    ctx.globalAlpha = night * 0.85;
                    if (!this._starCanvas) {
                        this._starCanvas = document.createElement('canvas');
                        this._starCanvas.width = this.w;
                        this._starCanvas.height = this.h * 0.6;
                        const sctx = this._starCanvas.getContext('2d');
                        for (let j = 0; j < 120; j++) {
                            const sx = Math.random() * this.w;
                            const sy = Math.random() * this.h * 0.5;
                            const size = Math.random() * 1.5 + 0.5;
                            sctx.fillStyle = '#fff';
                            sctx.beginPath();
                            sctx.arc(sx, sy, size, 0, Math.PI * 2);
                            sctx.fill();
                        }
                    }
                    if (this._starCanvas.width !== this.w) { this._starCanvas = null; } // dumb resize check
                    else ctx.drawImage(this._starCanvas, 0, 0);
                    ctx.globalAlpha = 1;
                }

                // Sun/Moon
                const cx = this.w * ((time + 0.25) % 1);
                const cy = this.h * 0.15 + Math.sin(((time + 0.25) % 1) * Math.PI) * (-this.h * 0.1);

                if (time > 0.2 && time < 0.8) {
                    // Sun
                    const sunGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 50);
                    sunGlow.addColorStop(0, 'rgba(255, 255, 220, 0.9)');
                    sunGlow.addColorStop(0.3, 'rgba(255, 240, 150, 0.4)');
                    sunGlow.addColorStop(1, 'rgba(255, 200, 50, 0)');
                    ctx.fillStyle = sunGlow;
                    ctx.beginPath(); ctx.arc(cx, cy, 50, 0, Math.PI * 2); ctx.fill();
                    ctx.fillStyle = '#fff';
                    ctx.beginPath(); ctx.arc(cx, cy, 18, 0, Math.PI * 2); ctx.fill();
                } else {
                    // Moon
                    ctx.fillStyle = '#f0f0f5';
                    ctx.beginPath(); ctx.arc(cx, cy, 30, 0, Math.PI * 2); ctx.fill();
                    ctx.fillStyle = '#d0d0d8';
                    ctx.beginPath(); ctx.arc(cx - 6, cy - 4, 5, 0, Math.PI * 2); ctx.fill();
                    ctx.beginPath(); ctx.arc(cx + 8, cy + 6, 4, 0, Math.PI * 2); ctx.fill();
                }

                // --- TU Mount Fix Logic (DISABLED) ---
                // Mountains are now drawn from a single authoritative call site in
                // Game.prototype.render (see "Mountain Rendering Patch v2" below).
                // Drawing them inside renderSky caused double-draws, cache
                // interference, and desync with the sky/lighting system.
            }

            renderParallax(cam, time = 0.5) {
                renderParallaxMountains(this, cam, time);
            }

            renderWorld(world, cam, time) {
                if (!world || !world.tiles || !world.light) return;

                const ctx = this.ctx;
                const ts = CONFIG.TILE_SIZE;
                const startX = Math.max(0, ((cam.x / ts) | 0) - 1);
                const startY = Math.max(0, ((cam.y / ts) | 0) - 1);
                const endX = Math.min(world.w - 1, startX + ((this.w / ts) | 0) + 3);
                const endY = Math.min(world.h - 1, startY + ((this.h / ts) | 0) + 3);
                const camCeilX = Math.ceil(cam.x);
                const camCeilY = Math.ceil(cam.y);
                const lut = window.BLOCK_LIGHT_LUT;
                if (!lut) return;

                // Prepare Bucket
                const bucket = this._getBucketState();
                bucket.reset();
                const texArr = this._ensureTexArray();

                const tiles = world.tiles;
                const light = world.light;
                const BL = window.BLOCK_LIGHT;
                const AIR = (window.BLOCK && window.BLOCK.AIR) || 0;

                // Fill buckets
                // Check for flatified world (optimization)
                if (world.tilesFlat && world.lightFlat && world.tilesFlat.length === world.w * world.h) {
                    const H = world.h | 0;
                    const tf = world.tilesFlat;
                    const lf = world.lightFlat;
                    for (let x = startX; x <= endX; x++) {
                        const base = x * H;
                        for (let y = startY; y <= endY; y++) {
                            const idx = base + y;
                            const block = tf[idx] | 0;
                            if (block === AIR) continue;

                            const px = x * ts - camCeilX;
                            const py = y * ts - camCeilY;
                            const pp = ((px & 0xffff) << 16) | (py & 0xffff);

                            const bl = BL[block] | 0;
                            if (bl > 5) {
                                if (bucket.glowLists[block].length === 0) bucket.glowKeys.push(block);
                                bucket.glowLists[block].push(pp);
                            }

                            const lv = lf[idx] & 255;
                            const a = lut[lv];
                            if (a) {
                                if (bucket.darkLists[lv].length === 0) bucket.darkKeys.push(lv);
                                bucket.darkLists[lv].push(pp);
                            }
                        }
                    }
                } else {
                    // Legacy array of arrays
                    for (let x = startX; x <= endX; x++) {
                        const colT = tiles[x];
                        const colL = light[x];
                        for (let y = startY; y <= endY; y++) {
                            const block = colT[y] | 0;
                            if (block === AIR) continue;

                            const px = x * ts - camCeilX;
                            const py = y * ts - camCeilY;
                            const pp = ((px & 0xffff) << 16) | (py & 0xffff);

                            const bl = BL[block] | 0;
                            if (bl > 5) {
                                if (bucket.glowLists[block].length === 0) bucket.glowKeys.push(block);
                                bucket.glowLists[block].push(pp);
                            }
                            const lv = colL[y] & 255;
                            const a = lut[lv];
                            if (a) {
                                if (bucket.darkLists[lv].length === 0) bucket.darkKeys.push(lv);
                                bucket.darkLists[lv].push(pp);
                            }
                        }
                    }
                }

                // Render Glow Tiles
                if (this.enableGlow) {
                    ctx.shadowBlur = 0; // optimized handling inside loop? no, batch shadow change
                    // Group by block to share shadow color
                    for (let i = 0; i < bucket.glowKeys.length; i++) {
                        const bid = bucket.glowKeys[i];
                        const list = bucket.glowLists[bid];
                        const tex = texArr ? texArr[bid] : this.textures.get(bid);
                        if (!tex) continue;

                        const color = BLOCK_COLOR[bid] || '#fff';
                        const bl = BL[bid];
                        ctx.shadowColor = color;
                        ctx.shadowBlur = bl * 2;

                        for (let j = 0; j < list.length; j++) {
                            const p = list[j];
                            ctx.drawImage(tex, (p >> 16) & 0xffff, p & 0xffff);
                        }
                    }
                    ctx.shadowBlur = 0;
                } else {
                    // No glow, just draw
                    for (let i = 0; i < bucket.glowKeys.length; i++) {
                        const bid = bucket.glowKeys[i];
                        const list = bucket.glowLists[bid];
                        const tex = texArr ? texArr[bid] : this.textures.get(bid);
                        if (!tex) continue;
                        for (let j = 0; j < list.length; j++) {
                            const p = list[j];
                            ctx.drawImage(tex, (p >> 16) & 0xffff, p & 0xffff);
                        }
                    }
                }

                // Render Dark Mask
                ctx.fillStyle = '#000';
                bucket.darkKeys.sort((a, b) => a - b);
                for (let i = 0; i < bucket.darkKeys.length; i++) {
                    const lv = bucket.darkKeys[i];
                    const list = bucket.darkLists[lv];
                    ctx.globalAlpha = lut[lv];
                    ctx.beginPath();
                    for (let j = 0; j < list.length; j++) {
                        const p = list[j];
                        ctx.rect((p >> 16) & 0xffff, p & 0xffff, ts, ts);
                    }
                    ctx.fill();
                }
                ctx.globalAlpha = 1;
            }

            renderHighlight(tx, ty, cam, inRange) {
                const ctx = this.ctx;
                const ts = CONFIG.TILE_SIZE;
                const sx = tx * ts - Math.ceil(cam.x);
                const sy = ty * ts - Math.ceil(cam.y);

                if (inRange) {
                    // 发光选框
                    ctx.shadowColor = '#ffeaa7';
                    ctx.shadowBlur = 15;
                    ctx.strokeStyle = 'rgba(255, 234, 167, 0.9)';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(sx, sy, ts, ts);
                    ctx.shadowBlur = 0;

                    ctx.fillStyle = 'rgba(255, 234, 167, 0.15)';
                    ctx.fillRect(sx, sy, ts, ts);
                } else {
                    ctx.strokeStyle = 'rgba(255, 100, 100, 0.4)';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(sx, sy, ts, ts);
                }
            }

            // Unified Post Process (incorporating Sprint Blur and Ultra Visuals)
            applyPostFX(time, depth01, reducedMotion) {
                // 1. Sprint Blur (Speed Lines)
                const amtRaw = (typeof this._speedBlurAmt === 'number') ? this._speedBlurAmt : 0;
                const amt = Math.max(0, Math.min(1, amtRaw));

                if (!reducedMotion && amt > 0.04) {
                    try {
                        const canvas = this.canvas;
                        const wPx = canvas.width | 0;
                        const hPx = canvas.height | 0;

                        let buf = this._speedBlurBuf;
                        if (!buf) {
                            const c = document.createElement('canvas');
                            const ctx = c.getContext('2d', { alpha: false });
                            buf = this._speedBlurBuf = { c, ctx };
                        }
                        if (buf.c.width !== wPx || buf.c.height !== hPx) {
                            buf.c.width = wPx;
                            buf.c.height = hPx;
                        }

                        const bctx = buf.ctx;
                        bctx.setTransform(1, 0, 0, 1, 0, 0);
                        bctx.globalCompositeOperation = 'copy';
                        bctx.globalAlpha = 1;

                        // Directional blur simulation
                        const blurPx = Math.min(2.6, 0.7 + amt * 1.4);
                        bctx.filter = `blur(${blurPx.toFixed(2)}px)`;
                        bctx.drawImage(canvas, 0, 0);
                        bctx.filter = 'none';

                        const ctx = this.ctx;
                        ctx.save();
                        ctx.setTransform(1, 0, 0, 1, 0, 0);

                        const dir = (this._speedBlurDirX === -1) ? -1 : 1;
                        const off = (-dir) * Math.min(18, (4 + amt * 11));

                        ctx.globalCompositeOperation = 'screen';
                        ctx.globalAlpha = Math.min(0.22, 0.06 + amt * 0.14);
                        ctx.drawImage(buf.c, off, 0);

                        ctx.globalAlpha = Math.min(0.18, 0.04 + amt * 0.10);
                        ctx.drawImage(buf.c, off * 0.5, 0);
                        ctx.restore();
                    } catch (_) { }
                }

                // 2. Ultra Visual FX Logic
                const gs = (window.GAME_SETTINGS || {});
                let mode = (typeof gs.__postFxModeEffective === 'number') ? gs.__postFxModeEffective : Number(gs.postFxMode);
                if (!Number.isFinite(mode)) mode = 2;
                if (mode <= 0) return;
                if (this.lowPower && mode > 1) mode = 1;

                const ctx = this.ctx;
                const canvas = this.canvas;
                const dpr = this.dpr || 1;
                const wPx = canvas.width;
                const hPx = canvas.height;

                const night = Utils.nightFactor(time);
                const dusk = Math.max(0, 1 - Math.abs(time - 0.72) / 0.08);
                const dawn = Math.max(0, 1 - Math.abs(time - 0.34) / 0.08);
                const warm = Utils.clamp(dawn * 0.9 + dusk * 1.1, 0, 1);
                const cool = Utils.clamp(night * 0.9, 0, 1);
