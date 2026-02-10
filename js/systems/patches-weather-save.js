
                                (() => {
                                    'use strict';
                                    const TU = window.TU || {};

                                    // ───────────────────────── Game: simple dynamic weather (rain/snow) + tone
                                    const Game = TU.Game;
                                    if (Game && Game.prototype && !Game.prototype._updateWeather) {
                                        function mulberry32(a) {
                                            return function () {
                                                a |= 0;
                                                a = (a + 0x6D2B79F5) | 0;
                                                let t = Math.imul(a ^ (a >>> 15), 1 | a);
                                                t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
                                                return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
                                            };
                                        }

                                        Game.prototype._updateWeather = function (dtMs) {
                                            const settings = this.settings || {};
                                            const reducedMotion = !!settings.reducedMotion;

                                            // 统一 dt（ms），做上限保护
                                            const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() :
                                                Date.now();
                                            const dt = Math.min(1000, Math.max(0, dtMs || 0));

                                            // 初始化 weather 对象（支持：clear / rain / snow / thunder / bloodmoon）
                                            if (!this.weather) {
                                                this.weather = {
                                                    type: 'clear',
                                                    intensity: 0,
                                                    targetIntensity: 0,
                                                    nextType: 'clear',
                                                    nextIntensity: 0,
                                                    lightning: 0
                                                };
                                            }
                                            const w = this.weather;

                                            if (!Number.isFinite(w.intensity)) w.intensity = 0;
                                            if (!Number.isFinite(w.targetIntensity)) w.targetIntensity = 0;
                                            if (!Number.isFinite(w.nextIntensity)) w.nextIntensity = 0;
                                            if (!Number.isFinite(w.lightning)) w.lightning = 0;
                                            if (!w.type) w.type = 'clear';
                                            if (!w.nextType) w.nextType = w.type;

                                            // 若关闭环境粒子或减少动画：直接清空天气（并同步关闭音效/后期参数）
                                            if (reducedMotion || !settings.ambient) {
                                                w.type = 'clear';
                                                w.intensity = 0;
                                                w.targetIntensity = 0;
                                                w.nextType = 'clear';
                                                w.nextIntensity = 0;
                                                w.lightning = 0;

                                                if (document && document.body) {
                                                    document.body.classList.remove('weather-on', 'weather-rain', 'weather-snow',
                                                        'weather-thunder', 'weather-bloodmoon');
                                                }
                                                if (document && document.documentElement && document.documentElement.style) {
                                                    const st = document.documentElement.style;
                                                    st.setProperty('--weather-hue', '0deg');
                                                    st.setProperty('--weather-sat', '1');
                                                    st.setProperty('--weather-bright', '1');
                                                    st.setProperty('--weather-contrast', '1');
                                                }

                                                // 全局天气后期参数：回到默认
                                                const fx0 = window.TU_WEATHER_FX || (window.TU_WEATHER_FX = {});
                                                fx0.type = 'clear';
                                                fx0.intensity = 0;
                                                fx0.gloom = 0;
                                                fx0.lightning = 0;
                                                fx0.shadowColor = 'rgb(10,5,20)';
                                                fx0.postMode = 'source-over';
                                                fx0.postR = 0; fx0.postG = 0; fx0.postB = 0; fx0.postA = 0;

                                                // 音频（合成雨声）停用
                                                if (this.audio && typeof this.audio.updateWeatherAmbience === 'function') {
                                                    this.audio.updateWeatherAmbience(dt, w);
                                                }
                                                return;
                                            }

                                            // RNG（与 seed 绑定，保持可复现）
                                            if (!this._weatherRng) {
                                                const seed = (Number.isFinite(this.seed) ? this.seed : ((Math.random() * 1e9) | 0)) >>> 0;
                                                this._weatherRng = mulberry32(seed ^ 0x9E3779B9);
                                            }
                                            const rng = this._weatherRng;

                                            if (!this._weatherNextAt) this._weatherNextAt = now + 8000 + rng() * 12000;

                                            const t = this.timeOfDay || 0;
                                            const night = (typeof Utils !== 'undefined' && Utils.nightFactor) ? Utils.nightFactor(t) :
                                                0;

                                            // 血月：只在夜晚触发，触发后尽量持续到天亮
                                            if (w.type === 'bloodmoon') {
                                                w.nextType = 'bloodmoon';
                                                w.nextIntensity = 1;
                                                w.targetIntensity = 1;

                                                // 天亮后开始淡出到 clear
                                                if (night < 0.18) {
                                                    w.nextType = 'clear'; w.nextIntensity = 0; w.targetIntensity = 0; //
                                // 允许后续重新滚天气
 if (!this._weatherNextAt || this._weatherNextAt - now > 15000) {
                                                        this._weatherNextAt = now + 8000 + rng() * 12000;
                                                    }
                                                } else {
                                                    // 血月期间，不频繁重新决策
                                                    if (this._weatherNextAt < now) this._weatherNextAt = now + 60000;
                                                }
                                            } // 决策新的天气目标（非血月时）
 if
                                            (w.type !== 'bloodmoon' && now >= this._weatherNextAt) {
                                                // dawn/dusk 略提高下雨概率；夜晚略提高下雪概率；深夜少量概率触发血月
                                                const dawn = Math.max(0, 1 - Math.abs(t - 0.28) / 0.14);
                                                const dusk = Math.max(0, 1 - Math.abs(t - 0.72) / 0.14);

                                                let pRain = 0.10 + (dawn + dusk) * 0.10;
                                                let pSnow = 0.05 + night * 0.05;

                                                // 血月概率：只在较深夜晚才可能出现
                                                let pBlood = 0;
                                                if (night > 0.55) pBlood = Math.min(0.03, 0.022 * night);

                                                pRain = Math.min(0.28, Math.max(0, pRain));
                                                pSnow = Math.min(0.16, Math.max(0, pSnow));

                                                // 选择类型（血月优先级最高）
                                                const r = rng();
                                                let nextType = 'clear';
                                                if (pBlood > 0 && r < pBlood) { nextType = 'bloodmoon'; } else {
                                                    const rr = r - pBlood;
                                                    if (rr < pSnow) nextType = 'snow'; else if (rr < pSnow + pRain) { // 雷雨：rain
                                                        // 的一个更“压抑”的分支
 const pThunder = 0.38 + night * 0.22; nextType = (rng() < pThunder)
                                                            ? 'thunder' : 'rain';
                                                    }
                                                } const nextIntensity = (nextType === 'clear') ? 0 :
                                                    (nextType === 'bloodmoon') ? 1 : (0.25 + rng() * 0.75); w.nextType = nextType;
                                                w.nextIntensity = nextIntensity; // 换天气：先淡出，再切换类型，再淡入 if (w.type !==nextType)
                                                if (w.type !== nextType) w.targetIntensity = 0; else w.targetIntensity = nextIntensity; // 下一次变更：18~45 秒
                                                this._weatherNextAt = now + 18000 + rng() * 27000;
                                            }
                                            // 当强度足够低时允许切换类型
                                            if (w.type
                                        !== w.nextType && w.intensity < 0.04 && w.targetIntensity === 0) {
                                                w.type = w.nextType; w.targetIntensity = w.nextIntensity;
                                            }
                                            // 平滑插值强度（指数趋近，防止 dt 抖动导致跳变）
                                            const tau = 650; // ms
                                            const k = 1 - Math.exp(-dt / tau);
                                            w.intensity += (w.targetIntensity - w.intensity) * k;
                                            if (Math.abs(w.intensity) < 0.001) w.intensity = 0;
                                            // 雷雨闪电：使用极短的闪光衰减（配合后期 / 光照 LUT）
                                            if (w.type === 'thunder' && w.intensity > 0.12) {
                                                if (!w._lightningNextAt) w._lightningNextAt = now + 1200 + rng() * 2800;
                                                if (now >= w._lightningNextAt) {
                                                    w.lightning = 1;
                                                    w._lightningNextAt = now + 1800 + rng() * 6500;
                                                }
                                            }
                                            if (w.lightning > 0) {
                                                w.lightning -= dt / 220;
                                                if (w.lightning < 0) w.lightning = 0;
                                            } // 应用 UI / CSS 色调（仅 rain/snow 使用轻量 CSS
                                            // filter；血月 / 雷雨交给 Renderer 的 LUT + postFX）
 const key = w.type + ':' +
                                                Math.round(w.intensity * 100) + ':' + Math.round(w.lightning * 100); if (key
                                                    !== this._weatherAppliedKey) {
                                                        this._weatherAppliedKey = key; const
                                                            cssOn = w.intensity > 0.06 && (w.type === 'rain' || w.type === 'snow');

                                                if (document && document.body) {
                                                    document.body.classList.toggle('weather-on', cssOn);
                                                    document.body.classList.toggle('weather-rain', cssOn && w.type === 'rain');
                                                    document.body.classList.toggle('weather-snow', cssOn && w.type === 'snow');

                                                    // 新增类型：用于 DOM 粒子/状态展示（不驱动 CSS filter）
                                                    document.body.classList.toggle('weather-thunder', w.type === 'thunder' &&
                                                        w.intensity > 0.06);
                                                    document.body.classList.toggle('weather-bloodmoon', w.type === 'bloodmoon'
                                                        && w.intensity > 0.06);
                                                }

                                                if (document && document.documentElement && document.documentElement.style) {
                                                    const st = document.documentElement.style;

                                                    if (!cssOn) {
                                                        st.setProperty('--weather-hue', '0deg');
                                                        st.setProperty('--weather-sat', '1');
                                                        st.setProperty('--weather-bright', '1');
                                                        st.setProperty('--weather-contrast', '1');
                                                    } else if (w.type === 'rain') {
                                                        st.setProperty('--weather-hue', (-6 * w.intensity).toFixed(1) + 'deg');
                                                        st.setProperty('--weather-sat', (1 - 0.10 * w.intensity).toFixed(3));
                                                        st.setProperty('--weather-bright', (1 - 0.10 * w.intensity).toFixed(3));
                                                        st.setProperty('--weather-contrast', (1 + 0.10 * w.intensity).toFixed(3));
                                                    } else if (w.type === 'snow') {
                                                        st.setProperty('--weather-hue', (4 * w.intensity).toFixed(1) + 'deg');
                                                        st.setProperty('--weather-sat', (1 - 0.06 * w.intensity).toFixed(3));
                                                        st.setProperty('--weather-bright', (1 + 0.08 * w.intensity).toFixed(3));
                                                        st.setProperty('--weather-contrast', (1 + 0.06 * w.intensity).toFixed(3));
                                                    }
                                                }
                                            }

                                            // ───────────────────────── Renderer 联动参数：BLOCK_LIGHT_LUT + postProcess
                                            // 色偏（供渲染阶段读取）
                                            const fx = window.TU_WEATHER_FX || (window.TU_WEATHER_FX = {});
                                            fx.type = w.type;
                                            fx.intensity = w.intensity;
                                            fx.lightning = w.lightning;

                                            // gloom：驱动光照 LUT（越大越压抑）
                                            let gloom = 0;
                                            if (w.type === 'thunder') {
                                                gloom = 0.18 + w.intensity * 0.45;
                                            } else if (w.type === 'bloodmoon') {
                                                gloom = w.intensity * (0.25 + 0.38 * night);
                                            }
                                            // clamp 0..0.75
                                            if (gloom < 0) gloom = 0; if (gloom > 0.75) gloom = 0.75;
                                            fx.gloom = gloom;

                                            // 阴影底色（暗角遮罩用）
                                            fx.shadowColor = (w.type === 'bloodmoon') ? 'rgb(30,0,6)'
                                                : (w.type === 'thunder') ? 'rgb(6,10,22)'
                                                    : 'rgb(10,5,20)';

                                            // postFX 色偏参数（在 applyPostFX 末尾叠加）
                                            if (w.type === 'thunder') {
                                                fx.postMode = 'multiply';
                                                fx.postR = 70; fx.postG = 90; fx.postB = 125;
                                                fx.postA = Math.min(0.26, 0.08 + 0.16 * w.intensity);
                                            } else if (w.type === 'bloodmoon') {
                                                fx.postMode = 'source-over';
                                                fx.postR = 160; fx.postG = 24; fx.postB = 34;
                                                fx.postA = Math.min(0.30, 0.06 + 0.22 * w.intensity);
                                            } else {
                                                fx.postMode = 'source-over';
                                                fx.postR = 0; fx.postG = 0; fx.postB = 0; fx.postA = 0;
                                            }

                                            // 音频：合成雨声（与 rain/thunder 粒子强度同步）
                                            if (this.audio && typeof this.audio.updateWeatherAmbience ===
                                                'function') {
                                                this.audio.updateWeatherAmbience(dt, w);
                                            }
                                        };
                                    }

                                    // ───────────────────────── Inventory: PointerEvents drag & drop swap
                                    (mobile - friendly)
                                    const InventoryUI = TU.InventoryUI || window.InventoryUI;
                                    if (InventoryUI && InventoryUI.prototype &&
                                        !InventoryUI.prototype.__dragDropPatched) {
                                        const proto = InventoryUI.prototype;
                                        proto.__dragDropPatched = true;

                                        proto._slotIndexFromPoint = function (clientX, clientY) {
                                            const el = document.elementFromPoint(clientX, clientY);
                                            if (!el) return -1;
                                            const slot = el.closest ? el.closest('.inv-slot') : null;
                                            if (!slot) return -1;
                                            const idx = parseInt(slot.dataset.idx, 10);
                                            return Number.isFinite(idx) ? idx : -1;
                                        };

                                        proto._dragSetSource = function (idx) {
                                            if (this._dragSourceIdx === idx) return;
                                            if (Number.isFinite(this._dragSourceIdx) && this._slotEls &&
                                                this._slotEls[this._dragSourceIdx]) {
                                                this._slotEls[this._dragSourceIdx].classList.remove('drag-source');
                                            }
                                            this._dragSourceIdx = idx;
                                            if (Number.isFinite(idx) && this._slotEls && this._slotEls[idx]) {
                                                this._slotEls[idx].classList.add('drag-source');
                                            }
                                        };

                                        proto._dragSetTarget = function (idx) {
                                            if (this._dragTargetIdx === idx) return;
                                            if (Number.isFinite(this._dragTargetIdx) && this._slotEls &&
                                                this._slotEls[this._dragTargetIdx]) {
                                                this._slotEls[this._dragTargetIdx].classList.remove('drag-target');
                                            }
                                            this._dragTargetIdx = idx;
                                            if (Number.isFinite(idx) && idx >= 0 && this._slotEls &&
                                                this._slotEls[idx]) {
                                                this._slotEls[idx].classList.add('drag-target');
                                            }
                                        };

                                        proto._dragClear = function () {
                                            this._dragPointerId = null;
                                            this._dragMoved = false;
                                            this._dragStartX = 0;
                                            this._dragStartY = 0;
                                            this._dragStartIdx = -1;

                                            this._dragSetTarget(-1);
                                            this._dragSetSource(-1);
                                        };

                                        // Close 时清理状态
                                        if (typeof proto.close === 'function') {
                                            const _oldClose = proto.close;
                                            proto.close = function () {
                                                this._dragClear && this._dragClear();
                                                return _oldClose.call(this);
                                            };
                                        }

                                        // 绑定额外的 pointermove/up 来完成拖拽交换
                                        if (typeof proto._bind === 'function') {
                                            const _oldBind = proto._bind;
                                            proto._bind = function () {
                                                _oldBind.call(this);
                                                if (this.__dragListenersAdded) return;
                                                this.__dragListenersAdded = true;

                                                const onMove = (e) => {
                                                    if (this._dragPointerId !== e.pointerId) return;
                                                    const dx = e.clientX - this._dragStartX;
                                                    const dy = e.clientY - this._dragStartY;
                                                    if (!this._dragMoved && (dx * dx + dy * dy) > 64) this._dragMoved =
                                                        true;

                                                    const idx = this._slotIndexFromPoint(e.clientX, e.clientY);
                                                    this._dragSetTarget(idx);

                                                    if (this._dragMoved) e.preventDefault();
                                                };

                                                const onUp = (e) => {
                                                    if (this._dragPointerId !== e.pointerId) return;

                                                    const moved = !!this._dragMoved;
                                                    const targetIdx = Number.isFinite(this._dragTargetIdx) ?
                                                        this._dragTargetIdx : -1;
                                                    const startIdx = Number.isFinite(this._dragStartIdx) ?
                                                        this._dragStartIdx : -1;

                                                    this._dragClear();

                                                    // 只有“真正拖动”才触发自动落下；点击不动则沿用原逻辑（继续拿在手上）
                                                    if (moved && this._cursorItem && targetIdx >= 0 && targetIdx !==
                                                        startIdx) {
                                                        this._leftClick(targetIdx);
                                                        this._changed();
                                                    }
                                                };

                                                // 这些监听不会替换原逻辑，只补全拖拽体验
                                                this.overlay.addEventListener('pointermove', onMove, {
                                                    passive: false
                                                });
                                                this.overlay.addEventListener('pointerup', onUp, { passive: true });
                                                this.overlay.addEventListener('pointercancel', onUp, { passive: true });

                                                // 兜底：防止 pointerup 在极端情况下丢失
                                                window.addEventListener('pointerup', onUp, { passive: true });
                                                window.addEventListener('pointercancel', onUp, { passive: true });
                                            };
                                        }

                                        // Slot pointerdown：开始拖拽状态
                                        if (typeof proto._onSlotPointerDown === 'function') {
                                            const _oldDown = proto._onSlotPointerDown;
                                            proto._onSlotPointerDown = function (e) {
                                                const idx = parseInt(e.currentTarget.dataset.idx, 10);
                                                const isLeft = (e.button === 0);

                                                _oldDown.call(this, e);

                                                if (!isLeft) return;
                                                if (!this._cursorItem) return;

                                                this._dragPointerId = e.pointerId;
                                                this._dragStartX = e.clientX;
                                                this._dragStartY = e.clientY;
                                                this._dragStartIdx = idx;
                                                this._dragMoved = false;

                                                this._dragSetSource(idx);
                                                this._dragSetTarget(idx);

                                                // 尝试捕获 pointer，确保移动/抬起事件稳定
                                                try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) { /*
                                                silently ignore */ }
                                            };
                                        }
                                    }
                                }
)();



                                (() => {
                                    const TU = window.TU || {};
                                    (function () {
                                        const __p = ({
                                            id: 'batching_idb_pickup_safe_v2',
                                            order: 40,
                                            description: "拾取/存档批处理与安全优化（v2）",
                                            apply: () => {
                                                (function () {
                                                    'use strict';

                                                    var TU = window.TU || {};
                                                    var Renderer = TU.Renderer;
                                                    var SaveSystem = TU.SaveSystem;
                                                    var DroppedItem = TU.DroppedItem;
                                                    var DroppedItemManager = TU.DroppedItemManager;

                                                    var CONFIG = TU.CONFIG || window.CONFIG;
                                                    var Utils = TU.Utils || window.Utils;
                                                    var BLOCK = TU.BLOCK || window.BLOCK;

                                                    // 兼容：BLOCK_LIGHT / BLOCK_COLOR 多为 script 顶层 const（不挂在 window），用 typeof 取更稳
                                                    var BL = null;
                                                    try { BL = (typeof BLOCK_LIGHT !== 'undefined') ? BLOCK_LIGHT : (window.BLOCK_LIGHT || TU.BLOCK_LIGHT); } catch (e) { BL = window.BLOCK_LIGHT || TU.BLOCK_LIGHT; }
                                                    var BC = null;
                                                    try { BC = (typeof BLOCK_COLOR !== 'undefined') ? BLOCK_COLOR : (window.BLOCK_COLOR || TU.BLOCK_COLOR); } catch (e2) { BC = window.BLOCK_COLOR || TU.BLOCK_COLOR; }

                                                    // Toast 兼容（同样可能是顶层 const）
                                                    var ToastRef = null;
                                                    try { ToastRef = (typeof Toast !== 'undefined') ? Toast : (TU.Toast || window.Toast); } catch (e3) { ToastRef = TU.Toast || window.Toast; }

                                                    // ───────────────────────── Patch Flags ─────────────────────────
                                                    var FLAGS = window.__TU_PATCH_FLAGS__ = window.__TU_PATCH_FLAGS__ || {};
                                                    try {
                                                        if (FLAGS.disableChunkBatching == null) FLAGS.disableChunkBatching = (localStorage.getItem('TU_DISABLE_CHUNK_BATCHING') === '1');
                                                        if (FLAGS.disableIDBSave == null) FLAGS.disableIDBSave = (localStorage.getItem('TU_DISABLE_IDB_SAVE') === '1');
                                                        if (FLAGS.disablePickupAnim == null) FLAGS.disablePickupAnim = (localStorage.getItem('TU_DISABLE_PICKUP_ANIM') === '1');
                                                    } catch (e) { if (typeof console !== 'undefined' && console.debug) console.debug('[Debug] Silently caught:', e); }

                                                    // ───────────────────────── IndexedDB Save (robust, async, fallback) ─────────────────────────
                                                    var idb = (function () {
                                                        var DB_NAME = 'tu_terraria_ultra_save_db_v1';
                                                        var STORE = 'kv';
                                                        var dbPromise = null;

                                                        function open() {
                                                            if (FLAGS.disableIDBSave) return Promise.resolve(null);
                                                            if (!('indexedDB' in window)) return Promise.resolve(null);
                                                            if (dbPromise) return dbPromise;

                                                            dbPromise = new Promise(function (resolve) {
                                                                try {
                                                                    var req = indexedDB.open(DB_NAME, 1);
                                                                    req.onupgradeneeded = function () {
                                                                        try {
                                                                            var db = req.result;
                                                                            if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
                                                                        } catch (e) { if (typeof console !== 'undefined' && console.debug) console.debug('[Debug] Silently caught:', e); }
                                                                    };
                                                                    req.onsuccess = function () { resolve(req.result); };
                                                                    req.onerror = function () { resolve(null); };
                                                                } catch (e) {
                                                                    resolve(null);
                                                                }
                                                            });

                                                            return dbPromise;
                                                        }

                                                        function _tx(db, mode) {
                                                            try { return db.transaction(STORE, mode).objectStore(STORE); } catch (_) { return null; }
                                                        }

                                                        function get(key) {
                                                            return open().then(function (db) {
                                                                if (!db) return null;
                                                                return new Promise(function (resolve) {
                                                                    try {
                                                                        var store = _tx(db, 'readonly');
                                                                        if (!store) return resolve(null);
                                                                        var req = store.get(key);
                                                                        req.onsuccess = function () { resolve(req.result || null); };
                                                                        req.onerror = function () { resolve(null); };
                                                                    } catch (e) {
                                                                        resolve(null);
                                                                    }
                                                                });
                                                            });
                                                        }

                                                        function set(key, value) {
                                                            return open().then(function (db) {
                                                                if (!db) return false;
                                                                return new Promise(function (resolve) {
                                                                    try {
                                                                        var store = _tx(db, 'readwrite');
                                                                        if (!store) return resolve(false);
                                                                        var req = store.put(value, key);
                                                                        req.onsuccess = function () { resolve(true); };
                                                                        req.onerror = function () { resolve(false); };
                                                                    } catch (e) {
                                                                        resolve(false);
                                                                    }
                                                                });
                                                            });
                                                        }

                                                        function del(key) {
                                                            return open().then(function (db) {
                                                                if (!db) return false;
                                                                return new Promise(function (resolve) {
                                                                    try {
                                                                        var store = _tx(db, 'readwrite');
                                                                        if (!store) return resolve(false);
                                                                        var req = store.delete(key);
                                                                        req.onsuccess = function () { resolve(true); };
                                                                        req.onerror = function () { resolve(false); };
                                                                    } catch (e) {
                                                                        resolve(false);
                                                                    }
                                                                });
                                                            });
                                                        }

                                                        return { open: open, get: get, set: set, del: del };
                                                    })();

                                                    function decodeSaveDataLikeLocalStorage(data) {
                                                        try {
                                                            if (!data) return null;
                                                            var obj = data;
                                                            if (typeof obj === 'string') {
                                                                obj = JSON.parse(obj);
                                                            }
                                                            if (!obj || obj.v !== 1) return null;

                                                            // 解码 diffs（支持旧版数组 & 新版 RLE）
                                                            var diff = new Map();
                                                            var diffs = obj.diffs;

                                                            // 旧版：["x_y_id", ...]
                                                            if (Array.isArray(diffs)) {
                                                                for (var i = 0; i < diffs.length; i++) {
                                                                    var s = diffs[i];
                                                                    if (typeof s !== 'string') continue;
                                                                    var parts = s.split('_');
                                                                    if (parts.length !== 3) continue;
                                                                    var x = parseInt(parts[0], 36);
                                                                    var y = parseInt(parts[1], 36);
                                                                    var id = parseInt(parts[2], 36);
                                                                    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(id)) continue;
                                                                    diff.set(x + ',' + y, id);
                                                                }
                                                            }
                                                            // 新版：{ fmt:'rle1', w, data:[ 'r<start>_<len>_<id>', ... ] }
                                                            else if (diffs && typeof diffs === 'object' && diffs.fmt === 'rle1' && Array.isArray(diffs.data)) {
                                                                var w = Number.isFinite(diffs.w) ? (diffs.w | 0) : (Number.isFinite(obj.w) ? (obj.w | 0) : (CONFIG && CONFIG.WORLD_WIDTH ? CONFIG.WORLD_WIDTH : 2400));
                                                                for (var j = 0; j < diffs.data.length; j++) {
                                                                    var token = diffs.data[j];
                                                                    if (typeof token !== 'string') continue;
                                                                    var t = token.charAt(0) === 'r' ? token.slice(1) : token;
                                                                    var ps = t.split('_');
                                                                    if (ps.length !== 3) continue;
                                                                    var start = parseInt(ps[0], 36);
                                                                    var len = parseInt(ps[1], 36);
                                                                    var bid = parseInt(ps[2], 36);
                                                                    if (!Number.isFinite(start) || !Number.isFinite(len) || !Number.isFinite(bid)) continue;
                                                                    if (len <= 0) continue;

                                                                    var maxLen = len;
                                                                    // 粗略防护：避免极端 token 导致卡死
                                                                    if (maxLen > 500000) maxLen = 500000;

                                                                    for (var k = 0; k < maxLen; k++) {
                                                                        var idx = start + k;
                                                                        var xx = idx % w;
                                                                        var yy = (idx / w) | 0;
                                                                        diff.set(xx + ',' + yy, bid);
                                                                    }
                                                                }
                                                            }

                                                            obj._diffMap = diff;
                                                            return obj;
                                                        } catch (e) {
                                                            return null;
                                                        }
                                                    }

                                                    if (SaveSystem && !SaveSystem.__idbPatchV2Installed) {
                                                        SaveSystem.__idbPatchV2Installed = true;

                                                        // 1) clear：同时清理 localStorage + IndexedDB
                                                        var _oldClear = SaveSystem.clear;
                                                        SaveSystem.clear = function () {
                                                            try { _oldClear && _oldClear.call(SaveSystem); } catch (_) {
                                                                try { localStorage.removeItem(SaveSystem.KEY); } catch (e) { if (typeof console !== 'undefined' && console.debug) console.debug('[Debug] Silently caught:', e); }
                                                            }
                                                            try { idb.del(SaveSystem.KEY); } catch (e) { if (typeof console !== 'undefined' && console.debug) console.debug('[Debug] Silently caught:', e); }
                                                        };

                                                        // 2) promptStartIfNeeded：如果 localStorage 没有但 IDB 有，也能提示继续
                                                        var _oldPrompt = SaveSystem.promptStartIfNeeded;
                                                        SaveSystem.promptStartIfNeeded = async function () {
                                                            try {
                                                                var hasLS = false;
                                                                try { hasLS = !!localStorage.getItem(SaveSystem.KEY); } catch (_) { hasLS = false; }

                                                                var hasIDB = false;
                                                                if (!hasLS && !FLAGS.disableIDBSave) {
                                                                    try { hasIDB = !!(await idb.get(SaveSystem.KEY)); } catch (_) { hasIDB = false; }
                                                                }

                                                                if (!hasLS && !hasIDB) return { mode: 'new', save: null };

                                                                var overlay = document.getElementById('save-prompt-overlay');
                                                                var btnC = document.getElementById('save-prompt-continue');
                                                                var btnN = document.getElementById('save-prompt-new');
                                                                var btnX = document.getElementById('save-prompt-close');

                                                                if (!overlay || !btnC || !btnN) return { mode: 'new', save: null };

                                                                return await new Promise(function (resolve) {
                                                                    var resolved = false;

                                                                    var cleanup = function () {
                                                                        overlay.classList.remove('show');
                                                                        overlay.setAttribute('aria-hidden', 'true');
                                                                        btnC.removeEventListener('click', onC);
                                                                        btnN.removeEventListener('click', onN);
                                                                        if (btnX) btnX.removeEventListener('click', onX);
                                                                    };

                                                                    var done = function (mode) {
                                                                        if (resolved) return;
                                                                        resolved = true;
                                                                        cleanup();

                                                                        if (mode !== 'continue') {
                                                                            resolve({ mode: mode, save: null });
                                                                            return;
                                                                        }

                                                                        // 继续：优先 localStorage，失败再读 IDB
                                                                        (async function () {
                                                                            var save = null;
                                                                            try { save = SaveSystem.load ? SaveSystem.load() : null; } catch (_) { save = null; }
                                                                            if (!save && !FLAGS.disableIDBSave) {
                                                                                try {
                                                                                    var raw = await idb.get(SaveSystem.KEY);
                                                                                    save = decodeSaveDataLikeLocalStorage(raw);
                                                                                } catch (_) { save = null; }
                                                                            }
                                                                            resolve({ mode: 'continue', save: save });
                                                                        })();
                                                                    };

                                                                    var onC = function () { done('continue'); };
                                                                    var onN = function () { done('new'); };
                                                                    var onX = function () { done('new'); };

                                                                    overlay.classList.add('show');
                                                                    overlay.setAttribute('aria-hidden', 'false');
                                                                    btnC.addEventListener('click', onC);
                                                                    btnN.addEventListener('click', onN);
                                                                    if (btnX) btnX.addEventListener('click', onX);
                                                                });
                                                            } catch (e) {
                                                                // 兜底：回退到旧实现
                                                                try {
                                                                    return _oldPrompt ? await _oldPrompt.call(SaveSystem) : { mode: 'new', save: null };
                                                                } catch (_) {
                                                                    return { mode: 'new', save: null };
                                                                }
                                                            }
                                                        };

                                                        // 3) save：localStorage 写入 + IDB 备份；localStorage 爆 quota 时自动切到 IDB 不影响继续玩
                                                        if (SaveSystem.prototype && typeof SaveSystem.prototype.save === 'function') {
                                                            var _oldSave = SaveSystem.prototype.save;

                                                            SaveSystem.prototype.save = function (reason) {
                                                                // 尽量复用原逻辑；但为了拿到 payload，这里做一次“轻度复制”以保证 IDB 一定能写到
                                                                if (reason === undefined) reason = 'manual';
                                                                if (this._disabled) return;

                                                                var g = this.game;
                                                                if (!g || !g.world || !g.player) return;

                                                                // diff 太大时：停用自动保存，但允许手动保存（尤其是 IDB）
                                                                if (this.diff && this.diff.size > 50000) {
                                                                    if (reason === 'autosave') {
                                                                        if (!this._autosaveDisabled) {
                                                                            this._autosaveDisabled = true;
                                                                            if (ToastRef && ToastRef.show) ToastRef.show('⚠️ 改动过多：自动保存已停用（可手动保存/清理存档）', 2800);
                                                                        }
                                                                        return;
                                                                    }
                                                                }

                                                                var payload = {
                                                                    v: 1,
                                                                    ts: Date.now(),
                                                                    seed: g.seed || this.seed || Date.now(),
                                                                    timeOfDay: g.timeOfDay || 0.35,
                                                                    player: {
                                                                        x: g.player.x, y: g.player.y,
                                                                        health: g.player.health, mana: g.player.mana,
                                                                        inventory: g.player.inventory,
                                                                        selectedSlot: g.player.selectedSlot
                                                                    },
                                                                    w: g.world.w, h: g.world.h,
                                                                    diffs: SaveSystem._encodeDiff ? SaveSystem._encodeDiff(this.diff, g.world.w) : { fmt: 'rle1', w: g.world.w, data: [] }
                                                                };

                                                                var lsOk = false;
                                                                // localStorage 写入（如果此前已确认 quota 不够，可跳过避免每次 throw）
                                                                if (!this._lsFailed) {
                                                                    try {
                                                                        localStorage.setItem(SaveSystem.KEY, JSON.stringify(payload));
                                                                        lsOk = true;
                                                                    } catch (e) {
                                                                        this._lsFailed = true;
                                                                        lsOk = false;
                                                                    }
                                                                }

                                                                // IDB 备份（异步，不阻塞帧）
                                                                if (!FLAGS.disableIDBSave) {
                                                                    try {
                                                                        idb.set(SaveSystem.KEY, payload).then(function (ok) {
                                                                            if (!ok) return;
                                                                            // 若 localStorage 失败，则提示“已保存(IDB)”，避免用户以为没存上
                                                                            if (!lsOk && ToastRef && ToastRef.show) {
                                                                                if (reason === 'manual') ToastRef.show('💾 已保存（IndexedDB）');
                                                                                if (reason === 'autosave') ToastRef.show('✅ 自动保存（IndexedDB）', 1100);
                                                                            }
                                                                        }).catch(_ => { /* silently ignore */ });
                                                                    } catch (e) { if (typeof console !== 'undefined' && console.debug) console.debug('[Debug] Silently caught:', e); }
                                                                }

                                                                // Toast：保持原体验（localStorage 成功时才显示，避免重复）
                                                                if (lsOk) {
                                                                    try {
                                                                        if (ToastRef && ToastRef.show) {
                                                                            if (reason === 'manual') ToastRef.show('💾 已保存');
                                                                            if (reason === 'autosave') ToastRef.show('✅ 自动保存', 1100);
                                                                        }
                                                                    } catch (e) { if (typeof console !== 'undefined' && console.debug) console.debug('[Debug] Silently caught:', e); }
                                                                } else {
                                                                    // 两种存储都不可用时，才彻底禁用
                                                                    if (FLAGS.disableIDBSave) {
                                                                        this._disabled = true;
                                                                        if (ToastRef && ToastRef.show) ToastRef.show('⚠️ 存档失败：空间不足，已停用自动保存', 2600);
                                                                    }
                                                                }
                                                            };

                                                            // tickAutosave：尊重 _autosaveDisabled
                                                            if (typeof SaveSystem.prototype.tickAutosave === 'function') {
                                                                var _oldTick = SaveSystem.prototype.tickAutosave;
                                                                SaveSystem.prototype.tickAutosave = function (dt) {
                                                                    if (this._autosaveDisabled) return;
                                                                    return _oldTick.call(this, dt);
                                                                };
                                                            }
                                                        }
                                                    }

