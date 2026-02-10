
                                (() => {
                                    const TU = window.TU || {};
                                    (function () {
                                        const __p = ({
                                            id: 'weather_canvas_fx_perf_v1',
                                            order: 60,
                                            description: "天气 Canvas 特效与性能优化（v1）",
                                            apply: () => {
                                                'use strict';
                                                const TU = window.TU || (window.TU = {});
                                                const Game = TU.Game;
                                                const Renderer = TU.Renderer;

                                                // ───────────────────────── CSS: add weather overlay canvas + disable expensive CSS filter on #game
                                                try {
                                                    const style = document.createElement('style');
                                                    style.setAttribute('data-tu-patch', 'weather_canvas_fx_perf_v1');
                                                    style.textContent = `
            #weatherfx{
              position: fixed;
              top: 0; left: 0;
              width: 100%; height: 100%;
              pointer-events: none;
              z-index: 55; /* above ambient particles (50), below UI (100) */
            }
            .reduced-motion #weatherfx{ display:none !important; }
            body.weather-on #game{ filter:none !important; }
          `;
                                                    document.head && document.head.appendChild(style);
                                                } catch (e) { if (typeof console !== 'undefined' && console.debug) console.debug('[Debug] Silently caught:', e); }

                                                // ───────────────────────── Ensure overlay canvas exists
                                                function ensureWeatherCanvas() {
                                                    // DOM-less offscreen canvas: avoid extra overlay layer & DOM reflow
                                                    let c = (window.TU && TU.__weatherfxCanvas) || null;
                                                    if (c) return c;
                                                    c = document.createElement('canvas'); // offscreen (NOT appended)
                                                    c.width = 1; c.height = 1;
                                                    if (window.TU) TU.__weatherfxCanvas = c;
                                                    return c;
                                                }

                                                // ───────────────────────── WeatherCanvasFX: fast rain/snow + lightning on a single canvas
                                                class WeatherCanvasFX {
                                                    constructor(canvas) {
                                                        this.canvas = canvas;
                                                        this.ctx = canvas ? canvas.getContext('2d', { alpha: true }) : null;

                                                        this._wPx = 0;
                                                        this._hPx = 0;
                                                        this._wCss = 0;
                                                        this._hCss = 0;
                                                        this._dpr = 1;

                                                        this._lastNow = 0;
                                                        this._hadFx = false;

                                                        // deterministic-ish RNG (xorshift32) to reduce Math.random usage during generation
                                                        this._seed = 0x12345678;

                                                        // Rain / snow pattern buffers (offscreen)
                                                        this._rain = { tile: null, ctx: null, pattern: null, size: 0, ox: 0, oy: 0 };
                                                        this._snow = { tile: null, ctx: null, pattern: null, size: 0, ox: 0, oy: 0 };

                                                        // Lightning flash gradient cache (depends on resolution only)
                                                        this._flash = { w: 0, h: 0, grad: null };

                                                        // Lightning bolt (reused object + typed array)
                                                        this._bolt = { pts: null, n: 0, life: 0, maxLife: 0 };
                                                        this._prevLightning = 0;
                                                    }

                                                    _rand01() {
                                                        // xorshift32
                                                        let x = this._seed | 0;
                                                        x ^= (x << 13);
                                                        x ^= (x >>> 17);
                                                        x ^= (x << 5);
                                                        this._seed = x | 0;
                                                        return ((x >>> 0) / 4294967296);
                                                    }

                                                    _makeOffscreenCanvas(w, h) {
                                                        try {
                                                            if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
                                                        } catch (e) { if (typeof console !== 'undefined' && console.debug) console.debug('[Debug] Silently caught:', e); }
                                                        const c = document.createElement('canvas');
                                                        c.width = w; c.height = h;
                                                        return c;
                                                    }

                                                    resizeLike(renderer) {
                                                        if (!renderer || !renderer.canvas || !this.canvas || !this.ctx) return;
                                                        const wPx = renderer.canvas.width | 0;
                                                        const hPx = renderer.canvas.height | 0;

                                                        // renderer.w/h are CSS px viewport units used by the game
                                                        const wCss = (renderer.w | 0) || Math.round(window.innerWidth || 0);
                                                        const hCss = (renderer.h | 0) || Math.round(window.innerHeight || 0);

                                                        const dpr = Number(renderer.dpr) || (window.devicePixelRatio || 1);

                                                        const sizeChanged = (this.canvas.width !== wPx) || (this.canvas.height !== hPx);

                                                        if (sizeChanged) {
                                                            this.canvas.width = wPx;
                                                            this.canvas.height = hPx;
                                                            this.canvas.style.width = wCss + 'px';
                                                            this.canvas.style.height = hCss + 'px';

                                                            this._wPx = wPx; this._hPx = hPx;
                                                            this._wCss = wCss; this._hCss = hCss;
                                                            this._dpr = dpr;

                                                            // invalidate caches on resize
                                                            this._rain.pattern = null;
                                                            this._rain.tile = null;
                                                            this._snow.pattern = null;
                                                            this._snow.tile = null;
                                                            this._flash.grad = null;
                                                            this._flash.w = 0; this._flash.h = 0;
                                                        } else {
                                                            this._wPx = wPx; this._hPx = hPx;
                                                            this._wCss = wCss; this._hCss = hCss;
                                                            this._dpr = dpr;
                                                        }

                                                        // Always render in pixel space (identity transform) for predictable pattern scrolling
                                                        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
                                                        // Keep smoothing on for nicer rain streaks; it mainly affects drawImage scaling.
                                                        try { this.ctx.imageSmoothingEnabled = true; } catch (e) { if (typeof console !== 'undefined' && console.debug) console.debug('[Debug] Silently caught:', e); }
                                                    }

                                                    _ensureRainPattern() {
                                                        const ctxOut = this.ctx;
                                                        if (!ctxOut) return;

                                                        // Choose tile size by DPR for fewer repeats
                                                        const tile = (this._dpr > 1.25) ? 512 : 256;
                                                        if (this._rain.pattern && this._rain.size === tile) return;

                                                        const c = this._makeOffscreenCanvas(tile, tile);
                                                        const g = c.getContext('2d', { alpha: true });
                                                        if (!g) return;

                                                        // draw rain streaks onto tile (one-time cost)
                                                        g.setTransform(1, 0, 0, 1, 0, 0);
                                                        g.clearRect(0, 0, tile, tile);

                                                        g.lineCap = 'round';
                                                        g.lineJoin = 'round';

                                                        const drops = Math.round((tile * tile) / 2600); // density knob (higher = denser)
                                                        const angle = 12 * Math.PI / 180;
                                                        const sx = Math.sin(angle);
                                                        const cy = Math.cos(angle);

                                                        // two passes: thin + thick for variation
                                                        for (let pass = 0; pass < 2; pass++) {
                                                            g.lineWidth = pass === 0 ? 1 : 2;
                                                            g.strokeStyle = pass === 0 ? 'rgba(180,220,255,0.55)' : 'rgba(180,220,255,0.35)';

                                                            const n = pass === 0 ? drops : Math.round(drops * 0.35);
                                                            for (let i = 0; i < n; i++) {
                                                                const x = this._rand01() * tile;
                                                                const y = this._rand01() * tile;

                                                                const len = (8 + this._rand01() * 22) * (pass === 0 ? 1 : 1.2);
                                                                const dx = sx * len;
                                                                const dy = cy * len;

                                                                const a = pass === 0
                                                                    ? (0.10 + this._rand01() * 0.22)
                                                                    : (0.06 + this._rand01() * 0.16);

                                                                g.globalAlpha = a;
                                                                g.beginPath();
                                                                g.moveTo(x, y);
                                                                g.lineTo(x + dx, y + dy);
                                                                g.stroke();
                                                            }
                                                        }

                                                        g.globalAlpha = 1;

                                                        // pattern is tied to output ctx
                                                        const p = ctxOut.createPattern(c, 'repeat');
                                                        if (!p) return;

                                                        this._rain.tile = c;
                                                        this._rain.ctx = g;
                                                        this._rain.pattern = p;
                                                        this._rain.size = tile;
                                                        this._rain.ox = 0;
                                                        this._rain.oy = 0;
                                                    }

                                                    _ensureSnowPattern() {
                                                        const ctxOut = this.ctx;
                                                        if (!ctxOut) return;

                                                        const tile = (this._dpr > 1.25) ? 384 : 256;
                                                        if (this._snow.pattern && this._snow.size === tile) return;

                                                        const c = this._makeOffscreenCanvas(tile, tile);
                                                        const g = c.getContext('2d', { alpha: true });
                                                        if (!g) return;

                                                        g.setTransform(1, 0, 0, 1, 0, 0);
                                                        g.clearRect(0, 0, tile, tile);

                                                        const flakes = Math.round((tile * tile) / 5200);
                                                        g.fillStyle = 'rgba(255,255,255,0.9)';
                                                        for (let i = 0; i < flakes; i++) {
                                                            const x = this._rand01() * tile;
                                                            const y = this._rand01() * tile;
                                                            const r = 0.8 + this._rand01() * 1.8;
                                                            const a = 0.10 + this._rand01() * 0.35;

                                                            g.globalAlpha = a;
                                                            g.beginPath();
                                                            g.arc(x, y, r, 0, Math.PI * 2);
                                                            g.fill();
                                                        }
                                                        g.globalAlpha = 1;

                                                        const p = ctxOut.createPattern(c, 'repeat');
                                                        if (!p) return;

                                                        this._snow.tile = c;
                                                        this._snow.ctx = g;
                                                        this._snow.pattern = p;
                                                        this._snow.size = tile;
                                                        this._snow.ox = 0;
                                                        this._snow.oy = 0;
                                                    }

                                                    drawRain(intensity, dtMs, isThunder) {
                                                        if (!this.ctx) return;
                                                        this._ensureRainPattern();
                                                        if (!this._rain.pattern) return;

                                                        const ctx = this.ctx;
                                                        const w = this._wPx, h = this._hPx;
                                                        const tile = this._rain.size | 0;

                                                        // Speed in px/s, scaled by DPR for consistent look
                                                        const base = (isThunder ? 1400 : 1100) * this._dpr;
                                                        const speed = base * (0.55 + 0.85 * Math.min(1, Math.max(0, intensity)));

                                                        const dt = (dtMs || 0) / 1000;
                                                        // scroll diagonally to match streak angle
                                                        this._rain.oy = (this._rain.oy + speed * dt) % tile;
                                                        this._rain.ox = (this._rain.ox + speed * 0.18 * dt) % tile;

                                                        const ox = this._rain.ox;
                                                        const oy = this._rain.oy;

                                                        // Density & alpha: draw one or two layers (still just 1–2 fillRect calls)
                                                        const aBase = (0.10 + 0.28 * intensity) * (isThunder ? 1.10 : 1.0);

                                                        ctx.globalCompositeOperation = 'source-over';
                                                        ctx.fillStyle = this._rain.pattern;

                                                        // Far layer (subtle)
                                                        ctx.globalAlpha = aBase * 0.55;
                                                        ctx.setTransform(1, 0, 0, 1, -ox * 0.65, -oy * 0.65);
                                                        ctx.fillRect(0, 0, w + tile, h + tile);

                                                        // Near layer
                                                        ctx.globalAlpha = aBase;
                                                        ctx.setTransform(1, 0, 0, 1, -ox, -oy);
                                                        ctx.fillRect(0, 0, w + tile, h + tile);

                                                        // Reset
                                                        ctx.setTransform(1, 0, 0, 1, 0, 0);
                                                        ctx.globalAlpha = 1;
                                                    }

                                                    drawSnow(intensity, dtMs) {
                                                        if (!this.ctx) return;
                                                        this._ensureSnowPattern();
                                                        if (!this._snow.pattern) return;

                                                        const ctx = this.ctx;
                                                        const w = this._wPx, h = this._hPx;
                                                        const tile = this._snow.size | 0;

                                                        const dt = (dtMs || 0) / 1000;

                                                        // Slow fall + gentle drift
                                                        const fall = (180 + 240 * intensity) * this._dpr;
                                                        const drift = (40 + 80 * intensity) * this._dpr;

                                                        this._snow.oy = (this._snow.oy + fall * dt) % tile;
                                                        this._snow.ox = (this._snow.ox + drift * dt) % tile;

                                                        const ox = this._snow.ox;
                                                        const oy = this._snow.oy;

                                                        const aBase = 0.08 + 0.22 * intensity;

                                                        ctx.globalCompositeOperation = 'source-over';
                                                        ctx.fillStyle = this._snow.pattern;

                                                        // Far layer (less alpha, slower)
                                                        ctx.globalAlpha = aBase * 0.50;
                                                        ctx.setTransform(1, 0, 0, 1, -ox * 0.55, -oy * 0.55);
                                                        ctx.fillRect(0, 0, w + tile, h + tile);

                                                        // Near layer
                                                        ctx.globalAlpha = aBase;
                                                        ctx.setTransform(1, 0, 0, 1, -ox, -oy);
                                                        ctx.fillRect(0, 0, w + tile, h + tile);

                                                        ctx.setTransform(1, 0, 0, 1, 0, 0);
                                                        ctx.globalAlpha = 1;
                                                    }

                                                    _ensureFlashGradient() {
                                                        const ctx = this.ctx;
                                                        if (!ctx) return;

                                                        const w = this._wPx | 0;
                                                        const h = this._hPx | 0;

                                                        if (this._flash.grad && this._flash.w === w && this._flash.h === h) return;

                                                        const cx = w * 0.5;
                                                        const cy = h * 0.45;
                                                        const r0 = Math.min(w, h) * 0.06;
                                                        const r1 = Math.max(w, h) * 0.95;

                                                        const g = ctx.createRadialGradient(cx, cy, r0, cx, cy, r1);
                                                        g.addColorStop(0, 'rgba(255,255,255,1)');
                                                        g.addColorStop(1, 'rgba(255,255,255,0)');

                                                        this._flash.grad = g;
                                                        this._flash.w = w;
                                                        this._flash.h = h;
                                                    }

                                                    _spawnBolt() {
                                                        const w = this._wPx | 0;
                                                        const h = this._hPx | 0;
                                                        if (w <= 0 || h <= 0) return;

                                                        const segs = 18;
                                                        if (!this._bolt.pts || this._bolt.pts.length !== segs * 2) {
                                                            this._bolt.pts = new Float32Array(segs * 2);
                                                        }

                                                        let x = w * (0.22 + this._rand01() * 0.56);
                                                        let y = -h * 0.05;
                                                        const stepY = (h * 1.08) / (segs - 1);
                                                        let amp = w * 0.10;

                                                        const pts = this._bolt.pts;
                                                        for (let i = 0; i < segs; i++) {
                                                            pts[i * 2] = x;
                                                            pts[i * 2 + 1] = y;

                                                            y += stepY;
                                                            x += (this._rand01() - 0.5) * amp;
                                                            amp *= 0.82;
                                                        }

                                                        this._bolt.n = segs;
                                                        this._bolt.maxLife = 120 + (this._rand01() * 80); // ms
                                                        this._bolt.life = this._bolt.maxLife;
                                                    }

                                                    drawLightning(lightning, dtMs) {
                                                        if (!this.ctx) return;
                                                        const ctx = this.ctx;
                                                        const w = this._wPx, h = this._hPx;

                                                        const f = Math.min(1, Math.max(0, Number(lightning) || 0));
                                                        if (f <= 0.001) return;

                                                        // Rising edge: spawn a visible bolt sometimes
                                                        if (f > 0.75 && this._prevLightning <= 0.12) {
                                                            this._spawnBolt();
                                                        }

                                                        // 1) Flash overlay (cheap): 2 fillRect, cached gradient, no string allocations per frame
                                                        this._ensureFlashGradient();

                                                        ctx.globalCompositeOperation = 'screen';

                                                        // Full-screen cool flash
                                                        ctx.globalAlpha = 0.10 + 0.34 * f;
                                                        ctx.fillStyle = 'rgb(210,230,255)';
                                                        ctx.fillRect(0, 0, w, h);

                                                        // Radial highlight
                                                        if (this._flash.grad) {
                                                            ctx.globalAlpha = 0.18 * f;
                                                            ctx.fillStyle = this._flash.grad;
                                                            ctx.fillRect(0, 0, w, h);
                                                        }

                                                        // 2) Bolt (optional, short-lived)
                                                        if (this._bolt && this._bolt.life > 0 && this._bolt.pts && this._bolt.n >= 2) {
                                                            const dt = Math.max(0, Number(dtMs) || 0);
                                                            this._bolt.life = Math.max(0, this._bolt.life - dt);

                                                            const life01 = this._bolt.maxLife > 0 ? (this._bolt.life / this._bolt.maxLife) : 0;
                                                            if (life01 > 0.001) {
                                                                const pts = this._bolt.pts;
                                                                const n = this._bolt.n;

                                                                ctx.lineCap = 'round';
                                                                ctx.lineJoin = 'round';

                                                                ctx.beginPath();
                                                                ctx.moveTo(pts[0], pts[1]);
                                                                for (let i = 1; i < n; i++) {
                                                                    const j = i * 2;
                                                                    ctx.lineTo(pts[j], pts[j + 1]);
                                                                }

                                                                const s = (this._dpr || 1);

                                                                // Outer glow-ish stroke (no shadowBlur to keep it cheap)
                                                                ctx.globalAlpha = 0.10 * f * life01;
                                                                ctx.strokeStyle = 'rgb(140,190,255)';
                                                                ctx.lineWidth = 5.5 * s;
                                                                ctx.stroke();

                                                                // Core stroke
                                                                ctx.globalAlpha = 0.70 * f * life01;
                                                                ctx.strokeStyle = 'rgb(255,255,255)';
                                                                ctx.lineWidth = 1.8 * s;
                                                                ctx.stroke();
                                                            }
                                                        }

                                                        // reset minimal states
                                                        ctx.globalAlpha = 1;
                                                        ctx.globalCompositeOperation = 'source-over';
                                                    }

                                                    render(weather, renderer) {
                                                        if (!this.ctx || !this.canvas) return;

                                                        // Respect reduced-motion: hide & clear once
                                                        const reduced = !!(document.documentElement && document.documentElement.classList.contains('reduced-motion'));
                                                        if (reduced) {
                                                            if (this._hadFx) {
                                                                this.ctx.setTransform(1, 0, 0, 1, 0, 0);
                                                                this.ctx.clearRect(0, 0, this._wPx || this.canvas.width, this._hPx || this.canvas.height);
                                                                this._hadFx = false;
                                                            }
                                                            return;
                                                        }

                                                        this.resizeLike(renderer);

                                                        const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
                                                        let dtMs = now - (this._lastNow || now);
                                                        if (!Number.isFinite(dtMs)) dtMs = 0;
                                                        if (dtMs < 0) dtMs = 0;
                                                        if (dtMs > 200) dtMs = 200;
                                                        this._lastNow = now;

                                                        const w = weather || {};
                                                        const type = (w.type || 'clear').toString();
                                                        const intensity = Number(w.intensity) || 0;
                                                        const lightning = Number(w.lightning) || 0;

                                                        // If nothing to draw, clear once then stop touching the canvas (saves fill-rate)
                                                        if (intensity <= 0.001 && lightning <= 0.001) {
                                                            if (this._hadFx) {
                                                                this.ctx.setTransform(1, 0, 0, 1, 0, 0);
                                                                this.ctx.clearRect(0, 0, this._wPx, this._hPx);
                                                                this._hadFx = false;
                                                            }
                                                            this._prevLightning = lightning;
                                                            return;
                                                        }

                                                        this._hadFx = true;

                                                        // Clear overlay each frame when active (transparent canvas)
                                                        const ctx = this.ctx;
                                                        ctx.setTransform(1, 0, 0, 1, 0, 0);
                                                        ctx.clearRect(0, 0, this._wPx, this._hPx);

                                                        if ((type === 'rain' || type === 'thunder') && intensity > 0.01) {
                                                            this.drawRain(intensity, dtMs, type === 'thunder');
                                                        } else if (type === 'snow' && intensity > 0.01) {
                                                            this.drawSnow(intensity, dtMs);
                                                        }

                                                        if (lightning > 0.001) {
                                                            this.drawLightning(lightning, dtMs);
                                                        } else if (this._bolt && this._bolt.life > 0) {
                                                            // Let bolt fade out naturally even if lightning param drops fast
                                                            this.drawLightning(Math.max(0, this._prevLightning * 0.8), dtMs);
                                                        }

                                                        this._prevLightning = lightning;
                                                    }
                                                }

                                                TU.WeatherCanvasFX = WeatherCanvasFX;

                                                // ───────────────────────── AmbientParticles: fix missing container + skip rain/snow DOM particles (we draw on canvas)
                                                            if (life01 > 0.001) {
                                                                const pts = this._bolt.pts;
                                                                const n = this._bolt.n;

                                                                ctx.lineCap = 'round';
                                                                ctx.lineJoin = 'round';

                                                                ctx.beginPath();
                                                                ctx.moveTo(pts[0], pts[1]);
                                                                for (let i = 1; i < n; i++) {
                                                                    const j = i * 2;
                                                                    ctx.lineTo(pts[j], pts[j + 1]);
                                                                }

                                                                const s = (this._dpr || 1);

                                                                // Outer glow-ish stroke (no shadowBlur to keep it cheap)
                                                                ctx.globalAlpha = 0.10 * f * life01;
                                                                ctx.strokeStyle = 'rgb(140,190,255)';
                                                                ctx.lineWidth = 5.5 * s;
                                                                ctx.stroke();

                                                                // Core stroke
                                                                ctx.globalAlpha = 0.70 * f * life01;
                                                                ctx.strokeStyle = 'rgb(255,255,255)';
                                                                ctx.lineWidth = 1.8 * s;
                                                                ctx.stroke();
                                                            }
                                                        }

                                                        // reset minimal states
                                                        ctx.globalAlpha = 1;
                                                        ctx.globalCompositeOperation = 'source-over';
                                                    }

                                                    render(weather, renderer) {
                                                        if (!this.ctx || !this.canvas) return;

                                                        // Respect reduced-motion: hide & clear once
                                                        const reduced = !!(document.documentElement && document.documentElement.classList.contains('reduced-motion'));
                                                        if (reduced) {
                                                            if (this._hadFx) {
                                                                this.ctx.setTransform(1, 0, 0, 1, 0, 0);
                                                                this.ctx.clearRect(0, 0, this._wPx || this.canvas.width, this._hPx || this.canvas.height);
                                                                this._hadFx = false;
                                                            }
                                                            return;
                                                        }

                                                        this.resizeLike(renderer);

                                                        const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
                                                        let dtMs = now - (this._lastNow || now);
                                                        if (!Number.isFinite(dtMs)) dtMs = 0;
                                                        if (dtMs < 0) dtMs = 0;
                                                        if (dtMs > 200) dtMs = 200;
                                                        this._lastNow = now;

                                                        const w = weather || {};
                                                        const type = (w.type || 'clear').toString();
                                                        const intensity = Number(w.intensity) || 0;
                                                        const lightning = Number(w.lightning) || 0;

                                                        // If nothing to draw, clear once then stop touching the canvas (saves fill-rate)
                                                        if (intensity <= 0.001 && lightning <= 0.001) {
                                                            if (this._hadFx) {
                                                                this.ctx.setTransform(1, 0, 0, 1, 0, 0);
                                                                this.ctx.clearRect(0, 0, this._wPx, this._hPx);
                                                                this._hadFx = false;
                                                            }
                                                            this._prevLightning = lightning;
                                                            return;
                                                        }

                                                        this._hadFx = true;

                                                        // Clear overlay each frame when active (transparent canvas)
                                                        const ctx = this.ctx;
                                                        ctx.setTransform(1, 0, 0, 1, 0, 0);
                                                        ctx.clearRect(0, 0, this._wPx, this._hPx);

                                                        if ((type === 'rain' || type === 'thunder') && intensity > 0.01) {
                                                            this.drawRain(intensity, dtMs, type === 'thunder');
                                                        } else if (type === 'snow' && intensity > 0.01) {
                                                            this.drawSnow(intensity, dtMs);
                                                        }

                                                        if (lightning > 0.001) {
                                                            this.drawLightning(lightning, dtMs);
                                                        } else if (this._bolt && this._bolt.life > 0) {
                                                            // Let bolt fade out naturally even if lightning param drops fast
                                                            this.drawLightning(Math.max(0, this._prevLightning * 0.8), dtMs);
                                                        }

                                                        this._prevLightning = lightning;
                                                    }
                                                }

                                                TU.WeatherCanvasFX = WeatherCanvasFX;

