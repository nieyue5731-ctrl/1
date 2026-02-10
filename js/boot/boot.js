
                                window.addEventListener('load', () => {
                                    const SAFE = window.TU_SAFE || {};
                                    const report = (err, ctx) => {
                                        try {
                                            if (SAFE && typeof SAFE.reportError === 'function') SAFE.reportError(err, ctx);
                                            else console.error(err);
                                        } catch (e) {
                                            try { console.error(err); } catch { }
                                        }
                                    };

                                    try {
                                        // Ensure optional turbo hooks are installed before boot (idempotent)
                                        try { if (window.__TU_APPLY_TURBO_PATCHES__) window.__TU_APPLY_TURBO_PATCHES__(); } catch (e) { try { console.warn('[Boot] Turbo patches failed', e); } catch (_) { } }

                                        const game = new Game();
                                        // 暴露实例：便于调试，也便于错误兜底层在异常时停帧/暂停
                                        window.__GAME_INSTANCE__ = game;
                                        window.game = game; // 兼容旧的 window.game 引用（错误兜底/健康检查/调试）


                                        const p = game.init();
                                        if (p && typeof p.catch === 'function') {
                                            p.catch((e) => report(e, { phase: 'init' }));
                                        }
                                    } catch (e) {
                                        report(e, { phase: 'boot' });
                                    }
                                });
