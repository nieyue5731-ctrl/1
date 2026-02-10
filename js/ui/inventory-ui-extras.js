                e.preventDefault();

                const idx = parseInt(e.currentTarget.dataset.idx, 10);
                this._selectedIdx = idx;
                if (idx < 9 && this.game && this.game.player) this.game.player.selectedSlot = idx;

                // Shift+点击：快速移动（桌面）
                if (e.shiftKey && !this._cursorItem) {
                    this._quickMove(idx);
                    this._changed();
                    return;
                }

                // 右键：拆分/放1个
                const isRight = (e.button === 2);
                if (isRight) {
                    this._rightClick(idx);
                    this._changed();
                    return;
                }

                // 左键：拿起/放下/交换
                this._leftClick(idx);
                this._changed();
            }

            _cloneItem(it) {
                if (!it) return null;
                const out = {};
                for (const k in it) out[k] = it[k];
                return out;
            }

            _isEmptySlot(i) {
                const it = this.game.player.inventory[i];
                return !it || (it.count === 0 && it.id !== 'pickaxe');
            }

            _clearSlot(i) {
                const it = this.game.player.inventory[i];
                if (!it) {
                    this.game.player.inventory[i] = { id: this.EMPTY_ID, name: '', count: 0 };
                    return;
                }
                it.id = this.EMPTY_ID;
                it.name = '';
                it.count = 0;
                // 清理镐子属性等
                delete it.power; delete it.speed; delete it.icon;
            }

            _setSlot(i, item) {
                const inv = this.game.player.inventory;
                if (!inv[i]) inv[i] = { id: this.EMPTY_ID, name: '', count: 0 };

                if (!item || item.count <= 0) {
                    this._clearSlot(i);
                    return;
                }

                // 直接覆盖字段（保持引用不变，避免其它地方持有 inv[i] 时失效）
                const s = inv[i];
                for (const k in s) delete s[k];
                for (const k in item) s[k] = item[k];
                if (!('name' in s)) s.name = '';
            }

            _getSelectedItem() {
                const it = this.game.player.inventory[this._selectedIdx];
                if (!it) return null;
                if (it.count === 0 && it.id !== 'pickaxe') return null;
                return it;
            }

            _leftClick(idx) {
                const inv = this.game.player.inventory;
                const it = inv[idx];

                const empty = (!it || (it.count === 0 && it.id !== 'pickaxe'));
                if (!this._cursorItem) {
                    if (empty) { this._hideHeld(); return; }
                    this._cursorItem = this._cloneItem(it);
                    this._cursorFrom = idx;
                    this._clearSlot(idx);
                    this._renderHeld();
                    return;
                }

                // 已拿起：放下/交换
                if (empty) {
                    this._setSlot(idx, this._cursorItem);
                    this._cursorItem = null;
                    this._cursorFrom = -1;
                    this._hideHeld();
                } else {
                    const tmp = this._cloneItem(it);
                    this._setSlot(idx, this._cursorItem);
                    this._cursorItem = tmp;
                    this._cursorFrom = idx;
                    this._renderHeld();
                }
            }

            _rightClick(idx) {
                const inv = this.game.player.inventory;
                const it = inv[idx];
                const empty = (!it || (it.count === 0 && it.id !== 'pickaxe'));

                // 没拿东西：拆半
                if (!this._cursorItem) {
                    if (empty) return;
                    if (it.id === 'pickaxe') return;
                    if (it.count <= 1) return;

                    const take = Math.ceil(it.count / 2);
                    const remain = it.count - take;

                    this._cursorItem = this._cloneItem(it);
                    this._cursorItem.count = take;
                    this._cursorFrom = -1;

                    it.count = remain;
                    if (it.count <= 0) this._clearSlot(idx);

                    this._renderHeld();
                    return;
                }

                // 拿着东西：往目标放 1 个（同类叠加/空位新建）
                if (this._cursorItem.id === 'pickaxe') return;
                if (this._cursorItem.count <= 0) { this._cursorItem = null; this._hideHeld(); return; }

                if (empty) {
                    const one = this._cloneItem(this._cursorItem);
                    one.count = 1;
                    this._setSlot(idx, one);
                    this._cursorItem.count -= 1;
                } else {
                    if (it.id !== this._cursorItem.id) return;
                    if (it.count >= this.MAX_STACK) return;
                    it.count += 1;
                    this._cursorItem.count -= 1;
                }

                if (this._cursorItem.count <= 0) {
                    this._cursorItem = null;
                    this._cursorFrom = -1;
                    this._hideHeld();
                } else {
                    this._renderHeld();
                }
            }

            _quickMove(idx) {
                const inv = this.game.player.inventory;
                const it = inv[idx];
                if (!it || (it.count === 0 && it.id !== 'pickaxe')) return;
                if (it.id === 'pickaxe') return; // 简化：镐子不参与快速移动

                const fromHotbar = idx < 9;
                const range = fromHotbar ? [9, this.MAX_SIZE - 1] : [0, 8];

                let remaining = it.count;

                // 1) 先叠加到同类堆
                for (let i = range[0]; i <= range[1] && remaining > 0; i++) {
                    const t = inv[i];
                    if (!t || t.count === 0) continue;
                    if (t.id !== it.id) continue;
                    const canAdd = Math.min(remaining, this.MAX_STACK - t.count);
                    if (canAdd <= 0) continue;
                    t.count += canAdd;
                    remaining -= canAdd;
                }

                // 2) 再放到空格
                for (let i = range[0]; i <= range[1] && remaining > 0; i++) {
                    const t = inv[i];
                    if (!t || (t.count === 0 && t.id !== 'pickaxe')) {
                        const piece = this._cloneItem(it);
                        piece.count = Math.min(remaining, this.MAX_STACK);
                        this._setSlot(i, piece);
                        remaining -= piece.count;
                    }
                }

                // 原格子扣除
                if (remaining <= 0) {
                    this._clearSlot(idx);
                } else {
                    it.count = remaining;
                }
            }

            _sortBackpack() {
                const inv = this.game.player.inventory;
                const start = 9;

                // collect
                const items = [];
                for (let i = start; i < this.MAX_SIZE; i++) {
                    const it = inv[i];
                    if (!it || (it.count === 0 && it.id !== 'pickaxe')) continue;
                    if (it.id === 'pickaxe') continue;
                    items.push(this._cloneItem(it));
                }

                // merge by id
                const map = new Map();
                for (const it of items) {
                    const key = it.id;
                    const prev = map.get(key) || 0;
                    map.set(key, prev + (it.count || 0));
                }

                const merged = [];
                for (const [id, total] of map.entries()) {
                    let left = total;
                    while (left > 0) {
                        const take = Math.min(left, this.MAX_STACK);
                        const bd = (typeof id === 'number') ? BLOCK_DATA[id] : null;
                        merged.push({ id, name: bd ? bd.name : ('' + id), count: take });
                        left -= take;
                    }
                }

                // sort (by name)
                merged.sort((a, b) => (String(a.name)).localeCompare(String(b.name), 'zh-Hans-CN-u-co-pinyin'));

                // clear backpack slots
                for (let i = start; i < this.MAX_SIZE; i++) this._clearSlot(i);

                // refill
                let ptr = start;
                for (const it of merged) {
                    if (ptr >= this.MAX_SIZE) break;
                    this._setSlot(ptr, it);
                    ptr++;
                }
            }

            _moveSelectedToHotbar() {
                const inv = this.game.player.inventory;
                const idx = this._selectedIdx;
                const it = this._getSelectedItem();
                if (!it) return;

                if (idx < 9) return;

                // 找空位，否则用当前选中栏位
                let target = -1;
                for (let i = 0; i < 9; i++) {
                    if (this._isEmptySlot(i)) { target = i; break; }
                }
                if (target < 0) target = this.game.player.selectedSlot || 0;

                const tmp = this._cloneItem(inv[target]);
                this._setSlot(target, this._cloneItem(it));
                if (tmp && !(tmp.count === 0 && tmp.id !== 'pickaxe')) {
                    this._setSlot(idx, tmp);
                } else {
                    this._clearSlot(idx);
                }

                this._selectedIdx = target;
            }

            _dropSelected() {
                const game = this.game;

                // 优先丢弃“手上拿起的物品”
                if (this._cursorItem) {
                    if (typeof this._cursorItem.id !== 'number') return;
                    const px = game.player.cx ? game.player.cx() : (game.player.x + game.player.w / 2);
                    const py = game.player.cy ? game.player.cy() : (game.player.y + game.player.h / 2);
                    game.droppedItems && game.droppedItems.spawn(px, py, this._cursorItem.id, this._cursorItem.count);
                    this._cursorItem = null;
                    this._cursorFrom = -1;
                    this._hideHeld();
                    return;
                }

                const idx = this._selectedIdx;
                const it = this._getSelectedItem();
                if (!it) return;
                if (typeof it.id !== 'number') return;

                const px = game.player.cx ? game.player.cx() : (game.player.x + game.player.w / 2);
                const py = game.player.cy ? game.player.cy() : (game.player.y + game.player.h / 2);

                game.droppedItems && game.droppedItems.spawn(px, py, it.id, it.count);
                this._clearSlot(idx);
            }

            _returnCursorItem() {
                if (!this._cursorItem) return;
                const inv = this.game.player.inventory;

                // 1) 尝试叠回同类（全背包范围）
                if (this._cursorItem.id !== 'pickaxe') {
