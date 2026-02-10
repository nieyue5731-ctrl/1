
                                (() => {
                                    // 防止 toast 无限刷屏
                                    let lastAt = 0;
                                    let lastMsg = '';
                                    const safeToast = (msg) => {
                                        const now = Date.now();
                                        const m = String(msg || '未知错误');
                                        if (m === lastMsg && (now - lastAt) < 1500) return;
                                        lastAt = now;
                                        lastMsg = m;
                                        try { if (typeof Toast !== 'undefined' && Toast && Toast.show) Toast.show(m, 2600); }
                                        catch (e) { if (typeof console !== 'undefined' && console.debug) console.debug('[Debug] Silently caught:', e); }
                                    };

                                    window.addEventListener('error', (ev) => {
                                        try {
                                            const msg = ev && ev.message ? ev.message : '运行时错误';
                                            safeToast('⚠️ ' + msg);
                                            // 打印更完整的堆栈，方便排查
                                            if (ev && ev.error) console.error(ev.error);
                                            else console.error(ev);
                                        } catch (e) { if (typeof console !== 'undefined' && console.debug) console.debug('[Debug] Silently caught:', e); }
                                    });

                                    window.addEventListener('unhandledrejection', (ev) => {
                                        try {
                                            const r = ev && ev.reason;
                                            const msg = (r && (r.message || r.toString())) || '未处理的异步错误';
                                            safeToast('⚠️ ' + msg);
                                            console.error(r || ev);
                                        } catch (e) { if (typeof console !== 'undefined' && console.debug) console.debug('[Debug] Silently caught:', e); }
                                    });
                                })();
                            


                                (() => {
                                    'use strict';
                                    const TU = window.TU = window.TU || {};

                                    // ------------------------------------------------------------
                                    // Lightweight Profiler (default OFF)
                                    // ------------------------------------------------------------
                                    const Profiler = TU.Profiler = TU.Profiler || (function () {
                                        const P = {
                                            enabled: false,
                                            frame: 0,
                                            _lastUI: 0,
                                            _uiInterval: 250, // ms
                                            _now: (typeof performance !== 'undefined' && performance.now) ? () => performance.now() : () => Date.now(),
                                            _m: Object.create(null),
                                            _c: Object.create(null),
                                            _extra: Object.create(null),
                                            ui: null,

                                            beginFrame() {
                                                this.frame = (this.frame + 1) | 0;
                                                this._m.renderWorld = 0;
                                                this._m.updateLight = 0;
                                                this._m.workerApply = 0;
                                                this._c.renderWorld = 0;
                                                this._c.updateLight = 0;
                                                this._c.workerApply = 0;
                                                this._extra.workerChanges = 0;
                                            },

                                            add(name, dt, countInc = 1, extraKey = null, extraVal = 0) {
                                                if (!this.enabled) return;
                                                this._m[name] = (this._m[name] || 0) + dt;
