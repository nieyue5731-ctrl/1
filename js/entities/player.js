                    if (this.mode !== 'none' || this.particles.length) this._clearAll();
                    this.mode = 'none';
                    return;
                }

                const nightFactor = Utils.nightFactor(timeOfDay);

                const wType = (weather && weather.type) ? weather.type : 'clear';
                const wInt = (weather && Number.isFinite(weather.intensity)) ? weather.intensity : 0;

                let mode = 'none';
                let target = 0;

                // 天气优先：雨/雪会替代夜晚萤火虫
                if ((wType === 'rain' || wType === 'thunder') && wInt > 0.06) {
                    mode = 'rain';
                    target = Math.round(35 + wInt * 95);   // 35 ~ 130
                } else if (wType === 'snow' && wInt > 0.06) {
                    mode = 'snow';
                    target = Math.round(20 + wInt * 70);   // 20 ~ 90
                } else if (nightFactor > 0.25) {
                    mode = 'firefly';
                    target = Math.round(10 + nightFactor * 18); // 10 ~ 28
                }

                // 低画质：适当减量（DOM 粒子更省）
                try {
                    const gs = window.GAME_SETTINGS || {};
                    const cap = (typeof gs.__dprCapEffective === 'number') ? gs.__dprCapEffective : gs.dprCap;
                    if (cap && cap <= 1.25) target = Math.floor(target * 0.75);
                } catch (e) { if (typeof console !== 'undefined' && console.debug) console.debug('[Debug] Silently caught:', e); }

                // 切换模式：重建粒子（避免同时存在多种粒子造成冗余开销）
                if (mode !== this.mode) {
                    this._clearAll();
                    this.mode = mode;
                }

                // 容器透明度：只在变化明显时写入，减少 layout/style 抖动
                let opacity = 0;
                if (mode === 'firefly') opacity = 0.25 + nightFactor * 0.75;
                else if (mode === 'rain') opacity = 0.35 + wInt * 0.65;
                else if (mode === 'snow') opacity = 0.25 + wInt * 0.75;
                opacity = Math.min(1, Math.max(0, opacity));
                if (this._lastOpacity < 0 || Math.abs(opacity - this._lastOpacity) > 0.03) {
                    this.container.style.opacity = opacity.toFixed(3);
                    this._lastOpacity = opacity;
                }

                // 数量调整（上限保护）
                target = Math.max(0, Math.min(target, mode === 'rain' ? 140 : 110));
                if (this.particles.length < target) this._spawn(target - this.particles.length, mode, wInt, nightFactor);
                else if (this.particles.length > target) {
                    for (let i = this.particles.length - 1; i >= target; i--) {
                        const p = this.particles.pop();
                        if (p && p.parentNode) p.parentNode.removeChild(p);
                    }
                }

                // 萤火虫：夜晚因子变化时，才更新每个粒子 opacity
                if (mode === 'firefly') {
                    if (Math.abs(nightFactor - this._night) > 0.03) {
                        this._night = nightFactor;
                        for (const p of this.particles) {
                            const o = (p._baseOpacity || 1) * nightFactor;
                            p.style.opacity = o.toFixed(3);
                        }
                    }
                }
            }

            _spawn(n, mode, intensity, nightFactor) {
                const frag = document.createDocumentFragment();

                for (let i = 0; i < n; i++) {
                    const p = document.createElement('div');

                    if (mode === 'firefly') {
                        p.className = 'firefly';
                        p.style.left = (Math.random() * 100).toFixed(2) + '%';
                        p.style.top = (30 + Math.random() * 40).toFixed(2) + '%';
                        p.style.animationDelay = (-Math.random() * 8).toFixed(2) + 's';
                        p.style.animationDuration = (6 + Math.random() * 4).toFixed(2) + 's';
                        const base = 0.2 + Math.random() * 0.8;
                        p._baseOpacity = base;
                        p.style.opacity = (base * nightFactor).toFixed(3);
                    }
                    else if (mode === 'rain') {
                        p.className = 'raindrop';
                        p.style.left = (Math.random() * 100).toFixed(2) + '%';
                        p.style.top = (-20 - Math.random() * 35).toFixed(2) + '%';
                        const len = 10 + Math.random() * 18;
                        p.style.height = len.toFixed(1) + 'px';
                        p.style.opacity = (0.25 + Math.random() * 0.55).toFixed(3);
                        const baseDur = 1.05 - 0.45 * intensity;
                        const dur = Math.max(0.45, baseDur + (Math.random() * 0.35));
                        p.style.animationDuration = dur.toFixed(2) + 's';
                        p.style.animationDelay = (-Math.random() * 1.5).toFixed(2) + 's';
                    }
                    else if (mode === 'snow') {
                        p.className = 'snowflake';
                        p.style.left = (Math.random() * 100).toFixed(2) + '%';
                        p.style.top = (-10 - Math.random() * 25).toFixed(2) + '%';
                        const size = 2 + Math.random() * 3.5;
                        p.style.width = size.toFixed(1) + 'px';
                        p.style.height = size.toFixed(1) + 'px';
                        p.style.opacity = (0.35 + Math.random() * 0.55).toFixed(3);
                        const drift = (Math.random() * 80 - 40).toFixed(0) + 'px';
                        p.style.setProperty('--drift', drift);
                        const baseDur = 6.5 - 2.2 * intensity;
                        const dur = Math.max(3.0, baseDur + (Math.random() * 3.0));
                        p.style.animationDuration = dur.toFixed(2) + 's';
                        p.style.animationDelay = (-Math.random() * 3.5).toFixed(2) + 's';
                    }
                    else {
                        continue;
                    }

                    frag.appendChild(p);
                    this.particles.push(p);
                }

                this.container.appendChild(frag);
            }

            _clearAll() {
                for (const p of this.particles) {
                    if (p && p.parentNode) p.parentNode.removeChild(p);
                }
                this.particles.length = 0;
                this._night = 0;
                this._lastOpacity = -1;
            }
        }

        // ═══════════════════════════════════════════════════════════════════════════════
        //                                      玩家

        // ───────────────────────── Exports ─────────────────────────
        window.TU = window.TU || {};
        Object.assign(window.TU, { AmbientParticles });

    



        // ═══════════════════════════════════════════════════════════════════════════════
        class Player {
            constructor(x, y) {
                this.x = x; this.y = y;
                this.w = 16; this.h = 40;
                this.vx = 0; this.vy = 0;
                this.grounded = false;
                this.facingRight = true;
                this.health = 100; this.maxHealth = 100;
                this.mana = 50; this.maxMana = 50;
                this.animFrame = 0; this.animTimer = 0;
                // Sprint state
                // - _sprinting: raw "wants sprint" from input (hold/shift)
                // - _sprintActive: sprint is actually active (ground-only, with perfect-landing resume)
                this._sprinting = false;
                this._sprintActive = false;
                this._sprintBoostMs = 0;
                this._sprintVfxMs = 0;
                this._sprintLeanMs = 0;
                this._sprintCarryArmed = false;
                this._perfectLandMs = 0;
                this.inventory = [
                    { id: 'pickaxe', name: '铜镐', count: 1, power: 40, speed: 2, icon: '⛏️' },
                    { id: BLOCK.DIRT, name: '土块', count: 50 },
                    { id: BLOCK.STONE, name: '石块', count: 50 },
                    { id: BLOCK.PLANKS, name: '木板', count: 30 },
                    { id: BLOCK.TORCH, name: '火把', count: 50 },
                    { id: BLOCK.GLASS, name: '玻璃', count: 20 }
                    // 快捷栏预留3个空位给新挖掘的物品
                ];
                this.selectedSlot = 0;
                // 预生成玩家像素 Sprite（头+身体），避免每帧逐像素 fillRect（性能大幅提升）
                if (!Player._spriteCanvases) Player._initSpriteCache();

                // 跳跃手感：土狼时间 + 跳跃缓冲 + 防按住连跳
                this._jumpHeld = false;
                this._coyoteMs = 0;
                this._jumpBufferMs = 0;
            }

            static _initSpriteCache() {
                // 颜色表与原 render() 内定义保持一致
                const colors = {
                    '#': '#ffcc80', // 皮肤
                    'X': '#7e57c2', // 紫色上衣
                    'Y': '#5e35b1', // 衣服阴影
                    'L': '#455a64', // 裤子
                    'H': '#3e2723', // 头发深色
                    'h': '#5d4037', // 头发亮色
                    'E': '#ffffff', // 眼白
                    'e': '#333333', // 瞳孔
                    'S': '#212121', // 鞋子
                    'G': '#ffd700', // 皮带扣
                    'B': '#3e2723'  // 皮带
                };

                const headSprite = [
                    '..HHHHHH..',
                    '.HHhHHHhH.',
                    'HHHhHHHHHH',
                    'HH######HH',
                    'HH#E#E##HH',
                    'H##e#e###H',
                    '.########.',
                    '.########.',
                    '..######..',
                    '..........'
                ];
                const bodyBase = [
                    '.XXXXXX.',
                    'XXXXXXXX',
                    'XXXXXXXX',
                    'XYXXXXYX',
                    'XYXXXXYX',
                    'XYXXXXYX',
                    'BBGBBBBB',
                    'LL....LL',
                    'LL....LL',
                    'SS....SS'
                ];

                // 原始绘制坐标（以玩家中心为原点）
                // head: (-10, -22), 10x10, scale=2  => 20x20
                // body: (-8,  -4),  8x10, scale=2  => 16x20
                // 合并包围盒：x [-10, 10) => 20，y [-22, 16) => 38
                const W = 20, H = 38;
                const padX = 10, padY = 22;
                const scale = 2;

                const makeCanvas = (bodyLines) => {
                    const c = document.createElement('canvas');
                    c.width = W;
                    c.height = H;
                    const cx = c.getContext('2d', { willReadFrequently: true });
                    cx.imageSmoothingEnabled = false;

                    const drawPixelMatrix = (matrix, offsetX, offsetY) => {
                        for (let y = 0; y < matrix.length; y++) {
                            const row = matrix[y];
                            for (let x = 0; x < row.length; x++) {
                                const ch = row[x];
                                const col = colors[ch];
                                if (col) {
                                    cx.fillStyle = col;
                                    cx.fillRect(offsetX + x * scale, offsetY + y * scale, scale, scale);
                                }
                            }
                        }
                    };

                    // 身体 + 头部（bob 由运行时在 drawImage 时加偏移，保持与原逻辑一致）
                    drawPixelMatrix(bodyLines, -8 + padX, -4 + padY);
                    drawPixelMatrix(headSprite, -10 + padX, -22 + padY);
                    return c;
                };

                // walkFrame 0/1/2/3 的身体行（与原 render() 修改 bodySprite[7..9] 完全一致）
                const f0 = bodyBase.slice();
                const f1 = bodyBase.slice();
                const f2 = bodyBase.slice();

                // frame 1 / 3
                f1[7] = 'LL....L.';
                f1[8] = 'LL....L.';
                f1[9] = 'SS....S.';

                // frame 2
                f2[7] = '.L....LL';
                f2[8] = '.L....LL';
                f2[9] = '.S....SS';

                const c0 = makeCanvas(f0);
                const c1 = makeCanvas(f1);
                const c2 = makeCanvas(f2);

                Player._spriteCanvases = [c0, c1, c2, c1];
                Player._spriteColors = colors;
                Player._spriteOffset = { x: padX, y: padY };
            }

            update(input, world, dt) {
                this.input = input; // 保存输入状态用于渲染动画

                // 统一以 60FPS 为基准做时间缩放（保持原手感，同时让不同帧率下速度一致）
                const dtClamped = Math.min(dt, 50);
                const dtScale = dtClamped / 16.6667;

                const wasGrounded = this.grounded;

                // Perfect landing window countdown (ms)
                if (this._perfectLandMs > 0) this._perfectLandMs = Math.max(0, this._perfectLandMs - dtClamped);

                // ── 冲刺判定（地面才允许冲刺；空中强制取消）
                // input.sprint：来自 “长按 A/D” 或 Shift 的原始意图
                const wantsSprint = !!input.sprint;
                this._sprinting = wantsSprint;

                // 落地 0.1s 内（PERFECT_LAND_MS）如果仍在按方向键，可“立刻续冲”（不必重新长按）
                const hasDir = !!(input.left || input.right);
                const sprintActive = wasGrounded && (wantsSprint || (this._perfectLandMs > 0 && hasDir));

                const justStartedSprint = sprintActive && !this._sprintActive;
                this._sprintActive = sprintActive;

                // 冲刺起步：爆发 + 前倾
                if (justStartedSprint) {
                    this._sprintBoostMs = CONFIG.SPRINT_BOOST_MS;
                    this._sprintVfxMs = CONFIG.SPRINT_VFX_MS;
                    this._sprintLeanMs = CONFIG.SPRINT_LEAN_MS;

                    // Small kick makes sprint feel snappy (ground only)
                    let dir = 0;
                    if (input.left && !input.right) dir = -1;
                    else if (input.right && !input.left) dir = 1;
                    else dir = this.facingRight ? 1 : -1;

                    this.vx += dir * CONFIG.SPRINT_KICK;
                }

                if (this._sprintBoostMs > 0) this._sprintBoostMs = Math.max(0, this._sprintBoostMs - dtClamped);
                if (this._sprintVfxMs > 0) this._sprintVfxMs = Math.max(0, this._sprintVfxMs - dtClamped);
                if (this._sprintLeanMs > 0) this._sprintLeanMs = Math.max(0, this._sprintLeanMs - dtClamped);

                // Air: keep a bit of inertia, but do NOT allow sprint acceleration
                const baseSpeed = CONFIG.PLAYER_SPEED;
                const groundMax = baseSpeed * (sprintActive ? CONFIG.SPRINT_MULT : 1);
                const airMax = baseSpeed * CONFIG.AIR_INERTIA_MULT;
                const maxSpeed = wasGrounded ? groundMax : airMax;

                const accel = wasGrounded ? 1 : CONFIG.AIR_CONTROL;
                const sprintAccelMult = (sprintActive && wasGrounded && this._sprintBoostMs > 0) ? CONFIG.SPRINT_BOOST_ACCEL_MULT : 1;
                const accelSpeed = wasGrounded ? groundMax : baseSpeed;

                // ── 跳跃：土狼时间 + 跳跃缓冲（更“跟手”）
                const COYOTE_MS = 100;
                const JUMP_BUFFER_MS = 120;

                // 只在“按下瞬间”记录跳跃（避免按住键自动连跳）
                const jumpPressed = !!input.jump && !this._jumpHeld;
                this._jumpHeld = !!input.jump;

                if (this.grounded) this._coyoteMs = COYOTE_MS;
                else this._coyoteMs = Math.max(0, this._coyoteMs - dtClamped);

                if (jumpPressed) this._jumpBufferMs = JUMP_BUFFER_MS;
                else this._jumpBufferMs = Math.max(0, this._jumpBufferMs - dtClamped);

                // ── 水平移动（地面冲刺爆发；空中不加速冲刺）
                if (input.left) { this.vx -= accelSpeed * 0.22 * accel * sprintAccelMult * dtScale; this.facingRight = false; }
                if (input.right) { this.vx += accelSpeed * 0.22 * accel * sprintAccelMult * dtScale; this.facingRight = true; }

                // 摩擦：按 dtScale 进行幂缩放，避免帧率变化导致“滑/粘”
                this.vx *= Math.pow(CONFIG.FRICTION, dtScale);
                if (Math.abs(this.vx) < 0.1) this.vx = 0;

                // 速度上限：地面=正常/冲刺；空中=保留少量惯性，但不让它无限快
                this.vx = Utils.clamp(this.vx, -maxSpeed, maxSpeed);

                // 满足缓冲 & 土狼时间才起跳
                if (this._jumpBufferMs > 0 && this._coyoteMs > 0) {
                    this.vy = -CONFIG.JUMP_FORCE;
                    this.grounded = false;
                    this._jumpBufferMs = 0;
                    this._coyoteMs = 0;
                }

                // 重力（dtScale）
                this.vy += CONFIG.GRAVITY * dtScale;
                this.vy = Math.min(this.vy, CONFIG.MAX_FALL_SPEED);

                // 碰撞移动（按 dtScale 让位移与时间成正比）
                this._moveCollide(world, this.vx * dtScale, 0);

                // 记录“离地”（从地面进入空中）用于：冲刺落地反馈 / 完美踩点续冲
                // 注意：必须在把 grounded 置 false 之前判断
                // （这里 wasGrounded 代表上一帧是否在地面）
                this.grounded = false;
                this._moveCollide(world, 0, this.vy * dtScale);

                const leftGround = wasGrounded && !this.grounded;
                if (leftGround) {
                    // 仅当“地面冲刺中离地”才武装落地续冲
                    this._sprintCarryArmed = !!sprintActive;
                    // 空中强制取消冲刺（不影响已有惯性）
                    this._sprintActive = false;
                    this._sprintBoostMs = 0;
                    this._sprintLeanMs = 0;
                }

                const justLanded = (!wasGrounded && this.grounded);
                if (justLanded) {
                    if (this._sprintCarryArmed) {
                        // 完美踩点：落地 0.1s 内，按住方向即可瞬间续冲
                        this._perfectLandMs = CONFIG.PERFECT_LAND_MS;

                        // 冲刺落地反馈：dust + 轻微震屏
                        try {
                            const g = window.__GAME_INSTANCE__;
                            if (g && g.settings && g.settings.particles && g.particles && typeof g.particles.emit === 'function') {
                                g.particles.emit(this.cx(), this.y + this.h - 2, {
                                    count: CONFIG.LAND_DUST_COUNT,
                                    speed: 2.6,
                                    life: 0.55,
                                    size: 3.2,
                                    gravity: 0.12,
                                    spread: 1.2,
                                    color: 'rgba(235, 230, 220, 0.95)',
                                    glow: true
                                });
                            }
                            if (g && typeof g.addCameraShake === 'function') g.addCameraShake(CONFIG.LAND_SHAKE_AMP, CONFIG.LAND_SHAKE_MS);
                        } catch (e) { if (typeof console !== 'undefined' && console.debug) console.debug('[Debug] Silently caught:', e); }
                    }
                    this._sprintCarryArmed = false;
                }

                // 动画计时保持毫秒
                if (Math.abs(this.vx) > 0.5 && this.grounded) {
                    this.animTimer += dtClamped;
                    if (this.animTimer > 100) { this.animTimer = 0; this.animFrame = (this.animFrame + 1) % 4; }
                } else this.animFrame = 0;

                // 帧末尾：空中强制取消冲刺（兜底，防止任何“空中乱冲”）
                if (!this.grounded) this._sprintActive = false;
            }

            _moveCollide(world, dx, dy) {
                const steps = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)));
                const sx = dx / (steps || 1), sy = dy / (steps || 1);

                for (let i = 0; i < steps; i++) {
                    this.x += sx;
                    if (this._collides(world)) { this.x -= sx; this.vx = 0; break; }
                }
                for (let i = 0; i < steps; i++) {
                    this.y += sy;
                    if (this._collides(world)) {
                        this.y -= sy;
                        if (dy > 0) this.grounded = true;
                        this.vy = 0;
                        break;
                    }
                }
            }

            _collides(world) {
                const ts = CONFIG.TILE_SIZE;
                const l = Math.floor(this.x / ts), r = Math.floor((this.x + this.w - 0.001) / ts);
                const t = Math.floor(this.y / ts), b = Math.floor((this.y + this.h - 0.001) / ts);

                for (let tx = l; tx <= r; tx++) {
                    if (tx < 0 || tx >= world.w) continue;
                    const col = world.tiles[tx];
                    for (let ty = t; ty <= b; ty++) {
                        if (ty < 0 || ty >= world.h) continue;
                        if (BLOCK_SOLID[col[ty]]) return true;
                    }
                }
                return false;
            }

            render(ctx, cam) {
                // Pixel-aligned camera math: match world renderer rounding to avoid sprint-camera jitter
                const camPxX = Math.ceil(cam.x);
                const camPxY = Math.ceil(cam.y);
                const sx = Math.floor(this.x) - camPxX;
                const sy = Math.floor(this.y) - camPxY;

                ctx.save();
                ctx.translate(sx + this.w / 2, sy + this.h / 2);

                // 像素艺术渲染：禁用平滑
                ctx.imageSmoothingEnabled = false;

                // 翻转
                if (!this.facingRight) ctx.scale(-1, 1);

                // 冲刺起步前倾：仅在短时间内生效（更“有重量感”）
                if (this._sprintLeanMs > 0 && this.grounded) {
                    const t = Utils.clamp(this._sprintLeanMs / Math.max(1, CONFIG.SPRINT_LEAN_MS), 0, 1);
                    // ease-out：一开始前倾明显，随后快速回正
                    const k = t * t;
                    ctx.rotate(-CONFIG.SPRINT_LEAN_ANGLE * k);
                }

                // --- 动画状态 ---
                const isMoving = Math.abs(this.vx) > 0.1;
                const useTool = this.input && (this.input.mouseLeft || this.input.mouseRight);

                // 简单的帧动画计时器（与原逻辑一致）
                const now = Date.now();
                const tick = Math.floor(now / 100);
                const walkFrame = isMoving ? (tick % 4) : 0;
