        (function initLoadingParticles() {
            const container = document.querySelector('.loading-particles');
            if (!container) return;
            const frag = document.createDocumentFragment();
            const colors = ['#ffeaa7', '#fd79a8', '#a29bfe', '#74b9ff'];
            // 动态粒子数量：综合硬件线程数与 DPR，低端/高 DPR 设备更省电
            const cores = navigator.hardwareConcurrency || 4;
            const dpr = window.devicePixelRatio || 1;
            const reduce = (() => {
                try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch { return false; }
            })();
            let particleCount = Math.round(18 + cores * 2);
            if (dpr >= 2) particleCount -= 4;
            if (dpr >= 3) particleCount -= 6;
            if (reduce) particleCount = Math.min(particleCount, 16);
            particleCount = Math.max(12, Math.min(60, particleCount));
            for (let i = 0; i < particleCount; i++) {
                const p = document.createElement('div');
                p.className = 'particle';
                p.style.left = (Math.random() * 100).toFixed(3) + '%';
                p.style.animationDelay = (Math.random() * 10).toFixed(2) + 's';
                p.style.animationDuration = (8 + Math.random() * 6).toFixed(2) + 's';
                p.style.background = colors[(Math.random() * colors.length) | 0];
                frag.appendChild(p);
            }
            container.appendChild(frag);
        })();

        // ═══════════════════════════════════════════════════════════════════════════════
        //                                  工具函数
        // ═══════════════════════════════════════════════════════════════════════════════
    

