
        (() => {
            const minimapEl = document.getElementById('minimap');
            if (!minimapEl) return;

            const root = document.documentElement;
            const isMobileNow = () => root.classList.contains('is-mobile');

            window.TU = window.TU || {};

            const computeScale = (state) => {
                // offsetWidth/Height 不受 transform 影响，正好作为“基准尺寸”
                const baseW = minimapEl.offsetWidth || 160;
                const baseH = minimapEl.offsetHeight || 100;

                let targetW = baseW, targetH = baseH;

                if (state === 'collapsed') {
                    targetW = 44; targetH = 44;
                } else if (state === 'expanded') {
                    targetW = Math.min(360, Math.round(window.innerWidth * 0.70));
                    targetH = Math.min(240, Math.round(window.innerHeight * 0.45));
                }

                const sx = Math.max(0.1, targetW / baseW);
                const sy = Math.max(0.1, targetH / baseH);

                minimapEl.style.setProperty('--mm-sx', sx.toFixed(4));
                minimapEl.style.setProperty('--mm-sy', sy.toFixed(4));
            };

            const setState = (state) => {
                minimapEl.dataset.state = state;
                minimapEl.classList.toggle('minimap-collapsed', state === 'collapsed');
                minimapEl.classList.toggle('minimap-expanded', state === 'expanded');

                // 折叠时跳过小地图渲染，省电（尤其移动端）
                window.TU.MINIMAP_VISIBLE = (state !== 'collapsed');

                computeScale(state);
            };

            // 初始化：移动端默认折叠（关闭），桌面端默认正常显示
            setState(isMobileNow() ? 'collapsed' : 'normal');

            const toggle = () => {
                const state = minimapEl.dataset.state || 'normal';
                if (state === 'collapsed') {
                    setState('expanded');
                } else if (state === 'expanded') {
                    setState(isMobileNow() ? 'collapsed' : 'normal');
                } else {
                    setState('expanded');
                }
            };

            // 对外暴露：键盘快捷键 / 其他系统可直接调用
            window.TU.toggleMinimap = toggle;
            window.TU.setMinimapState = setState;

            // resize/orientation 变化时重算缩放（保持展开尺寸一致）
            let raf = 0;
            const sync = () => {
                raf = 0;
                computeScale(minimapEl.dataset.state || 'normal');
            };
            const schedule = () => { if (!raf) raf = requestAnimationFrame(sync); };
            window.addEventListener('resize', schedule, { passive: true });
            window.addEventListener('orientationchange', schedule, { passive: true });

            minimapEl.setAttribute('role', 'button');
            minimapEl.tabIndex = 0;
            minimapEl.setAttribute('aria-label', '小地图（点击展开/收起）');
            minimapEl.setAttribute('aria-keyshortcuts', 'M');

            minimapEl.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                toggle();
            });

            minimapEl.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggle();
                }
            });
        })();
