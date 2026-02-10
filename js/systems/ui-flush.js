
        (() => {
            'use strict';
            const TU = (window.TU = window.TU || {});
            if (TU.UIFlushScheduler) return;

            /**
             * UIFlushScheduler
             * - 只收集“DOM 写操作”（最后一次覆盖前面的）
             * - 在游戏 rAF 的统一 flush 阶段执行，避免每帧/每个子步频繁写 DOM
             */
            class UIFlushScheduler {
                constructor() {
                    this._map = new Map();
                    this._order = [];
                    this._flushing = false;
                }

                enqueue(key, fn) {
                    if (!key || typeof fn !== 'function') return;
                    const k = String(key);
                    if (!this._map.has(k)) this._order.push(k);
                    this._map.set(k, fn);
                }

                clear() {
                    this._map.clear();
                    this._order.length = 0;
                }

                flush() {
                    if (this._flushing) return;
                    if (this._order.length === 0) return;

                    this._flushing = true;
                    try {
                        for (let i = 0; i < this._order.length; i++) {
                            const k = this._order[i];
                            const fn = this._map.get(k);
                            if (fn) {
                                try { fn(); } catch (e) { /* 单个 UI 写入失败不影响主循环 */ }
                            }
                        }
                    } finally {
                        this.clear();
                        this._flushing = false;
                    }
                }
            }

            TU.UIFlushScheduler = UIFlushScheduler;
        })();
    
