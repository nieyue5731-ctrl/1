
        class InventoryUI {
            /** @param {Game} game */
            constructor(game) {
                this.game = game;

                this.isOpen = false;
                this.MAX_SIZE = (window.INVENTORY_LIMITS && INVENTORY_LIMITS.MAX_SIZE) ? INVENTORY_LIMITS.MAX_SIZE : 36;
                this.MAX_STACK = (window.INVENTORY_LIMITS && INVENTORY_LIMITS.MAX_STACK) ? INVENTORY_LIMITS.MAX_STACK : 999;
                this.EMPTY_ID = '__empty__';

                this.overlay = document.getElementById('inventory-overlay');
                this.panel = document.getElementById('inventory-panel');

                this.hotbarGrid = document.getElementById('inv-hotbar-grid');
                this.backpackGrid = document.getElementById('inv-backpack-grid');

                this.closeBtn = document.getElementById('inv-close');
                this.capacityText = document.getElementById('inv-capacity-text');
                this.capacityFill = document.getElementById('inv-capacity-fill');

                this.previewBox = document.getElementById('inv-preview');
                this.nameEl = document.getElementById('inv-item-name');
                this.metaEl = document.getElementById('inv-item-meta');
                this.descEl = document.getElementById('inv-item-desc');

                this.btnSort = document.getElementById('inv-sort');
                this.btnToHotbar = document.getElementById('inv-to-hotbar');
                this.btnPutBack = document.getElementById('inv-put-back');
                this.btnDrop = document.getElementById('inv-drop');

                this.btnTop = document.getElementById('btn-inventory');
                this.btnFloat = document.getElementById('btn-bag-toggle');

                this.heldEl = document.getElementById('inv-held');

                this._slotEls = new Array(this.MAX_SIZE);
                this._slotCanvases = new Array(this.MAX_SIZE);
                this._slotCtx = new Array(this.MAX_SIZE);
                this._slotCountEls = new Array(this.MAX_SIZE);
                this._slotEmojiEls = new Array(this.MAX_SIZE);
                this._lastId = new Array(this.MAX_SIZE).fill(null);
                this._lastCount = new Array(this.MAX_SIZE).fill(-1);

                this._selectedIdx = 0;
                this._cursorItem = null;
                this._cursorFrom = -1;

                this._previewCanvas = document.createElement('canvas');
                this._previewCanvas.width = this._previewCanvas.height = 56;
                this._previewCtx = this._previewCanvas.getContext('2d', { willReadFrequently: true });
                this._previewCtx.imageSmoothingEnabled = false;

                this._previewEmoji = document.createElement('span');
                this._previewEmoji.className = 'item-icon';
                this._previewEmoji.style.display = 'none';

                this.previewBox.innerHTML = '';
                this.previewBox.appendChild(this._previewEmoji);
                this.previewBox.appendChild(this._previewCanvas);
                this._previewCanvas.style.display = 'none';

                this._heldCanvas = document.createElement('canvas');
                this._heldCanvas.width = this._heldCanvas.height = 34;
                this._heldCtx = this._heldCanvas.getContext('2d', { willReadFrequently: true });
                this._heldCtx.imageSmoothingEnabled = false;

                this._heldEmoji = document.createElement('span');
                this._heldEmoji.className = 'item-icon';
                this._heldEmoji.style.display = 'none';

                this._heldCount = document.createElement('span');
                this._heldCount.className = 'count';

                this.heldEl.innerHTML = '';
                this.heldEl.appendChild(this._heldEmoji);
                this.heldEl.appendChild(this._heldCanvas);
                this.heldEl.appendChild(this._heldCount);

                this._buildSlots();
                this._bind();
                this.ensureCapacity();
                this.refresh(true);

                // hotbar/buildHotbar 会发出事件，背包打开时跟随更新
                document.addEventListener('tu:inventoryChanged', () => {
                    if (this.isOpen) this.refresh(false);
                });
            }

            ensureCapacity() {
                const inv = this.game.player.inventory;
                for (let i = 0; i < this.MAX_SIZE; i++) {
                    if (!inv[i]) inv[i] = { id: this.EMPTY_ID, name: '', count: 0 };
                    if (inv[i].count == null) inv[i].count = 0;
                    if (!('id' in inv[i])) inv[i].id = this.EMPTY_ID;
                    if (!('name' in inv[i])) inv[i].name = '';
                }
            }

            toggle() { this.isOpen ? this.close() : this.open(); }

            open() {
                if (this.game.crafting && this.game.crafting.isOpen) this.game.crafting.close();
                this.ensureCapacity();
                this.isOpen = true;
                if (Utils && Utils.resetGameInput) Utils.resetGameInput(this.game);
                this.overlay.classList.add('open');
                this.overlay.setAttribute('aria-hidden', 'false');
                this._selectedIdx = (this.game.player && Number.isFinite(this.game.player.selectedSlot)) ? this.game.player.selectedSlot : 0;
                this.refresh(true);
                this._updateDetails();
            }

            close() {
                this._returnCursorItem();
                this.isOpen = false;
                this.overlay.classList.remove('open');
                this.overlay.setAttribute('aria-hidden', 'true');
                this._hideHeld();
            }

            /** @returns {boolean} */
            isBlockingInput() { return this.isOpen; }

            refresh(force = false) {
                this.ensureCapacity();

                const inv = this.game.player.inventory;
                const player = this.game.player;

                // 容量
                let used = 0;
                for (let i = 0; i < this.MAX_SIZE; i++) {
                    const it = inv[i];
                    if (it && it.count > 0) used++;
                }
                if (this.capacityText) this.capacityText.textContent = `${used}/${this.MAX_SIZE}`;
                if (this.capacityFill) this.capacityFill.style.width = `${Math.min(100, (used / this.MAX_SIZE) * 100)}%`;

                // slots
                for (let i = 0; i < this.MAX_SIZE; i++) {
                    const it = inv[i];
                    const empty = (!it || (it.count === 0 && it.id !== 'pickaxe'));
                    const slot = this._slotEls[i];

                    slot.classList.toggle('empty', empty);
                    slot.classList.toggle('active', (i < 9) && (i === player.selectedSlot));
                    slot.classList.toggle('selected', i === this._selectedIdx);

                    const idKey = empty ? null : it.id;
                    const countKey = empty ? 0 : it.count;

                    if (!force && this._lastId[i] === idKey && this._lastCount[i] === countKey) continue;
                    this._lastId[i] = idKey;
                    this._lastCount[i] = countKey;

                    const canvas = this._slotCanvases[i];
                    const cx = this._slotCtx[i];
                    const emoji = this._slotEmojiEls[i];
                    const countEl = this._slotCountEls[i];

                    // reset
                    canvas.style.display = 'none';
                    emoji.style.display = 'none';
                    countEl.style.display = 'none';

                    if (empty) continue;

                    if (it.id === 'pickaxe') {
                        emoji.textContent = it.icon || '⛏️';
                        emoji.style.display = '';
                    } else {
                        canvas.style.display = '';
                        cx.clearRect(0, 0, 34, 34);
                        const tex = (this.game.ui && this.game.ui.textures) ? this.game.ui.textures.get(it.id) : (this.game.renderer && this.game.renderer.textures ? this.game.renderer.textures.get(it.id) : null);
                        if (tex) cx.drawImage(tex, 0, 0, 34, 34);
                    }

                    if (it.id !== 'pickaxe' && it.count > 1) {
                        countEl.textContent = String(it.count);
                        countEl.style.display = '';
                    }
                }

                // 按钮状态
                const sel = this._getSelectedItem();
                const selMovable = !!(sel && sel.count > 0);
                if (this.btnToHotbar) this.btnToHotbar.disabled = !selMovable;
                if (this.btnDrop) this.btnDrop.disabled = !(sel && typeof sel.id === 'number' && sel.count > 0);
                if (this.btnPutBack) this.btnPutBack.disabled = !this._cursorItem;

                this._updateDetails();
            }

            _buildSlots() {
                // 清空容器（只构建一次）
                this.hotbarGrid.innerHTML = '';
                this.backpackGrid.innerHTML = '';

                for (let i = 0; i < this.MAX_SIZE; i++) {
                    const slot = document.createElement('div');
                    slot.className = 'inv-slot';
                    slot.dataset.idx = String(i);

                    if (i < 9 && !this.game.isMobile) {
                        const key = document.createElement('span');
                        key.className = 'key';
                        key.textContent = String(i + 1);
                        slot.appendChild(key);
                    }

                    const emoji = document.createElement('span');
                    emoji.className = 'item-icon';
                    emoji.style.display = 'none';
                    slot.appendChild(emoji);

                    const c = document.createElement('canvas');
                    c.width = c.height = 34;
                    c.style.display = 'none';
                    const cx = c.getContext('2d', { willReadFrequently: true });
                    cx.imageSmoothingEnabled = false;
                    slot.appendChild(c);

                    const count = document.createElement('span');
                    count.className = 'count';
                    count.style.display = 'none';
                    slot.appendChild(count);

                    slot.addEventListener('pointerdown', (e) => this._onSlotPointerDown(e));
                    slot.addEventListener('contextmenu', (e) => e.preventDefault());

                    if (i < 9) this.hotbarGrid.appendChild(slot);
                    else this.backpackGrid.appendChild(slot);

                    this._slotEls[i] = slot;
                    this._slotCanvases[i] = c;
                    this._slotCtx[i] = cx;
                    this._slotCountEls[i] = count;
                    this._slotEmojiEls[i] = emoji;
                }
            }

            _bind() {
                // 点击遮罩关闭
                this.overlay.addEventListener('click', (e) => {
                    if (e.target === this.overlay) this.close();
                });

                // close
                if (this.closeBtn) this.closeBtn.addEventListener('click', () => this.close());

                // 移动端：滑动关闭（下滑优先，辅以右滑）
                try {
                    const isMobile = document.documentElement.classList.contains('is-mobile') ||
                        (window.matchMedia && (matchMedia('(pointer: coarse)').matches || matchMedia('(any-pointer: coarse)').matches));
                    if (isMobile && this.panel) {
                        let dragging = false;
                        let pid = null;
                        let sx = 0, sy = 0;
                        let lastDx = 0, lastDy = 0;

                        const canStart = (e) => {
                            // 不抢占格子拖拽/按钮点击
                            if (e.target && e.target.closest) {
                                if (e.target.closest('.inv-slot, .inv-btn, button, a, input, select, textarea')) return false;
                            }
                            // 允许从顶部区域/详情区域滑动
                            return true;
                        };

                        const onDown = (e) => {
                            if (!this.isOpen) return;
                            try { e.preventDefault(); } catch (e) { if (typeof console !== 'undefined' && console.debug) console.debug('[Debug] Silently caught:', e); }
                            if (e.pointerType !== 'touch') return;
                            if (!canStart(e)) return;
                            dragging = true;
                            pid = e.pointerId;
                            sx = e.clientX; sy = e.clientY;
                            lastDx = 0; lastDy = 0;
                            this.panel.classList.add('dragging');
                            try { this.panel.setPointerCapture(pid); } catch (e) { if (typeof console !== 'undefined' && console.debug) console.debug('[Debug] Silently caught:', e); }
                        };

                        const onMove = (e) => {
                            if (!dragging || e.pointerId !== pid) return;
                            try { e.preventDefault(); } catch (e) { if (typeof console !== 'undefined' && console.debug) console.debug('[Debug] Silently caught:', e); }
                            lastDx = e.clientX - sx;
                            lastDy = e.clientY - sy;

                            // 以“下滑关闭”为主；横向轻微容错
                            const dy = Math.max(0, lastDy);
                            const dx = Math.max(0, lastDx);

                            const useDy = dy > dx * 0.8;
                            const offset = useDy ? Math.min(260, dy) : Math.min(220, dx * 0.75);
                            this.panel.style.setProperty('--inv-drag-y', offset.toFixed(0) + 'px');
                        };

                        const endDrag = () => {
                            if (!dragging) return;
                            dragging = false;
                            this.panel.classList.remove('dragging');

                            const dy = Math.max(0, lastDy);
                            const dx = Math.max(0, lastDx);
                            const shouldClose = (dy > 160 && dy > dx) || (dx > 200 && dx > dy);

                            if (shouldClose) {
                                this.panel.style.setProperty('--inv-drag-y', '0px');
                                this.close();
                            } else {
                                // 回弹
                                this.panel.style.setProperty('--inv-drag-y', '0px');
                            }

                            try { if (pid != null) this.panel.releasePointerCapture(pid); } catch (e) { if (typeof console !== 'undefined' && console.debug) console.debug('[Debug] Silently caught:', e); }
                            pid = null;
                        };

                        this.panel.addEventListener('pointerdown', onDown, { passive: false });
                        this.panel.addEventListener('pointermove', onMove, { passive: false });
                        this.panel.addEventListener('pointerup', endDrag, { passive: true });
                        this.panel.addEventListener('pointercancel', endDrag, { passive: true });
                    }
                } catch (e) { if (typeof console !== 'undefined' && console.debug) console.debug('[Debug] Silently caught:', e); }

                // 按钮
                if (this.btnTop) this.btnTop.addEventListener('click', () => this.toggle());
                if (this.btnFloat) this.btnFloat.addEventListener('click', () => this.toggle());

                if (this.btnSort) this.btnSort.addEventListener('click', () => { this._sortBackpack(); this._changed(); });
                if (this.btnToHotbar) this.btnToHotbar.addEventListener('click', () => { this._moveSelectedToHotbar(); this._changed(); });
                if (this.btnPutBack) this.btnPutBack.addEventListener('click', () => { this._returnCursorItem(); this._changed(); });
                if (this.btnDrop) this.btnDrop.addEventListener('click', () => { this._dropSelected(); this._changed(); });

                // 跟随鼠标/触摸显示拿起的物品
                this.overlay.addEventListener('pointermove', (e) => {
                    if (!this._cursorItem) return;
                    this._showHeldAt(e.clientX, e.clientY);
                }, { passive: true });

                this.overlay.addEventListener('pointerleave', () => {
                    // 留在屏幕边缘时保持显示（不隐藏）
                });
            }

            _onSlotPointerDown(e) {
                e.preventDefault();
