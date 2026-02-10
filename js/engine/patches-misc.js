                                                this._m[name] = (this._m[name] || 0) + dt;
                                                this._c[name] = (this._c[name] || 0) + countInc;
                                                if (extraKey) this._extra[extraKey] = (this._extra[extraKey] || 0) + extraVal;
                                            },

                                            ensureUI() {
                                                if (this.ui) return this.ui;
                                                const div = document.createElement('div');
                                                div.id = 'tu-profiler';
                                                div.style.cssText = [
                                                    'position:fixed',
                                                    'left:8px',
                                                    'top:8px',
                                                    'z-index:9999',
                                                    'padding:6px 8px',
                                                    'background:rgba(0,0,0,0.55)',
                                                    'color:#e8f0ff',
                                                    'font:12px/1.25 ui-monospace,Menlo,Consolas,monospace',
                                                    'border:1px solid rgba(255,255,255,0.18)',
                                                    'border-radius:6px',
                                                    'pointer-events:none',
                                                    'white-space:pre',
                                                    'image-rendering:pixelated'
                                                ].join(';');
                                                div.textContent = 'Profiler ON';
                                                document.body.appendChild(div);
                                                this.ui = div;
                                                return div;
                                            },

                                            setEnabled(v) {
                                                this.enabled = !!v;
                                                try {
                                                    if (this.enabled) this.ensureUI().style.display = 'block';
                                                    else if (this.ui) this.ui.style.display = 'none';
                                                    try { localStorage.setItem('tu_profiler_enabled', this.enabled ? '1' : '0'); } catch (e) { if (typeof console !== 'undefined' && console.debug) console.debug('[Debug] Silently caught:', e); }
                                                } catch (e) { if (typeof console !== 'undefined' && console.debug) console.debug('[Debug] Silently caught:', e); }
                                            },

                                            toggle() { this.setEnabled(!this.enabled); },

                                            updateUI(game) {
                                                if (!this.enabled) return;
                                                const now = this._now();
                                                if (now - this._lastUI < this._uiInterval) return;
                                                this._lastUI = now;

                                                const fps = game && game.fps ? game.fps : 0;
                                                const rw = this._m.renderWorld || 0;
                                                const ul = this._m.updateLight || 0;
                                                const wa = this._m.workerApply || 0;

                                                const c_rw = this._c.renderWorld || 0;
                                                const c_ul = this._c.updateLight || 0;
                                                const c_wa = this._c.workerApply || 0;

                                                const ch = this._extra.workerChanges || 0;

                                                const text =
                                                    'TU Profiler (toggle: F3)\n' +
                                                    'FPS: ' + fps.toFixed(1) + '\n' +
                                                    'renderWorld: ' + rw.toFixed(2) + 'ms (' + c_rw + ')\n' +
                                                    'updateLight: ' + ul.toFixed(2) + 'ms (' + c_ul + ')\n' +
                                                    'workerApply: ' + wa.toFixed(2) + 'ms (' + c_wa + ') chg:' + ch + '\n';

                                                this.ensureUI().textContent = text;
                                            }
                                        };

                                        try { P.enabled = (localStorage.getItem('tu_profiler_enabled') === '1'); } catch (e) { if (typeof console !== 'undefined' && console.debug) console.debug('[Debug] Silently caught:', e); }
                                        return P;
                                    })();

                                    // Key toggle (F3)
                                    try {
                                        window.addEventListener('keydown', (e) => {
                                            if (e.key === 'F3') {
                                                e.preventDefault();
                                                Profiler.toggle();
                                            }
                                        }, { passive: false });
                                    } catch (e) { if (typeof console !== 'undefined' && console.debug) console.debug('[Debug] Silently caught:', e); }

                                    // ------------------------------------------------------------
                                    // World buffers: tiles/light/walls -> flat TypedArray + subarray views
                                    // ------------------------------------------------------------
                                    function flatifyColumns(cols, w, h, ctor) {
                                        if (!cols || !cols.length || !w || !h) return null;
                                        if (cols.__tu_flat && cols.__tu_flat.buf) return cols.__tu_flat;

                                        const flat = new ctor(w * h);
                                        for (let x = 0; x < w; x++) flat.set(cols[x], x * h);

                                        const views = new Array(w);
                                        for (let x = 0; x < w; x++) views[x] = flat.subarray(x * h, (x + 1) * h);

                                        views.__tu_flat = { buf: flat, views, w, h };
                                        return { buf: flat, views, w, h };
                                    }

                                    TU.flatifyWorld = TU.flatifyWorld || function (world) {
                                        try {
                                            if (!world || !world.w || !world.h) return false;
                                            if (world.__tu_flatified) return true;
                                            const w = world.w | 0, h = world.h | 0;

                                            if (world.tiles && Array.isArray(world.tiles) && world.tiles.length === w) {
                                                const t = flatifyColumns(world.tiles, w, h, Uint8Array);
                                                if (t) { world.tilesFlat = t.buf; world.tiles = t.views; }
                                            }
                                            if (world.light && Array.isArray(world.light) && world.light.length === w) {
                                                const l = flatifyColumns(world.light, w, h, Uint8Array);
                                                if (l) { world.lightFlat = l.buf; world.light = l.views; }
                                            }
                                            if (world.walls && Array.isArray(world.walls) && world.walls.length === w) {
                                                const wa = flatifyColumns(world.walls, w, h, Uint8Array);
                                                if (wa) { world.wallsFlat = wa.buf; world.walls = wa.views; }
                                            }

                                            world.__tu_flatified = true;
                                            return true;
                                        } catch (e) {
                                            try { console.warn('[tu_perf_pack] flatifyWorld failed', e); } catch (e) { if (typeof console !== 'undefined' && console.debug) console.debug('[Debug] Silently caught:', e); }
                                            return false;
                                        }
                                    };

                                    // Wrap WorldGenerator.generate to flatify at world creation
                                    try {
                                        if (typeof WorldGenerator !== 'undefined' && WorldGenerator && WorldGenerator.prototype && typeof WorldGenerator.prototype.generate === 'function') {
                                            const _origGen = WorldGenerator.prototype.generate;
                                            if (!WorldGenerator.prototype.__tu_perfPackGenWrapped) {
                                                WorldGenerator.prototype.__tu_perfPackGenWrapped = true;
                                                WorldGenerator.prototype.generate = async function (progress) {
                                                    const data = await _origGen.call(this, progress);
                                                    try { TU.flatifyWorld(data); } catch (e) { if (typeof console !== 'undefined' && console.debug) console.debug('[Debug] Silently caught:', e); }
                                                    return data;
                                                };
                                            }
                                        }
                                    } catch (e) { if (typeof console !== 'undefined' && console.debug) console.debug('[Debug] Silently caught:', e); }

                                    // ------------------------------------------------------------
                                    // Renderer: reduce per-tile Canvas API cost (glow + dark mask)
                                    // ------------------------------------------------------------
                                    function ensureTexArray(renderer) {
                                        try {
                                            const map = renderer && renderer.textures;
                                            if (!map || typeof map.get !== 'function') return null;
                                            if (renderer.__tu_texArr && renderer.__tu_texArrMap === map) return renderer.__tu_texArr;

                                            const arr = renderer.__tu_texArr || (renderer.__tu_texArr = new Array(256));
                                            for (let i = 0; i < 256; i++) arr[i] = null;
                                            try { map.forEach((v, k) => { arr[k & 255] = v; }); } catch (e) { if (typeof console !== 'undefined' && console.debug) console.debug('[Debug] Silently caught:', e); }
                                            renderer.__tu_texArrMap = map;
                                            return arr;
                                        } catch (_) { return null; }
                                    }

                                    function getBucketState(renderer) {
                                        let st = renderer.__tu_tileBuckets;
                                        if (st) return st;
                                        st = renderer.__tu_tileBuckets = {
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
                                        for (let i = 0; i < 256; i++) { st.glowLists[i] = []; st.darkLists[i] = []; }
                                        return st;
                                    }

                                    function packPos(px, py) { return ((px & 0xffff) << 16) | (py & 0xffff); }
                                    function unpackX(p) { return (p >> 16) & 0xffff; }
                                    function unpackY(p) { return p & 0xffff; }

                                    try {
                                        if (typeof Renderer !== 'undefined' && Renderer && Renderer.prototype && typeof Renderer.prototype.renderWorld === 'function') {
                                            const _baseRenderWorld = Renderer.prototype.renderWorld;
                                            if (!Renderer.prototype.__tu_perfPackRenderWrapped) {
                                                Renderer.prototype.__tu_perfPackRenderWrapped = true;

                                                Renderer.prototype.renderWorld = function (world, cam, time) {
                                                    if (this.__tu_disablePerfPackRender) return _baseRenderWorld.call(this, world, cam, time);
                                                    const doProf = Profiler.enabled;
                                                    const t0 = doProf ? (performance.now ? performance.now() : Date.now()) : 0;

                                                    try {
                                                        if (!world || !world.tiles || !world.light || !this.textures || !window.BLOCK_LIGHT || !window.CONFIG) {
                                                            return _baseRenderWorld.call(this, world, cam, time);
                                                        }
                                                        if (this.__disableChunkBatching) return _baseRenderWorld.call(this, world, cam, time);

                                                        const ctx = this.ctx;
                                                        const ts = CONFIG.TILE_SIZE;

                                                        let startX = ((cam.x / ts) | 0) - 1;
                                                        let startY = ((cam.y / ts) | 0) - 1;
                                                        let endX = startX + ((this.w / ts) | 0) + 3;
                                                        let endY = startY + ((this.h / ts) | 0) + 3;

                                                        if (startX < 0) startX = 0;
                                                        if (startY < 0) startY = 0;
                                                        if (endX >= world.w) endX = world.w - 1;
                                                        if (endY >= world.h) endY = world.h - 1;

                                                        const camCeilX = Math.ceil(cam.x);
                                                        const camCeilY = Math.ceil(cam.y);

                                                        const lut = window.BLOCK_LIGHT_LUT;
                                                        if (!lut || lut.length < 16) return _baseRenderWorld.call(this, world, cam, time);

                                                        ctx.globalCompositeOperation = 'source-over';
                                                        ctx.globalAlpha = 1;
                                                        ctx.shadowBlur = 0;

                                                        // Draw chunks using existing cache
                                                        const cfg = this.__cb2_cfg || { tiles: 16 };
                                                        const cts = (cfg.tiles | 0) || 16;

                                                        const cx0 = (startX / cts) | 0;
                                                        const cy0 = (startY / cts) | 0;
                                                        const cx1 = (endX / cts) | 0;
                                                        const cy1 = (endY / cts) | 0;

                                                        for (let cx = cx0; cx <= cx1; cx++) {
                                                            for (let cy = cy0; cy <= cy1; cy++) {
                                                                const entry = this.__cb2_getEntry ? this.__cb2_getEntry(world, cx, cy) : null;
                                                                if (!entry || !entry.canvas) continue;
                                                                ctx.drawImage(entry.canvas, cx * cts * ts - camCeilX, cy * cts * ts - camCeilY);
                                                            }
                                                        }

                                                        // Bucket tiles
                                                        const tilesCols = world.tiles;
                                                        const lightCols = world.light;
                                                        const tilesFlat = world.tilesFlat;
                                                        const lightFlat = world.lightFlat;

                                                        const BL = window.BLOCK_LIGHT;
                                                        const BC = window.BLOCK_COLOR || null;
                                                        const AIR = (window.BLOCK && window.BLOCK.AIR !== undefined) ? window.BLOCK.AIR : 0;

                                                        const bucket = getBucketState(this);
                                                        bucket.reset();

                                                        const texArr = ensureTexArray(this);
                                                        const H = world.h | 0;

                                                        if (tilesFlat && lightFlat && tilesFlat.length === (world.w * world.h)) {
                                                            for (let x = startX; x <= endX; x++) {
                                                                const base = x * H;
                                                                for (let y = startY; y <= endY; y++) {
                                                                    const idx = base + y;
                                                                    const block = tilesFlat[idx] | 0;
                                                                    if (block === AIR) continue;

                                                                    const px = x * ts - camCeilX;
                                                                    const py = y * ts - camCeilY;

                                                                    const bl = BL[block] | 0;
                                                                    if (bl > 5) {
                                                                        const list = bucket.glowLists[block];
                                                                        if (list.length === 0) bucket.glowKeys.push(block);
                                                                        list.push(packPos(px, py));
                                                                    }

                                                                    const lv = lightFlat[idx] & 255;
                                                                    const a = lut[lv];
                                                                    if (a) {
                                                                        const dl = bucket.darkLists[lv];
                                                                        if (dl.length === 0) bucket.darkKeys.push(lv);
                                                                        dl.push(packPos(px, py));
                                                                    }
                                                                }
                                                            }
                                                        } else {
                                                            for (let x = startX; x <= endX; x++) {
                                                                const colT = tilesCols[x];
                                                                const colL = lightCols[x];
                                                                for (let y = startY; y <= endY; y++) {
                                                                    const block = colT[y] | 0;
                                                                    if (block === AIR) continue;

                                                                    const px = x * ts - camCeilX;
                                                                    const py = y * ts - camCeilY;

                                                                    const bl = BL[block] | 0;
                                                                    if (bl > 5) {
                                                                        const list = bucket.glowLists[block];
                                                                        if (list.length === 0) bucket.glowKeys.push(block);
                                                                        list.push(packPos(px, py));
                                                                    }

                                                                    const lv = colL[y] & 255;
                                                                    const a = lut[lv];
                                                                    if (a) {
                                                                        const dl = bucket.darkLists[lv];
                                                                        if (dl.length === 0) bucket.darkKeys.push(lv);
                                                                        dl.push(packPos(px, py));
                                                                    }
                                                                }
                                                            }
                                                        }

                                                        // Draw glow tiles grouped by block
                                                        if (bucket.glowKeys.length) {
                                                            const enableGlow = !!this.enableGlow;
                                                            for (let ki = 0; ki < bucket.glowKeys.length; ki++) {
                                                                const blockId = bucket.glowKeys[ki] | 0;
                                                                const list = bucket.glowLists[blockId];
                                                                if (!list || !list.length) continue;

                                                                const tex = texArr ? texArr[blockId] : this.textures.get(blockId);
                                                                if (!tex) continue;

                                                                const bl = BL[blockId] | 0;

                                                                if (enableGlow) {
                                                                    ctx.shadowColor = (BC && BC[blockId]) ? BC[blockId] : '#fff';
                                                                    ctx.shadowBlur = bl * 2;
                                                                } else {
                                                                    ctx.shadowBlur = 0;
                                                                }

                                                                for (let i = 0; i < list.length; i++) {
                                                                    const p = list[i] | 0;
                                                                    ctx.drawImage(tex, unpackX(p), unpackY(p));
                                                                }
                                                            }
                                                            ctx.shadowBlur = 0;
                                                        }

                                                        // Draw dark mask grouped by light value (one fill per bucket)
                                                        if (bucket.darkKeys.length) {
                                                            ctx.fillStyle = '#000';
                                                            bucket.darkKeys.sort((a, b) => a - b);
                                                            for (let ki = 0; ki < bucket.darkKeys.length; ki++) {
                                                                const lv = bucket.darkKeys[ki] & 255;
                                                                const a = lut[lv];
                                                                if (!a) continue;
                                                                const list = bucket.darkLists[lv];
                                                                if (!list || !list.length) continue;

                                                                ctx.globalAlpha = a;
                                                                ctx.beginPath();
                                                                for (let i = 0; i < list.length; i++) {
                                                                    const p = list[i] | 0;
                                                                    ctx.rect(unpackX(p), unpackY(p), ts, ts);
                                                                }
                                                                ctx.fill();
                                                            }
                                                            ctx.globalAlpha = 1;
                                                        }

                                                    } catch (e) {
                                                        this.__tu_disablePerfPackRender = true;
                                                        try { console.warn('[tu_perf_pack] renderWorld patch disabled:', e); } catch (e) { if (typeof console !== 'undefined' && console.debug) console.debug('[Debug] Silently caught:', e); }
                                                        return _baseRenderWorld.call(this, world, cam, time);
                                                    } finally {
                                                        if (doProf) {
                                                            const t1 = (performance.now ? performance.now() : Date.now());
                                                            Profiler.add('renderWorld', t1 - t0, 1);
                                                        }
                                                    }
                                                };
                                            }
                                        }
                                    } catch (e) { if (typeof console !== 'undefined' && console.debug) console.debug('[Debug] Silently caught:', e); }

                                    // ------------------------------------------------------------
                                    // TileLogicEngine worker: diff buffer reuse + recycle
                                    // ------------------------------------------------------------
                                    function patchWorkerSource() {
                                        try {
                                            if (typeof TileLogicEngine === 'undefined' || !TileLogicEngine) return false;
                                            if (TileLogicEngine.__tu_perfPackWorkerSource) return true;

                                            const orig = TileLogicEngine._workerSource;
                                            if (typeof orig !== 'function') return false;

                                            const inject = `

  // __TU_OUT_POOL__: preallocated out buffers (recycled by main thread)
  const __TU_OUT_POOL__ = [];
  let __tuOutView = null;
  let __tuOutLen = 0;

  function __tuAllocOut(minInts) {
    minInts = (minInts|0) || 1024;
    for (let i = __TU_OUT_POOL__.length - 1; i >= 0; i--) {
      const buf = __TU_OUT_POOL__[i];
      if (buf && buf.byteLength >= (minInts << 2)) {
        __TU_OUT_POOL__.splice(i, 1);
        return buf;
      }
    }
    return new ArrayBuffer(minInts << 2);
  }

  function __tuEnsureOut(extraInts) {
    if (!__tuOutView) {
      __tuOutView = new Int32Array(__tuAllocOut(2048));
      __tuOutLen = 0;
      return;
    }
    if ((__tuOutLen + extraInts) <= __tuOutView.length) return;

    // grow: allocate bigger, copy, recycle old
    const need = (__tuOutLen + extraInts) | 0;
    let next = __tuOutView.length << 1;
    while (next < need) next = next << 1;
    const nb = __tuAllocOut(next);
    const nv = new Int32Array(nb);
    nv.set(__tuOutView.subarray(0, __tuOutLen));
    try { __TU_OUT_POOL__.push(__tuOutView.buffer); } catch(_) { /* silently ignore */ }
    __tuOutView = nv;
  }

  const __tuChanges = {
    length: 0,
    reset() {
      __tuEnsureOut(0);
      __tuOutLen = 0;
      this.length = 0;
    },
    push(i, oldId, newId) {
      __tuEnsureOut(3);
      __tuOutView[__tuOutLen++] = i|0;
      __tuOutView[__tuOutLen++] = oldId|0;
      __tuOutView[__tuOutLen++] = newId|0;
      this.length = __tuOutLen;
    }
  };
`;

                                            TileLogicEngine._workerSource = function () {
                                                let s = orig.call(TileLogicEngine);
                                                if (!s || s.indexOf("const changes = [];") === -1 || s.indexOf("postMessage({ type: 'changes'") === -1) return s;
                                                if (s.indexOf('__TU_OUT_POOL__') !== -1) return s;

                                                const injectKey = "let AIR = 0, WATER = 27;";
                                                if (s.indexOf(injectKey) === -1) return s;

                                                s = s.replace(injectKey, injectKey + inject);

                                                s = s.replace(/function step\(\)\s*\{\s*\n\s*const changes = \[\];/m,
                                                    "function step() {\n    __tuChanges.reset();\n    const changes = __tuChanges;"
                                                );

                                                s = s.replace(/if\s*\(changes\.length\)\s*\{\s*\n\s*const buf = new Int32Array\(changes\);\s*\n\s*postMessage\(\{ type: 'changes', buf: buf\.buffer \}, \[buf\.buffer\]\);\s*\n\s*\}/m,
                                                    "if (changes.length) {\n      const len = changes.length|0;\n      const buf = __tuOutView.buffer;\n      postMessage({ type: 'changes', buf: buf, len: len }, [buf]);\n      __tuOutView = null;\n      __tuOutLen = 0;\n      __tuChanges.length = 0;\n    }"
                                                );

                                                s = s.replace(/switch\s*\(m\.type\)\s*\{\s*/m,
                                                    (m) => m + "\n      case 'recycle': {\n        if (m.buf) {\n          try { __TU_OUT_POOL__.push(m.buf); } catch(_) { /* silently ignore */ }\n        }\n        break;\n      }\n"
                                                );

                                                return s;
                                            };

                                            TileLogicEngine.__tu_perfPackWorkerSource = true;
                                            return true;
                                        } catch (e) {
                                            try { console.warn('[tu_perf_pack] patchWorkerSource failed', e); } catch (e) { if (typeof console !== 'undefined' && console.debug) console.debug('[Debug] Silently caught:', e); }
                                            return false;
                                        }
                                    }

                                    patchWorkerSource();

                                    try {
                                        if (typeof TileLogicEngine !== 'undefined' && TileLogicEngine && TileLogicEngine.prototype) {

                                            if (typeof TileLogicEngine.prototype._flattenTiles === 'function' && !TileLogicEngine.prototype.__tu_perfPackFlattenWrapped) {
                                                TileLogicEngine.prototype.__tu_perfPackFlattenWrapped = true;
                                                const _origFlat = TileLogicEngine.prototype._flattenTiles;
                                                TileLogicEngine.prototype._flattenTiles = function () {
                                                    try {
                                                        const w = this.world;
                                                        if (w && w.tilesFlat && w.tilesFlat.length === (this.w * this.h)) {
                                                            return new Uint8Array(w.tilesFlat);
                                                        }
                                                    } catch (e) { if (typeof console !== 'undefined' && console.debug) console.debug('[Debug] Silently caught:', e); }
                                                    return _origFlat.call(this);
                                                };
                                            }

                                            if (typeof TileLogicEngine.prototype._initWorker === 'function' && !TileLogicEngine.prototype.__tu_perfPackInitWrapped) {
                                                TileLogicEngine.prototype.__tu_perfPackInitWrapped = true;
                                                const _origInit = TileLogicEngine.prototype._initWorker;
                                                TileLogicEngine.prototype._initWorker = function () {
                                                    _origInit.call(this);

                                                    try {
                                                        if (!this.worker || this.__tu_perfPackOnMsgWrapped) return;
                                                        this.__tu_perfPackOnMsgWrapped = true;

                                                        const self = this;
                                                        const w = this.worker;

                                                        const pendingPool = [];
                                                        function allocPending(arr) {
                                                            const o = pendingPool.pop() || { arr: null, pos: 0 };
                                                            o.arr = arr; o.pos = 0;
                                                            return o;
                                                        }
                                                        function freePending(o) {
                                                            o.arr = null; o.pos = 0;
                                                            pendingPool.push(o);
                                                        }
                                                        self.__tu_pendingPool = { allocPending, freePending };

                                                        w.onmessage = (e) => {
                                                            const msg = e.data;
                                                            if (!msg || !msg.type) return;
                                                            if (msg.type === 'changes' && msg.buf) {
                                                                try {
                                                                    const len = (msg.len | 0) > 0 ? (msg.len | 0) : 0;
                                                                    const arr = len ? new Int32Array(msg.buf, 0, len) : new Int32Array(msg.buf);
                                                                    self.pending.push(allocPending(arr));
                                                                    self._scheduleApply();
                                                                } catch (e) { if (typeof console !== 'undefined' && console.debug) console.debug('[Debug] Silently caught:', e); }
                                                            }
                                                        };
                                                    } catch (e) { if (typeof console !== 'undefined' && console.debug) console.debug('[Debug] Silently caught:', e); }
                                                };
                                            }

                                            if (typeof TileLogicEngine.prototype._applyPending === 'function' && !TileLogicEngine.prototype.__tu_perfPackApplyWrapped) {
                                                TileLogicEngine.prototype.__tu_perfPackApplyWrapped = true;
                                                const _origApply = TileLogicEngine.prototype._applyPending;

                                                function pendingRemaining(pending) {
                                                    let rem = 0;
                                                    for (let i = 0; i < pending.length; i++) {
                                                        const it = pending[i];
                                                        if (!it || !it.arr) continue;
                                                        rem += (it.arr.length - (it.pos | 0));
                                                    }
                                                    return rem;
                                                }

                                                TileLogicEngine.prototype._applyPending = function (deadline) {
                                                    const doProf = Profiler.enabled;
                                                    const before = doProf ? pendingRemaining(this.pending) : 0;
                                                    const t0 = doProf ? (performance.now ? performance.now() : Date.now()) : 0;

                                                    _origApply.call(this, deadline);

                                                    try {
                                                        while (this.pending.length && this.pending[0] && this.pending[0].arr && (this.pending[0].pos >= this.pending[0].arr.length)) {
                                                            const done = this.pending.shift();
                                                            const buf = done && done.arr && done.arr.buffer;
                                                            if (buf && this.worker && typeof this.worker.postMessage === 'function') {
                                                                try { this.worker.postMessage({ type: 'recycle', buf: buf }, [buf]); } catch (e) { if (typeof console !== 'undefined' && console.debug) console.debug('[Debug] Silently caught:', e); }
                                                            }
                                                            try {
                                                                const pool = this.__tu_pendingPool;
                                                                if (pool && pool.freePending) pool.freePending(done);
                                                            } catch (e) { if (typeof console !== 'undefined' && console.debug) console.debug('[Debug] Silently caught:', e); }
                                                        }
                                                    } catch (e) { if (typeof console !== 'undefined' && console.debug) console.debug('[Debug] Silently caught:', e); }

                                                    if (doProf) {
                                                        const t1 = (performance.now ? performance.now() : Date.now());
                                                        const after = pendingRemaining(this.pending);
                                                        const processedElems = (before - after) | 0;
                                                        const changes = processedElems > 0 ? ((processedElems / 3) | 0) : 0;
                                                        Profiler.add('workerApply', t1 - t0, 1, 'workerChanges', changes);
                                                    }
                                                };
                                            }
                                        }
                                    } catch (e) { if (typeof console !== 'undefined' && console.debug) console.debug('[Debug] Silently caught:', e); }

                                    // ------------------------------------------------------------
                                    // Profile hooks: Game.loop + Game._updateLight
                                    // ------------------------------------------------------------
                                    try {
                                        if (typeof Game !== 'undefined' && Game && Game.prototype) {
                                            if (typeof Game.prototype.loop === 'function' && !Game.prototype.__tu_profLoopWrapped) {
                                                Game.prototype.__tu_profLoopWrapped = true;
                                                const _origLoop = Game.prototype.loop;
                                                Game.prototype.loop = function (timestamp) {
                                                    if (Profiler.enabled) Profiler.beginFrame();
                                                    const r = _origLoop.call(this, timestamp);
                                                    if (Profiler.enabled) Profiler.updateUI(this);
                                                    return r;
                                                };
                                            }

                                            if (typeof Game.prototype._updateLight === 'function' && !Game.prototype.__tu_profUpdateLightWrapped) {
                                                Game.prototype.__tu_profUpdateLightWrapped = true;
                                                const _origUL = Game.prototype._updateLight;
                                                Game.prototype._updateLight = function (x, y) {
                                                    if (!Profiler.enabled) return _origUL.call(this, x, y);
                                                    const t0 = performance.now ? performance.now() : Date.now();
                                                    try { return _origUL.call(this, x, y); }
                                                    finally {
                                                        const t1 = performance.now ? performance.now() : Date.now();
                                                        Profiler.add('updateLight', t1 - t0, 1);
                                                    }
                                                };
                                            }
                                        }
                                    } catch (e) { if (typeof console !== 'undefined' && console.debug) console.debug('[Debug] Silently caught:', e); }

                                })();
                            


                                (() => {
                                    'use strict';

                                    // ─────────────────────────────────────────────────────────────
                                    // 1) Chunk glow bake: bake glow layer into chunk glowCanvas (with padding)
                                    // ─────────────────────────────────────────────────────────────
                                    try {
                                        if (typeof Renderer !== 'undefined' && Renderer && Renderer.prototype && Renderer.prototype.__cb2_getEntry) {
                                            const GLOW_PAD = 32; // chunk-level padding to avoid blur clipping on chunk borders

                                            // Wrap/replace rebuildChunk to draw BOTH base + glow layers into chunk-local canvases.
                                            const _origRebuild = Renderer.prototype.__cb2_rebuildChunk;
                                            Renderer.prototype.__cb2_rebuildChunk = function (entry, world) {
                                                try {
                                                    const cfg = this.__cb2_cfg || { tiles: 16 };
                                                    const cts = (cfg.tiles | 0) || 16;
                                                    const ts = (CONFIG && CONFIG.TILE_SIZE) ? (CONFIG.TILE_SIZE | 0) : 16;

                                                    const pxW = cts * ts;
                                                    const pad = GLOW_PAD | 0;
                                                    const glowW = pxW + pad * 2;

                                                    // Ensure base canvas
                                                    if (!entry.canvas) {
                                                        entry.canvas = document.createElement('canvas');
                                                        entry.ctx = entry.canvas.getContext('2d', { alpha: true });
                                                        entry.ctx.imageSmoothingEnabled = false;
                                                    }
                                                    if (entry.canvas.width !== pxW || entry.canvas.height !== pxW) {
                                                        entry.canvas.width = entry.canvas.height = pxW;
                                                    }
                                                    const ctx = entry.ctx;

                                                    // Ensure glow canvas
                                                    if (!entry.glowCanvas) {
                                                        entry.glowCanvas = document.createElement('canvas');
                                                        entry.glowCtx = entry.glowCanvas.getContext('2d', { alpha: true });
                                                        entry.glowCtx.imageSmoothingEnabled = false;
                                                        entry.glowPad = pad;
                                                        entry.hasGlow = false;
                                                    }
                                                    if (entry.glowCanvas.width !== glowW || entry.glowCanvas.height !== glowW) {
                                                        entry.glowCanvas.width = entry.glowCanvas.height = glowW;
                                                    }
                                                    const gctx = entry.glowCtx;
                                                    entry.glowPad = pad;
                                                    entry.hasGlow = false;

                                                    // Clear
                                                    ctx.clearRect(0, 0, pxW, pxW);
                                                    gctx.clearRect(0, 0, glowW, glowW);

                                                    const tilesCols = world && world.tiles;
                                                    const tilesFlat = world && world.tilesFlat;
                                                    const H = world ? (world.h | 0) : 0;

                                                    const texGen = this.textures;
                                                    const BL = (typeof BLOCK_LIGHT !== 'undefined') ? BLOCK_LIGHT : null;

                                                    const cx0 = (entry.cx | 0) * cts;
                                                    const cy0 = (entry.cy | 0) * cts;

                                                    for (let lx = 0; lx < cts; lx++) {
                                                        const wx = cx0 + lx;
                                                        if (wx < 0 || wx >= world.w) continue;

                                                        let col = null;
                                                        let baseIdx = 0;
                                                        if (tilesFlat && H) {
                                                            baseIdx = (wx * H) | 0;
                                                        } else if (tilesCols) {
                                                            col = tilesCols[wx];
                                                        }

                                                        for (let ly = 0; ly < cts; ly++) {
                                                            const wy = cy0 + ly;
                                                            if (wy < 0 || wy >= world.h) continue;

                                                            const id = (tilesFlat && H) ? (tilesFlat[baseIdx + wy] | 0) : (col ? (col[wy] | 0) : 0);
                                                            if (id === 0) continue;

                                                            // Base tile & glow bake
                                                            const tex = texGen && texGen.get ? texGen.get(id) : null;
                                                            const bl = BL ? (BL[id] | 0) : 0;

                                                            if (bl > 5) {
                                                                // Glow tiles: draw into glowCanvas (includes tile content when using getGlow fallback),
                                                                // base canvas intentionally skips to avoid double-draw.
                                                                const gtex = (texGen && texGen.getGlow) ? texGen.getGlow(id) : null;
                                                                if (gtex) {
                                                                    const gp = gtex.__pad | 0;
                                                                    gctx.drawImage(gtex, lx * ts + pad - gp, ly * ts + pad - gp);
                                                                    entry.hasGlow = true;
                                                                } else if (tex) {
                                                                    // Fallback: shadowBlur bake directly into glowCanvas
                                                                    try {
                                                                        gctx.save();
                                                                        gctx.shadowColor = (typeof BLOCK_COLOR !== 'undefined' && BLOCK_COLOR[id]) ? BLOCK_COLOR[id] : '#ffffff';
                                                                        gctx.shadowBlur = bl * 2;
                                                                        gctx.drawImage(tex, lx * ts + pad, ly * ts + pad);
                                                                        gctx.restore();
                                                                        entry.hasGlow = true;
                                                                    } catch (e) { if (typeof console !== 'undefined' && console.debug) console.debug('[Debug] Silently caught:', e); }
                                                                }
                                                            } else {
                                                                if (tex) ctx.drawImage(tex, lx * ts, ly * ts);
                                                            }

                                                        }
                                                    }

                                                    entry.dirty = false;
                                                    return;
                                                } catch (e) {
                                                    // Fallback to previous rebuild if anything goes wrong.
                                                    try { if (_origRebuild) return _origRebuild.call(this, entry, world); } catch (e) { if (typeof console !== 'undefined' && console.debug) console.debug('[Debug] Silently caught:', e); }
                                                    entry.dirty = false;
                                                }
                                            };

                                            // Ensure existing cached entries get glow canvases after patch
                                            try {
                                                const oldGet = Renderer.prototype.__cb2_getEntry;
                                                Renderer.prototype.__cb2_getEntry = function (world, cx, cy) {
                                                    const e = oldGet.call(this, world, cx, cy);
                                                    if (e && !e.glowCanvas) {
                                                        e.dirty = true; // force rebuild with new glow bake path
                                                        try { this.__cb2_rebuildChunk(e, world); } catch (e) { if (typeof console !== 'undefined' && console.debug) console.debug('[Debug] Silently caught:', e); }
                                                    }
                                                    return e;
                                                };
                                            } catch (e) { if (typeof console !== 'undefined' && console.debug) console.debug('[Debug] Silently caught:', e); }
                                        }
                                    } catch (e) { if (typeof console !== 'undefined' && console.debug) console.debug('[Debug] Silently caught:', e); }

                                    // ─────────────────────────────────────────────────────────────
                                    // 2) Vignette/darkness: tile-resolution alpha-map (offscreen ImageData), single draw
                                    //    + draw glowCanvas per chunk (no per-tile glow loops)
                                    // ─────────────────────────────────────────────────────────────
                                    try {
                                        if (typeof Renderer !== 'undefined' && Renderer && Renderer.prototype && typeof Renderer.prototype.renderWorld === 'function') {
                                            const _prevRW = Renderer.prototype.renderWorld;

                                            function parseRgb(str) {
                                                // supports 'rgb(r,g,b)' or 'rgba(r,g,b,a)' or '#rrggbb'
                                                if (!str) return { r: 10, g: 5, b: 20 };
                                                const s = String(str).trim();
                                                let m = s.match(/^rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)\s*/i);
                                                if (m) return { r: (m[1] | 0), g: (m[2] | 0), b: (m[3] | 0) };
                                                m = s.match(/^#([0-9a-f]{6})$/i);
                                                if (m) {
                                                    const n = parseInt(m[1], 16);
                                                    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
                                                }
                                                return { r: 10, g: 5, b: 20 };
                                            }

                                            // dark LUT builder (same as original renderWorld)
                                            function buildDarkLUT(levels, nightBonus) {
                                                const lut = new Float32Array(256);
                                                for (let i = 0; i < 256; i++) {
                                                    const darkness = 1 - (i / levels);
                                                    let totalDark = darkness * 0.6 + nightBonus;
                                                    if (totalDark > 0.88) totalDark = 0.88;
                                                    lut[i] = (totalDark > 0.05) ? totalDark : 0;
                                                }
                                                return lut;
                                            }

                                            Renderer.prototype.renderWorld = function (world, cam, time) {
                                                // Preserve worker-rendered fast path (if present)
                                                try {
                                                    const ww = this.__ww;
                                                    if (ww && ww.renderEnabled && ww.worldReady) {
                                                        ww.requestFrame(cam, time, this);
                                                        const bm = ww.consumeBitmap();
                                                        if (bm) {
                                                            try { this.ctx.drawImage(bm, 0, 0, this.w, this.h); return; }
                                                            finally { try { bm.close && bm.close(); } catch (e) { if (typeof console !== 'undefined' && console.debug) console.debug('[Debug] Silently caught:', e); } }
                                                        }
                                                    }
                                                } catch (e) { if (typeof console !== 'undefined' && console.debug) console.debug('[Debug] Silently caught:', e); }

                                                // Preconditions for our path
                                                if (!world || !cam || !this.__cb2_getEntry || !this.__cb2_cfg || !this.ctx) {
                                                    return _prevRW.call(this, world, cam, time);
                                                }
                                                const ts = (CONFIG && CONFIG.TILE_SIZE) ? (CONFIG.TILE_SIZE | 0) : 16;
                                                const ctx = this.ctx;

                                                // Visible tile range (clamped once)
                                                let startX = (cam.x / ts) | 0; startX -= 1;
                                                let startY = (cam.y / ts) | 0; startY -= 1;
                                                let endX = startX + ((this.w / ts) | 0) + 3;
                                                let endY = startY + ((this.h / ts) | 0) + 3;

                                                if (startX < 0) startX = 0;
                                                if (startY < 0) startY = 0;
                                                if (endX >= world.w) endX = world.w - 1;
                                                if (endY >= world.h) endY = world.h - 1;

                                                const camCeilX = Math.ceil(cam.x);
                                                const camCeilY = Math.ceil(cam.y);

                                                // ───────── LUT (day/night + weather gloom/flash) ─────────
                                                const Utils = window.Utils || (window.TU && window.TU.Utils);
                                                const night = Utils && Utils.nightFactor ? Utils.nightFactor(time) : 0;
                                                const qNight = Math.round(night * 100) / 100;
                                                const levels = (CONFIG && CONFIG.LIGHT_LEVELS) ? (CONFIG.LIGHT_LEVELS | 0) : 16;

                                                const wf = window.TU_WEATHER_FX || null;
                                                let wType = (wf && wf.type) ? wf.type : 'clear';
                                                let wGloom = (wf && typeof wf.gloom === 'number') ? wf.gloom : 0;
                                                let wFlash = (wf && typeof wf.lightning === 'number') ? wf.lightning : 0;
                                                if (wGloom < 0) wGloom = 0;
                                                if (wGloom > 1) wGloom = 1;
                                                if (wFlash < 0) wFlash = 0;
                                                if (wFlash > 1) wFlash = 1;
                                                const wKey = wType + ':' + ((wGloom * 100) | 0) + ':' + ((wFlash * 100) | 0) + ':' + qNight + ':' + levels;

                                                if (!this._darkAlphaLUTDay || this._darkAlphaLUTLevels !== levels) {
                                                    this._darkAlphaLUTLevels = levels;
                                                    this._darkAlphaLUTDay = buildDarkLUT(levels, 0);
                                                    this._darkAlphaLUTNight = buildDarkLUT(levels, 0.2);
                                                }
                                                let lut = this._darkAlphaLUTBlend;
                                                if (!lut || this._darkAlphaLUTBlendWeatherKey !== wKey || this._darkAlphaLUTBlendNight !== qNight || this._darkAlphaLUTBlendLevels !== levels) {
                                                    lut = this._darkAlphaLUTBlend || (this._darkAlphaLUTBlend = new Float32Array(256));
                                                    const dayL = this._darkAlphaLUTDay;
                                                    const nightL = this._darkAlphaLUTNight;
                                                    const lv = levels || 1;
                                                    const gloom = wGloom;
                                                    const flash = wFlash;
                                                    let th = 0.05 - gloom * 0.02;
                                                    if (th < 0.02) th = 0.02;

                                                    for (let i = 0; i < 256; i++) {
                                                        let v = dayL[i] + (nightL[i] - dayL[i]) * qNight;

                                                        if (gloom > 0.001) {
                                                            let light01 = i / lv;
                                                            if (light01 < 0) light01 = 0;
                                                            if (light01 > 1) light01 = 1;
                                                            const sh = 1 - light01;
                                                            v += gloom * (0.08 + 0.22 * sh);
                                                            v *= (1 + gloom * 0.18);
                                                        }

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
                                                window.BLOCK_LIGHT_LUT = lut;

                                                // ───────── 1) Draw tile chunks (base) ─────────
                                                ctx.globalCompositeOperation = 'source-over';
                                                ctx.globalAlpha = 1;
                                                ctx.shadowBlur = 0;

                                                const cfg = this.__cb2_cfg || { tiles: 16 };
                                                const cts = (cfg.tiles | 0) || 16;

                                                const cStartX = (startX / cts) | 0;
                                                const cStartY = (startY / cts) | 0;
                                                const cEndX = (endX / cts) | 0;
                                                const cEndY = (endY / cts) | 0;

                                                for (let cy = cStartY; cy <= cEndY; cy++) {
                                                    for (let cx = cStartX; cx <= cEndX; cx++) {
                                                        const e = this.__cb2_getEntry(world, cx, cy);
                                                        if (!e || !e.canvas) continue;
                                                        const dx = cx * cts * ts - camCeilX;
                                                        const dy = cy * cts * ts - camCeilY;
                                                        ctx.drawImage(e.canvas, dx, dy);
                                                    }
                                                }

                                                // ───────── 2) Draw baked glow canvases (chunk-level) ─────────
                                                if (this.enableGlow) {
                                                    for (let cy = cStartY; cy <= cEndY; cy++) {
                                                        for (let cx = cStartX; cx <= cEndX; cx++) {
                                                            const e = this.__cb2_getEntry(world, cx, cy);
                                                            if (!e || !e.glowCanvas || !e.hasGlow) continue;
                                                            const pad = e.glowPad | 0;
                                                            const dx = cx * cts * ts - camCeilX - pad;
                                                            const dy = cy * cts * ts - camCeilY - pad;
                                                            ctx.drawImage(e.glowCanvas, dx, dy);
                                                        }
                                                    }
                                                }

                                                // ───────── 3) Tile-resolution darkness alpha-map (offscreen ImageData) ─────────
                                                const tilesCols = world.tiles;
                                                const lightCols = world.light;
                                                const tilesFlat = world.tilesFlat;
                                                const lightFlat = world.lightFlat;
                                                const H = world.h | 0;

                                                const wTiles = (endX - startX + 1) | 0;
                                                const hTiles = (endY - startY + 1) | 0;

                                                let mask = this.__tu_darkMask;
                                                if (!mask || mask.w !== wTiles || mask.h !== hTiles) {
                                                    const c = (typeof OffscreenCanvas !== 'undefined') ? new OffscreenCanvas(wTiles, hTiles) : document.createElement('canvas');
                                                    c.width = wTiles; c.height = hTiles;
                                                    const mctx = c.getContext('2d', { alpha: true });
                                                    mask = this.__tu_darkMask = { canvas: c, ctx: mctx, w: wTiles, h: hTiles, imageData: mctx.createImageData(wTiles, hTiles) };
                                                }

                                                const wfShadow = wf && wf.shadowColor ? wf.shadowColor : 'rgb(10,5,20)';
                                                const rgb = parseRgb(wfShadow);

                                                const data = mask.imageData.data;
                                                // Fill
                                                let di = 0;
                                                if (tilesFlat && lightFlat && H) {
                                                    // x-major scan for cache friendliness on column-major flat arrays
                                                    // We write into row-major ImageData with a constant stride.
                                                    for (let y = 0; y < hTiles; y++) {
                                                        const wy = startY + y;
                                                        const rowBase = (y * wTiles) << 2;
                                                        for (let x = 0; x < wTiles; x++) {
                                                            const wx = startX + x;
                                                            const idx = (wx * H + wy) | 0;
                                                            const id = tilesFlat[idx] | 0;
                                                            const a = id ? lut[lightFlat[idx] | 0] : 0;
                                                            const o = rowBase + (x << 2);
                                                            data[o] = rgb.r;
                                                            data[o + 1] = rgb.g;
                                                            data[o + 2] = rgb.b;
                                                            data[o + 3] = a ? ((a * 255) | 0) : 0;
                                                        }
                                                    }
                                                } else {
                                                    for (let y = startY; y <= endY; y++) {
                                                        for (let x = startX; x <= endX; x++) {
                                                            const id = tilesCols && tilesCols[x] ? (tilesCols[x][y] | 0) : 0;
                                                            const lv = lightCols && lightCols[x] ? (lightCols[x][y] | 0) : 0;
                                                            const a = id ? lut[lv] : 0;
                                                            data[di++] = rgb.r;
                                                            data[di++] = rgb.g;
                                                            data[di++] = rgb.b;
                                                            data[di++] = a ? ((a * 255) | 0) : 0;
                                                        }
                                                    }
                                                }

                                                mask.ctx.putImageData(mask.imageData, 0, 0);

                                                const oldSmooth = ctx.imageSmoothingEnabled;
                                                ctx.imageSmoothingEnabled = false;
                                                ctx.globalAlpha = 1;
                                                ctx.globalCompositeOperation = 'source-over';

                                                ctx.drawImage(
                                                    mask.canvas,
                                                    0, 0, wTiles, hTiles,
                                                    startX * ts - camCeilX,
                                                    startY * ts - camCeilY,
                                                    wTiles * ts,
                                                    hTiles * ts
                                                );

                                                ctx.imageSmoothingEnabled = oldSmooth;
                                                ctx.globalAlpha = 1;
                                            };
                                        }
                                    } catch (e) { if (typeof console !== 'undefined' && console.debug) console.debug('[Debug] Silently caught:', e); }

                                    // ─────────────────────────────────────────────────────────────
                                    // 3) TileLogic diff: column-view bitpack (only when diff is huge) + apply path
                                    // ─────────────────────────────────────────────────────────────
                                    try {
                                        if (typeof TileLogicEngine !== 'undefined' && TileLogicEngine) {

                                            // ---- Worker source: add packed path when len is large ----
                                            if (!TileLogicEngine.__tu_packXYWorkerSourcePatched && typeof TileLogicEngine._workerSource === 'function') {
                                                const _orig = TileLogicEngine._workerSource;
                                                TileLogicEngine._workerSource = function () {
                                                    let s = _orig.call(TileLogicEngine);
                                                    try {
                                                        if (!s || s.indexOf("type: 'changes'") === -1) return s;
                                                        if (s.indexOf("type: 'changesXY'") !== -1) return s;

                                                        // 1) inject allocator + threshold near pool definition
                                                        const poolDecl = "const __TU_OUT_POOL__ = [];";
                                                        if (s.indexOf(poolDecl) !== -1) {
                                                            const inject = `
  const __TU_PACK_THRESHOLD__ = 6144; // ints (3 per change); only pack when very large
  function __tuAllocOutPacked(n) {
    const need = (n << 3) >>> 0; // 8 bytes per change (xy uint32 + ids uint16 + pad)
    let b = null;
    for (let i = __TU_OUT_POOL__.length - 1; i >= 0; i--) {
      const cand = __TU_OUT_POOL__[i];
      if (cand && cand.byteLength >= need) { b = cand; __TU_OUT_POOL__.splice(i, 1); break; }
    }
    return b || new ArrayBuffer(need);
  }
`;
                                                            s = s.replace(poolDecl, poolDecl + inject);
                                                        }

                                                        // 2) replace postMessage line with conditional packed send
                                                        const needle = "postMessage({ type: 'changes', buf: buf, len: len }, [buf]);";
                                                        if (s.indexOf(needle) !== -1) {
                                                            const repl = `
      if (len >= __TU_PACK_THRESHOLD__) {
        const n = (len / 3) | 0;
        const pbuf = __tuAllocOutPacked(n);
        const xy = new Uint32Array(pbuf, 0, n);
        const ids = new Uint16Array(pbuf, n * 4, n);
        for (let k = 0, j = 0; k < n; k++, j += 3) {
          const idx = __tuOutView[j] | 0;
          const x = (idx / H) | 0;
          const y = idx - x * H;
          xy[k] = ((x & 0xffff) << 16) | (y & 0xffff);
          const oldId = __tuOutView[j + 1] | 0;
          const newId = __tuOutView[j + 2] | 0;
          ids[k] = ((oldId & 255) | ((newId & 255) << 8)) & 0xffff;
        }
        try { __TU_OUT_POOL__.push(buf); } catch(_) { /* silently ignore */ }
        postMessage({ type: 'changesXY', buf: pbuf, n: n }, [pbuf]);
      } else {
        postMessage({ type: 'changes', buf: buf, len: len }, [buf]);
      }`;
                                                            s = s.replace(needle, repl);
                                                        }

                                                        return s;
                                                    } catch (_) {
                                                        return s;
                                                    }
                                                };
                                                TileLogicEngine.__tu_packXYWorkerSourcePatched = true;
                                            }

                                            // ---- Main thread: accept changesXY and apply using column view getter ----
                                            if (TileLogicEngine.prototype && !TileLogicEngine.prototype.__tu_packXYApplyWrapped) {
                                                TileLogicEngine.prototype.__tu_packXYApplyWrapped = true;

                                                // Column view getter (cached)
                                                TileLogicEngine.prototype.__tu_getTileCol = function (x) {
                                                    const wx = x | 0;
                                                    if (this.__tu_lastColX === wx && this.__tu_lastCol) return this.__tu_lastCol;
                                                    const cols = this.world && this.world.tiles;
                                                    const col = cols ? cols[wx] : null;
                                                    this.__tu_lastColX = wx;
                                                    this.__tu_lastCol = col;
                                                    return col;
                                                };

                                                // Wrap _initWorker to extend onmessage
                                                if (typeof TileLogicEngine.prototype._initWorker === 'function') {
                                                    const _origInit = TileLogicEngine.prototype._initWorker;
                                                    TileLogicEngine.prototype._initWorker = function () {
                                                        _origInit.call(this);

                                                        try {
                                                            if (!this.worker || this.__tu_packXYOnMsgWrapped) return;
                                                            this.__tu_packXYOnMsgWrapped = true;

                                                            const self = this;
                                                            const w = this.worker;
                                                            const oldHandler = w.onmessage;

                                                            // pending pool (reuse objects)
                                                            const pendingPool = [];
                                                            function allocPendingPacked(buf, n) {
                                                                const o = pendingPool.pop() || { type: 'xy', buf: null, n: 0, pos: 0 };
                                                                o.type = 'xy';
                                                                o.buf = buf;
                                                                o.n = n | 0;
                                                                o.pos = 0;
                                                                return o;
                                                            }
                                                            function allocPendingArr(arr) {
                                                                const o = pendingPool.pop() || { type: 'i32', arr: null, pos: 0 };
                                                                o.type = 'i32';
                                                                o.arr = arr;
                                                                o.pos = 0;
                                                                return o;
                                                            }
                                                            function freePending(o) {
                                                                o.type = 'i32';
                                                                o.arr = null;
                                                                o.buf = null;
                                                                o.n = 0;
                                                                o.pos = 0;
                                                                pendingPool.push(o);
                                                            }
                                                            self.__tu_pendingPool2 = { allocPendingPacked, allocPendingArr, freePending };

                                                            w.onmessage = (e) => {
                                                                const msg = e.data;
                                                                if (!msg || !msg.type) { if (oldHandler) try { oldHandler(e); } catch (e) { if (typeof console !== 'undefined' && console.debug) console.debug('[Debug] Silently caught:', e); } return; }

                                                                if (msg.type === 'changes' && msg.buf) {
                                                                    try {
                                                                        const len = (msg.len | 0) > 0 ? (msg.len | 0) : 0;
                                                                        const arr = len ? new Int32Array(msg.buf, 0, len) : new Int32Array(msg.buf);
                                                                        self.pending.push(allocPendingArr(arr));
                                                                        self._scheduleApply();
                                                                        return;
                                                                    } catch (e) { if (typeof console !== 'undefined' && console.debug) console.debug('[Debug] Silently caught:', e); }
                                                                }

                                                                if (msg.type === 'changesXY' && msg.buf) {
                                                                    try {
                                                                        const n = (msg.n | 0) > 0 ? (msg.n | 0) : 0;
                                                                        self.pending.push(allocPendingPacked(msg.buf, n));
                                                                        self._scheduleApply();
                                                                        return;
                                                                    } catch (e) { if (typeof console !== 'undefined' && console.debug) console.debug('[Debug] Silently caught:', e); }
                                                                }

                                                                if (oldHandler) {
                                                                    try { oldHandler(e); } catch (e) { if (typeof console !== 'undefined' && console.debug) console.debug('[Debug] Silently caught:', e); }
                                                                }
                                                            };
                                                        } catch (e) { if (typeof console !== 'undefined' && console.debug) console.debug('[Debug] Silently caught:', e); }
                                                    };
                                                }

                                                // Replace _applyPending with a packed-aware version (keeps recycle behavior)
                                                if (typeof TileLogicEngine.prototype._applyPending === 'function') {
                                                    const _origApply = TileLogicEngine.prototype._applyPending;

                                                    TileLogicEngine.prototype._applyPending = function (deadline) {
                                                        // If we don't have packed items, just use original (perfpack wrapper will recycle buffers)
                                                        let hasPacked = false;
                                                        for (let i = 0; i < this.pending.length; i++) {
                                                            const it = this.pending[i];
                                                            if (it && it.type === 'xy') { hasPacked = true; break; }
                                                        }
                                                        if (!hasPacked) return _origApply.call(this, deadline);

                                                        this._applyScheduled = false;
                                                        if (!this.pending.length) return;

                                                        const game = this.game;
                                                        const world = this.world;
                                                        const renderer = game && game.renderer;

                                                        const BL = (typeof BLOCK_LIGHT !== 'undefined') ? BLOCK_LIGHT : null;

                                                        let any = false;
                                                        const lightSeeds = [];
                                                        const maxLightSeeds = 16;

                                                        const maxOps = 2000;
                                                        let ops = 0;

                                                        const pool = this.__tu_pendingPool2 || null;
                                                        const getCol = this.__tu_getTileCol ? this.__tu_getTileCol.bind(this) : null;

                                                        while (this.pending.length && (deadline.timeRemaining() > 2 || deadline.didTimeout) && ops < maxOps) {
                                                            const cur = this.pending[0];

                                                            if (cur.type === 'xy') {
                                                                const n = cur.n | 0;
                                                                const buf = cur.buf;
                                                                if (!buf || !n) { this.pending.shift(); ops++; continue; }

                                                                const xy = new Uint32Array(buf, 0, n);
                                                                const ids = new Uint16Array(buf, n * 4, n);

                                                                while ((cur.pos | 0) < n && ops < maxOps) {
                                                                    const k = cur.pos | 0;
                                                                    cur.pos = k + 1;

                                                                    const v = xy[k] >>> 0;
                                                                    const x = (v >>> 16) & 0xffff;
                                                                    const y = v & 0xffff;
                                                                    if (x >= (this.w | 0) || y >= (this.h | 0)) { ops++; continue; }

                                                                    const pack = ids[k] >>> 0;
                                                                    const expectOld = pack & 255;
                                                                    const newId = (pack >>> 8) & 255;

                                                                    const col = getCol ? getCol(x) : (world.tiles ? world.tiles[x] : null);
                                                                    if (!col) { ops++; continue; }
                                                                    const oldMain = col[y] | 0;
                                                                    if (oldMain !== expectOld) { ops++; continue; }

                                                                    col[y] = newId;
                                                                    any = true;

                                                                    try { renderer && renderer.invalidateTile && renderer.invalidateTile(x, y); } catch (e) { if (typeof console !== 'undefined' && console.debug) console.debug('[Debug] Silently caught:', e); }

                                                                    if (BL) {
                                                                        const blOld = BL[expectOld] | 0;
                                                                        const blNew = BL[newId] | 0;
                                                                        if (blOld !== blNew && lightSeeds.length < maxLightSeeds) lightSeeds.push([x, y]);
                                                                    }

                                                                    this._minimapDirty = true;
                                                                    ops++;
                                                                }

                                                                if ((cur.pos | 0) >= n) {
                                                                    this.pending.shift();
                                                                    // recycle packed buffer back to worker
                                                                    const rbuf = cur.buf;
                                                                    if (rbuf && this.worker && typeof this.worker.postMessage === 'function') {
                                                                        try { this.worker.postMessage({ type: 'recycle', buf: rbuf }, [rbuf]); } catch (e) { if (typeof console !== 'undefined' && console.debug) console.debug('[Debug] Silently caught:', e); }
                                                                    }
                                                                    if (pool && pool.freePending) try { pool.freePending(cur); } catch (e) { if (typeof console !== 'undefined' && console.debug) console.debug('[Debug] Silently caught:', e); }
                                                                } else {
                                                                    break;
                                                                }
                                                            } else {
                                                                // Non-packed: delegate to original apply for this timeslice (keeps semantics & recycling)
                                                                _origApply.call(this, deadline);
                                                                break;
                                                            }
                                                        }

                                                        if (any) {
                                                            if (lightSeeds.length && game && game._deferLightUpdate) {
                                                                for (let i = 0; i < lightSeeds.length; i++) {
                                                                    const p = lightSeeds[i];
                                                                    try { game._deferLightUpdate(p[0], p[1]); } catch (e) { if (typeof console !== 'undefined' && console.debug) console.debug('[Debug] Silently caught:', e); }
                                                                }
                                                            }

                                                            const now = performance.now();
                                                            if (this._minimapDirty && (now - this._lastMinimapFlush > 600)) {
                                                                this._minimapDirty = false;
                                                                this._lastMinimapFlush = now;
                                                                try { game._deferMinimapUpdate && game._deferMinimapUpdate(); } catch (e) { if (typeof console !== 'undefined' && console.debug) console.debug('[Debug] Silently caught:', e); }
                                                            }
                                                        }

                                                        if (this.pending.length) this._scheduleApply();
                                                    };
                                                }
                                            }
                                        }
                                    } catch (e) { if (typeof console !== 'undefined' && console.debug) console.debug('[Debug] Silently caught:', e); }

                                })();
                            


                                (() => {
                                    'use strict';

                                    const TU = window.TU = window.TU || {};

                                    // ─────────────────────────────────────────────────────────────
                                    // 1) Toast：对象池 + 并发上限，降低 DOM churn（频繁提示时更稳）
                                    // ─────────────────────────────────────────────────────────────
                                    try {
                                        if (typeof Toast !== 'undefined' && Toast && !Toast.__tuPoolV1) {
                                            Toast.__tuPoolV1 = true;

                                            const _getHost = Toast.el ? Toast.el.bind(Toast) : (() => document.getElementById('toast-container'));

                                            const pool = [];
                                            const active = [];
                                            const MAX_ACTIVE = 4;

                                            const clearTimers = (t) => {
                                                try { if (t._hideTimer) { clearTimeout(t._hideTimer); t._hideTimer = 0; } } catch (e) { if (typeof console !== 'undefined' && console.debug) console.debug('[Debug] Silently caught:', e); }
                                                try { if (t._rmTimer) { clearTimeout(t._rmTimer); t._rmTimer = 0; } } catch (e) { if (typeof console !== 'undefined' && console.debug) console.debug('[Debug] Silently caught:', e); }
                                            };

                                            const detach = (t) => {
                                                try {
                                                    const idx = active.indexOf(t);
                                                    if (idx >= 0) active.splice(idx, 1);
                                                } catch (e) { if (typeof console !== 'undefined' && console.debug) console.debug('[Debug] Silently caught:', e); }
                                                try { if (t && t.parentNode) t.parentNode.removeChild(t); } catch (e) { if (typeof console !== 'undefined' && console.debug) console.debug('[Debug] Silently caught:', e); }
                                            };

                                            const recycle = (t) => {
                                                if (!t) return;
                                                clearTimers(t);
                                                try { t.classList.remove('show'); } catch (e) { if (typeof console !== 'undefined' && console.debug) console.debug('[Debug] Silently caught:', e); }
                                                detach(t);
                                                pool.push(t);
                                            };

                                            const make = () => {
                                                const t = document.createElement('div');
                                                t.className = 'toast';
                                                t._hideTimer = 0;
                                                t._rmTimer = 0;
                                                return t;
                                            };

                                            Toast.show = function (msg, ms = 1600) {
                                                const host = _getHost();
                                                if (!host) return;

                                                // 并发上限：超出则先回收最旧的 toast
                                                while (active.length >= MAX_ACTIVE) {
                                                    recycle(active[0]);
                                                }

                                                const t = pool.pop() || make();
                                                clearTimers(t);

                                                try { t.textContent = String(msg ?? ''); } catch (_) { t.textContent = '' + msg; }
                                                try { t.classList.remove('show'); } catch (e) { if (typeof console !== 'undefined' && console.debug) console.debug('[Debug] Silently caught:', e); }

                                                host.appendChild(t);
                                                active.push(t);

                                                requestAnimationFrame(() => { try { t.classList.add('show'); } catch (e) { if (typeof console !== 'undefined' && console.debug) console.debug('[Debug] Silently caught:', e); } });

                                                t._hideTimer = setTimeout(() => {
                                                    try { t.classList.remove('show'); } catch (e) { if (typeof console !== 'undefined' && console.debug) console.debug('[Debug] Silently caught:', e); }
                                                    t._rmTimer = setTimeout(() => recycle(t), 220);
                                                }, ms);
                                            };
                                        }
                                    } catch (e) { if (typeof console !== 'undefined' && console.debug) console.debug('[Debug] Silently caught:', e); }

                                    // ─────────────────────────────────────────────────────────────
                                    // 2) 机器逻辑：压力板 + 抽水泵（减少每帧/每 tick 的小对象分配）
                                    // ─────────────────────────────────────────────────────────────
                                    try {
                                        if (typeof Game !== 'undefined' && Game.prototype) {
                                            const GP = Game.prototype;

                                            // 2.1 压力板：用 int key 代替 "x,y" 字符串；复用 Set/Array
                                            if (typeof GP._updatePressurePlates === 'function' && !GP.__tuPlateGcOptV1) {
                                                GP.__tuPlateGcOptV1 = true;

                                                const _old = GP._updatePressurePlates;

                                                GP._updatePressurePlates = function () {
                                                    const world = this.world;
                                                    const m = this._machines;
                                                    if (!world || !m || !m.plates || !m.plates.length) return;

                                                    const IDS = (TU && TU.LOGIC_BLOCKS) ? TU.LOGIC_BLOCKS : {};
                                                    const PL_OFF = IDS.PLATE_OFF;
                                                    const PL_ON = IDS.PLATE_ON;

                                                    // 兜底：若缺少依赖，走旧实现
                                                    if (PL_OFF == null || PL_ON == null || typeof this._writeTileFast !== 'function') {
                                                        return _old.call(this);
                                                    }

                                                    const CFG = (typeof CONFIG !== 'undefined') ? CONFIG : (TU.CONFIG || { TILE_SIZE: 16 });
                                                    const ts = (CFG && CFG.TILE_SIZE) ? CFG.TILE_SIZE : 16;
                                                    const w = world.w | 0;
                                                    const h = world.h | 0;
                                                    const tiles = world.tiles;

                                                    const pressed = this._platePressed || (this._platePressed = new Set());
                                                    const next = this._plateNext || (this._plateNext = new Set());
                                                    next.clear();

                                                    const markPlateUnder = (ent) => {
                                                        if (!ent) return;
                                                        const cx = (ent.x + ent.w * 0.5);
                                                        const fy = (ent.y + ent.h + 1);
                                                        const tx = (cx / ts) | 0;
                                                        const ty = (fy / ts) | 0;
                                                        if (tx < 0 || ty < 0 || tx >= w || ty >= h) return;
                                                        const id = tiles[tx][ty];
                                                        if (id === PL_OFF || id === PL_ON) {
                                                            next.add(tx + ty * w);
                                                        }
                                                    };

                                                    // player
                                                    markPlateUnder(this.player);

                                                    // mobs/enemies if present
                                                    try {
                                                        const ents = this.entities || this.mobs || this.enemies;
                                                        if (Array.isArray(ents)) {
                                                            for (let i = 0; i < ents.length; i++) markPlateUnder(ents[i]);
                                                        }
                                                    } catch (e) { if (typeof console !== 'undefined' && console.debug) console.debug('[Debug] Silently caught:', e); }

                                                    // Apply state changes (ON for pressed, OFF for released)
                                                    for (const k of next) {
                                                        if (pressed.has(k)) continue;
                                                        pressed.add(k);
                                                        const y = (k / w) | 0;
                                                        const x = (k - y * w) | 0;
                                                        this._writeTileFast(x, y, PL_ON, false);
                                                    }

                                                    if (pressed.size) {
                                                        // 收集释放列表：避免在迭代 Set 时 delete 的边缘行为
                                                        const toOff = this._plateToOff || (this._plateToOff = []);
                                                        toOff.length = 0;
                                                        for (const k of pressed) {
                                                            if (!next.has(k)) toOff.push(k);
                                                        }
                                                        for (let i = 0; i < toOff.length; i++) {
                                                            const k = toOff[i] | 0;
                                                            pressed.delete(k);
                                                            const y = (k / w) | 0;
                                                            const x = (k - y * w) | 0;
                                                            this._writeTileFast(x, y, PL_OFF, false);
                                                        }
                                                    }
                                                };
                                            }

                                            // 2.2 抽水泵：复用 BFS 数组；邻居选择不再分配小数组
                                            if (typeof GP._pumpSim === 'function' && !GP.__tuPumpGcOptV1) {
                                                GP.__tuPumpGcOptV1 = true;

                                                const _oldPump = GP._pumpSim;

                                                GP._pumpSim = function (dtMs) {
                                                    const world = this.world;
                                                    if (!world || !world.tiles) return;

                                                    const m = this._machines;
                                                    if (!m || !m.pumpsIn || !m.pumpsOut) return;
                                                    if (!m.pumpsIn.length || !m.pumpsOut.length) return;

                                                    this._pumpAcc = (this._pumpAcc || 0) + (dtMs || 0);
                                                    if (this._pumpAcc < 220) return;
                                                    this._pumpAcc = 0;

                                                    const IDS = (TU && TU.LOGIC_BLOCKS) ? TU.LOGIC_BLOCKS : {};
                                                    const B = (typeof BLOCK !== 'undefined') ? BLOCK : (TU.BLOCK || {});

                                                    // 兜底：关键 ID/常量不全则走旧实现
                                                    if (!IDS || IDS.PUMP_IN == null || IDS.PUMP_OUT == null || IDS.WIRE_OFF == null || IDS.WIRE_ON == null || B.AIR == null || B.WATER == null) {
                                                        return _oldPump.call(this, dtMs);
                                                    }

                                                    const w = world.w | 0, h = world.h | 0;
                                                    const tiles = world.tiles;

                                                    // Visited marks for BFS
                                                    if (!this._pumpVisited || this._pumpVisited.length !== w * h) {
                                                        this._pumpVisited = new Uint32Array(w * h);
                                                        this._pumpStamp = 1;
                                                    }
                                                    let stamp = (this._pumpStamp + 1) >>> 0;
                                                    if (stamp === 0) { this._pumpVisited.fill(0); stamp = 1; }
                                                    this._pumpStamp = stamp;
                                                    const vis = this._pumpVisited;

                                                    const isWire = (id) => (id === IDS.WIRE_OFF || id === IDS.WIRE_ON);
                                                    const isSwitch = (id) => (id === IDS.SWITCH_OFF || id === IDS.SWITCH_ON || id === IDS.PLATE_OFF || id === IDS.PLATE_ON);
                                                    const isPump = (id) => (id === IDS.PUMP_IN || id === IDS.PUMP_OUT);
                                                    const isConductor = (id) => isWire(id) || isSwitch(id) || isPump(id);
                                                    const isPoweredSource = (id) => (id === IDS.SWITCH_ON || id === IDS.PLATE_ON);

                                                    const tmpIn = this._pumpTmpIn || (this._pumpTmpIn = new Int32Array(2));
                                                    const tmpOut = this._pumpTmpOut || (this._pumpTmpOut = new Int32Array(2));

                                                    const pickNeighborWater = (x, y, outXY) => {
                                                        // prefer below
                                                        let nx = x, ny = y + 1;
                                                        if (ny >= 0 && ny < h && tiles[nx][ny] === B.WATER) { outXY[0] = nx; outXY[1] = ny; return true; }
                                                        nx = x - 1; ny = y;
                                                        if (nx >= 0 && nx < w && tiles[nx][ny] === B.WATER) { outXY[0] = nx; outXY[1] = ny; return true; }
                                                        nx = x + 1;
                                                        if (nx >= 0 && nx < w && tiles[nx][ny] === B.WATER) { outXY[0] = nx; outXY[1] = ny; return true; }
                                                        nx = x; ny = y - 1;
                                                        if (ny >= 0 && ny < h && tiles[nx][ny] === B.WATER) { outXY[0] = nx; outXY[1] = ny; return true; }
                                                        return false;
                                                    };

                                                    const pickNeighborOutput = (x, y, outXY) => {
                                                        let nx = x, ny = y - 1;
                                                        if (ny >= 0 && ny < h && tiles[nx][ny] === B.AIR) { outXY[0] = nx; outXY[1] = ny; return true; }
                                                        nx = x + 1; ny = y;
                                                        if (nx >= 0 && nx < w && tiles[nx][ny] === B.AIR) { outXY[0] = nx; outXY[1] = ny; return true; }
                                                        nx = x - 1;
                                                        if (nx >= 0 && nx < w && tiles[nx][ny] === B.AIR) { outXY[0] = nx; outXY[1] = ny; return true; }
                                                        nx = x; ny = y + 1;
                                                        if (ny >= 0 && ny < h && tiles[nx][ny] === B.AIR) { outXY[0] = nx; outXY[1] = ny; return true; }
                                                        return false;
                                                    };

                                                    // Process a small number of pumps per tick to keep fps stable
                                                    const budget = (this._perf && this._perf.level === 'low') ? 1 : 3;

                                                    const qx = this._pumpQX || (this._pumpQX = []);
                                                    const qy = this._pumpQY || (this._pumpQY = []);
                                                    const outList = this._pumpOutList || (this._pumpOutList = []);

                                                    let done = 0;

                                                    for (let pi = 0; pi < m.pumpsIn.length && done < budget; pi++) {
                                                        const pIn = m.pumpsIn[pi];
                                                        if (!pIn) continue;

                                                        const sx = pIn[0] | 0;
                                                        const sy = pIn[1] | 0;

                                                        if (sx < 0 || sy < 0 || sx >= w || sy >= h) continue;
                                                        if (tiles[sx][sy] !== IDS.PUMP_IN) continue;

                                                        // BFS wire network
                                                        qx.length = 0; qy.length = 0;
                                                        outList.length = 0;
                                                        qx.push(sx); qy.push(sy);

                                                        let powered = false;
                                                        let nodes = 0;

                                                        vis[sx + sy * w] = stamp;

                                                        while (qx.length && nodes < 24000) {
                                                            const x = qx.pop() | 0;
                                                            const y = qy.pop() | 0;
                                                            nodes++;

                                                            const id = tiles[x][y];
                                                            if (isPoweredSource(id)) powered = true;
                                                            if (id === IDS.PUMP_OUT) outList.push(x + y * w);

                                                            const push = (nx, ny) => {
                                                                if (nx < 0 || ny < 0 || nx >= w || ny >= h) return;
                                                                const k = nx + ny * w;
                                                                if (vis[k] === stamp) return;
                                                                const tid = tiles[nx][ny];
                                                                if (!isConductor(tid)) return;
                                                                vis[k] = stamp;
                                                                qx.push(nx); qy.push(ny);
                                                            };

                                                            push(x - 1, y);
                                                            push(x + 1, y);
                                                            push(x, y - 1);
                                                            push(x, y + 1);
                                                        }

                                                        if (!powered || !outList.length) continue;

                                                        // intake -> output water teleport
                                                        if (!pickNeighborWater(sx, sy, tmpIn)) continue;

                                                        // pick a deterministic output (round-robin)
                                                        const rr = (this._pumpRR || 0) % outList.length;
                                                        this._pumpRR = (rr + 1) | 0;
                                                        const outK = outList[rr] | 0;
                                                        const oy = (outK / w) | 0;
                                                        const ox = (outK - oy * w) | 0;

                                                        if (!pickNeighborOutput(ox, oy, tmpOut)) continue;

                                                        // move one tile of water (coarse, region independent)
                                                        this._writeTileFast(tmpIn[0], tmpIn[1], B.AIR, false);
                                                        this._writeTileFast(tmpOut[0], tmpOut[1], B.WATER, false);

                                                        done++;
                                                    }
                                                };
                                            }
                                        }
                                    } catch (e) { if (typeof console !== 'undefined' && console.debug) console.debug('[Debug] Silently caught:', e); }
                                })();
                            

