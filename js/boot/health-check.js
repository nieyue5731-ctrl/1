
(function() {
    'use strict';

    // 页面卸载时清理资源
    window.addEventListener('beforeunload', function() {
        // 清理所有Worker
        if (window.TU && TU._worldWorkerClient && TU._worldWorkerClient.worker) {
            try { TU._worldWorkerClient.worker.terminate(); } catch (e) {}
        }
        // 清理ImageBitmap
        if (window.TU && TU._worldWorkerClient && TU._worldWorkerClient._lastBitmap) {
            try { TU._worldWorkerClient._lastBitmap.close(); } catch (e) {}
        }
        // 清理资源管理器
        if (window.TU_Defensive && window.TU_Defensive.ResourceManager) {
            try { window.TU_Defensive.ResourceManager.disposeAll(); } catch (e) {}
        }
    });

    // 单一健康检查定时器 (每30秒)
    setInterval(function() {
        // 检查Worker健康状态
        if (window.TU && TU._worldWorkerClient) {
            const client = TU._worldWorkerClient;
            if (client._frameTimeouts > 10) {
                console.error('[HealthCheck] Too many frame timeouts, resetting worker');
                try {
                    if (client.worker) client.worker.terminate();
                    client.worker = null;
                    client._initSent = false;
                    client._frameTimeouts = 0;
                    client._frameInFlight = false;
                } catch (e) {}
            }
        }

        // 检查游戏状态
        const game = window.__GAME_INSTANCE__ || window.game;
        if (game) {
            // 检查玩家位置有效性
            if (game.player && game.world) {
                const px = game.player.x;
                const py = game.player.y;
                if (typeof px !== 'number' || typeof py !== 'number' ||
                    isNaN(px) || isNaN(py) || !isFinite(px) || !isFinite(py)) {
                    console.error('[HealthCheck] Invalid player position, resetting');
                    game.player.x = game.world.w * 16 / 2;
                    game.player.y = game.world.h * 16 / 2;
                }
            }

            // 检查游戏循环是否冻结
            if (game._lastFrameTime && Date.now() - game._lastFrameTime > 10000) {
                console.error('[HealthCheck] Game loop appears frozen');
                if (typeof game.loop === 'function' && !game._rafRunning) {
                    game._rafRunning = true;
                    requestAnimationFrame((ts) => game.loop(ts));
                }
            }
        }
    }, 30000);

    console.log('[Cleanup] 统一清理与健康检查已注册');
})();
