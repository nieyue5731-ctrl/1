        const RECIPES = [
            { out: BLOCK.PLANKS, count: 4, req: [{ id: BLOCK.LOG, count: 1 }], desc: "基础建筑材料，由原木加工而成。" },
            { out: BLOCK.TORCH, count: 4, req: [{ id: BLOCK.WOOD, count: 1 }], desc: "照亮黑暗的必需品。" },
            { out: BLOCK.BRICK, count: 4, req: [{ id: BLOCK.CLAY, count: 2 }], desc: "坚固的红色砖块。" },
            { out: BLOCK.GLASS, count: 2, req: [{ id: BLOCK.SAND, count: 2 }], desc: "透明的装饰方块。" },
            { out: BLOCK.TREASURE_CHEST, count: 1, req: [{ id: BLOCK.WOOD, count: 8 }], desc: "用于储存物品的箱子。" },
            { out: BLOCK.LANTERN, count: 1, req: [{ id: BLOCK.TORCH, count: 1 }, { id: BLOCK.IRON_ORE, count: 1 }], desc: "比火把更优雅的照明工具。" },
            { out: BLOCK.FROZEN_STONE, count: 4, req: [{ id: BLOCK.ICE, count: 2 }, { id: BLOCK.STONE, count: 2 }], desc: "寒冷的建筑石材。" },
            { out: BLOCK.GLOWSTONE, count: 1, req: [{ id: BLOCK.GLASS, count: 1 }, { id: BLOCK.TORCH, count: 2 }], desc: "人造发光石块。" },
            { out: BLOCK.METEORITE_BRICK, count: 4, req: [{ id: BLOCK.METEORITE, count: 1 }, { id: BLOCK.STONE, count: 1 }], desc: "来自外太空的建筑材料。" },
            { out: BLOCK.RAINBOW_BRICK, count: 10, req: [{ id: BLOCK.CRYSTAL, count: 1 }, { id: BLOCK.BRICK, count: 10 }], desc: "散发着彩虹光芒的砖块。" },
            { out: BLOCK.PARTY_BLOCK, count: 5, req: [{ id: BLOCK.PINK_FLOWER, count: 1 }, { id: BLOCK.DIRT, count: 5 }], desc: "让每一天都变成派对！" },
            { out: BLOCK.WOOD, count: 1, req: [{ id: BLOCK.PLANKS, count: 2 }], desc: "将木板还原为木材。" },
            { out: BLOCK.BONE, count: 2, req: [{ id: BLOCK.STONE, count: 1 }], desc: "由石头雕刻而成的骨头形状。" },
            { out: BLOCK.HAY, count: 4, req: [{ id: BLOCK.TALL_GRASS, count: 8 }], desc: "干草堆，适合建造农场。" }
        ];

        // ═══════════════════════════════════════════════════════════════════════════════
        //                                  合成系统

        // ───────────────────────── Exports ─────────────────────────
        window.TU = window.TU || {};
        Object.assign(window.TU, { Renderer });

    



        // ═══════════════════════════════════════════════════════════════════════════════
        class CraftingSystem {
            constructor(game) {
                this.game = game;
                this.isOpen = false;
                this.selectedRecipe = null;

                this.overlay = document.getElementById('crafting-overlay');
                this.grid = document.getElementById('craft-grid');
                this.closeBtn = document.getElementById('craft-close');
                this.craftBtn = document.getElementById('craft-action-btn');
                this.toggleBtn = document.getElementById('btn-craft-toggle');

                this._init();
            }

            _init() {
                this.closeBtn.addEventListener('click', () => this.close());
                this.toggleBtn.addEventListener('click', () => this.toggle());
                this.craftBtn.addEventListener('click', () => this.craft());

                // 点击遮罩关闭
                this.overlay.addEventListener('click', (e) => {
                    if (e.target === this.overlay) this.close();
                });
            }

            toggle() {
                if (this.isOpen) this.close();
                else this.open();
            }

            open() {
                this.isOpen = true;
                if (Utils && Utils.resetGameInput) Utils.resetGameInput(this.game);
                this.overlay.classList.add('open');
                this.refresh();
                this.selectRecipe(this.selectedRecipe || RECIPES[0]);
            }

            close() {
                this.isOpen = false;
                this.overlay.classList.remove('open');
            }

            refresh() {
                this.grid.innerHTML = '';

                RECIPES.forEach(recipe => {
                    const canCraft = this._canCraft(recipe);
                    const slot = document.createElement('div');
                    slot.className = `craft-slot ${canCraft ? 'can-craft' : ''}`;
                    if (this.selectedRecipe === recipe) slot.classList.add('selected');

                    // 绘制图标
                    const tex = this.game.renderer.textures.get(recipe.out);
                    if (tex) {
                        const c = document.createElement('canvas');
                        c.width = 32; c.height = 32;
                        const ctx = c.getContext('2d', { willReadFrequently: true });
                        ctx.imageSmoothingEnabled = false;
                        ctx.drawImage(tex, 0, 0, 32, 32);
                        slot.appendChild(c);
                    }

                    slot.addEventListener('click', () => this.selectRecipe(recipe));
                    this.grid.appendChild(slot);
                });
            }

            selectRecipe(recipe) {
                this.selectedRecipe = recipe;

                // 更新网格选中状态
                const slots = this.grid.children;
                RECIPES.forEach((r, i) => {
                    if (slots[i]) slots[i].classList.toggle('selected', r === recipe);
                });

                // 更新详情
                const info = BLOCK_DATA[recipe.out];
                document.getElementById('craft-title').textContent = `${info.name} (x${recipe.count})`;
                document.getElementById('craft-desc').textContent = recipe.desc;

                // 预览图
                const preview = document.getElementById('craft-preview');
                preview.innerHTML = '';
                const tex = this.game.renderer.textures.get(recipe.out);
                if (tex) {
                    const c = document.createElement('canvas');
                    c.width = 48; c.height = 48;
                    const ctx = c.getContext('2d', { willReadFrequently: true });
                    ctx.imageSmoothingEnabled = false;
                    ctx.drawImage(tex, 0, 0, 48, 48);
                    preview.appendChild(c);
                }

                // 原料列表
                const ingList = document.getElementById('craft-ingredients');
                ingList.innerHTML = '';
                let allHave = true;

                recipe.req.forEach(req => {
                    const have = this._countItem(req.id);
                    const needed = req.count;
                    const isEnough = have >= needed;
                    if (!isEnough) allHave = false;

                    const reqInfo = BLOCK_DATA[req.id];

                    const div = document.createElement('div');
                    div.className = `ingredient ${isEnough ? '' : 'missing'}`;
                    div.innerHTML = `
                <span class="ing-name">${reqInfo.name}</span>
                <span class="ing-count ${isEnough ? 'ok' : 'bad'}">${have}/${needed}</span>
            `;
                    ingList.appendChild(div);
                });

                // 按钮状态
                this.craftBtn.disabled = !allHave;
                this.craftBtn.textContent = allHave ? "制造" : "材料不足";
            }

            craft() {
                if (!this.selectedRecipe || !this._canCraft(this.selectedRecipe)) return;

                // 扣除材料
                this.selectedRecipe.req.forEach(req => {
                    this._consumeItem(req.id, req.count);
                });

                // 添加结果
                this.game._addToInventory(this.selectedRecipe.out, this.selectedRecipe.count);

                // 刷新界面
                this.refresh();
                this.selectRecipe(this.selectedRecipe);

                // 更新快捷栏
                this.game.ui.buildHotbar();
            }

            _canCraft(recipe) {
                return recipe.req.every(req => this._countItem(req.id) >= req.count);
            }

            _countItem(id) {
                let count = 0;
                for (const item of this.game.player.inventory) {
                    if (item.id === id) count += item.count;
                }
                return count;
            }

            _consumeItem(id, count) {
                let remaining = count;
                for (const item of this.game.player.inventory) {
                    if (item.id === id) {
                        const take = Math.min(item.count, remaining);
                        item.count -= take;
                        remaining -= take;
                        if (remaining <= 0) break;
                    }
                }
            }
        }

        // ═══════════════════════════════════════════════════════════════════════════════
        //                                   UI管理器 (美化版)

        // ───────────────────────── Exports ─────────────────────────
        window.TU = window.TU || {};
        Object.assign(window.TU, { CraftingSystem });

    
