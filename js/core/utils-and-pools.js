        <div id="stats">
            <div class="stat-bar">
                <span class="icon">💖</span>
                <div class="bar">
                    <div class="fill" id="health-fill" style="width:100%"></div>
                    <span class="value" id="health-value">100/100</span>
                </div>
            </div>
            <div class="stat-bar">
                <span class="icon">💫</span>
                <div class="bar">
                    <div class="fill" id="mana-fill" style="width:100%"></div>
                    <span class="value" id="mana-value">50/50</span>
                </div>
            </div>
        </div>
        <div id="minimap"><canvas id="minimap-canvas"></canvas></div>
        <div id="fps" style="position: absolute; top: 70px; right: 100px;">60 FPS</div>
        <button id="fullscreen-btn" style="position: absolute; top: 50%; right: 10px; transform: translateY(-50%);"
            aria-label="全屏 (F)" aria-keyshortcuts="F">⛶</button>
        <div id="time-display" style="position: absolute; top: 70px; right: 15px;"><span id="time-icon">☀️</span> <span
                id="time-text">12:00</span></div>
        <div id="info">
            <span class="highlight">AD</span> 移动 |
            <span class="highlight">W和空格</span> 跳跃 |
            <span class="highlight">左键</span> 挖掘 |
            <span class="highlight">右键</span> 放置 |
            <span class="highlight">E</span> 工作台 |
            <span class="highlight">B</span> 背包 |
            <span class="highlight">1-9</span> 切换
        </div>
        <div aria-hidden="true" id="mining-bar">
            <div class="mb-top">
                <canvas class="mb-icon" height="18" id="mining-icon" width="18"></canvas>
                <div class="mb-name" id="mining-name">挖掘中…</div>
                <div class="mb-percent" id="mining-percent">0%</div>
            </div>
            <div class="mb-track">
                <div class="fill"></div>
            </div>
        </div>
    </div>
    <div id="mobile-controls">
        <div class="joystick-container" id="joystick">
            <div class="joystick-base"></div>
            <div class="joystick-thumb" id="joystick-thumb"></div>
        </div>
        <div class="jump-container">
            <div class="action-btn jump" id="btn-jump">⬆️</div>
        </div>
        <div class="action-buttons">
            <div class="action-row">
                <div class="action-btn mine" id="btn-mine">⛏️</div>
                <div class="action-btn place" id="btn-place">🧱</div>
            </div>
        </div>
    </div>
    <div id="crosshair"></div>




        // ╔═══════════════════════════════════════════════════════════════════════════════╗
        // ║                    TERRARIA ULTRA - 全面深度优化 v3                           ║
        // ║                    性能优化 & 代码质量提升 & 新功能                            ║
        // ╚═══════════════════════════════════════════════════════════════════════════════╝


        // ═══════════════════ 对象池优化 (防御性重构版) ═══════════════════
        const ObjectPool = {
            _pools: new Map(),
            _typeCount: 0,
            MAX_TYPES: 100,
            MAX_POOL_SIZE: 500,
            
            get(type, factory) {
                // 验证类型参数
                if (typeof type !== 'string' || type.length === 0) {
                    console.warn('[ObjectPool] Invalid type parameter');
                    return factory();
                }
                
                let pool = this._pools.get(type);
                if (!pool) {
                    // 配额限制检查
                    if (this._typeCount >= this.MAX_TYPES) {
                        console.warn('[ObjectPool] Type quota exceeded');
                        return factory();
                    }
                    pool = [];
                    this._pools.set(type, pool);
                    this._typeCount++;
                }
                
                if (pool.length > 0) {
                    return pool.pop();
                }
                return factory();
            },
            
            release(type, obj) {
                // 验证参数
                if (!obj || typeof obj !== 'object') {
                    console.warn('[ObjectPool] Invalid object to release');
                    return;
                }
                
                if (typeof type !== 'string') {
                    console.warn('[ObjectPool] Invalid type for release');
                    return;
                }
                
                let pool = this._pools.get(type);
                if (!pool) {
                    if (this._typeCount >= this.MAX_TYPES) return;
                    pool = [];
                    this._pools.set(type, pool);
                    this._typeCount++;
                }
                
                if (pool.length < this.MAX_POOL_SIZE) {
                    pool.push(obj);
                }
            },
            
            clear(type) {
                if (type) {
                    if (this._pools.has(type)) {
                        this._pools.delete(type);
                        this._typeCount = Math.max(0, this._typeCount - 1);
                    }
                } else {
                    this._pools.clear();
                    this._typeCount = 0;
                }
            },
            
            getStats() {
                let totalObjects = 0;
                this._pools.forEach(pool => { totalObjects += pool.length; });
                return {
                    typeCount: this._typeCount,
                    totalObjects: totalObjects,
                    maxTypes: this.MAX_TYPES,
                    maxPoolSize: this.MAX_POOL_SIZE
                };
            }
        };
        window.ObjectPool = ObjectPool;

        // ═══════════════════ 向量池优化 (防御性重构版) ═══════════════════
        const VecPool = {
            _pool: [],
            _maxSize: 200,
            _releasedCount: 0,
            _acquiredCount: 0,
            
            get(x = 0, y = 0) {
                // 验证坐标参数
                const safeX = Number.isFinite(x) ? x : 0;
                const safeY = Number.isFinite(y) ? y : 0;
                
                this._acquiredCount++;
                
                if (this._pool.length > 0) {
                    const v = this._pool.pop();
                    if (v && typeof v === 'object') {
                        v.x = safeX;
                        v.y = safeY;
                        v._pooled = false; // mark as acquired
                        return v;
                    }
                }
                return { x: safeX, y: safeY, _pooled: false };
            },
            
            release(v) {
                // 严格验证
                if (!v || typeof v !== 'object') return;
                
                // 防止重复释放：use tag instead of O(n) includes()
                if (v._pooled) return;
                
                this._releasedCount++;
                
                if (this._pool.length < this._maxSize) {
                    v.x = 0;
                    v.y = 0;
                    v._pooled = true;
                    this._pool.push(v);
                }
            },
            
            getStats() {
                return {
                    poolSize: this._pool.length,
                    maxSize: this._maxSize,
                    acquired: this._acquiredCount,
                    released: this._releasedCount
                };
            },
            
            clear() {
                this._pool = [];
                this._acquiredCount = 0;
                this._releasedCount = 0;
            }
        };
        window.VecPool = VecPool;

        // ═══════════════════ 数组池优化 (防御性重构版) ═══════════════════
        const ArrayPool = {
            _pools: new Map(),
            _typeCount: 0,
            MAX_TYPES: 10,
            MAX_POOL_SIZE: 50,
            
            get(size = 0) {
                // 验证size参数
                const safeSize = Number.isInteger(size) && size >= 0 ? size : 0;
                const key = safeSize <= 16 ? 16 : safeSize <= 64 ? 64 : safeSize <= 256 ? 256 : 1024;
                
                let pool = this._pools.get(key);
                if (!pool) {
                    if (this._typeCount >= this.MAX_TYPES) {
                        console.warn('[ArrayPool] Type quota exceeded');
                        return new Array(safeSize);
                    }
                    pool = [];
                    this._pools.set(key, pool);
                    this._typeCount++;
                }
                
                if (pool.length > 0) {
                    const arr = pool.pop();
                    if (Array.isArray(arr)) {
                        arr.length = 0;
                        arr._pooled = false; // mark as acquired
                        return arr;
                    }
                }
                return new Array(safeSize);
            },
            
            release(arr) {
                // 严格验证
                if (!Array.isArray(arr)) {
                    console.warn('[ArrayPool] Attempted to release non-array');
                    return;
                }
                
                // 防止重复释放
                const len = arr.length;
                const key = len <= 16 ? 16 : len <= 64 ? 64 : len <= 256 ? 256 : 1024;
                let pool = this._pools.get(key);
                
                if (!pool) {
                    if (this._typeCount >= this.MAX_TYPES) return;
                    pool = [];
                    this._pools.set(key, pool);
                    this._typeCount++;
                }
                
                if (pool.length < this.MAX_POOL_SIZE) {
                    // Tag-based double-release prevention (O(1) vs O(n) includes)
                    if (arr._pooled) return;
                    arr._pooled = true;
                    arr.length = 0;
                    pool.push(arr);
                }
            },
            
            getStats() {
                let totalArrays = 0;
                this._pools.forEach(pool => { totalArrays += pool.length; });
                return {
                    typeCount: this._typeCount,
                    totalArrays: totalArrays,
                    maxTypes: this.MAX_TYPES,
                    maxPoolSize: this.MAX_POOL_SIZE
                };
            },
            
            clear() {
                this._pools.clear();
                this._typeCount = 0;
            }
        };
        window.ArrayPool = ArrayPool;

        // ═══════════════════ 内存优化工具 (防御性重构版) ═══════════════════
        const MemoryManager = {
            _lastCleanup: 0,
            _cleanupInterval: 30000, // 30秒清理一次
            _cleanupCount: 0,
            _maxCleanups: 10000, // 防止无限清理
            
            tick(now) {
                // 验证时间戳
                if (!Number.isFinite(now)) {
                    console.warn('[MemoryManager] Invalid timestamp');
                    return;
                }
                
                // 防止清理次数过多
                if (this._cleanupCount >= this._maxCleanups) {
                    return;
                }
                
                if (now - this._lastCleanup > this._cleanupInterval) {
                    this._lastCleanup = now;
                    this._cleanupCount++;
                    this.cleanup();
                }
            },

            cleanup() {
                try {
                    // 清理对象池中过多的对象
                    if (window.ObjectPool && window.ObjectPool._pools) {
                        window.ObjectPool._pools.forEach((pool, type) => {
                            if (Array.isArray(pool) && pool.length > 100) {
                                // 清理多余对象的引用
                                for (let i = 100; i < pool.length; i++) {
                                    const obj = pool[i];
                                    if (obj && typeof obj === 'object') {
                                        Object.keys(obj).forEach(key => { obj[key] = null; });
                                    }
                                }
                                pool.length = 100;
                            }
                        });
                    }
                    
                    if (window.VecPool && Array.isArray(window.VecPool._pool) && window.VecPool._pool.length > 100) {
                        window.VecPool._pool.length = 100;
                    }
                    
                    if (window.ArrayPool && window.ArrayPool._pools) {
                        window.ArrayPool._pools.forEach((pool) => {
                            if (Array.isArray(pool) && pool.length > 20) {
                                pool.length = 20;
                            }
                        });
                    }
                } catch (e) {
                    console.error('[MemoryManager] Cleanup error:', e);
                }
            },

            getStats() {
                const stats = {
                    objectPools: 0,
                    vecPool: 0,
                    arrayPools: 0,
                    cleanupCount: this._cleanupCount
                };
                
                try {
                    if (window.VecPool && Array.isArray(window.VecPool._pool)) {
                        stats.vecPool = window.VecPool._pool.length;
                    }
                    if (window.ObjectPool && window.ObjectPool._pools) {
                        window.ObjectPool._pools.forEach(pool => {
                            if (Array.isArray(pool)) stats.objectPools += pool.length;
                        });
                    }
                    if (window.ArrayPool && window.ArrayPool._pools) {
                        window.ArrayPool._pools.forEach(pool => {
                            if (Array.isArray(pool)) stats.arrayPools += pool.length;
                        });
                    }
                } catch (e) {
                    console.error('[MemoryManager] Stats error:', e);
                }
                
                return stats;
            },
            
            reset() {
                this._cleanupCount = 0;
                this._lastCleanup = 0;
            }
        };
        window.MemoryManager = MemoryManager;

        // ═══════════════════ 事件优化工具 ═══════════════════
        const EventUtils = {
            throttle(fn, delay) {
                let last = 0;
                let timer = null;
                return function (...args) {
                    const now = Date.now();
                    if (now - last >= delay) {
                        last = now;
                        fn.apply(this, args);
                    } else if (!timer) {
                        timer = setTimeout(() => {
                            timer = null;
                            last = Date.now();
                            fn.apply(this, args);
                        }, delay - (now - last));
                    }
                };
            },

            debounce(fn, delay) {
                let timer = null;
                return function (...args) {
                    clearTimeout(timer);
                    timer = setTimeout(() => fn.apply(this, args), delay);
                };
            },

            // RAF节流 - 确保每帧最多执行一次 (防御性重构版)
            rafThrottle(fn) {
                // 验证函数参数
                if (typeof fn !== 'function') {
                    console.warn('[EventUtils.rafThrottle] Invalid function');
                    return () => {};
                }
                
                let scheduled = false;
                let lastArgs = null;
                let rafId = null;
                
                return function (...args) {
                    lastArgs = args;
                    if (!scheduled) {
                        scheduled = true;
                        rafId = requestAnimationFrame(() => {
                            scheduled = false;
                            rafId = null;
                            try {
                                fn.apply(this, lastArgs);
                            } catch (e) {
                                console.error('[EventUtils.rafThrottle] Callback error:', e);
                            }
                            lastArgs = null; // 清理引用
                        });
                    }
                };
            },
            
            // 带取消功能的throttle
            throttleCancellable(fn, delay) {
                if (typeof fn !== 'function') {
                    console.warn('[EventUtils.throttleCancellable] Invalid function');
                    return { call: () => {}, cancel: () => {} };
                }
                
                let last = 0;
                let timer = null;
                
                const call = function (...args) {
                    const now = Date.now();
                    if (now - last >= delay) {
                        last = now;
                        clearTimeout(timer);
                        timer = null;
                        try {
                            fn.apply(this, args);
                        } catch (e) {
                            console.error('[EventUtils.throttleCancellable] Error:', e);
                        }
                    } else if (!timer) {
                        timer = setTimeout(() => {
                            timer = null;
                            last = Date.now();
                            try {
                                fn.apply(this, args);
                            } catch (e) {
                                console.error('[EventUtils.throttleCancellable] Delayed error:', e);
                            }
                        }, delay - (now - last));
                    }
                };
                
                const cancel = () => {
                    clearTimeout(timer);
                    timer = null;
                    last = 0;
                };
                
                return { call, cancel };
            }
        };
        window.EventUtils = EventUtils;

        // ═══════════════════ 性能监控 (防御性重构版) ═══════════════════
        const PerfMonitor = {
            _samples: [],
            _maxSamples: 60,
            _lastFrame: 0,
            _frameCount: 0,
            _maxFrameCount: 1000000, // 防止溢出
            _errorCount: 0,
            _maxErrors: 100,

            frame(timestamp) {
                // 验证时间戳
                if (!Number.isFinite(timestamp)) {
                    this._errorCount++;
                    if (this._errorCount <= this._maxErrors) {
                        console.warn('[PerfMonitor] Invalid timestamp');
                    }
                    return;
                }
                
                // 防止溢出
                if (this._frameCount >= this._maxFrameCount) {
                    this.reset();
                }
                this._frameCount++;
                
                if (this._lastFrame) {
                    const delta = timestamp - this._lastFrame;
                    // 验证delta
                    if (delta > 0 && delta < 10000) { // 合理的帧时间范围
                        this._samples.push(delta);
                        if (this._samples.length > this._maxSamples) {
                            this._samples.shift();
                        }
                    }
                }
                this._lastFrame = timestamp;
            },
            
            reset() {
                this._samples = [];
                this._lastFrame = 0;
                this._frameCount = 0;
            },

            getAverageFPS() {
                if (!Array.isArray(this._samples) || this._samples.length === 0) return 60;
                
                try {
                    // 过滤异常值
                    const validSamples = this._samples.filter(s => s > 0 && s < 1000);
                    if (validSamples.length === 0) return 60;
                    
                    const avg = validSamples.reduce((a, b) => a + b, 0) / validSamples.length;
                    return Math.max(1, Math.min(999, Math.round(1000 / avg)));
                } catch (e) {
                    console.error('[PerfMonitor] getAverageFPS error:', e);
                    return 60;
                }
            },

            getMinFPS() {
                if (!Array.isArray(this._samples) || this._samples.length === 0) return 60;
                
                try {
                    const validSamples = this._samples.filter(s => s > 0 && s < 1000);
                    if (validSamples.length === 0) return 60;
                    
                    const max = Math.max(...validSamples);
                    return Math.max(1, Math.min(999, Math.round(1000 / max)));
                } catch (e) {
                    console.error('[PerfMonitor] getMinFPS error:', e);
                    return 60;
                }
            },

            getFrameTimeStats() {
                if (!Array.isArray(this._samples) || this._samples.length === 0) {
                    return { avg: '16.67', min: '16.67', max: '16.67' };
                }
                
                try {
                    const validSamples = this._samples.filter(s => s > 0 && s < 1000);
                    if (validSamples.length === 0) return { avg: '16.67', min: '16.67', max: '16.67' };
                    
                    const avg = validSamples.reduce((a, b) => a + b, 0) / validSamples.length;
                    return {
                        avg: avg.toFixed(2),
                        min: Math.min(...validSamples).toFixed(2),
                        max: Math.max(...validSamples).toFixed(2)
                    };
                } catch (e) {
                    console.error('[PerfMonitor] getFrameTimeStats error:', e);
                    return { avg: '16.67', min: '16.67', max: '16.67' };
                }
            }
        };
        window.PerfMonitor = PerfMonitor;

        // ═══════════════════ 纹理缓存优化 (防御性重构版) ═══════════════════
        // TextureCache: O(1) LRU using Map iteration order (delete+re-insert)
        const TextureCache = {
            _cache: new Map(),  // Map preserves insertion order; delete+set = move to end
            _maxSize: 200,
            _hitCount: 0,
            _missCount: 0,

            get(key) {
                if (key === undefined || key === null) return null;
                
                const val = this._cache.get(key);
                if (val !== undefined) {
                    this._hitCount++;
                    // O(1) LRU update: delete and re-insert moves key to end
                    this._cache.delete(key);
                    this._cache.set(key, val);
                    return val;
                }
                
                this._missCount++;
                return null;
            },

            set(key, value) {
                if (key === undefined || key === null) return;
                
                // Update existing: delete first to refresh insertion order
                if (this._cache.has(key)) {
                    this._cache.delete(key);
                    this._cache.set(key, value);
                    return;
                }

                // LRU eviction: Map.keys().next() gives oldest entry in O(1)
                while (this._cache.size >= this._maxSize) {
                    const oldest = this._cache.keys().next().value;
                    const cached = this._cache.get(oldest);
                    if (cached && cached.src) cached.src = '';
                    this._cache.delete(oldest);
                }

                this._cache.set(key, value);
            },
            
            getStats() {
                const total = this._hitCount + this._missCount;
                return {
                    size: this._cache.size,
                    maxSize: this._maxSize,
                    hits: this._hitCount,
                    misses: this._missCount,
                    hitRate: total > 0 ? (this._hitCount / total * 100).toFixed(2) + '%' : 'N/A'
                };
            },

            clear() {
                this._cache.forEach(texture => {
                    if (texture && texture.src) texture.src = '';
                });
                this._cache.clear();
                this._hitCount = 0;
                this._missCount = 0;
            }
        };
        window.TextureCache = TextureCache;

        // ═══════════════════ 批量渲染优化 ═══════════════════
        const BatchRenderer = {
            _batches: new Map(),
            _currentBatch: null,

            begin(ctx) {
                this._batches.clear();
                this._ctx = ctx;
            },

            addTile(texture, x, y, alpha = 1) {
                const key = texture.src || texture;
                if (!this._batches.has(key)) {
                    this._batches.set(key, []);
                }
                this._batches.get(key).push({ texture, x, y, alpha });
            },

            flush() {
                const ctx = this._ctx;
                if (!ctx) return;

                this._batches.forEach((tiles, key) => {
                    // 按alpha分组绘制
                    let currentAlpha = 1;
                    ctx.globalAlpha = 1;

                    for (const tile of tiles) {
                        if (tile.alpha !== currentAlpha) {
                            currentAlpha = tile.alpha;
                            ctx.globalAlpha = currentAlpha;
                        }
                        ctx.drawImage(tile.texture, tile.x, tile.y);
                    }
                });

                ctx.globalAlpha = 1;
                this._batches.clear();
            }
        };
        window.BatchRenderer = BatchRenderer;

        // ═══════════════════ 懒加载优化 ═══════════════════
        const LazyLoader = {
            _pending: new Map(),
            _loaded: new Set(),

            load(key, loader) {
                if (this._loaded.has(key)) {
                    return Promise.resolve();
                }

                if (this._pending.has(key)) {
                    return this._pending.get(key);
                }

                const promise = loader().then(() => {
                    this._loaded.add(key);
                    this._pending.delete(key);
                }).catch(err => {
                    this._pending.delete(key);
                    throw err;
                });

                this._pending.set(key, promise);
                return promise;
            },

            isLoaded(key) {
                return this._loaded.has(key);
            }
        };
        window.LazyLoader = LazyLoader;

        // NOTE: Global error handlers already registered in TU_Defensive module (head).
        // Removed duplicate handlers here to avoid double-logging.

        window.TU = window.TU || {};
