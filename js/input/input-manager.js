                    let remaining = this._cursorItem.count;
                    for (let i = 0; i < this.MAX_SIZE && remaining > 0; i++) {
                        const t = inv[i];
                        if (!t || t.count === 0) continue;
                        if (t.id !== this._cursorItem.id) continue;
                        const canAdd = Math.min(remaining, this.MAX_STACK - t.count);
                        if (canAdd <= 0) continue;
                        t.count += canAdd;
                        remaining -= canAdd;
                    }
                    this._cursorItem.count = remaining;
                    if (this._cursorItem.count <= 0) {
                        this._cursorItem = null;
                        this._cursorFrom = -1;
                        this._hideHeld();
                        return;
                    }
                }

                // 2) 优先放回来源格（如果空）
                if (this._cursorFrom >= 0 && this._isEmptySlot(this._cursorFrom)) {
                    this._setSlot(this._cursorFrom, this._cursorItem);
                    this._cursorItem = null;
                    this._cursorFrom = -1;
                    this._hideHeld();
                    return;
                }

                // 3) 找任意空位
                for (let i = 0; i < this.MAX_SIZE; i++) {
                    if (this._isEmptySlot(i)) {
                        this._setSlot(i, this._cursorItem);
                        this._cursorItem = null;
                        this._cursorFrom = -1;
                        this._hideHeld();
                        return;
                    }
                }

                // 4) 没空位：放不回，保持拿起状态（不丢失）
                this._renderHeld();
            }

            _changed() {
                // 同步快捷栏 & 触发背包刷新（buildHotbar 内会派发 inventoryChanged 事件）
                if (this.game.ui) this.game.ui.buildHotbar();
                else this.refresh(false);
            }

            _updateDetails() {
                const it = this._getSelectedItem();

                // 预览
                this._previewCtx.clearRect(0, 0, 56, 56);
                this._previewCanvas.style.display = 'none';
                this._previewEmoji.style.display = 'none';

                if (!it) {
                    this.nameEl.textContent = '未选择';
                    this.metaEl.textContent = '';
                    this.descEl.textContent = this._cursorItem ? '已拿起物品：可点击格子放下，或点“放回”。' : '点击格子查看，或拖拽/点击交换。';
                    return;
                }

                this.nameEl.textContent = it.name || (it.id === 'pickaxe' ? '镐子' : '物品');
                const meta = [];
                if (it.id === 'pickaxe') meta.push('工具');
                else meta.push('方块');
                if (it.count != null && it.id !== 'pickaxe') meta.push(`数量 x${it.count}`);
                this.metaEl.textContent = meta.join(' · ');

                // 描述：使用 BLOCK_DATA
                if (typeof it.id === 'number' && window.BLOCK_DATA && BLOCK_DATA[it.id] && BLOCK_DATA[it.id].desc) {
                    this.descEl.textContent = BLOCK_DATA[it.id].desc;
                } else if (it.id === 'pickaxe') {
                    this.descEl.textContent = '用于挖掘方块。打开背包时可整理与移动物品。';
                } else {
                    this.descEl.textContent = '—';
                }

                if (it.id === 'pickaxe') {
                    this._previewEmoji.textContent = it.icon || '⛏️';
                    this._previewEmoji.style.display = '';
                } else {
                    const tex = (this.game.ui && this.game.ui.textures) ? this.game.ui.textures.get(it.id) : (this.game.renderer && this.game.renderer.textures ? this.game.renderer.textures.get(it.id) : null);
                    if (tex) {
                        this._previewCanvas.style.display = '';
                        this._previewCtx.drawImage(tex, 0, 0, 56, 56);
                    }
                }

                // 按钮状态
                if (this.btnToHotbar) this.btnToHotbar.disabled = !(it && it.count > 0 && this._selectedIdx >= 9);
                if (this.btnDrop) this.btnDrop.disabled = !(it && typeof it.id === 'number' && it.count > 0);
            }

            _renderHeld() {
                if (!this._cursorItem) { this._hideHeld(); return; }

                this._heldCtx.clearRect(0, 0, 34, 34);
                this._heldCanvas.style.display = 'none';
                this._heldEmoji.style.display = 'none';

                if (this._cursorItem.id === 'pickaxe') {
                    this._heldEmoji.textContent = this._cursorItem.icon || '⛏️';
                    this._heldEmoji.style.display = '';
                    this._heldCount.textContent = '';
                } else {
                    const tex = (this.game.ui && this.game.ui.textures) ? this.game.ui.textures.get(this._cursorItem.id) : (this.game.renderer && this.game.renderer.textures ? this.game.renderer.textures.get(this._cursorItem.id) : null);
                    if (tex) {
                        this._heldCanvas.style.display = '';
                        this._heldCtx.drawImage(tex, 0, 0, 34, 34);
                    }
                    this._heldCount.textContent = (this._cursorItem.count > 1) ? String(this._cursorItem.count) : '';
                }

                this.heldEl.style.display = 'flex';
            }

            _showHeldAt(x, y) {
                this.heldEl.style.left = x + 'px';
                this.heldEl.style.top = y + 'px';
            }

            _hideHeld() {
                this.heldEl.style.display = 'none';
            }
        }

        // ───────────────────────── Exports ─────────────────────────
        window.TU = window.TU || {};
        Object.assign(window.TU, { InventoryUI });

    



        // ═══════════════════════════════════════════════════════════════════════════════

        /**
         * InputManager
         * - 负责键盘/鼠标/触控/全屏事件的绑定
         * - 目标：把“输入/事件监听”从 Game 本体剥离出来，降低耦合
         * - ⚠️ 行为保持与旧版 Game._bindEvents 完全一致（代码搬迁 + this→game 重定向）
         */
        class InputManager {
            /** @param {Game} game */
            constructor(game) {
                this.game = game;
                // Hold-to-sprint (keyboard): avoid key-repeat jitter, compute in fixed-step tick
                this._holdLeftMs = 0;
                this._holdRightMs = 0;
                this._holdSprint = false;
                this._holdDir = 0;
                this._holdJustStarted = false;
            }

            bind() {
                const game = this.game;
                const self = this;

                // 说明：保持原有行为不变，仅将硬编码的按键/按钮集中化以便维护

                const onKeyDown = (e) => {

                    const code = e.code;

                    const modalOpen = (game.inventoryUI && game.inventoryUI.isOpen) || (game.crafting && game.crafting.isOpen) || game.paused || game._inputBlocked;
                    if (modalOpen) {
                        const isMoveKey = INPUT_KEYS.LEFT.has(code) || INPUT_KEYS.RIGHT.has(code) || INPUT_KEYS.JUMP.has(code) || INPUT_KEYS.SPRINT.has(code);
                        if (isMoveKey) { e.preventDefault(); return; }
                    }
                    if (INPUT_KEYS.LEFT.has(code)) game.input.left = true;

                    if (INPUT_KEYS.RIGHT.has(code)) game.input.right = true;

                    if (INPUT_KEYS.JUMP.has(code)) game.input.jump = true;

                    if (INPUT_KEYS.SPRINT.has(code)) game.input.sprint = true;

                    const handled = INPUT_KEYS.LEFT.has(code) || INPUT_KEYS.RIGHT.has(code) || INPUT_KEYS.JUMP.has(code) || INPUT_KEYS.SPRINT.has(code);
                    if (handled) e.preventDefault();
                    // 1-9 切换快捷栏（保留原逻辑：依赖 game.ui 是否已初始化）

                    if (e.key >= '1' && e.key <= '9' && game.ui) {

                        game.ui.selectSlot(parseInt(e.key, 10) - 1);

                    }

                    // 系统键（统一在这里处理：合成/背包/暂停/帮助），避免多个 keydown 监听相互“抢键”
                    const t = e.target;
                    const tag = (t && t.tagName) ? String(t.tagName).toLowerCase() : '';
                    const typing = (tag === 'input' || tag === 'textarea' || tag === 'select' || (t && t.isContentEditable));
                    if (!typing) {
                        // 防止按住不放导致反复触发开关
                        const isToggleKey = (code === 'Escape' || code === 'KeyE' || code === 'KeyB' || code === 'KeyI' || code === 'KeyH' || code === 'KeyM' || code === 'KeyF' || code === 'KeyO' || code === 'KeyP');
                        if (e.repeat && isToggleKey) return;

                        const ux = game._ux;
                        const isGameBlocked = !!(game._inputBlocked || (ux && ux.isPauseOpen && ux.isPauseOpen()) || game.paused);

                        // H：帮助（不强制暂停）
                        if (code === 'KeyH' && ux && ux.toggleHelp) {
                            e.preventDefault(); e.stopPropagation();
                            ux.toggleHelp();
                            return;
                        }

                        // M：小地图展开/收起（transform 动画更省电）
                        if (code === 'KeyM' && window.TU && typeof window.TU.toggleMinimap === 'function') {
                            e.preventDefault(); e.stopPropagation();
                            window.TU.toggleMinimap();
                            return;
                        }

                        // F：全屏（可配合浏览器手势/系统快捷键）
                        if (code === 'KeyF') {
                            e.preventDefault(); e.stopPropagation();
                            const fm = window.TU && window.TU.FullscreenManager;
                            if (fm && typeof fm.toggle === 'function') fm.toggle();
                            else {
                                const btn = document.getElementById('fullscreen-btn');
                                if (btn) btn.click();
                            }
                            return;
                        }

                        // Ctrl/Cmd + S：保存（防止误触浏览器“保存网页”）
                        if (code === 'KeyS' && (e.ctrlKey || e.metaKey) && game.saveSystem) {
                            e.preventDefault(); e.stopPropagation();
                            game.audio && game.audio.play('ui');
                            game.saveSystem.save('manual');
                            return;
                        }

                        // O：设置（与 UI 按钮一致逻辑）
                        if (code === 'KeyO' && ux && ux.showOverlay && ux.settingsOverlay) {
                            e.preventDefault(); e.stopPropagation();
                            game.audio && game.audio.play('ui');
                            game._settingsReturnToPause = !!game.paused;
                            if (typeof syncSettingsControls === 'function') syncSettingsControls(game.settings);
                            game.paused = true;
                            ux.hideOverlay && ux.hideOverlay(ux.pauseOverlay);
                            ux.showOverlay(ux.settingsOverlay);
                            return;
                        }

                        // P：暂停/继续
                        if (code === 'KeyP' && ux && ux.setPaused) {
                            e.preventDefault(); e.stopPropagation();
                            game.audio && game.audio.play('ui');
                            ux.setPaused(!game.paused);
                            return;
                        }

                        // E：合成（暂停/面板打开时不触发）
                        if (code === 'KeyE' && game.crafting && !isGameBlocked && !(ux && ux.isSettingsOpen && ux.isSettingsOpen())) {
                            e.preventDefault(); e.stopPropagation();
                            if (game.inventoryUI && game.inventoryUI.isOpen) game.inventoryUI.close();
                            game.crafting.toggle();
                            return;
                        }

                        // B / I：背包（暂停/面板打开时不触发）
                        if ((code === 'KeyB' || code === 'KeyI') && game.inventoryUI && !isGameBlocked && !(ux && ux.isSettingsOpen && ux.isSettingsOpen())) {
                            e.preventDefault(); e.stopPropagation();
                            if (game.crafting && game.crafting.isOpen) game.crafting.close();
                            game.inventoryUI.toggle();
                            return;
                        }

                        // Esc：优先关闭“最上层”面板（help/settings/背包/合成），否则切换暂停
                        if (code === 'Escape') {
                            e.preventDefault(); e.stopPropagation();

                            if (ux && ux.isHelpOpen && ux.isHelpOpen()) {
                                ux.hideOverlay && ux.hideOverlay(ux.helpOverlay);
                                try { localStorage.setItem('terraria_ultra_help_seen_v1', '1'); } catch { }
                                return;
                            }
                            if (ux && ux.isSettingsOpen && ux.isSettingsOpen()) {
                                if (ux.closeSettings) ux.closeSettings();
                                else ux.hideOverlay && ux.hideOverlay(ux.settingsOverlay);
                                return;
                            }
                            if (game.inventoryUI && game.inventoryUI.isOpen) { game.inventoryUI.close(); return; }
                            if (game.crafting && game.crafting.isOpen) { game.crafting.close(); return; }

                            if (ux && ux.setPaused) {
                                game.audio && game.audio.play('ui');
                                ux.setPaused(!game.paused);
                                return;
                            }
                            game.paused = !game.paused;
                            return;
                        }
                    }

                };

                const onKeyUp = (e) => {

                    const code = e.code;

                    const modalOpen = (game.inventoryUI && game.inventoryUI.isOpen) || (game.crafting && game.crafting.isOpen) || game.paused || game._inputBlocked;
                    if (modalOpen) {
                        const isMoveKey = INPUT_KEYS.LEFT.has(code) || INPUT_KEYS.RIGHT.has(code) || INPUT_KEYS.JUMP.has(code) || INPUT_KEYS.SPRINT.has(code);
                        if (isMoveKey) { e.preventDefault(); }
                    }
                    if (INPUT_KEYS.LEFT.has(code)) game.input.left = false;
                    if (INPUT_KEYS.LEFT.has(code)) self._holdLeftMs = 0;

                    if (INPUT_KEYS.RIGHT.has(code)) game.input.right = false;
                    if (INPUT_KEYS.RIGHT.has(code)) self._holdRightMs = 0;

                    if (INPUT_KEYS.JUMP.has(code)) game.input.jump = false;

                    if (INPUT_KEYS.SPRINT.has(code)) game.input.sprint = false;

                    const handled = INPUT_KEYS.LEFT.has(code) || INPUT_KEYS.RIGHT.has(code) || INPUT_KEYS.JUMP.has(code) || INPUT_KEYS.SPRINT.has(code);
                    if (handled) e.preventDefault();
                };

                window.addEventListener('keydown', onKeyDown);

                window.addEventListener('keyup', onKeyUp);

                game.canvas.addEventListener('mousemove', (e) => {

                    game.input.mouseX = e.clientX;

                    game.input.mouseY = e.clientY;

                }, { passive: true });

                game.canvas.addEventListener('mousedown', (e) => {

                    if (e.button === MOUSE_BUTTON.LEFT) game.input.mouseLeft = true;

                    if (e.button === MOUSE_BUTTON.RIGHT) game.input.mouseRight = true;

                });

                game.canvas.addEventListener('mouseup', (e) => {

                    if (e.button === MOUSE_BUTTON.LEFT) game.input.mouseLeft = false;

                    if (e.button === MOUSE_BUTTON.RIGHT) game.input.mouseRight = false;

                });

                game.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

                const fullscreenBtn = DOM.byId(UI_IDS.fullscreenBtn);

                if (fullscreenBtn) {

                    fullscreenBtn.addEventListener('click', (e) => {
                        e.preventDefault(); e.stopPropagation();
                        const fm = window.TU && window.TU.FullscreenManager;
                        if (fm && typeof fm.toggle === 'function') {
                            fm.toggle();
                        } else {
                            if (document.fullscreenElement) document.exitFullscreen();
                            else document.documentElement.requestFullscreen();
                        }
                    });

                }

            }

            /**
             * Fixed-step tick to compute "hold A/D to sprint" without being affected by key repeat.
             * @param {number} dtMs
             */
            tick(dtMs) {
                const left = !!this.game.input.left;
                const right = !!this.game.input.right;

                // Only count hold when a single direction is pressed; switching direction resets.
                if (left && !right) this._holdLeftMs = Math.min(10000, (this._holdLeftMs || 0) + dtMs);
                else this._holdLeftMs = 0;

                if (right && !left) this._holdRightMs = Math.min(10000, (this._holdRightMs || 0) + dtMs);
                else this._holdRightMs = 0;

                const prev = !!this._holdSprint;
                let sprint = false;
                let dir = 0;
                if (this._holdLeftMs >= CONFIG.SPRINT_HOLD_MS) { sprint = true; dir = -1; }
                else if (this._holdRightMs >= CONFIG.SPRINT_HOLD_MS) { sprint = true; dir = 1; }

                this._holdSprint = sprint;
                this._holdDir = dir;
                this._holdJustStarted = (!prev && sprint);
            }

        }

        /**
         * InventorySystem
         * - 负责拾取入包（堆叠/空槽/扩容/满包日志）
         * - ⚠️ 行为保持与旧版 Game._addToInventory 完全一致（代码搬迁 + this→game 重定向）
         */

        // ───────────────────────── Exports ─────────────────────────
        window.TU = window.TU || {};
