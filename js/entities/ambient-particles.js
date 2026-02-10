                        this.items[i] = null;
                        this._holes++;
                        continue;
                    }

                    // Hash insert (bucket-only, collisions tolerated; distance check later)
                    const cx = (item.x / cs) | 0;
                    const cy = (item.y / cs) | 0;
                    const h = (((cx * 73856093) ^ (cy * 19349663)) >>> 0) & mask;
                    next[i] = head[h];
                    head[h] = i;
                }

                // Fast pickup query: only cells near player
                const px = player.cx ? player.cx() : (player.x || 0);
                const py = player.cy ? player.cy() : (player.y || 0);
                const pr = CONFIG.TILE_SIZE * 3; // pickup reach approx
                const minCx = ((px - pr) / cs) | 0, maxCx = ((px + pr) / cs) | 0;
                const minCy = ((py - pr) / cs) | 0, maxCy = ((py + pr) / cs) | 0;

                for (let cy = minCy; cy <= maxCy; cy++) {
                    for (let cx = minCx; cx <= maxCx; cx++) {
                        const h = (((cx * 73856093) ^ (cy * 19349663)) >>> 0) & mask;
                        let idx = head[h];
                        while (idx !== -1) {
                            const it = this.items[idx];
                            const nxt = next[idx];
                            if (it) {
                                // precise check
                                if (it.canPickup(player)) {
                                    const picked = addToInventoryCallback(it.blockId, it.count);
                                    if (picked) {
                                        this._release(it);
                                        this.items[idx] = null;
                                        this._holes++;
                                    }
                                }
                            }
                            idx = nxt;
                        }
                    }
                }

                // Advance head pointer (skip holes)
                while (this._start < this.items.length && !this.items[this._start]) {
                    this._start++;
                    this._holes = Math.max(0, this._holes - 1);
                }

                this._maybeCompact(false);
            }

            render(ctx, cam, textures, timeOfDay) {
                const ts = CONFIG.TILE_SIZE;
                const now = performance.now();
                const blinkPhase = Math.floor(now / 200) % 2;

                for (let i = this._start; i < this.items.length; i++) {
                    const item = this.items[i];
                    if (!item) continue;
                    const sx = item.x - cam.x;
                    const sy = item.y - cam.y;

                    // 浮动效果
                    const bob = Math.sin(now * 0.005 + item.bobOffset) * 3;

                    // 闪烁效果（快消失时）
                    const timeLeft = item.maxAge - item.age;
                    if (timeLeft < 5000 && blinkPhase === 0) {
                        continue; // 跳过渲染实现闪烁
                    }

                    ctx.save();
                    ctx.translate(sx + item.w / 2, sy + item.h / 2 + bob);
                    ctx.rotate(item.rotation);

                    // 发光效果（用查表避免每帧对象查找）
                    const lightLv = BLOCK_LIGHT[item.blockId];
                    if (lightLv > 0) {
                        ctx.shadowColor = BLOCK_COLOR[item.blockId] || '#fff';
                        ctx.shadowBlur = 15;
                    } else {
                        // 普通物品也有轻微发光
                        ctx.shadowColor = '#ffeaa7';
                        ctx.shadowBlur = 8;
                    }

                    // 绘制物品
                    const tex = textures.get(item.blockId);
                    if (tex) {
                        ctx.drawImage(tex, -item.w / 2, -item.h / 2, item.w, item.h);
                    } else {
                        // 后备渲染 (fixed: bd was undefined, use BLOCK_COLOR lookup)
                        ctx.fillStyle = BLOCK_COLOR[item.blockId] || '#fff';
                        ctx.fillRect(-item.w / 2, -item.h / 2, item.w, item.h);
                    }

                    ctx.shadowBlur = 0;

                    // 显示数量（如果大于1）
                    if (item.count > 1) {
                        ctx.fillStyle = '#ffeaa7';
                        ctx.font = 'bold 8px Arial';
                        ctx.textAlign = 'right';
                        ctx.fillText(item.count.toString(), item.w / 2, item.h / 2);
                    }

                    ctx.restore();
                }
            }

            clear() {
                for (let i = this._start; i < this.items.length; i++) {
                    const it = this.items[i];
                    if (it) this._release(it);
                }
                this.items = [];
                this._start = 0;
                this._holes = 0;
            }
        }

        // ═══════════════════════════════════════════════════════════════════════════════
        //                                 环境粒子系统

        // ───────────────────────── Exports ─────────────────────────
        window.TU = window.TU || {};
        Object.assign(window.TU, { DroppedItem, DroppedItemManager });

    

    <!-- ========================= SECTION: Effects & Simulation ========================= -->

    <!-- ========================= MODULE: fx/ambient_particles ========================= -->

        // ═══════════════════════════════════════════════════════════════════════════════
        class AmbientParticles {
            constructor(containerId) {
                this.container = document.getElementById(containerId);
                this.particles = [];
                this.mode = 'none';
                this._night = 0;
                this._lastOpacity = -1;
            }

            update(timeOfDay, weather) {
                if (!this.container) return;

                const reducedMotion = !!(window.GAME_SETTINGS && window.GAME_SETTINGS.reducedMotion);
                if (reducedMotion) {
                    if (this.mode !== 'none' || this.particles.length) this._clearAll();
