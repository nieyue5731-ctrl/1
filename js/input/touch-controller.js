                const walkFrame = isMoving ? (tick % 4) : 0;
                const toolFrame = useTool ? (tick % 3) : 0;

                // 预渲染的头+身体 Sprite（保持原像素画与坐标体系一致）
                const bob = (isMoving && (walkFrame === 1 || walkFrame === 3)) ? -2 : 0;
                const sprite = Player._spriteCanvases ? Player._spriteCanvases[walkFrame] : null;
                if (sprite) {
                    // 原始 top-left 为 (-10, -22)，因此 drawImage 放在同样位置
                    ctx.drawImage(sprite, -10, -22 + bob);
                }

                // 手臂逻辑（保持原效果：挥舞/行走摆臂）
                const colors = Player._spriteColors;

                ctx.save();
                ctx.translate(0, -8 + bob); // 肩膀位置

                let armRot = 0;
                if (useTool) {
                    // 挥舞工具
                    armRot = (toolFrame * -0.5) + 0.5; // +0.5 -> 0 -> -0.5
                } else if (isMoving) {
                    armRot = Math.sin(now / 150) * 0.8;
                }

                ctx.rotate(armRot);

                // 绘制手臂 (简单的矩形组合，保持像素感)
                ctx.fillStyle = colors['X']; // 袖子
                ctx.fillRect(-2, -2, 4, 6);
                ctx.fillStyle = colors['#']; // 手臂
                ctx.fillRect(-2, 4, 4, 8);

                // 手持物品
                const item = this.getItem();
                if (item) {
                    ctx.save();
                    ctx.translate(6, 12);

                    // 物品旋转修正
                    ctx.rotate(-Math.PI / 2);

                    if (item.id === 'pickaxe') {
                        // 像素风镐子
                        ctx.fillStyle = '#8d6e63'; // 棕色柄
                        ctx.fillRect(0, -2, 14, 4);

                        // 镐头
                        ctx.fillStyle = '#cfd8dc'; // 银色
                        // 简单的像素镐头形状（与原逻辑一致）
                        const pickHead = [
                            [0, -6], [2, -6], [4, -4], [6, -2], [8, 0], [10, 2], // 上半部分
                            [0, 6], [2, 6], [4, 4], [6, 2], [8, 0] // 下半部分
                        ];
                        for (let p of pickHead) {
                            ctx.fillRect(8 + p[0], p[1], 2, 2);
                        }
                        // 尖端
                        ctx.fillStyle = '#eceff1';
                        ctx.fillRect(18, 2, 2, 2);
                        ctx.fillRect(18, -6, 2, 2);

                    } else {
                        // 手持方块：绘制缩小版图标
                        ctx.rotate(Math.PI / 2); // 转回来
                        ctx.translate(-6, -6);
                        // 尝试获取方块颜色（查表更快）
                        const col = (typeof item.id === 'number') ? BLOCK_COLOR[item.id] : null;
                        if (col) {
                            ctx.fillStyle = col;
                            ctx.fillRect(0, 0, 10, 10);
                            ctx.strokeStyle = 'rgba(0,0,0,0.3)';
                            ctx.lineWidth = 2;
                            ctx.strokeRect(0, 0, 10, 10);
                        }
                    }

                    ctx.restore();
                }

                ctx.restore(); // 恢复手臂变换
                ctx.restore(); // 恢复整体变换
            }

            cx() { return this.x + this.w / 2; }
            cy() { return this.y + this.h / 2; }
            getItem() {
                const item = this.inventory[this.selectedSlot];
                // 如果槽位为空或物品数量为0，返回null
                if (!item || (item.count === 0 && item.id !== 'pickaxe')) {
                    return null;
                }
                return item;
            }
        }

        // ═══════════════════════════════════════════════════════════════════════════════
        //                              移动端触控控制器

        // ───────────────────────── Exports ─────────────────────────
        window.TU = window.TU || {};
        Object.assign(window.TU, { Player });

    



        // ═══════════════════════════════════════════════════════════════════════════════
        class TouchController {
            constructor(game) {
                this.game = game;
                this.joystick = { active: false, startX: 0, startY: 0, dx: 0, dy: 0 };
                this.buttons = { jump: false, mine: false, place: false };
                this.crosshair = { x: 0, y: 0, visible: false };
                this.targetTouchId = null;

                this._init();
                // 复用输入对象，避免每帧分配新对象（移动端 GC 压力大）
                this._input = { left: false, right: false, jump: false, sprint: false, mine: false, place: false, targetX: 0, targetY: 0, hasTarget: false };

            }

            _init() {
                const joystickEl = document.getElementById('joystick');
                const thumbEl = document.getElementById('joystick-thumb');
                const crosshairEl = document.getElementById('crosshair');

                // 兜底：若移动端 UI 节点缺失（被裁剪/二次封装），不要直接崩溃
                if (!joystickEl || !thumbEl || !crosshairEl) return;

                joystickEl.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    const touch = e.touches[0];
                    const rect = joystickEl.getBoundingClientRect();
                    this.joystick.active = true;
                    this.joystick.startX = rect.left + rect.width / 2;
                    this.joystick.startY = rect.top + rect.height / 2;
                    this._updateJoystick(touch.clientX, touch.clientY, thumbEl);
                }, { passive: false });
                joystickEl.addEventListener('touchmove', (e) => {
                    e.preventDefault();
                    if (!this.joystick.active) return;
                    const touch = e.touches[0];
                    this._updateJoystick(touch.clientX, touch.clientY, thumbEl);
                }, { passive: false });
                joystickEl.addEventListener('touchend', (e) => {
                    e.preventDefault();
                    this.joystick.active = false;
                    this.joystick.dx = 0;
                    this.joystick.dy = 0;
                    thumbEl.style.transform = 'translate(-50%, -50%)';
                }, { passive: false });
                this._setupButton('btn-jump', 'jump');
                this._setupButton('btn-mine', 'mine');
                this._setupButton('btn-place', 'place');

                const canvas = this.game.canvas;
                canvas.addEventListener('touchstart', (e) => {
                    for (const touch of e.changedTouches) {
                        if (touch.clientX < 200 && touch.clientY > window.innerHeight - 220) continue;
                        if (touch.clientX > window.innerWidth - 200 && touch.clientY > window.innerHeight - 220) continue;

                        this.targetTouchId = touch.identifier;
                        this._updateCrosshair(touch.clientX, touch.clientY, crosshairEl);
                        this.crosshair.visible = true;
                        crosshairEl.style.display = 'block';
                    }
                }, { passive: false });
                canvas.addEventListener('touchmove', (e) => {
                    for (const touch of e.changedTouches) {
                        if (touch.identifier === this.targetTouchId) {
                            this._updateCrosshair(touch.clientX, touch.clientY, crosshairEl);
                        }
                    }
                }, { passive: false });
                canvas.addEventListener('touchend', (e) => {
                    for (const touch of e.changedTouches) {
                        if (touch.identifier === this.targetTouchId) {
                            this.targetTouchId = null;
                        }
                    }
                }, { passive: false });
            }

            _updateJoystick(tx, ty, thumbEl) {
                let dx = tx - this.joystick.startX;
                let dy = ty - this.joystick.startY;

                // 根据设置动态缩放摇杆行程（适配不同摇杆尺寸）
                const size = (this.game && this.game.settings && this.game.settings.joystickSize) ? this.game.settings.joystickSize : 140;
                const maxDist = Math.max(34, size * 0.33);

                const dist = Math.hypot(dx, dy);

                if (dist > maxDist) {
                    dx = dx / dist * maxDist;
                    dy = dy / dist * maxDist;
                }

                // 归一化输入
                let nx = dx / maxDist;
                let ny = dy / maxDist;

                // 死区 + 灵敏度曲线（平方/立方等）
                const dz = (this.game && this.game.settings && typeof this.game.settings.joystickDeadzone === 'number')
                    ? this.game.settings.joystickDeadzone
                    : 0.14;
                const curve = (this.game && this.game.settings && typeof this.game.settings.joystickCurve === 'number')
                    ? this.game.settings.joystickCurve
                    : 2.2;

                let mag = Math.hypot(nx, ny);

                if (mag < dz) {
                    nx = 0; ny = 0; dx = 0; dy = 0;
                } else {
                    const t = (mag - dz) / (1 - dz);
                    const eased = Math.pow(Math.max(0, Math.min(1, t)), curve);
                    const s = (mag > 1e-5) ? (eased / mag) : 0;
                    nx *= s; ny *= s;
                    dx = nx * maxDist;
                    dy = ny * maxDist;
                }

                this.joystick.dx = nx;
                this.joystick.dy = ny;

                thumbEl.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
            }

            _updateCrosshair(x, y, el) {
                this.crosshair.x = x;
                this.crosshair.y = y;
                el.style.left = (x - 20) + 'px';
                el.style.top = (y - 20) + 'px';
            }

            _setupButton(id, action) {
                const btn = document.getElementById(id);
                if (!btn) return;

                const vibrate = (ms) => {
                    try {
                        const s = this.game && this.game.settings;
                        if (s && s.vibration && navigator.vibrate) navigator.vibrate(ms);
                    } catch (e) { if (typeof console !== 'undefined' && console.debug) console.debug('[Debug] Silently caught:', e); }
                };

                btn.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    this.buttons[action] = true;
                    btn.classList.add('active');
                    vibrate(10);
                }, { passive: false });

                const up = (e) => {
                    e.preventDefault();
                    this.buttons[action] = false;
                    btn.classList.remove('active');
                };
                btn.addEventListener('touchend', up, { passive: false });
                btn.addEventListener('touchcancel', up, { passive: false });
            }

            getInput() {
                const o = this._input;
                o.left = this.joystick.dx < -0.3;
                o.right = this.joystick.dx > 0.3;
                o.jump = this.buttons.jump;
                o.sprint = Math.abs(this.joystick.dx) > 0.85;
                o.mine = this.buttons.mine;
                o.place = this.buttons.place;
                o.targetX = this.crosshair.x;
                o.targetY = this.crosshair.y;
                o.hasTarget = this.crosshair.visible;
                return o;
            }
        }

        // ═══════════════════════════════════════════════════════════════════════════════
        //                                   渲染器 (美化版)
        // ═══════════════════════════════════════════════════════════════════════════════

        // ═══════════════════════════════════════════════════════════════════════
        //                           Render constants (缓存减少分配)

        // ───────────────────────── Exports ─────────────────────────
        window.TU = window.TU || {};
        Object.assign(window.TU, { TouchController });

    



        // ═══════════════════════════════════════════════════════════════════════
        const WALL_COLORS = ['#2b2f3a', '#353b48', '#2d3436', '#1e272e'];
        const PARALLAX_LAYERS = [
            // 更精致的多层山脉（根据昼夜自动换色）
            {
                p: 0.05, y: 260, amp: 145, freq: 0.0019, detail: 0.0065, sharp: 1.60, seed: 17,
                snow: 1, snowLine: 0.74,
                palette: {
                    night: ['#070a18', '#111a33'],
                    dawn: ['#20122f', '#3a1f48'],
                    day: ['#b7d4f4', '#7a9cc2'],
                    dusk: ['#1c1430', '#3b2953']
                }
            },
            {
                p: 0.10, y: 215, amp: 120, freq: 0.0025, detail: 0.0078, sharp: 1.45, seed: 33,
                snow: 1, snowLine: 0.76,
                palette: {
                    night: ['#0b1024', '#18284a'],
                    dawn: ['#2a1430', '#5a2a3f'],
                    day: ['#9cc0e0', '#5f86b5'],
                    dusk: ['#22193f', '#5a3b6d']
                }
            },
            {
                p: 0.18, y: 165, amp: 105, freq: 0.0034, detail: 0.0105, sharp: 1.30, seed: 57,
                snow: 0, snowLine: 0.0,
                palette: {
                    night: ['#111c2c', '#243a4e'],
                    dawn: ['#3a2340', '#7a3b4b'],
                    day: ['#7db6c9', '#3d6f86'],
                    dusk: ['#2b2447', '#7a4b6d']
                }
            },
            {
                p: 0.30, y: 110, amp: 90, freq: 0.0046, detail: 0.0135, sharp: 1.18, seed: 89,
                snow: 0, snowLine: 0.0,
                palette: {
                    night: ['#162a2f', '#2f4a45'],
                    dawn: ['#3a2f3c', '#8a4a4a'],
                    day: ['#5fa39b', '#2f6b5f'],
                    dusk: ['#2a2f47', '#6a5a6d']
                }
            },
            {
                p: 0.45, y: 65, amp: 70, freq: 0.0060, detail: 0.0180, sharp: 1.10, seed: 123,
                snow: 0, snowLine: 0.0,
                palette: {
                    night: ['#1b2a2a', '#3a4a3f'],
                    dawn: ['#3a2a2a', '#7a3a2f'],
                    day: ['#4f8a4f', '#2e5f35'],
                    dusk: ['#2a2a3a', '#4a3a3f']
                }
            }
        ];

        // ═══════════════════════════════════════════════════════════════════════
        //                    Parallax Mountains (重绘美化版)
        //   目标：更像“层叠远山 + 空气透视 + 细节脊线”，替代原本的正弦波山丘
        // ═══════════════════════════════════════════════════════════════════════

        const _PX = (() => {
            // 快速 1D 噪声（整数 hash + smoothstep 插值），足够做山脊轮廓且很轻量。
            const hash = (n) => {
                n = (n << 13) ^ n;
                return 1.0 - (((n * (n * n * 15731 + 789221) + 1376312589) & 0x7fffffff) / 1073741824.0);
            };

            const smooth = (t) => t * t * (3 - 2 * t);

            const noise1 = (x, seed) => {
                const i = Math.floor(x);
                const f = x - i;
