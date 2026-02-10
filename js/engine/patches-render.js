                                                                if (mm && mm.offsetParent !== null) {
                                                                    const r = mm.getBoundingClientRect();
                                                                    safeRects.push(expandRect(r, 14));
                                                                }
                                                            } catch { }
                                                        };

                                                        this._refreshSafeZones = refreshSafeZones;
                                                        refreshSafeZones();
                                                        window.addEventListener('resize', refreshSafeZones, { passive: true });
                                                        window.addEventListener('orientationchange', refreshSafeZones, { passive: true });

                                                        const findTouch = (touchList, id) => {
                                                            if (!touchList) return null;
                                                            for (let i = 0; i < touchList.length; i++) {
                                                                const t = touchList[i];
                                                                if (t && t.identifier === id) return t;
                                                            }
                                                            return null;
                                                        };

                                                        const inSafeZone = (x, y) => {
                                                            for (let i = 0; i < safeRects.length; i++) {
                                                                if (hitRect(safeRects[i], x, y)) return true;
                                                            }
                                                            return false;
                                                        };

                                                        // ── Joystick：绑定自己的 touchId，避免与准星/按钮互相抢
                                                        this.joystick.touchId = null;

                                                        joystickEl.addEventListener('touchstart', (e) => {
                                                            // 防止页面滑动/缩放
                                                            e.preventDefault();

                                                            // 已经有 joystick touch 在控制时，不抢占
                                                            if (this.joystick.touchId !== null) return;

                                                            const t = e.changedTouches && e.changedTouches[0];
                                                            if (!t) return;

                                                            this.joystick.touchId = t.identifier;
                                                            this.joystick.active = true;

                                                            // joystick 基准点：固定在底座中心
                                                            const rect = joystickEl.getBoundingClientRect();
                                                            this.joystick.startX = rect.left + rect.width / 2;
                                                            this.joystick.startY = rect.top + rect.height / 2;

                                                            this._updateJoystick(t.clientX, t.clientY, thumbEl);
                                                        }, { passive: false });

                                                        joystickEl.addEventListener('touchmove', (e) => {
                                                            e.preventDefault();
                                                            if (!this.joystick.active || this.joystick.touchId === null) return;

                                                            const t = findTouch(e.touches, this.joystick.touchId) || findTouch(e.changedTouches, this.joystick.touchId);
                                                            if (!t) return;

                                                            this._updateJoystick(t.clientX, t.clientY, thumbEl);
                                                        }, { passive: false });

                                                        const endJoy = (e) => {
                                                            e.preventDefault();
                                                            if (this.joystick.touchId === null) return;

                                                            // 只有结束了 joystick 自己的 touch 才归零
                                                            const ended = findTouch(e.changedTouches, this.joystick.touchId);
                                                            if (!ended) return;

                                                            this.joystick.active = false;
                                                            this.joystick.touchId = null;
                                                            this.joystick.dx = 0;
                                                            this.joystick.dy = 0;
                                                            thumbEl.style.transform = 'translate(-50%, -50%)';
                                                        };

                                                        joystickEl.addEventListener('touchend', endJoy, { passive: false });
                                                        joystickEl.addEventListener('touchcancel', endJoy, { passive: false });

                                                        // ── Buttons：沿用原有逻辑
                                                        this._setupButton('btn-jump', 'jump');
                                                        this._setupButton('btn-mine', 'mine');
                                                        this._setupButton('btn-place', 'place');

                                                        // ── Crosshair：允许“设定一次目标后松手继续挖/放”
                                                        const setCrosshairState = (state) => {
                                                            if (!crosshairEl) return;
                                                            crosshairEl.classList.toggle('crosshair-active', state === 'active');
                                                            crosshairEl.classList.toggle('crosshair-idle', state === 'idle');
                                                            if (state === 'hidden') crosshairEl.classList.remove('crosshair-active', 'crosshair-idle');
                                                        };

                                                        canvas.addEventListener('touchstart', (e) => {
                                                            // 阻止双指缩放/滚动（尤其 iOS）
                                                            e.preventDefault();

                                                            if (!e.changedTouches) return;

                                                            // 如果当前没有正在拖动的准星，就从新 touch 中挑一个合适的
                                                            if (this.targetTouchId === null) {
                                                                for (let i = 0; i < e.changedTouches.length; i++) {
                                                                    const t = e.changedTouches[i];
                                                                    if (!t) continue;

                                                                    // 过滤掉靠近摇杆/按钮/小地图的触点，防误触
                                                                    if (inSafeZone(t.clientX, t.clientY)) continue;

                                                                    this.targetTouchId = t.identifier;
                                                                    if (crosshairEl) {
                                                                        this._updateCrosshair(t.clientX, t.clientY, crosshairEl);
                                                                        // 第一次设定目标：开启 hasTarget
                                                                        this.crosshair.visible = true;
                                                                        setCrosshairState('active');
                                                                    }
                                                                    break;
                                                                }
                                                            } else {
                                                                // 已在拖动：不抢占
                                                            }
                                                        }, { passive: false });

                                                        canvas.addEventListener('touchmove', (e) => {
                                                            e.preventDefault();
                                                            if (this.targetTouchId === null) return;

                                                            const t = findTouch(e.touches, this.targetTouchId) || findTouch(e.changedTouches, this.targetTouchId);
                                                            if (!t || !crosshairEl) return;

                                                            this._updateCrosshair(t.clientX, t.clientY, crosshairEl);
                                                            // 正在拖动时保持 active
                                                            if (this.crosshair.visible) setCrosshairState('active');
                                                        }, { passive: false });

                                                        const endCross = (e) => {
                                                            e.preventDefault();
                                                            if (this.targetTouchId === null) return;

                                                            const ended = findTouch(e.changedTouches, this.targetTouchId);
                                                            if (!ended) return;

                                                            this.targetTouchId = null;
                                                            // 松手后：保留目标点，但变为 idle（更不遮挡）
                                                            if (this.crosshair.visible) setCrosshairState('idle');
                                                        };

                                                        canvas.addEventListener('touchend', endCross, { passive: false });
                                                        canvas.addEventListener('touchcancel', endCross, { passive: false });
                                                    };

                                                    // 自适应摇杆半径（maxDist 与 UI 尺寸匹配）
                                                    TouchController.prototype._updateJoystick = function (tx, ty, thumbEl) {
                                                        let dx = tx - this.joystick.startX;
                                                        let dy = ty - this.joystick.startY;

                                                        const maxDist = (typeof this._joyMaxDist === 'number' && isFinite(this._joyMaxDist)) ? this._joyMaxDist : 50;
                                                        const dist = Math.sqrt(dx * dx + dy * dy);

                                                        if (dist > maxDist) {
                                                            dx = dx / dist * maxDist;
                                                            dy = dy / dist * maxDist;
                                                        }

                                                        this.joystick.dx = dx / maxDist;
                                                        this.joystick.dy = dy / maxDist;

                                                        thumbEl.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
                                                    };

                                                    // Crosshair：只做坐标更新（与原逻辑兼容）
                                                    TouchController.prototype._updateCrosshair = function (x, y, el) {
                                                        this.crosshair.x = x;
                                                        this.crosshair.y = y;
                                                        // 40x40
                                                        el.style.left = (x - 20) + 'px';
                                                        el.style.top = (y - 20) + 'px';
                                                    };
                                                }

                                                // ───────────────────────── Patch Renderer：缓存天空渐变 + 星星更省 + 视差降采样 ─────────────────────────
                                                if (Renderer && Renderer.prototype) {
                                                    const origResize = Renderer.prototype.resize;
                                                    Renderer.prototype.resize = function () {
                                                        origResize.call(this);
                                                        // 尺寸变化时清空缓存
                                                        this._skyGrad = null;
                                                        this._skyBucket = -1;
                                                        this._skyGradH = 0;

                                                        this._stars = null;
                                                        this._starsW = 0;
                                                        this._starsH = 0;
                                                        this._starsCount = 0;

                                                        this._parallaxGrad = null;
                                                        this._parallaxGradH = 0;
                                                    };

                                                    Renderer.prototype._ensureStars = function () {
                                                        const want = (this.lowPower ? 40 : 80);
                                                        if (this._stars && this._starsCount === want && this._starsW === this.w && this._starsH === this.h) return;

                                                        const stars = new Array(want);
                                                        const w = Math.max(1, this.w);
                                                        const h = Math.max(1, this.h * 0.5);

                                                        // 保持“看起来随机但稳定”的分布：沿用原有的取模方案
                                                        for (let i = 0; i < want; i++) {
                                                            const sx = (12345 * i * 17) % w;
                                                            const sy = (12345 * i * 31) % h;
                                                            const size = (i % 3) + 1;
                                                            const phase = i * 1.73;
                                                            const baseA = 0.55 + (i % 7) * 0.05; // 0.55~0.85
                                                            stars[i] = { x: sx, y: sy, s: size, p: phase, a: baseA };
                                                        }

                                                        this._stars = stars;
                                                        this._starsW = this.w;
                                                        this._starsH = this.h;
                                                        this._starsCount = want;
                                                    };

                                                    Renderer.prototype._getSkyBucket = function (time) {
                                                        if (time < 0.2) return 0;      // night
                                                        if (time < 0.3) return 1;      // dawn
                                                        if (time < 0.7) return 2;      // day
                                                        if (time < 0.8) return 3;      // dusk
                                                        return 0;                      // night
                                                    };

                                                    Renderer.prototype._ensureSkyGradient = function (bucket) {
                                                        if (this._skyGrad && this._skyBucket === bucket && this._skyGradH === this.h) return;

                                                        const ctx = this.ctx;
                                                        let colors;
                                                        if (bucket === 0) colors = ['#0c0c1e', '#1a1a2e', '#16213e'];
                                                        else if (bucket === 1) colors = ['#1a1a2e', '#4a1942', '#ff6b6b'];
                                                        else if (bucket === 2) colors = ['#74b9ff', '#81ecec', '#dfe6e9'];
                                                        else colors = ['#6c5ce7', '#fd79a8', '#ffeaa7'];

                                                        const grad = ctx.createLinearGradient(0, 0, 0, this.h * 0.7);
                                                        grad.addColorStop(0, colors[0]);
                                                        grad.addColorStop(0.5, colors[1]);
                                                        grad.addColorStop(1, colors[2]);

                                                        this._skyGrad = grad;
                                                        this._skyBucket = bucket;
                                                        this._skyGradH = this.h;
                                                    };

                                                    // 覆写天空渲染：同视觉，少分配/少字符串/少 arc
                                                    Renderer.prototype.renderSky = function (cam, time) {
                                                        const ctx = this.ctx;

                                                        // —— 平滑天空过渡：在关键时间点附近，用两套渐变叠加做 smoothstep 淡入淡出 ——
                                                        const transitions = this._skyTransitions || (this._skyTransitions = [
                                                            { at: 0.2, from: 0, to: 1, w: 0.04 }, // night -> dawn
                                                            { at: 0.3, from: 1, to: 2, w: 0.04 }, // dawn -> day
                                                            { at: 0.7, from: 2, to: 3, w: 0.04 }, // day -> dusk
                                                            { at: 0.8, from: 3, to: 0, w: 0.04 }  // dusk -> night
                                                        ]);

                                                        let bucketA = this._getSkyBucket(time);
                                                        let bucketB = bucketA;
                                                        let blend = 0;

                                                        for (let i = 0; i < transitions.length; i++) {
                                                            const tr = transitions[i];
                                                            const a = tr.at - tr.w, b = tr.at + tr.w;
                                                            if (time >= a && time <= b) {
                                                                bucketA = tr.from;
                                                                bucketB = tr.to;
                                                                blend = Utils.smoothstep(a, b, time);
                                                                break;
                                                            }
                                                        }

                                                        // 底层渐变
                                                        this._ensureSkyGradient(bucketA);
                                                        const gradA = this._skyGrad;
                                                        ctx.fillStyle = gradA;
                                                        ctx.fillRect(0, 0, this.w, this.h);

                                                        // 叠加渐变（仅在过渡期）
                                                        if (blend > 0.001 && bucketB !== bucketA) {
                                                            this._ensureSkyGradient(bucketB);
                                                            const gradB = this._skyGrad;
                                                            ctx.save();
                                                            ctx.globalAlpha = blend;
                                                            ctx.fillStyle = gradB;
                                                            ctx.fillRect(0, 0, this.w, this.h);
                                                            ctx.restore();
                                                        }

                                                        const night = Utils.nightFactor(time);

                                                        // 星星：夜晚按 nightFactor 平滑淡入淡出（避免“瞬间出现/消失”）
                                                        if (night > 0.01) {
                                                            const baseAlpha = night * 0.8;
                                                            this._ensureStars();
                                                            const stars = this._stars;
                                                            const now = Date.now() * 0.003;

                                                            ctx.save();
                                                            for (let i = 0; i < stars.length; i++) {
                                                                const s = stars[i];
                                                                const twinkle = Math.sin(now + i) * 0.3 + 0.7;
                                                                ctx.globalAlpha = baseAlpha * twinkle;
                                                                ctx.fillStyle = '#fff';
                                                                // fillRect 比 arc 省
                                                                ctx.fillRect(s.x, s.y, s.size, s.size);
                                                            }
                                                            ctx.restore();
                                                        }

                                                        // 太阳/月亮：使用透明度做平滑交接
                                                        const cx = this.w * ((time + 0.25) % 1);
                                                        const cy = 80 + Math.sin(((time + 0.25) % 1) * Math.PI) * -60;

                                                        const sunAlpha = Utils.smoothstep(0.18, 0.26, time) * (1 - Utils.smoothstep(0.74, 0.82, time));
                                                        const moonAlpha = night;

                                                        if (sunAlpha > 0.001) {
                                                            ctx.save();
                                                            ctx.globalAlpha = sunAlpha;

                                                            const sunGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 60);
                                                            sunGlow.addColorStop(0, 'rgba(255, 255, 200, 1)');
                                                            sunGlow.addColorStop(0.2, 'rgba(255, 220, 100, 0.8)');
                                                            sunGlow.addColorStop(0.5, 'rgba(255, 180, 50, 0.3)');
                                                            sunGlow.addColorStop(1, 'rgba(255, 150, 0, 0)');
                                                            ctx.fillStyle = sunGlow;
                                                            ctx.beginPath();
                                                            ctx.arc(cx, cy, 60, 0, Math.PI * 2);
                                                            ctx.fill();

                                                            ctx.fillStyle = '#FFF';
                                                            ctx.beginPath();
                                                            ctx.arc(cx, cy, 25, 0, Math.PI * 2);
                                                            ctx.fill();

                                                            ctx.restore();
                                                        }

                                                        if (moonAlpha > 0.001) {
                                                            ctx.save();
                                                            ctx.globalAlpha = moonAlpha;

                                                            const moonGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 40);
                                                            moonGlow.addColorStop(0, 'rgba(230, 230, 255, 1)');
                                                            moonGlow.addColorStop(0.5, 'rgba(200, 200, 255, 0.3)');
                                                            moonGlow.addColorStop(1, 'rgba(150, 150, 255, 0)');
                                                            ctx.fillStyle = moonGlow;
                                                            ctx.beginPath();
                                                            ctx.arc(cx, cy, 40, 0, Math.PI * 2);
                                                            ctx.fill();

                                                            ctx.fillStyle = '#E8E8F0';
                                                            ctx.beginPath();
                                                            ctx.arc(cx, cy, 18, 0, Math.PI * 2);
                                                            ctx.fill();

                                                            ctx.fillStyle = 'rgba(200, 200, 210, 0.5)';
                                                            ctx.beginPath();
                                                            ctx.arc(cx - 5, cy - 3, 4, 0, Math.PI * 2);
                                                            ctx.arc(cx + 6, cy + 5, 3, 0, Math.PI * 2);
                                                            ctx.fill();

                                                            ctx.restore();
                                                        }
                                                    };

                                                    // 覆写视差：低功耗时减少采样点/层数（更省）
                                                    Renderer.prototype.renderParallax = function (cam, time) {
                                                        renderParallaxMountains(this, cam, time);
                                                    };

                                                    // 覆写世界渲染：暗角 LUT 只在 levels 变化时构建（每帧少 256 次循环）
                                                    const buildDarkLUT = (levels, nightBonus) => {
                                                        const lut = new Float32Array(256);
                                                        for (let i = 0; i < 256; i++) {
                                                            const darkness = 1 - (i / levels);
                                                            let totalDark = darkness * 0.6 + nightBonus;
                                                            if (totalDark > 0.88) totalDark = 0.88;
                                                            lut[i] = (totalDark > 0.05) ? totalDark : 0;
                                                        }
                                                        return lut;
                                                    };

                                                    Renderer.prototype.renderWorld = function (world, cam, time) {
                                                        const ctx = this.ctx;
                                                        const ts = CONFIG.TILE_SIZE;

                                                        let startX = Math.floor(cam.x / ts) - 1;
                                                        let startY = Math.floor(cam.y / ts) - 1;
                                                        let endX = startX + Math.ceil(this.w / ts) + 2;
                                                        let endY = startY + Math.ceil(this.h / ts) + 2;

                                                        if (startX < 0) startX = 0;
                                                        if (startY < 0) startY = 0;
                                                        if (endX >= world.w) endX = world.w - 1;
                                                        if (endY >= world.h) endY = world.h - 1;

                                                        const tiles = world.tiles;
                                                        const light = world.light;

                                                        const camCeilX = Math.ceil(cam.x);
                                                        const camCeilY = Math.ceil(cam.y);

                                                        const night = Utils.nightFactor(time);
                                                        const qNight = Math.round(night * 100) / 100;
                                                        const levels = CONFIG.LIGHT_LEVELS;

                                                        if (!this._darkAlphaLUTDay || this._darkAlphaLUTLevels !== levels) {
                                                            this._darkAlphaLUTLevels = levels;
                                                            this._darkAlphaLUTDay = buildDarkLUT(levels, 0);
                                                            this._darkAlphaLUTNight = buildDarkLUT(levels, 0.2);
                                                        }
                                                        let lut = this._darkAlphaLUTBlend;
                                                        if (!lut || this._darkAlphaLUTBlendNight !== qNight || this._darkAlphaLUTBlendLevels !== levels) {
                                                            lut = this._darkAlphaLUTBlend || (this._darkAlphaLUTBlend = new Float32Array(256));
                                                            for (let i = 0; i < 256; i++) {
                                                                lut[i] = this._darkAlphaLUTDay[i] + (this._darkAlphaLUTNight[i] - this._darkAlphaLUTDay[i]) * qNight;
                                                            }
                                                            this._darkAlphaLUTBlendNight = qNight;
                                                            this._darkAlphaLUTBlendLevels = levels;
                                                        }

                                                        ctx.globalAlpha = 1;
                                                        ctx.fillStyle = 'rgb(10,5,20)';

                                                        for (let x = startX; x <= endX; x++) {
                                                            const colTiles = tiles[x];
                                                            const colLight = light[x];
                                                            for (let y = startY; y <= endY; y++) {
                                                                const block = colTiles[y];
                                                                if (block === BLOCK.AIR) continue;

                                                                const tex = this.textures.get(block);
                                                                const px = x * ts - camCeilX;
                                                                const py = y * ts - camCeilY;

                                                                const bl = BLOCK_LIGHT[block];
                                                                if (this.enableGlow && bl > 5 && tex) {
                                                                    ctx.save();
                                                                    ctx.shadowColor = BLOCK_COLOR[block];
                                                                    ctx.shadowBlur = bl * 2;
                                                                    ctx.drawImage(tex, px, py);
                                                                    ctx.restore();
                                                                } else if (tex) {
                                                                    ctx.drawImage(tex, px, py);
                                                                }

                                                                const a = lut[colLight[y]];
                                                                if (a) {
                                                                    ctx.globalAlpha = a;
                                                                    ctx.fillRect(px, py, ts, ts);
                                                                    ctx.globalAlpha = 1;
                                                                }
                                                            }
                                                        }

                                                        ctx.globalAlpha = 1;
                                                    };
                                                    // ───────────────────────── PostFX：色彩分级 / 氛围雾化 / 暗角 / 电影颗粒 ─────────────────────────
                                                    // 目标：在不引入昂贵像素级后处理（getImageData）的前提下，显著提升“质感”和层次
                                                    Renderer.prototype._ensureGrain = function () {
                                                        const size = 128; // 小纹理 + repeat，成本低
                                                        if (!this._grainCanvas) {
                                                            this._grainCanvas = document.createElement('canvas');
                                                            this._grainCanvas.width = size;
                                                            this._grainCanvas.height = size;
                                                            this._grainCtx = this._grainCanvas.getContext('2d', { alpha: true });
                                                            this._grainFrame = 0;
                                                            this._grainPattern = null;
                                                        }
                                                        // 每隔若干帧刷新一次噪声，避免每帧随机成本
                                                        const step = this.lowPower ? 18 : 10;
                                                        this._grainFrame = (this._grainFrame || 0) + 1;
                                                        if (!this._grainPattern || (this._grainFrame % step) === 0) {
                                                            const g = this._grainCtx;
                                                            const img = g.createImageData(size, size);
                                                            const d = img.data;
                                                            // LCG 伪随机（比 Math.random 更稳定更快）
                                                            let seed = (this._grainSeed = ((this._grainSeed || 1234567) * 1664525 + 1013904223) >>> 0);
                                                            for (let i = 0; i < d.length; i += 4) {
                                                                seed = (seed * 1664525 + 1013904223) >>> 0;
                                                                const v = (seed >>> 24); // 0..255
                                                                d[i] = v; d[i + 1] = v; d[i + 2] = v;
                                                                // 噪声 alpha：偏低，避免“脏屏”
                                                                d[i + 3] = 24 + (v & 15); // 24..39
                                                            }
                                                            g.putImageData(img, 0, 0);
                                                            this._grainPattern = this.ctx.createPattern(this._grainCanvas, 'repeat');
                                                        }
                                                    };

                                                    Renderer.prototype.applyPostFX = function (time, depth01, reducedMotion) {
                                                        const ctx = this.ctx;
                                                        if (!ctx || reducedMotion) return;
                                                        const w = this.w, h = this.h;
                                                        const lowFx = !!this.lowPower;

                                                        // Precompute vignette once per resize
                                                        if (!this._vignetteFx || this._vignetteFx.w !== w || this._vignetteFx.h !== h) {
                                                            const vc = document.createElement('canvas');
                                                            vc.width = Math.max(1, w);
                                                            vc.height = Math.max(1, h);
                                                            const vctx = vc.getContext('2d', { alpha: true });
                                                            const r = Math.max(w, h) * 0.75;
                                                            const g = vctx.createRadialGradient(w * 0.5, h * 0.5, r * 0.15, w * 0.5, h * 0.5, r);
                                                            g.addColorStop(0, 'rgba(0,0,0,0)');
                                                            g.addColorStop(1, 'rgba(0,0,0,1)');
                                                            vctx.fillStyle = g;
                                                            vctx.fillRect(0, 0, w, h);
                                                            this._vignetteFx = { c: vc, w, h };
                                                        }

                                                        // Ensure grain pattern exists (generated once)
                                                        if (!this._grainPattern && this._ensureGrain) this._ensureGrain();

                                                        const night = Utils.nightFactor(time);
                                                        const dusk = Math.max(0, 1 - Math.abs(time - 0.72) / 0.08);
                                                        const dawn = Math.max(0, 1 - Math.abs(time - 0.34) / 0.08);

                                                        // Cheap “grading” using only a few translucent overlays (no ctx.filter)
                                                        const warmA = Utils.clamp(dawn * 0.22 + dusk * 0.30, 0, 0.35);
                                                        const coolA = Utils.clamp(night * 0.28, 0, 0.35);
                                                        const fogA = Utils.clamp((depth01 * 0.10) + (night * 0.06), 0, 0.20);

                                                        ctx.save();

                                                        if (warmA > 0.001) {
                                                            ctx.globalAlpha = warmA;
                                                            ctx.fillStyle = 'rgba(255,180,90,1)';
                                                            ctx.fillRect(0, 0, w, h);
                                                        }
                                                        if (coolA > 0.001) {
                                                            ctx.globalAlpha = coolA;
                                                            ctx.fillStyle = 'rgba(90,150,255,1)';
                                                            ctx.fillRect(0, 0, w, h);
                                                        }
                                                        if (fogA > 0.001) {
                                                            ctx.globalAlpha = fogA;
                                                            ctx.fillStyle = 'rgba(24,28,36,1)';
                                                            ctx.fillRect(0, 0, w, h);
                                                        }

                                                        // Vignette
                                                        ctx.globalAlpha = (lowFx ? 0.16 : 0.24) + night * (lowFx ? 0.08 : 0.12);
                                                        ctx.drawImage(this._vignetteFx.c, 0, 0);

                                                        // Subtle grain (skip on low power)
                                                        if (this._grainPattern && !lowFx) {
                                                            ctx.globalAlpha = 0.045;
                                                            ctx.fillStyle = this._grainPattern;
                                                            ctx.fillRect(0, 0, w, h);
                                                        }

                                                        ctx.restore();
                                                    };

                                                }

                                                // ───────────────────────── Patch Game.render：修复未定义变量 + 减少重复取值 ─────────────────────────
                                                if (Game && Game.prototype) {
                                                    Game.prototype.render = function () {
                                                        // 防御性空值检查
                                                        if (!this.renderer) {
                                                            console.warn('[Renderer.render] Renderer not initialized');
                                                            return;
                                                        }
                                                        if (!this.world) {
                                                            console.warn('[Renderer.render] World not available');
                                                            return;
                                                        }

                                                        const cam = this._renderCamera || this.camera;
                                                        const renderer = this.renderer;
                                                        const settings = this.settings || {};
                                                        const p = this.player;
                                                        const ts = CONFIG.TILE_SIZE;

                                                        // 防御性相机检查
                                                        if (!cam || typeof cam.x !== 'number' || typeof cam.y !== 'number') {
                                                            console.warn('[Renderer.render] Invalid camera');
                                                            return;
                                                        }

                                                        renderer.clear();
                                                        renderer.renderSky(cam, this.timeOfDay);

                                                        // ── Mountain Rendering Patch v2 ──
                                                        // Single authoritative call site for mountains.
                                                        // Respects the user bgMountains toggle and autoQuality
                                                        // effective flag, but no longer skipped by
                                                        // reducedMotion / low-perf — those only affected the
                                                        // old parallax *scrolling* which is not relevant to
                                                        // the static mountain backdrop.
                                                        {
                                                            const gs = window.GAME_SETTINGS || settings;
                                                            const mtEnabled = (gs.bgMountains !== false) && (gs.__bgMountainsEffective !== false);
                                                            if (mtEnabled && typeof renderParallaxMountains === 'function') {
                                                                renderParallaxMountains(renderer, cam, this.timeOfDay);
                                                            }
                                                        }

                                                        renderer.renderWorld(this.world, cam, this.timeOfDay);

                                                        // 掉落物 / 粒子 / 玩家
                                                        this.droppedItems.render(renderer.ctx, cam, renderer.textures, this.timeOfDay);
                                                        if (settings.particles) this.particles.render(renderer.ctx, cam);
                                                        p.render(renderer.ctx, cam);

                                                        // 高亮：取当前输入（移动端优先 touch 输入）
                                                        const input = (this.isMobile && this.touchController && this._latestTouchInput) ? this._latestTouchInput : this.input;

                                                        const sx = (typeof input.targetX === 'number') ? input.targetX : input.mouseX;
                                                        const sy = (typeof input.targetY === 'number') ? input.targetY : input.mouseY;

                                                        const safeSX = Number.isFinite(sx) ? sx : (p.cx() - cam.x);
                                                        const safeSY = Number.isFinite(sy) ? sy : (p.cy() - cam.y);

                                                        const worldX = safeSX + cam.x;
                                                        const worldY = safeSY + cam.y;

                                                        let tileX = Math.floor(worldX / ts);
                                                        let tileY = Math.floor(worldY / ts);
                                                        if (this.isMobile && settings.aimAssist) {
                                                            tileX = Math.floor((worldX + ts * 0.5) / ts);
                                                            tileY = Math.floor((worldY + ts * 0.5) / ts);
                                                        }

                                                        const dx = worldX - p.cx();
                                                        const dy = worldY - p.cy();
                                                        const reachPx = CONFIG.REACH_DISTANCE * ts;
                                                        const inRange = (dx * dx + dy * dy) <= (reachPx * reachPx);

                                                        if (tileX >= 0 && tileX < this.world.w && tileY >= 0 && tileY < this.world.h) {
                                                            renderer.renderHighlight(tileX, tileY, cam, inRange);
                                                        }

                                                        // PostFX：提升整体质感（色彩分级/雾化/暗角/颗粒），默认开启
                                                        if (renderer.applyPostFX) {
                                                            const depth01 = Utils.clamp((p.y + p.h * 0.5) / (this.world.h * ts), 0, 1);
                                                            renderer.applyPostFX(this.timeOfDay, depth01, !!settings.reducedMotion);
                                                        }

                                                        // 小地图（折叠时完全跳过）
                                                        const minimapVisible = !(window.TU && window.TU.MINIMAP_VISIBLE === false);
                                                        if (settings.minimap && minimapVisible && this.minimap) {
                                                            this.minimap.update();
                                                            this.minimap.render(p.x, p.y);
                                                        }
                                                    };
                                                }
                                            }
                                        }); try { __p && __p.apply && __p.apply(); } catch (e) { console.warn('[TU merge] patch apply failed', __p && __p.id, e); }
                                    })();
                                })();
                            
