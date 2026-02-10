        class Game {
            constructor() {
                this.canvas = document.getElementById('game');
                this.renderer = new Renderer(this.canvas);
                this.particles = new ParticleSystem();
                this.ambientParticles = new AmbientParticles();
                this.droppedItems = new DroppedItemManager(); // 掉落物管理器

                // RAF 主循环：复用回调，避免每帧闭包分配；切后台可自动停帧省电
                this._rafCb = this.loop.bind(this);
                this._rafRunning = false;
                this._rafStoppedForHidden = false;

                // 自适应性能：低帧率自动降级（不改玩法，只改特效/辉光）
                this._perf = {
                    level: 'high', // 'high' | 'low'
                    fps: 60,
                    t0: 0,
                    frames: 0,
                    lowForMs: 0,
                    highForMs: 0
                };

                this.world = null;
                this.player = null;
                this.camera = { x: 0, y: 0 };

                // Camera shake (subtle, for landing feedback)
                this._shakeMs = 0;
                this._shakeTotalMs = 0;
                this._shakeAmp = 0;
                this._shakeX = 0;
                this._shakeY = 0;

                this.input = { left: false, right: false, jump: false, sprint: false, mouseX: 0, mouseY: 0, mouseLeft: false, mouseRight: false };
                this.isMobile = Utils.isMobile();

                // UX+：加载设置并立即应用到文档（影响摇杆/按钮尺寸、小地图显示、减少动态等）
                this.settings = GameSettings.applyToDocument(GameSettings.load());

                // UI Flush：集中 DOM 写入（避免每帧/每子步直接写 DOM）
                try {
                    const UFS = (window.TU && window.TU.UIFlushScheduler) ? window.TU.UIFlushScheduler : null;
                    this.uiFlush = UFS ? new UFS() : null;
                } catch (_) { this.uiFlush = null; }

                // Quality/Performance Manager：统一下发 dprCap/粒子上限/光照&小地图刷新频率/渲染特效开关
                try {
                    const QM = (window.TU && window.TU.QualityManager) ? window.TU.QualityManager : null;
                    this.quality = QM ? new QM(this) : null;
                } catch (_) { this.quality = null; }

                this.fpsEl = document.getElementById('fps');
                this.audio = new AudioManager(this.settings);
                this.audio.arm();
                this.saveSystem = new SaveSystem(this);
                this.paused = false;
                this._inputBlocked = false;
                this.seed = null;
                this._lastManualSaveAt = 0;
                // 系统分层：集中管理各子系统，降低 Game 的“上帝对象”体积
                this.services = Object.freeze({
                    input: new InputManager(this),
                    inventory: new InventorySystem(this),
                });

                this.timeOfDay = 0.35;
                this.lastTime = 0;
                this.frameCount = 0;
                this.fps = 60;
                this.lastFpsUpdate = 0;

                // 传奇史诗级手感优化：固定时间步长 + 插值渲染（更稳、更跟手、更不飘）
                this._fixedStep = 1000 / 60;      // 16.6667ms
                this._accumulator = 0;
                this._maxSubSteps = 5;            // 防止极端帧卡导致“物理螺旋”
                this._camPrevX = 0;
                this._camPrevY = 0;
                this._renderCamera = { x: 0, y: 0 };
                this._lookAheadX = 0;

                this.ui = null;
                this.minimap = null;
                this.touchController = null;

                this.miningProgress = 0;
                this.miningTarget = null;

                // 光照扩散：复用队列与 visited 标记，避免 Set+shift 带来的卡顿
                this._lightVisited = null;
                this._lightVisitMark = 1;
                this._lightQx = [];
                this._lightQy = [];
                this._lightQl = [];
                this._lightSrcX = [];
                this._lightSrcY = [];
                this._lightSrcL = [];
                this._latestTouchInput = null;

                // 连续放置保护：固定时间步长下，移动端长按可能在同一帧内触发多次放置，导致卡顿/卡死
                // 方案：放置动作节流 + 将昂贵的光照/小地图/UI 更新合并为“每帧最多一次”
                this._nextPlaceAt = 0;
                this._placeIntervalMs = (this.settings && this.settings.placeIntervalMs) ? this.settings.placeIntervalMs : 80; // 默认约 12.5 次/秒
                this._deferred = { light: [], hotbar: false, minimap: false };

                // Quality/Performance Manager 下发：昂贵系统的刷新频率
                this._lightIntervalMs = 0;        // 光照刷新节流（0=不节流）
                this._lastLightUpdateAt = 0;

                // 切换标签页/锁屏：重置计时器，避免回到页面时“瞬移/掉帧抖动”
                this._wasHidden = false;
                document.addEventListener('visibilitychange', () => {
                    if (document.hidden) {
                        this._wasHidden = true;
                        this._stopRafForHidden();
                        if (this.quality && typeof this.quality.onVisibilityChange === 'function') this.quality.onVisibilityChange(true);
                    } else {
                        if (this.quality && typeof this.quality.onVisibilityChange === 'function') this.quality.onVisibilityChange(false);
                        // 回到前台：重置计时器，避免超大 dt；如之前停帧则恢复
                        this.lastTime = performance.now();
                        this._accumulator = 0;
                        this._wasHidden = false;
                        this._resumeRafIfNeeded();
                    }
                }, { passive: true });

                this._bindEvents();
            }

            addCameraShake(amp = 1.5, ms = 100) {
                // Respect reduced motion; also keep it subtle
                try {
                    if (this.settings && this.settings.reducedMotion) return;
                } catch (e) { if (typeof console !== 'undefined' && console.debug) console.debug('[Debug] Silently caught:', e); }
                const a = Math.max(0, +amp || 0);
                const d = Math.max(0, +ms || 0);
                if (d <= 0 || a <= 0) return;

                // Stack by taking the stronger/longer
                this._shakeAmp = Math.max(this._shakeAmp || 0, a);
                this._shakeMs = Math.max(this._shakeMs || 0, d);
                this._shakeTotalMs = Math.max(this._shakeTotalMs || 0, this._shakeMs);
            }

            _tickCameraShake(dtClamped) {
                if (!this._shakeMs || this._shakeMs <= 0) {
                    this._shakeMs = 0;
                    this._shakeTotalMs = 0;
                    this._shakeAmp = 0;
                    this._shakeX = 0;
                    this._shakeY = 0;
                    return;
                }

                this._shakeMs = Math.max(0, this._shakeMs - dtClamped);
                const total = Math.max(1, this._shakeTotalMs || 1);
                const t = this._shakeMs / total; // 1 -> 0
                const strength = (this._shakeAmp || 0) * t;

                // Light, slightly vertical-biased shake
                this._shakeX = (Math.random() * 2 - 1) * strength;
                this._shakeY = (Math.random() * 2 - 1) * strength * 0.65;
            }

            async init() {
                const loadProgress = DOM.byId(UI_IDS.loadProgress);
                const loadStatus = DOM.byId(UI_IDS.loadStatus);

                // UX+：存档选择（若存在则允许继续）
                const start = await SaveSystem.promptStartIfNeeded();
                const save = (start && start.mode === 'continue') ? start.save : null;
                if (start && start.mode === 'new') {
                    // 新世界会覆盖旧进度
                    SaveSystem.clear();
                }

                const seed = (save && Number.isFinite(save.seed)) ? save.seed : Date.now();
                this.seed = seed;
                this.saveSystem.seed = seed;

                const gen = new WorldGenerator(CONFIG.WORLD_WIDTH, CONFIG.WORLD_HEIGHT, seed);
                const data = await gen.generate((s, p) => {
                    loadStatus.textContent = s;
                    loadProgress.style.width = p + '%';
                });

                this.world = data;

                // 如果有存档：应用世界差异与玩家状态
                if (save) {
                    this.saveSystem.importLoaded(save);
                    this.saveSystem.applyToWorld(this.world, save);
                    // 轻量刷新光照/小地图（避免全量重算）
                    try {
                        let c = 0;
                        for (const k of (save._diffMap ? save._diffMap.keys() : [])) {
                            const [x, y] = k.split(',').map(n => parseInt(n, 10));
                            if (Number.isFinite(x) && Number.isFinite(y)) this._updateLight(x, y);
                            if (++c > 4000) break; // 防止极端情况下卡顿
                        }
                        this.minimap && this.minimap.invalidate();
                    } catch { }

                    if (typeof save.timeOfDay === 'number' && isFinite(save.timeOfDay)) {
                        this.timeOfDay = save.timeOfDay;
                    }
                    Toast.show('🗂 已读取存档', 1400);
                }

                const spawnX = Math.floor(CONFIG.WORLD_WIDTH / 2);
                let spawnY = 0;
                for (let y = 0; y < CONFIG.WORLD_HEIGHT; y++) {
                    if (this.world.tiles[spawnX][y] !== BLOCK.AIR) { spawnY = y - 3; break; }
                }

                this.player = new Player(spawnX * CONFIG.TILE_SIZE, spawnY * CONFIG.TILE_SIZE);
                this.ui = new UIManager(this.player, this.renderer.textures, this.uiFlush);
                this.crafting = new CraftingSystem(this);
                this.inventoryUI = new InventoryUI(this);
                this.minimap = new Minimap(this.world);
                if (this.quality && typeof this.quality.onSettingsChanged === 'function') this.quality.onSettingsChanged();

                // 存档：恢复玩家属性与背包
                if (save) {
                    this.saveSystem.applyToPlayer(this.player, this.ui, save);
                }

                // 设备提示文案
                applyInfoHintText(this.isMobile);

                // 绑定 UX+ 按钮（暂停/设置/保存等）
                wireUXUI(this);

                if (this.isMobile) {
                    this.touchController = new TouchController(this);
                }

                // 资源预热：强制生成常用纹理/辉光，避免开局瞬间卡顿或闪烁
                try {
                    const warmTex = this.renderer && this.renderer.textures;
                    if (warmTex && warmTex.get) {
                        const ids = Object.keys(BLOCK_DATA).map(Number).filter(n => Number.isFinite(n));
                        const total = ids.length || 1;

                        for (let i = 0; i < ids.length; i++) {
                            const id = ids[i];
                            warmTex.get(id);
                            if (this.renderer.enableGlow && warmTex.getGlow && BLOCK_LIGHT[id] > 5) warmTex.getGlow(id);

                            // 让出主线程：避免卡死 loading 动画
                            if ((i % 18) === 0) {
                                const p = Math.round((i / total) * 100);
                                loadProgress.style.width = p + '%';
                                loadStatus.textContent = '🎨 预热纹理 ' + p + '%';
                                await new Promise(r => setTimeout(r, 0));
                            }
                        }

                        loadProgress.style.width = '100%';
                        loadStatus.textContent = '✅ 纹理就绪';
                    }

                    // 强制初始化玩家缓存（避免首帧闪烁）
                    if (Player && Player._initSpriteCache) Player._initSpriteCache();
                } catch (e) {
                    console.warn('prewarm failed', e);
                }

                // 淡出加载界面
                const loading = DOM.byId(UI_IDS.loading);
                loading.style.transition = 'opacity 0.5s';
                loading.style.opacity = '0';
                setTimeout(() => loading.style.display = 'none', 500);

                this._startRaf();
            }

            _bindEvents() {
                // 分层：输入绑定委托给 InputManager（行为不变）
                this.services.input.bind();
            }

            // ───────────────────────── 性能自适应（体验优化） ─────────────────────────
            _setQuality(level) {
                if (this._perf.level === level) return;
                this._perf.level = level;

                // 低档时同步给 CSS（UI 也可降级特效）：与 QualityManager.apply 的 tu-low-power 互补
                try {
                    if (typeof document !== 'undefined' && document.documentElement) {
                        document.documentElement.classList.toggle('tu-quality-low', level === 'low');
                    }
                } catch (e) { if (typeof console !== 'undefined' && console.debug) console.debug('[Debug] Silently caught:', e); }
                // 粒子数量：低档减少上限，显著降低 GC 与 draw calls
                if (this.particles) this.particles.max = (level === 'low') ? 220 : 400;

                // 发光方块阴影辉光：低档关闭 shadowBlur（通常是最吃性能的 2D 特效之一）
                if (this.renderer) this.renderer.enableGlow = (level !== 'low');

                // 动态分辨率：低档略降渲染分辨率，能显著提升帧率且视觉几乎无损
                if (this.renderer && this.renderer.setResolutionScale) {
                    this.renderer.lowPower = (level === 'low');
                    this.renderer.setResolutionScale(level === 'low' ? 0.85 : 1);
                }

                // 夜间萤火虫：低档降低数量（不彻底关闭，保留氛围）
                if (this.ambientParticles && this.ambientParticles.container) {
                    this.ambientParticles.container.style.opacity = (level === 'low') ? '0.7' : '1';
                }

                // 反馈提示（不打扰，1 秒消失）
                try { Toast.show(level === 'low' ? '⚡ 已自动降低特效以保持流畅' : '✨ 已恢复高特效', 1000); } catch { }
            }

            _haptic(ms) {
                if (!this.isMobile) return;
                if (!this.settings || this.settings.vibration === false) return;
                try { if (navigator.vibrate) navigator.vibrate(ms); } catch { }
            }

            _perfTick(dtClamped) {
                // 每帧统计，0.5 秒刷新一次 fps
                const p = this._perf;
                p.frames++;

                const now = this.lastTime; // loop 内已更新 lastTime
                if (!p.t0) p.t0 = now;

                const span = now - p.t0;
                if (span < 500) return;

                const fps = (p.frames * 1000) / span;
                p.fps = fps;
                p.frames = 0;
                p.t0 = now;

                // 连续低于阈值 2 秒：降级；连续高于阈值 3 秒：恢复
                if (fps < 45) {
                    p.lowForMs += span;
                    p.highForMs = 0;
                } else if (fps > 56) {
                    p.highForMs += span;
                    p.lowForMs = 0;
                } else {
                    // 中间区间：不累计
                    p.lowForMs = Math.max(0, p.lowForMs - span * 0.5);
                    p.highForMs = Math.max(0, p.highForMs - span * 0.5);
                }

                const autoQ = (!this.settings) || (this.settings.autoQuality !== false);
                // 动态分辨率微调（AutoQuality 下启用）：用“更平滑”的方式稳住帧率，避免一刀切抖动
                // 注意：只在 0.5s 的统计窗口内调整一次，不会造成频繁 resize
                if (autoQ && this.renderer && this.renderer.setResolutionScale) {
                    const f = fps;
                    let target = 1;
                    if (f < 35) target = 0.72;
                    else if (f < 45) target = 0.72 + (f - 35) * (0.13 / 10); // 0.72 -> 0.85
                    else if (f < 58) target = 0.85 + (f - 45) * (0.15 / 13); // 0.85 -> 1.00
                    else target = 1;

                    // 已处于 low 档时，略降低上限以进一步省电（不影响玩法）
                    if (p.level === 'low') target = Math.min(target, 0.90);

                    const cur = (typeof this.renderer.resolutionScale === 'number') ? this.renderer.resolutionScale : 1;
                    const next = cur + (target - cur) * 0.35;
                    this.renderer.setResolutionScale(next);
                }

                if (autoQ) {
                    if (p.level === 'high' && p.lowForMs >= 2000) this._setQuality('low');
                    if (p.level === 'low' && p.highForMs >= 3000) this._setQuality('high');
                } else {
                    // 手动模式：不做自动切换，避免来回抖动
                    p.lowForMs = 0;
                    p.highForMs = 0;
                }
            }

            _startRaf() {
                if (this._rafRunning) return;
                this._rafRunning = true;
                if (this._rafRunning) requestAnimationFrame(this._rafCb);
            }

            _stopRafForHidden() {
                this._rafRunning = false;
                this._rafStoppedForHidden = true;
            }

            _resumeRafIfNeeded() {
                if (this._rafRunning) return;
                if (!this._rafStoppedForHidden) return;
                if (document.hidden) return;
                this._rafStoppedForHidden = false;
                // 避免切回前台产生超大 dt
                this.lastTime = 0;
                this._accumulator = 0;
                this._startRaf();
            }

            loop(timestamp) {
                // 允许外部显式停帧（例如错误兜底层/手动暂停渲染）
                if (!this._rafRunning) return;

                // 切后台：停帧省电（不再继续排队 RAF）
                if (document.hidden) {
                    this._stopRafForHidden();
                    return;
                }

                // 固定时间步长：物理/手感不再随 FPS 浮动；渲染用插值保证顺滑
                if (!this.lastTime) this.lastTime = timestamp;

                let dtRaw = timestamp - this.lastTime;
                if (dtRaw < 0) dtRaw = 0;
                // 防止切回标签页/卡顿造成“物理螺旋”
                if (dtRaw > 250) dtRaw = 250;
                this.lastTime = timestamp;

                this.frameCount++;
                if (timestamp - this.lastFpsUpdate > 500) {
                    const span = (timestamp - this.lastFpsUpdate) || 1;
                    this.fps = Math.round(this.frameCount * 1000 / span);
                    this.frameCount = 0;
                    this.lastFpsUpdate = timestamp;
                    if (this.fpsEl && this.settings && this.settings.showFps) {
                        const el = this.fpsEl;
                        const v = this.fps + ' FPS';
                        if (this.uiFlush && typeof this.uiFlush.enqueue === 'function') {
                            this.uiFlush.enqueue('hud:fps', () => { if (el) el.textContent = v; });
                        } else {
                            el.textContent = v;
                        }
                    }
                    if (this.quality) this.quality.onFpsSample(this.fps, span);
                }

                const step = this._fixedStep || 16.6667;
                this._accumulator = (this._accumulator || 0) + dtRaw;

                let subSteps = 0;
                if (!this.paused) {
                    while (this._accumulator >= step && subSteps < (this._maxSubSteps || 5)) {
                        this._camPrevX = this.camera.x;
                        this._camPrevY = this.camera.y;
                        this.update(step);
                        this._accumulator -= step;
                        subSteps++;
                    }
                    if (subSteps === 0) { // 没有推进逻辑帧时，插值基准=当前相机
                        this._camPrevX = this.camera.x;
                        this._camPrevY = this.camera.y;
                    }
                    // 仍未追上：丢弃余量，避免越积越多
                    if (subSteps === (this._maxSubSteps || 5)) this._accumulator = 0;
                } else {
                    // 暂停时保持渲染（画面不黑屏），但不推进物理/时间
                    this._accumulator = 0;
                    if (this.ui) { this.ui.updateStats(); this.ui.updateTime(this.timeOfDay); }
                    this._camPrevX = this.camera.x;
                    this._camPrevY = this.camera.y;
                }

                // 合并处理交互引起的昂贵更新（光照/小地图/快捷栏），每帧最多一次
                this._flushDeferredWork();

                // 插值相机（避免低帧/抖动时画面“跳格”）
                const alpha = step > 0 ? (this._accumulator / step) : 0;
                const rc = this._renderCamera || (this._renderCamera = { x: this.camera.x, y: this.camera.y });
                rc.x = this._camPrevX + (this.camera.x - this._camPrevX) * alpha;
                rc.y = this._camPrevY + (this.camera.y - this._camPrevY) * alpha;

                // Apply subtle camera shake (render-time interpolation + shake offset)
                if (this._shakeMs > 0) {
                    rc.x += this._shakeX || 0;
                    rc.y += this._shakeY || 0;
                }

                this.render();

                // UI flush 阶段：统一写入 HUD/Overlay DOM
                if (this.uiFlush) this.uiFlush.flush();

                if (this._rafRunning) requestAnimationFrame(this._rafCb);
            }

            update(dt) {
                const dtClamped = Math.min(dt, 50);
                const dtScale = dtClamped / 16.6667;

                // camera shake (updated in fixed-step)
                this._tickCameraShake(dtClamped);

                // Keyboard: compute hold-to-sprint in fixed-step (stable, no jitter)
                const _im = (this.services && this.services.input) ? this.services.input : null;
                if (_im && typeof _im.tick === 'function') _im.tick(dtClamped);

                let input = this.input;

                // 移动端：TouchController.getInput() 已改为复用对象，这里再复用 mergedInput，避免每帧分配新对象
                if (this.isMobile && this.touchController) {
                    const ti = this.touchController.getInput();
                    this._latestTouchInput = ti;

                    const mi = this._mergedInput || (this._mergedInput = {
                        left: false, right: false, jump: false, sprint: false,
                        mouseX: 0, mouseY: 0, mouseLeft: false, mouseRight: false
                    });

                    mi.left = ti.left;
                    mi.right = ti.right;
                    mi.jump = ti.jump;
                    mi.sprint = ti.sprint;
                    mi.mouseLeft = ti.mine;
                    mi.mouseRight = ti.place;

                    if (ti.hasTarget) {
                        mi.mouseX = ti.targetX;
                        mi.mouseY = ti.targetY;
                    } else {
                        // 无目标时：默认瞄准玩家（转换为屏幕坐标）
                        mi.mouseX = this.player.cx() - this.camera.x;
                        mi.mouseY = this.player.cy() - this.camera.y;
                    }

                    input = mi;
                } else {
                    this._latestTouchInput = null;

                    // Desktop: merge shift-sprint + hold-to-sprint (A/D hold) into a stable input object
                    const ki = this._kbInput || (this._kbInput = {
                        left: false, right: false, jump: false, sprint: false,
                        mouseX: 0, mouseY: 0, mouseLeft: false, mouseRight: false
                    });

                    ki.left = this.input.left;
                    ki.right = this.input.right;
                    ki.jump = this.input.jump;
                    ki.mouseX = this.input.mouseX;
                    ki.mouseY = this.input.mouseY;
                    ki.mouseLeft = this.input.mouseLeft;
                    ki.mouseRight = this.input.mouseRight;

                    ki.sprint = !!(this.input.sprint || (_im && _im._holdSprint));

                    input = ki;
                }

                this.player.update(input, this.world, dtClamped);

                // Sprint speed feel: drive a subtle motion-blur intensity for PostFX
                try {
                    const r = this.renderer;
                    if (r) {
                        const base = CONFIG.PLAYER_SPEED;
                        const max = CONFIG.PLAYER_SPEED * CONFIG.SPRINT_MULT;
                        const vx = Math.abs(this.player.vx || 0);

                        let target = 0;
                        if (this.player && this.player._sprintActive) {
                            const denom = Math.max(0.001, (max - base * 0.8));
                            target = Utils.clamp((vx - base * 0.8) / denom, 0, 1);

                            // Extra punch right after sprint starts
                            if (this.player && this.player._sprintVfxMs > 0) target = Math.max(target, 0.85);
                        }

                        const cur = (typeof r._speedBlurAmt === 'number') ? r._speedBlurAmt : 0;
                        const smooth = 1 - Math.pow(1 - 0.22, dtScale); // fast response, still smooth
                        r._speedBlurAmt = cur + (target - cur) * smooth;
                        r._speedBlurDirX = (this.player.vx >= 0) ? 1 : -1;
                    }
                } catch (e) { if (typeof console !== 'undefined' && console.debug) console.debug('[Debug] Silently caught:', e); }

                // 镜头前瞻：奔跑方向更“看得见前方”，打怪/挖掘更舒服（带平滑，不卡顿）
                const lookStrength = (this.settings && typeof this.settings.lookAhead === 'number') ? this.settings.lookAhead : 1.0;
                const desiredLook = Utils.clamp(this.player.vx * 22 * lookStrength, -220 * lookStrength, 220 * lookStrength);
                const lookSmooth = 1 - Math.pow(1 - 0.12, dtScale);
                this._lookAheadX = (this._lookAheadX || 0) + (desiredLook - (this._lookAheadX || 0)) * lookSmooth;

                const targetX = this.player.cx() - this.renderer.w / 2 + this._lookAheadX;
                const targetY = this.player.cy() - this.renderer.h / 2;
                const maxX = this.world.w * CONFIG.TILE_SIZE - this.renderer.w;
                const maxY = this.world.h * CONFIG.TILE_SIZE - this.renderer.h;

                const baseCam = (this.settings && typeof this.settings.cameraSmooth === 'number') ? this.settings.cameraSmooth : 0.08;
                const camSmooth = 1 - Math.pow(1 - baseCam, dtScale);
                this.camera.x += (Utils.clamp(targetX, 0, maxX) - this.camera.x) * camSmooth;
                this.camera.y += (Utils.clamp(targetY, 0, maxY) - this.camera.y) * camSmooth;

                this._handleInteraction(input, dtScale);
                if (this.settings.particles) this.particles.update(dtScale);
                if (this._updateWeather) this._updateWeather(dtClamped);
                if (this.settings.ambient) this.ambientParticles.update(this.timeOfDay, this.weather);
                // 更新掉落物
                this.droppedItems.update(this.world, this.player, dt, (blockId, count) => {
                    const success = this._addToInventory(blockId, count);
                    if (success) {
                        // 拾取成功
                        this.audio && this.audio.play('pickup');
                        // 发射粒子效果（查表避免对象查找）
                        const col = BLOCK_COLOR[blockId] || '#ffeaa7';
                        this.particles.emit(this.player.cx(), this.player.cy() - 10, {
                            color: col,
                            count: 8,
                            speed: 2,
                            size: 3,
                            up: true,
                            gravity: 0.05,
                            glow: true
                        });
                    }
                    return success;
                });

                this.timeOfDay += dtClamped / CONFIG.DAY_LENGTH;
                if (this.timeOfDay >= 1) this.timeOfDay = 0;
                this.saveSystem.tickAutosave(dtClamped);

                this.ui.updateStats();
                this.ui.updateTime(this.timeOfDay);
            }

            _handleInteraction(input, dtScale = 1) {
                if (this._inputBlocked) {
                    this.miningProgress = 0;
                    this.miningTarget = null;
                    this.ui.hideMining();
                    return;
                }
                const worldX = input.mouseX + this.camera.x;
                const worldY = input.mouseY + this.camera.y;

                const ts = CONFIG.TILE_SIZE;
                let tileX = Math.floor(worldX / ts);
                let tileY = Math.floor(worldY / ts);
                if (this.isMobile && this.settings && this.settings.aimAssist) {
                    tileX = Math.floor((worldX + ts * 0.5) / ts);
                    tileY = Math.floor((worldY + ts * 0.5) / ts);
                }

                const dx = worldX - this.player.cx();
                const dy = worldY - this.player.cy();
                const reachPx = CONFIG.REACH_DISTANCE * CONFIG.TILE_SIZE;
                const inRange = (dx * dx + dy * dy) <= (reachPx * reachPx);

                if (tileX < 0 || tileX >= this.world.w || tileY < 0 || tileY >= this.world.h) { this.miningProgress = 0; this.miningTarget = null; this.ui && this.ui.hideMining && this.ui.hideMining(); return; }

                const item = this.player.getItem();
                const block = this.world.tiles[tileX][tileY];

                if (input.mouseLeft && inRange) {
                    if (block !== BLOCK.AIR && block !== BLOCK.BEDROCK) {
                        const hardness = BLOCK_HARDNESS[block];
                        const color = BLOCK_COLOR[block] || '#fff';
                        const glow = BLOCK_LIGHT[block] > 0;
                        const speed = (item && item.id === 'pickaxe' && typeof item.speed === 'number') ? item.speed : 0.4;

                        if (!this.miningTarget || this.miningTarget.x !== tileX || this.miningTarget.y !== tileY) {
                            this.miningTarget = { x: tileX, y: tileY };
                            this.miningProgress = 0;
                        }

                        this.miningProgress += speed * 0.02 * dtScale;

                        if (Math.random() < Math.min(1, 0.3 * dtScale)) {
                            this.particles.emit(tileX * CONFIG.TILE_SIZE + 8, tileY * CONFIG.TILE_SIZE + 8, {
                                color: color, count: 3, speed: 2.5, glow: glow
                            });
                        }

                        this.ui.showMining(
                            tileX * CONFIG.TILE_SIZE - this.camera.x + CONFIG.TILE_SIZE / 2,
                            tileY * CONFIG.TILE_SIZE - this.camera.y,
                            Math.min(1, this.miningProgress / hardness),
                            block
                        );

                        if (this.miningProgress >= hardness) {
                            // 挖掘成功，生成掉落物
                            const dropX = tileX * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2 - 6;
                            const dropY = tileY * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2 - 6;
                            if (block === BLOCK.TREASURE_CHEST && this._spawnTreasureChestLoot) {
                                this._spawnTreasureChestLoot(tileX, tileY, dropX, dropY);
                            } else {
                                this.droppedItems.spawn(dropX, dropY, block, 1);
                            }

                            this.world.tiles[tileX][tileY] = BLOCK.AIR;
                            this.saveSystem && this.saveSystem.markTile(tileX, tileY, BLOCK.AIR);
                            const hd = (BLOCK_DATA[block] && BLOCK_DATA[block].hardness) ? BLOCK_DATA[block].hardness : 1;
                            const vib = (hd <= 1) ? 5 : (hd <= 2) ? 12 : (hd <= 3) ? 20 : Math.min(35, Math.round(20 + (hd - 3) * 4));
                            this._haptic(vib);
                            this.audio && this.audio.play('mine');
                            this.particles.emit(tileX * CONFIG.TILE_SIZE + 8, tileY * CONFIG.TILE_SIZE + 8, {
                                color: color, count: 10, speed: 4, glow: glow
                            });
                            this.miningProgress = 0;
                            this.miningTarget = null;
                            this.ui.hideMining();
                            this._deferLightUpdate(tileX, tileY);
                            this._deferMinimapUpdate();
                        }
                    }
                } else {
                    this.miningProgress = 0;
                    this.miningTarget = null;
                    this.ui.hideMining();
                }

                if (input.mouseRight && inRange && !input.mouseLeft) {
                    const nowMs = performance.now();
                    const placeInterval = (this._perf && this._perf.level === 'low') ? (this._placeIntervalMs + 30) : this._placeIntervalMs;
                    if (nowMs >= (this._nextPlaceAt || 0) && item && typeof item.id === 'number' && typeof item.count === 'number' && item.count > 0 && item.id !== BLOCK.AIR) {
                        if (block === BLOCK.AIR || BLOCK_LIQUID[block]) {
                            const ts = CONFIG.TILE_SIZE;
                            const br = { x: tileX * ts, y: tileY * ts, w: ts, h: ts };
                            const pr = { x: this.player.x, y: this.player.y, w: this.player.w, h: this.player.h };

                            const collides = !(br.x + br.w < pr.x || br.x > pr.x + pr.w || br.y + br.h < pr.y || br.y > pr.y + pr.h);

                            if (!collides || item.id === BLOCK.TORCH) {
                                this.world.tiles[tileX][tileY] = item.id;
                                this._nextPlaceAt = nowMs + placeInterval;
                                this.saveSystem && this.saveSystem.markTile(tileX, tileY, item.id);
                                this._haptic(6);
                                this.audio && this.audio.play('place');

                                // 消耗物品
                                item.count--;
                                if (item.count <= 0) {
                                    // 物品用完，从库存中移除或设为空
                                    item.count = 0;
                                }

                                this.particles.emit(tileX * ts + 8, tileY * ts + 8, {
                                    color: BLOCK_COLOR[item.id] || '#fff', count: 5, speed: 2, up: true
                                });
                                this._deferLightUpdate(tileX, tileY);
                                this._deferMinimapUpdate();

                                // 更新快捷栏UI显示（合并到每帧最多一次）
                                this._deferHotbarUpdate();
                            }
                        }
                    }
                }
            }

            // ───────────────────────── 交互更新合并（修复连续放置卡死） ─────────────────────────
            _deferLightUpdate(x, y) {
                const d = this._deferred;
                if (!d) return;
                d.light.push({x, y});
            }
            _deferHotbarUpdate() {
                const d = this._deferred;
                if (!d) return;
                d.hotbar = true;
            }
            _deferMinimapUpdate() {
                const d = this._deferred;
                if (!d) return;
                d.minimap = true;
            }
            _flushDeferredWork() {
                const d = this._deferred;
                if (!d) return;

                // 光照最重：优先合并，且每帧最多一次
                if (d.light.length > 0) {
                    const interval = (typeof this._lightIntervalMs === 'number' && isFinite(this._lightIntervalMs)) ? this._lightIntervalMs : 0;
                    const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();

                    if (!interval || !this._lastLightUpdateAt || (now - this._lastLightUpdateAt) >= interval) {
                        const targets = d.light;
                        d.light = [];
                        this._lastLightUpdateAt = now;
                        // 合并更新：如果更新点很近，其实可以优化，这里简单遍历
                        for(const target of targets) {
                            this._updateLight(target.x, target.y);
                        }
                    }
                }
                if (d.minimap) {
                    d.minimap = false;
                    this.minimap && this.minimap.invalidate();
                }
                if (d.hotbar) {
                    d.hotbar = false;
                    this.ui && this.ui.buildHotbar();
                }
            }

            _updateLight(x, y) {
                const r = 14;
                const w = this.world.w, h = this.world.h;
                const tiles = this.world.tiles;
                const light = this.world.light;

                let startX = x - r, endX = x + r;
                let startY = y - r, endY = y + r;

                if (startX < 0) startX = 0;
                if (startY < 0) startY = 0;
                if (endX >= w) endX = w - 1;
                if (endY >= h) endY = h - 1;

                // 收集光源（保持原扫描顺序：x 外层、y 内层递增）
                const srcX = this._lightSrcX;
                const srcY = this._lightSrcY;
                const srcL = this._lightSrcL;
                srcX.length = 0;
                srcY.length = 0;
                srcL.length = 0;

                // 太阳光：对每列只扫一次（原实现为每格从顶部重扫，复杂度高）
                const maxScanY = endY;
                const maxSun = CONFIG.LIGHT_LEVELS;

                for (let tx = startX; tx <= endX; tx++) {
                    let sun = maxSun;
                    const colTiles = tiles[tx];
                    const colLight = light[tx];

                    // 需要先把 startY 之上的衰减累积出来
                    for (let ty = 0; ty <= maxScanY; ty++) {
                        const id = colTiles[ty];

                        const decay = SUN_DECAY[id];
                        if (decay) sun = Math.max(0, sun - decay);

                        if (ty >= startY) {
                            const bl = BLOCK_LIGHT[id];
                            const v = sun > bl ? sun : bl;
                            colLight[ty] = v;

                            if (bl > 0) {
                                srcX.push(tx);
                                srcY.push(ty);
                                srcL.push(bl);
                            }
                        }
                    }
                }

                // 从光源扩散（顺序与原实现一致）
                for (let i = 0; i < srcX.length; i++) {
                    this._spreadLight(srcX[i], srcY[i], srcL[i]);
                }
            }

            _spreadLight(sx, sy, level) {
                const w = this.world.w, h = this.world.h;
                const tiles = this.world.tiles;
                const light = this.world.light;

                // 延迟初始化（world 创建后才有尺寸）
                if (!this._lightVisited || this._lightVisited.length !== w * h) {
                    this._lightVisited = new Uint32Array(w * h);
                    this._lightVisitMark = 1;
                }

                // 每次扩散使用新的 mark，避免 visited.fill(0)
                let mark = (this._lightVisitMark + 1) >>> 0;
                if (mark === 0) { // 溢出回绕
                    this._lightVisited.fill(0);
                    mark = 1;
                }
                this._lightVisitMark = mark;

                const visited = this._lightVisited;
                const qx = this._lightQx;
                const qy = this._lightQy;
                const ql = this._lightQl;

                qx.length = 0;
                qy.length = 0;
                ql.length = 0;

                let head = 0;
                qx.push(sx);
                qy.push(sy);
                ql.push(level);

                while (head < qx.length) {
                    const x = qx[head];
                    const y = qy[head];
                    const l = ql[head];
                    head++;

                    if (l <= 0 || x < 0 || x >= w || y < 0 || y >= h) continue;

                    const idx = x + y * w;
                    if (visited[idx] === mark) continue;
                    visited[idx] = mark;

                    const colLight = light[x];
                    if (l > colLight[y]) colLight[y] = l;

                    const nl = l - (BLOCK_SOLID[tiles[x][y]] ? 2 : 1);
                    if (nl > 0) {
                        // push 顺序与原实现一致：left, right, up, down
                        qx.push(x - 1, x + 1, x, x);
                        qy.push(y, y, y - 1, y + 1);
                        ql.push(nl, nl, nl, nl);
                    }
                }
            }

            // 将掉落物添加到库存，返回是否成功

            _addToInventory(blockId, count = 1) {
                // 分层：入包逻辑委托给 InventorySystem（行为不变）
                return this.services.inventory.add(blockId, count);
            }

            render() {
                const cam = this._renderCamera || this.camera;
                this.renderer.clear();
                if (this.renderer.renderBackgroundCached) {
                    this.renderer.renderBackgroundCached(cam, this.timeOfDay, false);
                } else {
                    this.renderer.renderSky(cam, this.timeOfDay);
                }

                // ── Mountain Rendering Patch v2 (original render fallback) ──
                {
                    const gs = window.GAME_SETTINGS || this.settings || {};
                    const mtEnabled = (gs.bgMountains !== false) && (gs.__bgMountainsEffective !== false);
                    if (mtEnabled && typeof renderParallaxMountains === 'function') {
                        renderParallaxMountains(this.renderer, cam, this.timeOfDay);
                    }
                }

                this.renderer.renderWorld(this.world, cam, this.timeOfDay);

                // 渲染掉落物
                this.droppedItems.render(this.renderer.ctx, cam, this.renderer.textures, this.timeOfDay);
                if (this.settings.particles) this.particles.render(this.renderer.ctx, cam);
                this.player.render(this.renderer.ctx, cam);

                const p = this.player;
                const ts = CONFIG.TILE_SIZE;

                const input = (this.isMobile && this.touchController && this._latestTouchInput) ? this._latestTouchInput : this.input;
                const sx = (typeof input.targetX === 'number') ? input.targetX : input.mouseX;
                const sy = (typeof input.targetY === 'number') ? input.targetY : input.mouseY;

                const safeSX = Number.isFinite(sx) ? sx : (p.cx() - cam.x);
                const safeSY = Number.isFinite(sy) ? sy : (p.cy() - cam.y);

                const worldX = safeSX + cam.x;
                const worldY = safeSY + cam.y;

                let tileX = Math.floor(worldX / ts);
                let tileY = Math.floor(worldY / ts);
                if (this.isMobile && this.settings && this.settings.aimAssist) {
                    tileX = Math.floor((worldX + ts * 0.5) / ts);
                    tileY = Math.floor((worldY + ts * 0.5) / ts);
                }
                const dx = worldX - this.player.cx();
                const dy = worldY - this.player.cy();
                const reachPx = CONFIG.REACH_DISTANCE * CONFIG.TILE_SIZE;
                const inRange = (dx * dx + dy * dy) <= (reachPx * reachPx);

                if (tileX >= 0 && tileX < this.world.w && tileY >= 0 && tileY < this.world.h) {
                    this.renderer.renderHighlight(tileX, tileY, cam, inRange);
                }
                // 后期增强（在所有主体绘制完成后执行）
                if (this.renderer && this.renderer.postProcess) this.renderer.postProcess(this.timeOfDay);
                const minimapVisible = !(window.TU && window.TU.MINIMAP_VISIBLE === false);
                if (this.settings.minimap && minimapVisible) {
                    this.minimap.update();
                    if (this.minimap && typeof this.minimap.render === 'function') this.minimap.render(p.x, p.y);
                    else if (this.minimap && typeof this.minimap.renderPlayer === 'function') this.minimap.renderPlayer(p.x, p.y);
                }
            }
        }

        // ═══════════════════════════════════════════════════════════════════════════════
        //                                     启动
        // ═══════════════════════════════════════════════════════════════════════════════

        // ───────────────────────── Exports ─────────────────────────
        window.TU = window.TU || {};
        Object.assign(window.TU, { Game });

    




                                (() => {
                                    const TU = window.TU || {};
                                    (function () {
                                        const __p = ({
                                            id: 'experience_optimized_v2',
                                            order: 10,
                                            description: "交互/渲染体验优化（v2）",
                                            apply: () => {
                                                const TU = window.TU || {};
                                                const Game = TU.Game;
                                                const Renderer = TU.Renderer;
                                                const TouchController = TU.TouchController;

                                                // ───────────────────── Crosshair UX (移动端默认显示时避免左上角“悬空”) ─────────────────────
                                                try {
                                                    const style = document.createElement('style');
                                                    style.id = 'patch-crosshair-style';
                                                    style.textContent = `
            /* 默认隐藏（用 opacity 控制，不影响布局；兼容原有 display:block 的媒体查询） */
            #crosshair {
              opacity: 0;
              transform: scale(0.9);
              transition: opacity 140ms ease, transform 140ms ease;
            }
            #crosshair.crosshair-active { opacity: 1; transform: scale(1); }
            #crosshair.crosshair-idle { opacity: 0.55; transform: scale(0.95); }
          `;
                                                    document.head.appendChild(style);
                                                } catch { }

                                                // ───────────────────────── Patch TouchController：多指更稳 + 自适应摇杆半径 ─────────────────────────
                                                if (TouchController && TouchController.prototype) {
                                                    TouchController.prototype._init = function () {
                                                        const joystickEl = document.getElementById('joystick');
                                                        const thumbEl = document.getElementById('joystick-thumb');
                                                        const crosshairEl = document.getElementById('crosshair');

                                                        const canvas = this.game && this.game.canvas;

                                                        // 兼容：缺少关键节点则直接返回
                                                        if (!joystickEl || !thumbEl || !canvas) return;

                                                        // 让浏览器知道这里不会滚动（减少一些浏览器的触控延迟）
                                                        try { canvas.style.touchAction = 'none'; } catch { }
                                                        try { joystickEl.style.touchAction = 'none'; } catch { }

                                                        // 十字准星：默认透明，第一次设定目标后才显示
                                                        if (crosshairEl) {
                                                            crosshairEl.classList.remove('crosshair-active', 'crosshair-idle');
                                                        }

                                                        // 安全区（防误触）：根据 UI 实际位置动态计算
                                                        const safeRects = [];
                                                        const expandRect = (r, m) => ({ left: r.left - m, top: r.top - m, right: r.right + m, bottom: r.bottom + m });
                                                        const hitRect = (r, x, y) => (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom);

                                                        const refreshSafeZones = () => {
                                                            safeRects.length = 0;

                                                            // joystick 安全区
                                                            try {
                                                                const jr = joystickEl.getBoundingClientRect();
                                                                const m = Math.max(18, jr.width * 0.18);
                                                                safeRects.push(expandRect(jr, m));

                                                                // 同步摇杆最大位移：跟随 joystick 尺寸
                                                                this._joyMaxDist = Math.max(30, Math.min(90, jr.width * 0.35));
                                                            } catch {
                                                                this._joyMaxDist = 50;
                                                            }

                                                            // action buttons 安全区
                                                            try {
                                                                const act = document.querySelector('.action-buttons');
                                                                if (act) {
                                                                    const ar = act.getBoundingClientRect();
                                                                    safeRects.push(expandRect(ar, 18));
                                                                }
                                                            } catch { }

                                                            // jump button 安全区
                                                            try {
                                                                const jc = document.querySelector('.jump-container');
                                                                if (jc) {
                                                                    const r = jc.getBoundingClientRect();
                                                                    safeRects.push(expandRect(r, 18));
                                                                }
                                                            } catch { }

                                                            // minimap 安全区（防止在边缘误触到画布瞄准）
                                                            try {
                                                                const mm = document.getElementById('minimap');
                                                                if (mm && mm.offsetParent !== null) {
