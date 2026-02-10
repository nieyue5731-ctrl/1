                const f = x - i;
                const u = smooth(f);
                const a = hash(((i + seed) | 0));
                const b = hash(((i + 1 + seed) | 0));
                return a + (b - a) * u; // -1..1
            };

            const fbm = (x, seed, oct = 4) => {
                let v = 0;
                let amp = 0.55;
                let freq = 1;
                for (let o = 0; o < oct; o++) {
                    v += amp * noise1(x * freq, seed + o * 101);
                    freq *= 2;
                    amp *= 0.5;
                }
                return v; // ~[-1,1]
            };

            // ridged fbm：更“尖”的山脊
            const ridged = (x, seed, oct = 4) => {
                let v = 0;
                let amp = 0.65;
                let freq = 1;
                for (let o = 0; o < oct; o++) {
                    let n = noise1(x * freq, seed + o * 131);
                    n = 1 - Math.abs(n);
                    v += (n * n) * amp;
                    freq *= 2;
                    amp *= 0.55;
                }
                return v; // ~[0,1]
            };

            return { fbm, ridged };
        })();

        function renderParallaxMountains(renderer, cam, time = 0.5) {
            const ctx = renderer.ctx;
            const w = (renderer.w | 0);
            const h = (renderer.h | 0);
            if (!ctx || w <= 0 || h <= 0) return;

            // 可选：用户主动关闭“背景墙山脉”或性能管理器临时禁用
            try {
                const gs = window.GAME_SETTINGS || {};
                if (gs.bgMountains === false) return;
                if (gs.__bgMountainsEffective === false) return;
            } catch (e) { if (typeof console !== 'undefined' && console.debug) console.debug('[Debug] Silently caught:', e); }

            // ───────────────────────── Static helpers（只初始化一次） ─────────────────────────
            const PM = renderParallaxMountains.__PM || (renderParallaxMountains.__PM = (() => {
                const CHUNK_W = 512;   // 山脉“横向缓存块”宽度（px）
                const OVERLAP = 64;    // 两侧重叠，避免 chunk 拼接处的描边断裂
                const PAD_CHUNKS = 2;  // 视野外多缓存几个 chunk，减少移动时抖动/瞬时生成

                const makeCanvas = (cw, ch) => {
                    let c = null;
                    // OffscreenCanvas：更快且不进 DOM（不支持会回退）
                    if (typeof OffscreenCanvas !== 'undefined') {
                        try { c = new OffscreenCanvas(cw, ch); } catch (_) { c = null; }
                    }
                    if (!c) {
                        c = document.createElement('canvas');
                    }
                    // 无论 OffscreenCanvas / Canvas 都支持 width/height
                    c.width = cw;
                    c.height = ch;
                    return c;
                };

                const getCtx = (c) => {
                    try { return c.getContext('2d', { alpha: true }); } catch (e) {
                        try { return c.getContext('2d', { willReadFrequently: true }); } catch (_) { return null; }
                    }
                };

                return { CHUNK_W, OVERLAP, PAD_CHUNKS, makeCanvas, getCtx };
            })());

            const low = !!renderer.lowPower;
            const step = low ? 24 : 12;
            const layers = low ? PARALLAX_LAYERS.slice(0, 3) : PARALLAX_LAYERS;

            // ── Mountain Rendering Patch v2: deterministic theme derivation ──
            // Always derive the theme directly from the time value, never from
            // renderer._getSkyBucket which has multiple conflicting implementations
            // (class returns t*100, patch returns 0-3). This guarantees theme
            // is always correct regardless of which _getSkyBucket is active.
            const theme = (time < 0.2) ? 'night'
                        : (time < 0.3) ? 'dawn'
                        : (time < 0.7) ? 'day'
                        : (time < 0.8) ? 'dusk'
                        : 'night';

            // ───────────────────────── Cache（按主题/分辨率/低功耗重建） ─────────────────────────
            const cacheKey = theme + '|' + h + '|' + (low ? 1 : 0) + '|' + step + '|' + layers.length;
            let cache = renderer._parallaxMountainCache;
            if (!cache || cache.key !== cacheKey) {
                cache = renderer._parallaxMountainCache = {
                    key: cacheKey,
                    theme,
                    h,
                    low,
                    step,
                    chunkW: PM.CHUNK_W,
                    over: PM.OVERLAP,
                    pad: PM.PAD_CHUNKS,
                    layerMaps: Array.from({ length: layers.length }, () => new Map()),
                    fogKey: '',
                    fogGrad: null
                };
            } else {
                // 保险：层数变化时补齐/裁剪 map
                while (cache.layerMaps.length < layers.length) cache.layerMaps.push(new Map());
                if (cache.layerMaps.length > layers.length) cache.layerMaps.length = layers.length;
            }

            const ridgeStroke = (theme === 'day') ? 'rgba(255,255,255,0.20)' : 'rgba(220,230,255,0.14)';
            const snowStroke = (theme === 'day') ? 'rgba(255,255,255,0.75)' : 'rgba(220,230,255,0.55)';

            const chunkW = cache.chunkW;
            const over = cache.over;
            const fullW = chunkW + over * 2;

            // chunk 构建：只在“第一次进入视野”时生成（大幅减少每帧噪声/路径计算）
            const buildChunk = (layer, li, chunkIndex) => {
                const canvas = PM.makeCanvas(fullW, h);
                const g = PM.getCtx(canvas);
                if (!g) return { canvas };

                g.clearRect(0, 0, fullW, h);

                // 渐变填充
                const cols = (layer.palette && layer.palette[theme]) ? layer.palette[theme]
                    : (layer.palette ? layer.palette.night : ['#222', '#444']);
                const grad = g.createLinearGradient(0, h - layer.y - 160, 0, h);
                grad.addColorStop(0, cols[0]);
                grad.addColorStop(1, cols[1]);
                g.fillStyle = grad;

                const worldStart = chunkIndex * chunkW; // “山脉空间”的起点
                const x0 = -over;
                const x1 = chunkW + over;

                // 记录点：用于脊线高光与雪线（避免二次采样）
                const pts = [];

                // 轮廓填充
                g.beginPath();
                g.moveTo(0, h + 2);

                // 采样（用 < 再补一个端点，确保拼接处严格对齐）
                for (let x = x0; x < x1; x += step) {
                    const wx = worldStart + x;
                    const r = _PX.ridged(wx * layer.freq, layer.seed);
                    const f = _PX.fbm(wx * layer.detail, layer.seed + 999);

                    const contour = 0.72 * r + 0.28 * Math.pow(r, layer.sharp || 1.2);
                    const wobble = 0.86 + 0.14 * f;
                    const hh = layer.amp * contour * wobble;

                    const y = h - layer.y - hh;
                    const cx = x + over;
                    pts.push(cx, y, hh);
                    g.lineTo(cx, y);
                }

                // 末端精确补点（x1）
                {
                    const x = x1;
                    const wx = worldStart + x;
                    const r = _PX.ridged(wx * layer.freq, layer.seed);
                    const f = _PX.fbm(wx * layer.detail, layer.seed + 999);

                    const contour = 0.72 * r + 0.28 * Math.pow(r, layer.sharp || 1.2);
                    const wobble = 0.86 + 0.14 * f;
                    const hh = layer.amp * contour * wobble;

                    const y = h - layer.y - hh;
                    const cx = x + over;
                    pts.push(cx, y, hh);
                    g.lineTo(cx, y);
                }

                g.lineTo(fullW, h + 2);
                g.closePath();
                g.fill();

                // 脊线高光（薄薄一条，增强立体感）
                g.save();
                g.globalAlpha = low ? 0.10 : (0.12 + li * 0.02);
                g.strokeStyle = ridgeStroke;
                g.lineWidth = low ? 1 : 2;
                g.lineJoin = 'round';
                g.lineCap = 'round';
                g.beginPath();
                if (pts.length >= 3) {
                    g.moveTo(pts[0], pts[1]);
                    for (let i = 3; i < pts.length; i += 3) g.lineTo(pts[i], pts[i + 1]);
                }
                g.stroke();
                g.restore();

                // 雪线（只给最远两层，避免“到处发白”）
                if (layer.snow && !low) {
                    const threshold = (layer.snowLine || 0.75) * layer.amp;
                    g.save();
                    g.globalAlpha = (theme === 'day') ? 0.22 : 0.15;
                    g.strokeStyle = snowStroke;
                    g.lineWidth = 2;
                    g.lineJoin = 'round';
                    g.lineCap = 'round';
                    g.beginPath();
                    let inSeg = false;
                    for (let i = 0; i < pts.length; i += 3) {
                        const x = pts[i];
                        const y = pts[i + 1];
                        const hh = pts[i + 2];
                        if (hh > threshold) {
                            if (!inSeg) { g.moveTo(x, y + 1); inSeg = true; }
                            else g.lineTo(x, y + 1);
                        } else {
                            inSeg = false;
                        }
                    }
                    g.stroke();
                    g.restore();
                }

                return { canvas };
            };

            // ───────────────────────── Draw（按层绘制 chunk） ─────────────────────────
            for (let li = 0; li < layers.length; li++) {
                const layer = layers[li];
                const map = cache.layerMaps[li];

                // cam.x -> “山脉空间”偏移（与旧实现保持一致）
                const camP = (cam.x || 0) * layer.p;

                // 覆盖范围：与旧版一致，左右多画一点避免边缘露底
                const startWX = camP - 80;
                const endWX = camP + w + 80;

                const first = Math.floor(startWX / chunkW);
                const last = Math.floor(endWX / chunkW);

                const keepMin = first - cache.pad;
                const keepMax = last + cache.pad;

                // 生成缺失 chunk
                for (let ci = keepMin; ci <= keepMax; ci++) {
                    if (!map.has(ci)) {
                        map.set(ci, buildChunk(layer, li, ci));
                    }
                }

                // 清理远离视野的 chunk（控制内存 + Map 遍历成本）
                for (const k of map.keys()) {
                    if (k < keepMin || k > keepMax) map.delete(k);
                }

                // 绘制可见 chunk（裁剪掉 overlap 区域，拼接处无缝）
                for (let ci = first; ci <= last; ci++) {
                    const chunk = map.get(ci);
                    if (!chunk || !chunk.canvas) continue;

                    const dx = (ci * chunkW) - camP; // chunkStart - camOffset
                    try {
                        ctx.drawImage(chunk.canvas, over, 0, chunkW, h, dx, 0, chunkW, h);
                    } catch (_) {
                        // 某些极端环境下 OffscreenCanvas.drawImage 可能失败：降级为不渲染山脉（不影响游戏）
                    }
                }
            }

            // ───────────────────────── Fog overlay（缓存渐变，避免每帧 createLinearGradient） ─────────────────────────
            const fogKey = theme + '|' + h;
            if (!cache.fogGrad || cache.fogKey !== fogKey) {
                const fog = ctx.createLinearGradient(0, h * 0.35, 0, h);
                if (theme === 'day') {
                    fog.addColorStop(0, 'rgba(255,255,255,0.00)');
                    fog.addColorStop(0.72, 'rgba(220,235,255,0.10)');
                    fog.addColorStop(1, 'rgba(200,230,255,0.14)');
                } else if (theme === 'dawn') {
                    fog.addColorStop(0, 'rgba(255,120,180,0.00)');
                    fog.addColorStop(0.72, 'rgba(255,170,140,0.06)');
                    fog.addColorStop(1, 'rgba(190,210,255,0.10)');
                } else if (theme === 'dusk') {
                    fog.addColorStop(0, 'rgba(170,140,255,0.00)');
                    fog.addColorStop(0.72, 'rgba(255,160,120,0.05)');
                    fog.addColorStop(1, 'rgba(140,170,230,0.10)');
                } else {
                    fog.addColorStop(0, 'rgba(190,210,255,0.00)');
                    fog.addColorStop(0.72, 'rgba(160,180,255,0.06)');
                    fog.addColorStop(1, 'rgba(110,140,210,0.12)');
                }
                cache.fogGrad = fog;
                cache.fogKey = fogKey;
            }

            ctx.save();
            ctx.fillStyle = cache.fogGrad;
            ctx.fillRect(0, h * 0.35, w, h);
            ctx.restore();
        }


        // ═══════════════════ 渲染批量优化 ═══════════════════
        const RenderBatcher = {
