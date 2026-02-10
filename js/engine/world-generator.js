                    if (biome === 'plains') heightMod -= 5;
                    if (biome === 'jungle') heightMod += this.noise.fbm(x * 0.03, 50, 3) * 12;

                    const groundY = surfY + Math.floor(heightMod);

                    for (let y = 0; y < this.h; y++) {
                        if (y < groundY - 3) {
                            tiles[x][y] = BLOCK.AIR;
                        } else if (y === groundY) {
                            // 表面方块根据生物群系
                            tiles[x][y] = this._getSurfaceBlock(biome);
                        } else if (y < groundY + 4 + Math.floor(Math.random() * 4)) {
                            // 表土层
                            tiles[x][y] = this._getSubSurfaceBlock(biome);
                            walls[x][y] = 1;
                        } else if (y < this.h * CONFIG.UNDERGROUND_LEVEL) {
                            tiles[x][y] = this._getUndergroundBlock(x, y, 'upper');
                            walls[x][y] = 1;
                        } else if (y < this.h * CONFIG.CAVERN_LEVEL) {
                            tiles[x][y] = this._getUndergroundBlock(x, y, 'middle');
                            walls[x][y] = 2;
                        } else if (y < this.h * CONFIG.UNDERWORLD_LEVEL) {
                            tiles[x][y] = this._getUndergroundBlock(x, y, 'deep');
                            walls[x][y] = 2;
                        } else if (y >= this.h - 4) {
                            tiles[x][y] = BLOCK.BEDROCK;
                            walls[x][y] = 3;
                        } else {
                            // 地狱层
                            const hellNoise = this.noise.fbm(x * 0.03, y * 0.03, 3);
                            if (hellNoise > 0.3) tiles[x][y] = BLOCK.HELLSTONE;
                            else if (hellNoise > 0) tiles[x][y] = BLOCK.ASH;
                            else if (hellNoise > -0.3) tiles[x][y] = BLOCK.OBSIDIAN;
                            else tiles[x][y] = BLOCK.BASALT;
                            walls[x][y] = 3;
                        }
                    }
                }
            }

            _getSurfaceBlock(biome) {
                switch (biome) {
                    case 'tundra': case 'snow': return BLOCK.SNOW_GRASS;
                    case 'desert': return BLOCK.SAND;
                    case 'red_desert': return BLOCK.RED_SAND;
                    case 'jungle': return BLOCK.JUNGLE_GRASS;
                    case 'bamboo': return BLOCK.JUNGLE_GRASS;
                    case 'cherry': return BLOCK.GRASS;
                    case 'savanna': return Math.random() > 0.3 ? BLOCK.GRASS : BLOCK.SAND;
                    default: return BLOCK.GRASS;
                }
            }

            _getSubSurfaceBlock(biome) {
                switch (biome) {
                    case 'tundra': case 'snow': return Math.random() > 0.8 ? BLOCK.ICE : BLOCK.SNOW;
                    case 'desert': return Math.random() > 0.7 ? BLOCK.SANDSTONE : BLOCK.SAND;
                    case 'red_desert': return Math.random() > 0.6 ? BLOCK.SANDSTONE : BLOCK.RED_SAND;
                    case 'jungle': case 'bamboo': return Math.random() > 0.5 ? BLOCK.MUD : BLOCK.CLAY;
                    default: return BLOCK.DIRT;
                }
            }

            _getUndergroundBlock(x, y, layer) {
                const n = this.noise.fbm(x * 0.04, y * 0.04, 3);
                const n2 = this.noise.fbm(x * 0.08 + 200, y * 0.08, 2);

                if (layer === 'upper') {
                    if (n > 0.5) return BLOCK.GRAVEL;
                    if (n > 0.35) return BLOCK.CLAY;
                    if (n < -0.4) return BLOCK.LIMESTONE;
                    return BLOCK.STONE;
                } else if (layer === 'middle') {
                    if (n > 0.45) return BLOCK.MOSSY_STONE;
                    if (n > 0.3 && n2 > 0.2) return BLOCK.SLATE;
                    if (n < -0.35) return BLOCK.MARBLE;
                    if (n < -0.5) return BLOCK.GRANITE;
                    return BLOCK.STONE;
                } else {
                    if (n > 0.4) return BLOCK.GRANITE;
                    if (n > 0.25 && n2 > 0.1) return BLOCK.BASALT;
                    if (n < -0.3) return BLOCK.OBSIDIAN;
                    if (n < -0.45) return BLOCK.SLATE;
                    return BLOCK.STONE;
                }
            }

            _specialTerrain(tiles, walls) {
                // 浮空岛屿
                for (let i = 0; i < 3 + Math.floor(Math.random() * 4); i++) {
                    const ix = 80 + Math.floor(Math.random() * (this.w - 160));
                    const iy = 15 + Math.floor(Math.random() * 25);
                    const iw = 20 + Math.floor(Math.random() * 30);
                    const ih = 8 + Math.floor(Math.random() * 8);

                    this._createFloatingIsland(tiles, walls, ix, iy, iw, ih);
                }

                // 峡谷/裂缝
                for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) {
                    const cx = 50 + Math.floor(Math.random() * (this.w - 100));
                    this._createRavine(tiles, cx);
                }

                // 地表湖泊位置预留
                for (let i = 0; i < 4 + Math.floor(Math.random() * 4); i++) {
                    const lx = 30 + Math.floor(Math.random() * (this.w - 60));
                    this._createSurfaceLake(tiles, lx);
                }
            }

            _createFloatingIsland(tiles, walls, cx, cy, w, h) {
                for (let dx = -w / 2; dx < w / 2; dx++) {
                    const x = Math.floor(cx + dx);
                    if (x < 0 || x >= this.w) continue;

                    const edgeDist = Math.min(dx + w / 2, w / 2 - dx) / (w / 2);
                    const height = Math.floor(h * edgeDist * (0.7 + Math.random() * 0.3));

                    for (let dy = 0; dy < height; dy++) {
                        const y = cy + dy;
                        if (y < 0 || y >= this.h) continue;

                        if (dy === 0) {
                            tiles[x][y] = BLOCK.GRASS;
                        } else if (dy < 3) {
                            tiles[x][y] = BLOCK.DIRT;
                        } else {
                            tiles[x][y] = BLOCK.STONE;
                        }
                        walls[x][y] = 1;
                    }
                }

                // 岛上放些好东西
                if (cx > 0 && cx < this.w && cy > 0) {
                    if (Math.random() > 0.5) tiles[cx][cy - 1] = BLOCK.TREASURE_CHEST;
                    else tiles[cx][cy - 1] = BLOCK.CRYSTAL;
                }
            }

            _createRavine(tiles, startX) {
                let x = startX;
                const surfY = Math.floor(this.h * CONFIG.SURFACE_LEVEL);

                // 找到地表
                let groundY = 0;
                for (let y = 0; y < this.h; y++) {
                    if (tiles[x][y] !== BLOCK.AIR) { groundY = y; break; }
                }

                const depth = 30 + Math.floor(Math.random() * 40);
                const width = 3 + Math.floor(Math.random() * 4);

                for (let y = groundY; y < groundY + depth && y < this.h - 10; y++) {
                    const w = width + Math.floor(Math.sin(y * 0.1) * 2);
                    for (let dx = -w; dx <= w; dx++) {
                        const tx = x + dx + Math.floor(Math.sin(y * 0.15) * 3);
                        if (tx >= 0 && tx < this.w) {
                            tiles[tx][y] = BLOCK.AIR;
                        }
                    }
                }

                // 底部放水或熔岩
                for (let dx = -width - 2; dx <= width + 2; dx++) {
                    const tx = x + dx;
                    const ty = groundY + depth - 3;
                    if (tx >= 0 && tx < this.w && ty >= 0 && ty < this.h) {
                        if (tiles[tx][ty] === BLOCK.AIR) {
                            tiles[tx][ty] = Math.random() > 0.7 ? BLOCK.LAVA : BLOCK.WATER;
                        }
                    }
                }
            }

            _createSurfaceLake(tiles, startX) {
                const biome = this._biome(startX);
                if (biome === 'desert' || biome === 'red_desert') return; // 沙漠没有湖

                const width = 15 + Math.floor(Math.random() * 25);
                const depth = 4 + Math.floor(Math.random() * 6);

                // 找地表高度
                let minGroundY = this.h;
                for (let dx = 0; dx < width; dx++) {
                    const x = startX + dx;
                    if (x >= this.w) continue;
                    for (let y = 0; y < this.h; y++) {
                        if (tiles[x][y] !== BLOCK.AIR) {
                            minGroundY = Math.min(minGroundY, y);
                            break;
                        }
                    }
                }

                // 挖湖
                for (let dx = 0; dx < width; dx++) {
                    const x = startX + dx;
                    if (x >= this.w) continue;

                    const edgeDist = Math.min(dx, width - dx) / (width / 2);
                    const d = Math.floor(depth * edgeDist);

                    for (let dy = 0; dy < d; dy++) {
                        const y = minGroundY + dy;
                        if (y >= this.h) continue;
                        tiles[x][y] = biome === 'snow' || biome === 'tundra' ? BLOCK.ICE : BLOCK.WATER;
                    }
                }
            }

            _caves(tiles, walls) {
                const startY = Math.floor(this.h * CONFIG.SURFACE_LEVEL) + 8;

                // 多层洞穴系统
                for (let x = 0; x < this.w; x++) {
                    for (let y = startY; y < this.h - 4; y++) {
                        const subBiome = this._subBiome(x, y);

                        // 主洞穴网络
                        const c1 = this.caveNoise.warpedNoise(x * 0.032, y * 0.032);
                        const c2 = this.caveNoise.fbm(x * 0.05 + 500, y * 0.05, 4);
                        const c3 = this.caveNoise.fbm(x * 0.02 + 1000, y * 0.02, 3);

                        const depth = Math.min(1, (y - startY) / (this.h * 0.3));
                        const thresh = 0.35 + depth * 0.15;

                        // 主要洞穴
                        if (c1 > thresh || (c2 > 0.55 && Math.random() > 0.3)) {
                            tiles[x][y] = BLOCK.AIR;
                        }

                        // 大型洞室
                        if (y > this.h * CONFIG.CAVERN_LEVEL && c3 > 0.48) {
                            tiles[x][y] = BLOCK.AIR;
                        }

                        // 蠕虫状隧道
                        const worm = Math.sin(x * 0.05 + y * 0.1) * Math.sin(x * 0.02 - y * 0.03);
                        if (Math.abs(worm) < 0.08 && y > this.h * 0.35 && Math.random() > 0.3) {
                            tiles[x][y] = BLOCK.AIR;
                        }
                    }
                }

                // 地下水和熔岩池
                this._fillCaveLiquids(tiles);
            }

            _fillCaveLiquids(tiles) {
                for (let x = 0; x < this.w; x++) {
                    for (let y = Math.floor(this.h * 0.45); y < this.h - 4; y++) {
                        if (tiles[x][y] !== BLOCK.AIR) continue;

                        // 检查是否是池底
                        if (y + 1 < this.h && BLOCK_DATA[tiles[x][y + 1]]?.solid) {
                            // 深层熔岩
                            if (y > this.h * CONFIG.UNDERWORLD_LEVEL && Math.random() > 0.5) {
                                this._fillPool(tiles, x, y, BLOCK.LAVA, 8);
                            }
                            // 中层水池
                            else if (y < this.h * CONFIG.UNDERWORLD_LEVEL && Math.random() > 0.88) {
                                this._fillPool(tiles, x, y, BLOCK.WATER, 12);
                            }
                        }
                    }
                }
            }

            _fillPool(tiles, sx, sy, liquid, maxSize) {
                // 性能：避免 queue.shift() 的 O(n) 开销 & 字符串 key 的频繁分配
                const queue = [{ x: sx, y: sy }];
                let head = 0;
                const filled = new Set();
                let count = 0;

                while (head < queue.length && count < maxSize) {
                    const { x, y } = queue[head++];

                    if (x < 0 || x >= this.w || y < 0 || y >= this.h) continue;

                    // 以 32-bit key 代替 `${x},${y}`，减少 GC 压力（假设世界尺寸 < 65536）
                    const key = (x << 16) | (y & 0xffff);
                    if (filled.has(key)) continue;
                    filled.add(key);

                    if (tiles[x][y] !== BLOCK.AIR) continue;

                    tiles[x][y] = liquid;
                    count++;

                    // 只向下和水平扩展
                    queue.push({ x: x - 1, y }, { x: x + 1, y }, { x, y: y + 1 });
                }
            }

            _lakes(tiles) {
                // 地下大型湖泊
                for (let i = 0; i < 3 + Math.floor(Math.random() * 3); i++) {
                    const lx = 50 + Math.floor(Math.random() * (this.w - 100));
                    const ly = Math.floor(this.h * (0.5 + Math.random() * 0.25));
                    const lw = 25 + Math.floor(Math.random() * 35);
                    const lh = 8 + Math.floor(Math.random() * 12);

                    this._createUndergroundLake(tiles, lx, ly, lw, lh);
                }

                // 熔岩湖
                for (let i = 0; i < 2 + Math.floor(Math.random() * 2); i++) {
                    const lx = 40 + Math.floor(Math.random() * (this.w - 80));
                    const ly = Math.floor(this.h * (0.85 + Math.random() * 0.1));
                    const lw = 20 + Math.floor(Math.random() * 30);
                    const lh = 5 + Math.floor(Math.random() * 8);

                    this._createLavaLake(tiles, lx, ly, lw, lh);
                }
            }

            _createUndergroundLake(tiles, cx, cy, w, h) {
                for (let dx = -w / 2; dx < w / 2; dx++) {
                    for (let dy = -h / 2; dy < h / 2; dy++) {
                        const x = Math.floor(cx + dx);
                        const y = Math.floor(cy + dy);
                        if (x < 0 || x >= this.w || y < 0 || y >= this.h) continue;

                        const dist = Math.sqrt((dx / (w / 2)) ** 2 + (dy / (h / 2)) ** 2);
                        if (dist < 1 - Math.random() * 0.2) {
                            tiles[x][y] = BLOCK.WATER;
                        }
                    }
                }
            }

            _createLavaLake(tiles, cx, cy, w, h) {
                for (let dx = -w / 2; dx < w / 2; dx++) {
                    for (let dy = -h / 2; dy < h / 2; dy++) {
                        const x = Math.floor(cx + dx);
                        const y = Math.floor(cy + dy);
                        if (x < 0 || x >= this.w || y < 0 || y >= this.h) continue;

                        const dist = Math.sqrt((dx / (w / 2)) ** 2 + (dy / (h / 2)) ** 2);
                        if (dist < 0.9) {
                            tiles[x][y] = BLOCK.LAVA;
                        }
                    }
                }
                // 周围放萤石
                for (let i = 0; i < 8; i++) {
                    const gx = cx + Math.floor((Math.random() - 0.5) * w * 1.2);
                    const gy = cy + Math.floor((Math.random() - 0.5) * h * 1.5);
                    if (gx >= 0 && gx < this.w && gy >= 0 && gy < this.h) {
                        if (tiles[gx][gy] === BLOCK.STONE || tiles[gx][gy] === BLOCK.OBSIDIAN) {
                            tiles[gx][gy] = BLOCK.GLOWSTONE;
                        }
                    }
                }
            }

            _ores(tiles) {
                const ores = [
                    // 常见矿石
                    { id: BLOCK.COPPER_ORE, minY: 0.26, maxY: 0.55, chance: 0.008, size: 6 },
                    { id: BLOCK.IRON_ORE, minY: 0.35, maxY: 0.65, chance: 0.006, size: 5 },
                    { id: BLOCK.SILVER_ORE, minY: 0.45, maxY: 0.75, chance: 0.005, size: 4 },
                    { id: BLOCK.GOLD_ORE, minY: 0.52, maxY: 0.82, chance: 0.004, size: 4 },
                    // 稀有矿石
                    { id: BLOCK.DIAMOND_ORE, minY: 0.70, maxY: 0.88, chance: 0.0015, size: 3 },
                    { id: BLOCK.RUBY_ORE, minY: 0.60, maxY: 0.80, chance: 0.002, size: 3 },
                    { id: BLOCK.EMERALD_ORE, minY: 0.55, maxY: 0.75, chance: 0.002, size: 3 },
                    { id: BLOCK.SAPPHIRE_ORE, minY: 0.58, maxY: 0.78, chance: 0.002, size: 3 },
                    // 特殊矿石
                    { id: BLOCK.CRYSTAL, minY: 0.48, maxY: 0.72, chance: 0.003, size: 4 },
                    { id: BLOCK.AMETHYST, minY: 0.55, maxY: 0.80, chance: 0.0025, size: 4 },
                    { id: BLOCK.GLOWSTONE, minY: 0.60, maxY: 0.85, chance: 0.003, size: 3 },
                    // 地狱矿石
                    { id: BLOCK.HELLSTONE, minY: 0.88, maxY: 0.98, chance: 0.015, size: 5 }
                ];

                for (const ore of ores) {
                    const minY = Math.floor(this.h * ore.minY);
                    const maxY = Math.floor(this.h * ore.maxY);

                    for (let x = 0; x < this.w; x++) {
                        for (let y = minY; y < maxY; y++) {
                            // 使用噪声增加矿脉聚集性
                            const oreChance = ore.chance * (1 + this.oreNoise.fbm(x * 0.1, y * 0.1, 2));
                            if (Math.random() < oreChance) {
                                const block = tiles[x][y];
                                if (block === BLOCK.STONE || block === BLOCK.GRANITE ||
                                    block === BLOCK.SLATE || block === BLOCK.LIMESTONE) {
                                    this._placeVein(tiles, x, y, ore.id, ore.size + Math.floor(Math.random() * 3));
                                }
                            }
                        }
                    }
                }
            }

            _placeVein(tiles, sx, sy, id, size) {
                const placed = [{ x: sx, y: sy }];
                tiles[sx][sy] = id;
                let attempts = 0;

                while (placed.length < size && attempts < size * 3) {
                    attempts++;
                    const p = placed[Math.floor(Math.random() * placed.length)];
                    const nx = p.x + Math.floor(Math.random() * 3) - 1;
                    const ny = p.y + Math.floor(Math.random() * 3) - 1;

                    if (nx >= 0 && nx < this.w && ny >= 0 && ny < this.h) {
                        const block = tiles[nx][ny];
                        if (block === BLOCK.STONE || block === BLOCK.GRANITE ||
                            block === BLOCK.SLATE || block === BLOCK.LIMESTONE ||
                            block === BLOCK.MARBLE || block === BLOCK.BASALT) {
                            tiles[nx][ny] = id;
                            placed.push({ x: nx, y: ny });
                        }
                    }
                }
            }

            _vegetation(tiles) {
                for (let x = 5; x < this.w - 5; x++) {
                    const biome = this._biome(x);
                    let groundY = 0;
                    for (let y = 0; y < this.h; y++) {
                        if (tiles[x][y] !== BLOCK.AIR) { groundY = y; break; }
                    }
                    if (!groundY || groundY > this.h * 0.5) continue;

                    // 各种树木
                    this._placeTree(tiles, x, groundY, biome);

                    // 花草装饰
                    this._placeFlora(tiles, x, groundY, biome);
                }
            }

            _placeTree(tiles, x, groundY, biome) {
                const treeChance = {
                    'forest': 0.08, 'jungle': 0.12, 'plains': 0.03, 'cherry': 0.07,
                    'bamboo': 0.15, 'snow': 0.04, 'tundra': 0.02, 'savanna': 0.02,
                    'desert': 0, 'red_desert': 0
                };

                if (Math.random() > (treeChance[biome] || 0.05)) return;
                if (tiles[x][groundY - 1] !== BLOCK.AIR) return;

                let logType = BLOCK.LOG;
                let leafType = BLOCK.LEAVES;
                let height = 5 + Math.floor(Math.random() * 4);
                let canopyRadius = 2;

                switch (biome) {
                    case 'jungle':
                        height = 10 + Math.floor(Math.random() * 8);
                        canopyRadius = 3 + Math.floor(Math.random() * 2);
                        break;
                    case 'bamboo':
                        logType = BLOCK.BAMBOO;
                        height = 8 + Math.floor(Math.random() * 6);
                        // 竹子没有树冠
                        for (let i = 1; i <= height && groundY - i >= 0; i++) {
                            tiles[x][groundY - i] = logType;
                        }
                        return;
                    case 'cherry':
                        logType = BLOCK.CHERRY_LOG;
                        leafType = BLOCK.CHERRY_LEAVES;
                        height = 6 + Math.floor(Math.random() * 3);
                        canopyRadius = 3;
                        break;
                    case 'snow': case 'tundra':
                        logType = BLOCK.PINE_LOG;
                        leafType = BLOCK.PINE_LEAVES;
                        height = 8 + Math.floor(Math.random() * 5);
                        // 松树是三角形
                        for (let i = 1; i <= height && groundY - i >= 0; i++) {
                            tiles[x][groundY - i] = logType;
                        }
                        for (let layer = 0; layer < height - 2; layer++) {
                            const w = Math.max(1, Math.floor((height - layer) / 2));
                            const y = groundY - height + layer;
                            for (let dx = -w; dx <= w; dx++) {
                                const tx = x + dx;
                                if (tx >= 0 && tx < this.w && y >= 0 && tiles[tx][y] === BLOCK.AIR) {
                                    tiles[tx][y] = leafType;
                                }
                            }
                        }
                        return;
                    case 'savanna':
                        height = 4 + Math.floor(Math.random() * 2);
                        canopyRadius = 4;
                        break;
                    case 'desert': case 'red_desert':
                        // 仙人掌
                        if (Math.random() > 0.96) {
                            const h = 3 + Math.floor(Math.random() * 4);
                            for (let i = 1; i <= h && groundY - i >= 0; i++) {
                                tiles[x][groundY - i] = BLOCK.CACTUS;
                            }
                            // 仙人掌手臂
                            if (h > 3 && Math.random() > 0.5) {
                                const armY = groundY - Math.floor(h / 2);
                                const armDir = Math.random() > 0.5 ? 1 : -1;
                                if (x + armDir >= 0 && x + armDir < this.w) {
                                    if (armY >= 0 && armY < this.h && tiles[x + armDir][armY] === BLOCK.AIR) tiles[x + armDir][armY] = BLOCK.CACTUS;
                                    if (armY - 1 >= 0 && (armY - 1) < this.h && tiles[x + armDir][armY - 1] === BLOCK.AIR) tiles[x + armDir][armY - 1] = BLOCK.CACTUS;
                                }
                            }
                        }
                        return;
                }

                // 标准树干
                for (let i = 1; i <= height && groundY - i >= 0; i++) {
                    tiles[x][groundY - i] = logType;
                }

                // 树冠
                for (let dx = -canopyRadius; dx <= canopyRadius; dx++) {
                    for (let dy = -canopyRadius - 1; dy <= 1; dy++) {
                        const tx = x + dx, ty = groundY - height + dy;
                        if (tx >= 0 && tx < this.w && ty >= 0 && ty < this.h) {
                            const dist = Math.sqrt(dx * dx + dy * dy);
                            if (dist <= canopyRadius + 0.5 && tiles[tx][ty] === BLOCK.AIR && Math.random() > 0.15) {
                                tiles[tx][ty] = leafType;
                            }
                        }
                    }
                }
            }

            _placeFlora(tiles, x, groundY, biome) {
                if (tiles[x][groundY - 1] !== BLOCK.AIR) return;

                const floraChance = biome === 'jungle' ? 0.5 : biome === 'plains' ? 0.4 :
                    biome === 'forest' ? 0.35 : biome === 'cherry' ? 0.45 : 0.2;

                if (Math.random() > floraChance) return;

                const r = Math.random();
                let flora = BLOCK.TALL_GRASS;

                switch (biome) {
                    case 'plains':
                        if (r > 0.92) flora = BLOCK.SUNFLOWER;
                        else if (r > 0.85) flora = BLOCK.FLOWER_RED;
                        else if (r > 0.78) flora = BLOCK.FLOWER_YELLOW;
                        else if (r > 0.7) flora = BLOCK.PINK_FLOWER;
                        else if (r > 0.62) flora = BLOCK.BLUE_FLOWER;
                        else flora = BLOCK.TALL_GRASS;
                        break;
                    case 'forest':
                        if (r > 0.9) flora = BLOCK.MUSHROOM;
                        else if (r > 0.8) flora = BLOCK.FERN;
                        else if (r > 0.7) flora = BLOCK.FLOWER_RED;
                        else flora = BLOCK.TALL_GRASS;
                        break;
                    case 'jungle':
                        if (r > 0.85) flora = BLOCK.FERN;
                        else if (r > 0.75) flora = BLOCK.PINK_FLOWER;
                        else flora = BLOCK.TALL_GRASS;
                        break;
                    case 'cherry':
                        if (r > 0.8) flora = BLOCK.PINK_FLOWER;
                        else if (r > 0.6) flora = BLOCK.FLOWER_RED;
                        else flora = BLOCK.TALL_GRASS;
                        break;
                    case 'snow': case 'tundra':
                        if (r > 0.9) flora = BLOCK.BLUE_FLOWER;
                        break;
                    default:
                        if (r > 0.85) flora = BLOCK.FLOWER_YELLOW;
                        else if (r > 0.7) flora = BLOCK.TALL_GRASS;
                        else return;
                }

                tiles[x][groundY - 1] = flora;
            }

            _undergroundLife(tiles, walls) {
                const startY = Math.floor(this.h * CONFIG.UNDERGROUND_LEVEL);

                for (let x = 0; x < this.w; x++) {
                    for (let y = startY; y < this.h * CONFIG.UNDERWORLD_LEVEL; y++) {
                        if (tiles[x][y] !== BLOCK.AIR) continue;

                        const subBiome = this._subBiome(x, y);

                        // 地下蘑菇
                        if (tiles[x][y + 1] !== BLOCK.AIR && BLOCK_DATA[tiles[x][y + 1]]?.solid) {
                            if (Math.random() > 0.992) {
                                tiles[x][y] = subBiome === 'mushroom_cave' ? BLOCK.UNDERGROUND_MUSHROOM : BLOCK.MUSHROOM;
                            }
                            if (subBiome === 'mushroom_cave' && Math.random() > 0.97) {
                                // 巨型蘑菇
                                this._placeGiantMushroom(tiles, x, y);
                            }
                        }

                        // 天花板装饰
                        if (y > 0 && tiles[x][y - 1] !== BLOCK.AIR && BLOCK_DATA[tiles[x][y - 1]]?.solid) {
                            if (Math.random() > 0.985) {
                                tiles[x][y] = BLOCK.STALACTITE;
                            }
                            if (subBiome === 'lush_cave' && Math.random() > 0.9) {
                                tiles[x][y] = BLOCK.VINE;
                            }
                        }

                        // 地面装饰
                        if (y + 1 < this.h && tiles[x][y + 1] !== BLOCK.AIR && BLOCK_DATA[tiles[x][y + 1]]?.solid) {
                            if (Math.random() > 0.988) {
                                tiles[x][y] = BLOCK.STALAGMITE;
                            }
                            if (subBiome === 'lush_cave' && Math.random() > 0.93) {
                                tiles[x][y] = BLOCK.GLOWING_MOSS;
                            }
                            if (subBiome === 'crystal_cave' && Math.random() > 0.95) {
                                tiles[x][y] = Math.random() > 0.5 ? BLOCK.CRYSTAL : BLOCK.AMETHYST;
                            }
                        }

                        // 墙壁装饰
                        if (subBiome === 'lush_cave') {
                            if (x > 0 && tiles[x - 1][y] !== BLOCK.AIR && Math.random() > 0.92) {
                                tiles[x][y] = BLOCK.MOSS;
                            }
                            if (x + 1 < this.w && tiles[x + 1][y] !== BLOCK.AIR && Math.random() > 0.92) {
                                tiles[x][y] = BLOCK.MOSS;
                            }
                        }

                        // 冰洞穴
                        if (subBiome === 'ice_cave') {
                            if (Math.random() > 0.95) {
                                // 将周围石头变成冻石
                                for (let dx = -1; dx <= 1; dx++) {
                                    for (let dy = -1; dy <= 1; dy++) {
                                        const tx = x + dx, ty = y + dy;
                                        if (tx >= 0 && tx < this.w && ty >= 0 && ty < this.h) {
                                            if (tiles[tx][ty] === BLOCK.STONE) {
                                                tiles[tx][ty] = BLOCK.FROZEN_STONE;
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            _placeGiantMushroom(tiles, x, groundY) {
                const height = 5 + Math.floor(Math.random() * 4);
                const capRadius = 2 + Math.floor(Math.random() * 2);

                // 茎
                for (let i = 1; i <= height && groundY - i >= 0; i++) {
                    tiles[x][groundY - i] = BLOCK.MUSHROOM_GIANT;
                }

                // 伞盖
                for (let dx = -capRadius; dx <= capRadius; dx++) {
                    const tx = x + dx;
                    const ty = groundY - height;
                    if (tx >= 0 && tx < this.w && ty >= 0 && ty < this.h) {
                        if (tiles[tx][ty] === BLOCK.AIR) {
                            tiles[tx][ty] = BLOCK.MUSHROOM_GIANT;
                        }
                        if (ty - 1 >= 0 && tiles[tx][ty - 1] === BLOCK.AIR && Math.abs(dx) < capRadius) {
                            tiles[tx][ty - 1] = BLOCK.MUSHROOM_GIANT;
                        }
                    }
                }
            }

            _structures(tiles, walls) {
                // 地表小屋
                for (let i = 0; i < 6 + Math.floor(Math.random() * 5); i++) {
                    const x = 50 + Math.floor(Math.random() * (this.w - 100));
                    this._placeHouse(tiles, walls, x);
                }

                // 地下遗迹小屋
                for (let i = 0; i < 8 + Math.floor(Math.random() * 6); i++) {
                    const x = 40 + Math.floor(Math.random() * (this.w - 80));
                    const y = Math.floor(this.h * (0.4 + Math.random() * 0.35));
                    this._placeUndergroundCabin(tiles, walls, x, y);
                }

                // 矿井入口
                for (let i = 0; i < 3 + Math.floor(Math.random() * 3); i++) {
                    const x = 60 + Math.floor(Math.random() * (this.w - 120));
                    this._placeMineEntrance(tiles, walls, x);
                }

                // 神殿
                if (Math.random() > 0.3) {
                    const x = 100 + Math.floor(Math.random() * (this.w - 200));
                    const y = Math.floor(this.h * (0.55 + Math.random() * 0.2));
                    this._placeTemple(tiles, walls, x, y);
                }
            }

            _placeHouse(tiles, walls, x) {
                let groundY = 0;
                for (let y = 0; y < this.h; y++) {
                    if (tiles[x][y] !== BLOCK.AIR) { groundY = y; break; }
                }
                if (!groundY || groundY > this.h * 0.4) return;

                const w = 8 + Math.floor(Math.random() * 4);
                const h = 6 + Math.floor(Math.random() * 3);
                const biome = this._biome(x);

                let wallBlock = BLOCK.PLANKS;
                if (biome === 'desert' || biome === 'red_desert') wallBlock = BLOCK.SANDSTONE;
                if (biome === 'snow' || biome === 'tundra') wallBlock = Math.random() > 0.5 ? BLOCK.PLANKS : BLOCK.ICE;

                for (let dx = 0; dx < w; dx++) {
                    for (let dy = 0; dy < h; dy++) {
                        const tx = x + dx, ty = groundY - h + dy;
                        if (tx >= this.w || ty < 0) continue;

                        const isWall = dx === 0 || dx === w - 1 || dy === 0 || dy === h - 1;
                        const isDoor = dy === h - 1 && dx === Math.floor(w / 2);

                        if (isDoor) {
                            tiles[tx][ty] = BLOCK.AIR;
                        } else if (isWall) {
                            tiles[tx][ty] = wallBlock;
                        } else {
                            tiles[tx][ty] = BLOCK.AIR;
                            walls[tx][ty] = 1;
                        }
                    }
                }

                // 内部装饰
                const midX = x + Math.floor(w / 2);
                const floorY = groundY - 1;
                if (midX < this.w && floorY > 0) {
                    tiles[midX][groundY - h + 1] = BLOCK.LANTERN;
                    if (Math.random() > 0.5 && x + w - 2 < this.w) {
                        tiles[x + w - 2][floorY] = BLOCK.TREASURE_CHEST;
                    }
                }
            }

            _placeUndergroundCabin(tiles, walls, x, y) {
                const w = 7 + Math.floor(Math.random() * 5);
                const h = 5 + Math.floor(Math.random() * 3);

                for (let dx = 0; dx < w; dx++) {
                    for (let dy = 0; dy < h; dy++) {
                        const tx = x + dx, ty = y + dy;
                        if (tx >= this.w || ty >= this.h) continue;

                        const isWall = dx === 0 || dx === w - 1 || dy === 0 || dy === h - 1;
                        tiles[tx][ty] = isWall ? BLOCK.PLANKS : BLOCK.AIR;
                        if (!isWall) walls[tx][ty] = 1;
                    }
                }

                // 火把
                if (x + Math.floor(w / 2) < this.w && y + 1 < this.h) {
                    tiles[x + Math.floor(w / 2)][y + 1] = BLOCK.TORCH;
                }
                // 宝箱
                if (x + w - 2 < this.w && y + h - 2 < this.h && Math.random() > 0.3) {
                    tiles[x + w - 2][y + h - 2] = BLOCK.TREASURE_CHEST;
                }
            }

            _placeMineEntrance(tiles, walls, x) {
                let groundY = 0;
                for (let y = 0; y < this.h; y++) {
                    if (tiles[x][y] !== BLOCK.AIR) { groundY = y; break; }
                }
                if (!groundY) return;

                // 矿井入口框架
                const entranceW = 4;
                const entranceH = 5;

                for (let dx = 0; dx < entranceW; dx++) {
                    for (let dy = 0; dy < entranceH; dy++) {
                        const tx = x + dx, ty = groundY + dy;
                        if (tx >= this.w || ty >= this.h) continue;

                        if (dx === 0 || dx === entranceW - 1) {
                            tiles[tx][ty] = BLOCK.PLANKS;
                        } else {
                            tiles[tx][ty] = BLOCK.AIR;
                        }
                    }
                }

                // 向下的竖井
                const shaftDepth = 20 + Math.floor(Math.random() * 30);
                for (let dy = entranceH; dy < shaftDepth; dy++) {
                    const ty = groundY + dy;
                    if (ty >= this.h - 10) break;

                    for (let dx = 1; dx < entranceW - 1; dx++) {
                        const tx = x + dx;
                        if (tx < this.w) tiles[tx][ty] = BLOCK.AIR;
                    }

                    // 周期性放置梯子平台
                    if (dy % 8 === 0) {
                        for (let dx = 0; dx < entranceW; dx++) {
                            const tx = x + dx;
                            if (tx < this.w) tiles[tx][ty] = BLOCK.PLANKS;
                        }
                    }

                    // 火把
                    if (dy % 6 === 0 && x < this.w) {
                        tiles[x][ty] = BLOCK.TORCH;
                    }
                }
            }

            _placeTemple(tiles, walls, x, y) {
                const w = 15 + Math.floor(Math.random() * 10);
                const h = 10 + Math.floor(Math.random() * 5);

                const wallBlock = Math.random() > 0.5 ? BLOCK.BRICK : BLOCK.COBBLESTONE;

                for (let dx = 0; dx < w; dx++) {
                    for (let dy = 0; dy < h; dy++) {
                        const tx = x + dx, ty = y + dy;
                        if (tx >= this.w || ty >= this.h) continue;

                        const isWall = dx === 0 || dx === w - 1 || dy === 0 || dy === h - 1;
                        const isPillar = (dx === 3 || dx === w - 4) && dy > 1 && dy < h - 1;

                        if (isWall || isPillar) {
                            tiles[tx][ty] = wallBlock;
                        } else {
                            tiles[tx][ty] = BLOCK.AIR;
                            walls[tx][ty] = 2;
                        }
                    }
                }

                // 中央宝藏
                const cx = x + Math.floor(w / 2);
                const cy = y + h - 2;
                if (cx < this.w && cy < this.h) {
                    tiles[cx][cy] = BLOCK.TREASURE_CHEST;
                    tiles[cx][y + 1] = BLOCK.LANTERN;

                    // 周围水晶
                    for (let i = 0; i < 4; i++) {
                        const crystalX = cx + (i % 2 === 0 ? -2 : 2);
                        const crystalY = cy - (i < 2 ? 0 : 1);
                        if (crystalX >= 0 && crystalX < this.w && crystalY >= 0 && crystalY < this.h) {
                            tiles[crystalX][crystalY] = Math.random() > 0.5 ? BLOCK.CRYSTAL : BLOCK.AMETHYST;
                        }
                    }
                }

                // 蜘蛛网装饰
                for (let i = 0; i < 5; i++) {
                    const wx = x + 1 + Math.floor(Math.random() * (w - 2));
                    const wy = y + 1 + Math.floor(Math.random() * 3);
                    if (wx < this.w && wy < this.h && tiles[wx][wy] === BLOCK.AIR) {
                        tiles[wx][wy] = BLOCK.SPIDER_WEB;
                    }
                }
            }

            _dungeons(tiles, walls) {
                const dungeonCount = 2 + Math.floor(Math.random() * 3);

                for (let d = 0; d < dungeonCount; d++) {
                    const startX = 80 + Math.floor(Math.random() * (this.w - 160));
                    const startY = Math.floor(this.h * (0.5 + Math.random() * 0.3));

                    this._createDungeon(tiles, walls, startX, startY);
                }

                // 额外添加特殊结构
                this._createSpecialFeatures(tiles, walls);

                // StructureDescriptor：从 JSON 结构库按深度抽取并焊接到地形中
                if (this._weldStructuresFromLibrary) this._weldStructuresFromLibrary(tiles, walls);
            }

            // 创建特殊地形特征
            _createSpecialFeatures(tiles, walls) {
                // 陨石坑
                for (let i = 0; i < 1 + Math.floor(Math.random() * 2); i++) {
                    const mx = 100 + Math.floor(Math.random() * (this.w - 200));
                    this._createMeteoriteCrater(tiles, mx);
                }

                // 蜂巢
                for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) {
                    const hx = 60 + Math.floor(Math.random() * (this.w - 120));
                    const hy = Math.floor(this.h * (0.35 + Math.random() * 0.2));
                    this._createBeehive(tiles, walls, hx, hy);
                }

                // 蜘蛛巢穴
                for (let i = 0; i < 3 + Math.floor(Math.random() * 4); i++) {
                    const sx = 50 + Math.floor(Math.random() * (this.w - 100));
                    const sy = Math.floor(this.h * (0.45 + Math.random() * 0.3));
                    this._createSpiderNest(tiles, walls, sx, sy);
                }

                // 生命树
                for (let i = 0; i < 2 + Math.floor(Math.random() * 2); i++) {
                    const tx = 80 + Math.floor(Math.random() * (this.w - 160));
                    this._createLivingTree(tiles, walls, tx);
                }

                // 金字塔 (沙漠)
                this._createPyramids(tiles, walls);

                // 地下丛林神庙
                if (Math.random() > 0.4) {
                    const jx = Math.floor(this.w * 0.6 + Math.random() * this.w * 0.3);
                    const jy = Math.floor(this.h * (0.65 + Math.random() * 0.15));
                    this._createJungleTemple(tiles, walls, jx, jy);
                }

                // 天空岛链
                this._createSkyIslandChain(tiles, walls);

                // 地下蘑菇生态区
                this._createMushroomBiome(tiles, walls);

                // 腐化/猩红区域
                this._createEvilBiome(tiles, walls);

                // 神圣区域
                this._createHallowBiome(tiles, walls);

                // 海洋/沙滩
                this._createOceans(tiles, walls);

                // 药草分布
                this._distributeHerbs(tiles);

                // 生命水晶
                this._placeLifeCrystals(tiles);
            }

            _createMeteoriteCrater(tiles, cx) {
                let groundY = 0;
                for (let y = 0; y < this.h; y++) {
                    if (tiles[cx][y] !== BLOCK.AIR) { groundY = y; break; }
                }
                if (!groundY) return;

                const craterRadius = 8 + Math.floor(Math.random() * 6);

                // 挖出陨石坑
                for (let dx = -craterRadius; dx <= craterRadius; dx++) {
                    const x = cx + dx;
                    if (x < 0 || x >= this.w) continue;

                    const depth = Math.floor(Math.sqrt(craterRadius * craterRadius - dx * dx) * 0.7);
                    for (let dy = -2; dy < depth; dy++) {
                        const y = groundY + dy;
                        if (y >= 0 && y < this.h) {
                            tiles[x][y] = BLOCK.AIR;
                        }
                    }
                }

                // 填充陨石
                for (let dx = -craterRadius + 2; dx <= craterRadius - 2; dx++) {
                    const x = cx + dx;
                    if (x < 0 || x >= this.w) continue;

                    const meteoriteHeight = Math.floor(Math.sqrt((craterRadius - 2) * (craterRadius - 2) - dx * dx) * 0.5);
                    for (let dy = 0; dy < meteoriteHeight; dy++) {
                        const y = groundY + Math.floor(craterRadius * 0.5) - dy;
                        if (y >= 0 && y < this.h && Math.random() > 0.15) {
                            tiles[x][y] = BLOCK.METEORITE;
                        }
                    }
                }
            }

            _createBeehive(tiles, walls, cx, cy) {
                const w = 12 + Math.floor(Math.random() * 8);
                const h = 8 + Math.floor(Math.random() * 6);

                for (let dx = -w / 2; dx < w / 2; dx++) {
                    for (let dy = -h / 2; dy < h / 2; dy++) {
                        const x = Math.floor(cx + dx);
                        const y = Math.floor(cy + dy);
                        if (x < 0 || x >= this.w || y < 0 || y >= this.h) continue;

                        const dist = Math.sqrt((dx / (w / 2)) ** 2 + (dy / (h / 2)) ** 2);
                        if (dist < 0.85) {
                            if (dist > 0.7) {
                                tiles[x][y] = BLOCK.HIVE;
                            } else if (Math.random() > 0.6) {
                                tiles[x][y] = BLOCK.HONEY_BLOCK;
                            } else {
                                tiles[x][y] = BLOCK.AIR;
                            }
                            walls[x][y] = 1;
                        }
                    }
                }

                // 中心蜂窝
                if (cx >= 0 && cx < this.w && cy >= 0 && cy < this.h) {
                    tiles[cx][cy] = BLOCK.BEE_NEST;
                }
            }

            _createSpiderNest(tiles, walls, cx, cy) {
                const radius = 6 + Math.floor(Math.random() * 5);

                // 挖空区域
                for (let dx = -radius; dx <= radius; dx++) {
                    for (let dy = -radius; dy <= radius; dy++) {
                        const x = cx + dx;
                        const y = cy + dy;
                        if (x < 0 || x >= this.w || y < 0 || y >= this.h) continue;

                        const dist = Math.sqrt(dx * dx + dy * dy);
                        if (dist < radius * 0.9) {
                            tiles[x][y] = BLOCK.AIR;
                            walls[x][y] = 2;
                        }
                    }
                }

                // 添加蜘蛛网
                for (let i = 0; i < radius * 3; i++) {
                    const wx = cx + Math.floor((Math.random() - 0.5) * radius * 1.5);
                    const wy = cy + Math.floor((Math.random() - 0.5) * radius * 1.5);
                    if (wx >= 0 && wx < this.w && wy >= 0 && wy < this.h) {
                        if (tiles[wx][wy] === BLOCK.AIR) {
                            tiles[wx][wy] = BLOCK.SPIDER_WEB;
                        }
                    }
                }

                // 中心蜘蛛巢
                if (cx >= 0 && cx < this.w && cy >= 0 && cy < this.h) {
                    tiles[cx][cy] = BLOCK.SPIDER_NEST;
                }
            }

            _createLivingTree(tiles, walls, cx) {
                let groundY = 0;
                for (let y = 0; y < this.h; y++) {
                    if (tiles[cx][y] !== BLOCK.AIR) { groundY = y; break; }
                }
                if (!groundY || groundY > this.h * 0.4) return;

                const trunkWidth = 4 + Math.floor(Math.random() * 3);
                const trunkHeight = 25 + Math.floor(Math.random() * 20);
                const rootDepth = 15 + Math.floor(Math.random() * 10);

                // 树干
                for (let dx = -trunkWidth / 2; dx < trunkWidth / 2; dx++) {
                    const x = Math.floor(cx + dx);
                    if (x < 0 || x >= this.w) continue;

                    for (let dy = 1; dy <= trunkHeight; dy++) {
                        const y = groundY - dy;
                        if (y >= 0) {
                            tiles[x][y] = BLOCK.LIVING_WOOD;
                        }
                    }
                }

                // 树根 (向下延伸)
                for (let dx = -trunkWidth / 2; dx < trunkWidth / 2; dx++) {
                    const x = Math.floor(cx + dx);
                    if (x < 0 || x >= this.w) continue;

                    for (let dy = 0; dy < rootDepth; dy++) {
                        const y = groundY + dy;
                        if (y < this.h) {
                            tiles[x][y] = BLOCK.LIVING_WOOD;
                            walls[x][y] = 1;
                        }
                    }
                }

                // 地下房间
                const roomY = groundY + Math.floor(rootDepth / 2);
                const roomW = 6 + Math.floor(Math.random() * 4);
                const roomH = 5 + Math.floor(Math.random() * 3);

                for (let dx = -roomW / 2; dx < roomW / 2; dx++) {
                    for (let dy = -roomH / 2; dy < roomH / 2; dy++) {
                        const x = Math.floor(cx + dx);
                        const y = Math.floor(roomY + dy);
                        if (x >= 0 && x < this.w && y >= 0 && y < this.h) {
                            tiles[x][y] = BLOCK.AIR;
                            walls[x][y] = 1;
                        }
                    }
                }

                // 宝箱
                if (cx >= 0 && cx < this.w && roomY >= 0 && roomY < this.h) {
                    tiles[cx][Math.floor(roomY + roomH / 2 - 1)] = BLOCK.TREASURE_CHEST;
                    tiles[cx][Math.floor(roomY - roomH / 2 + 1)] = BLOCK.LANTERN;
                }

                // 树冠
                const canopyRadius = trunkWidth + 4 + Math.floor(Math.random() * 3);
                for (let dx = -canopyRadius; dx <= canopyRadius; dx++) {
                    for (let dy = -canopyRadius; dy <= 2; dy++) {
                        const x = cx + dx;
                        const y = groundY - trunkHeight + dy;
                        if (x < 0 || x >= this.w || y < 0) continue;

                        const dist = Math.sqrt(dx * dx + dy * dy);
                        if (dist <= canopyRadius && tiles[x][y] === BLOCK.AIR && Math.random() > 0.2) {
                            tiles[x][y] = BLOCK.LIVING_LEAF;
                        }
                    }
                }
            }

            _createPyramids(tiles, walls) {
                // 找沙漠区域
                for (let x = 50; x < this.w - 50; x += 80) {
                    const biome = this._biome(x);
                    if (biome !== 'desert' && biome !== 'red_desert') continue;
                    if (Math.random() > 0.4) continue;

                    let groundY = 0;
                    for (let y = 0; y < this.h; y++) {
                        if (tiles[x][y] !== BLOCK.AIR) { groundY = y; break; }
                    }
                    if (!groundY) continue;

                    const pyramidW = 30 + Math.floor(Math.random() * 20);
                    const pyramidH = Math.floor(pyramidW * 0.6);

                    // 金字塔外壳
                    for (let layer = 0; layer < pyramidH; layer++) {
                        const layerW = pyramidW - layer * 2;
                        const y = groundY - layer;
                        if (y < 0) break;

                        for (let dx = -layerW / 2; dx < layerW / 2; dx++) {
                            const px = Math.floor(x + dx);
                            if (px >= 0 && px < this.w) {
                                tiles[px][y] = BLOCK.SANDSTONE;
                            }
                        }
                    }

                    // 内部通道和房间
                    const corridorY = groundY - Math.floor(pyramidH / 3);
                    const roomY = groundY - Math.floor(pyramidH / 2);

                    // 入口通道
                    for (let dy = 0; dy < pyramidH / 2; dy++) {
                        const y = groundY - dy;
                        if (y >= 0 && tiles[x][y] !== BLOCK.AIR) {
                            tiles[x][y] = BLOCK.AIR;
                            if (x - 1 >= 0) tiles[x - 1][y] = BLOCK.AIR;
                        }
                    }

                    // 宝藏室
                    const treasureRoomW = 8;
                    const treasureRoomH = 6;
                    for (let dx = -treasureRoomW / 2; dx < treasureRoomW / 2; dx++) {
                        for (let dy = -treasureRoomH / 2; dy < treasureRoomH / 2; dy++) {
                            const px = Math.floor(x + dx);
                            const py = Math.floor(roomY + dy);
                            if (px >= 0 && px < this.w && py >= 0 && py < this.h) {
                                tiles[px][py] = BLOCK.AIR;
                                walls[px][py] = 1;
                            }
                        }
                    }

                    // 宝箱和装饰
                    if (x >= 0 && x < this.w && roomY >= 0 && roomY < this.h) {
                        tiles[x][Math.floor(roomY + treasureRoomH / 2 - 1)] = BLOCK.TREASURE_CHEST;
                        tiles[x - 2][Math.floor(roomY + treasureRoomH / 2 - 1)] = BLOCK.GOLD_BRICK;
                        tiles[x + 2][Math.floor(roomY + treasureRoomH / 2 - 1)] = BLOCK.GOLD_BRICK;
                    }
                }
            }

            _createJungleTemple(tiles, walls, cx, cy) {
                const w = 40 + Math.floor(Math.random() * 20);
                const h = 30 + Math.floor(Math.random() * 15);

                const wallBlock = BLOCK.LIHZAHRD_BRICK;

                // 外墙
                for (let dx = 0; dx < w; dx++) {
                    for (let dy = 0; dy < h; dy++) {
                        const x = cx + dx;
                        const y = cy + dy;
                        if (x >= this.w || y >= this.h) continue;

                        const isWall = dx < 3 || dx >= w - 3 || dy < 3 || dy >= h - 3;
                        tiles[x][y] = isWall ? wallBlock : BLOCK.AIR;
                        if (!isWall) walls[x][y] = 2;
                    }
                }

                // 内部隔墙
                for (let i = 0; i < 5; i++) {
                    const wx = cx + 5 + Math.floor(Math.random() * (w - 10));
                    const wy = cy + 5;
                    const wh = Math.floor(Math.random() * (h - 10));

                    for (let dy = 0; dy < wh; dy++) {
                        if (wx < this.w && wy + dy < this.h) {
                            tiles[wx][wy + dy] = wallBlock;
                        }
                    }
                }

                // 机关和宝藏
                const treasureX = cx + Math.floor(w / 2);
                const treasureY = cy + h - 5;
                if (treasureX < this.w && treasureY < this.h) {
                    tiles[treasureX][treasureY] = BLOCK.TREASURE_CHEST;
                    tiles[treasureX][cy + 4] = BLOCK.LANTERN;
                }

                // 祭坛
                const altarX = cx + Math.floor(w / 2);
                const altarY = cy + Math.floor(h / 2);
                if (altarX < this.w && altarY < this.h) {
                    tiles[altarX][altarY] = BLOCK.ALTAR;
                }
            }

            _createSkyIslandChain(tiles, walls) {
                const chainCount = 1 + Math.floor(Math.random() * 2);

                for (let c = 0; c < chainCount; c++) {
                    const startX = 100 + Math.floor(Math.random() * (this.w - 300));
                    const startY = 8 + Math.floor(Math.random() * 12);
                    const islandCount = 3 + Math.floor(Math.random() * 4);

                    let currentX = startX;
                    let currentY = startY;

                    for (let i = 0; i < islandCount; i++) {
                        const iw = 15 + Math.floor(Math.random() * 15);
                        const ih = 5 + Math.floor(Math.random() * 4);

                        // 云层基础
                        for (let dx = -iw / 2; dx < iw / 2; dx++) {
                            const x = Math.floor(currentX + dx);
                            if (x < 0 || x >= this.w) continue;

                            const edgeDist = Math.min(dx + iw / 2, iw / 2 - dx) / (iw / 2);
                            const height = Math.floor(ih * edgeDist);

                            for (let dy = 0; dy < height; dy++) {
                                const y = currentY + dy;
                                if (y >= 0 && y < this.h) {
                                    if (dy === 0) {
                                        tiles[x][y] = BLOCK.SUNPLATE;
                                    } else if (dy < 2) {
                                        tiles[x][y] = BLOCK.CLOUD;
                                    } else {
                                        tiles[x][y] = Math.random() > 0.5 ? BLOCK.CLOUD : BLOCK.RAIN_CLOUD;
                                    }
                                }
                            }
                        }

                        // 岛上建筑
                        if (Math.random() > 0.4) {
                            const houseX = Math.floor(currentX);
                            const houseY = currentY - 1;
                            if (houseX >= 0 && houseX < this.w && houseY >= 0) {
                                // 小房子
                                for (let hdx = -3; hdx <= 3; hdx++) {
                                    for (let hdy = 0; hdy < 4; hdy++) {
                                        const hx = houseX + hdx;
                                        const hy = houseY - hdy;
                                        if (hx >= 0 && hx < this.w && hy >= 0) {
                                            if (hdx === -3 || hdx === 3 || hdy === 0 || hdy === 3) {
                                                tiles[hx][hy] = BLOCK.SUNPLATE;
                                            } else {
                                                tiles[hx][hy] = BLOCK.AIR;
                                            }
                                        }
                                    }
                                }
                                tiles[houseX][houseY] = BLOCK.TREASURE_CHEST;
                            }
                        }

                        currentX += iw + 10 + Math.floor(Math.random() * 15);
                        currentY += Math.floor(Math.random() * 5) - 2;
                        currentY = Utils.clamp(currentY, 5, 25);
                    }
                }
            }

            _createMushroomBiome(tiles, walls) {
                const biomeCount = 1 + Math.floor(Math.random() * 2);

                for (let b = 0; b < biomeCount; b++) {
                    const cx = 100 + Math.floor(Math.random() * (this.w - 200));
                    const cy = Math.floor(this.h * (0.55 + Math.random() * 0.15));
                    const radius = 30 + Math.floor(Math.random() * 25);

                    // 转换区域为蘑菇生态
                    for (let dx = -radius; dx <= radius; dx++) {
                        for (let dy = -radius; dy <= radius; dy++) {
                            const x = cx + dx;
                            const y = cy + dy;
                            if (x < 0 || x >= this.w || y < 0 || y >= this.h) continue;

                            const dist = Math.sqrt(dx * dx + dy * dy);
                            if (dist > radius) continue;

                            const block = tiles[x][y];

                            // 转换方块
                            if (block === BLOCK.STONE) {
                                tiles[x][y] = Math.random() > 0.3 ? BLOCK.MUSHROOM_GRASS : block;
                            } else if (block === BLOCK.DIRT) {
                                tiles[x][y] = BLOCK.MUD;
                            }

                            // 在空气中生成蘑菇
                            if (block === BLOCK.AIR && y + 1 < this.h && BLOCK_DATA[tiles[x][y + 1]]?.solid) {
                                if (Math.random() > 0.9) {
                                    tiles[x][y] = BLOCK.UNDERGROUND_MUSHROOM;
                                }
                            }
                        }
                    }

                    // 巨型蘑菇
                    for (let i = 0; i < 5 + Math.floor(Math.random() * 5); i++) {
                        const mx = cx + Math.floor((Math.random() - 0.5) * radius);
                        const my = cy + Math.floor((Math.random() - 0.5) * radius);
                        if (mx >= 0 && mx < this.w && my >= 0 && my < this.h) {
                            if (tiles[mx][my] === BLOCK.AIR && my + 1 < this.h && BLOCK_DATA[tiles[mx][my + 1]]?.solid) {
                                this._placeGiantMushroom(tiles, mx, my);
                            }
                        }
                    }
                }
            }

            _createEvilBiome(tiles, walls) {
                const isCrimson = Math.random() > 0.5;
                const stoneType = isCrimson ? BLOCK.CRIMSON_STONE : BLOCK.EBONSTONE;
                const altarType = isCrimson ? BLOCK.CRIMSON_ALTAR : BLOCK.DEMON_ALTAR;

                // 在世界一侧创建邪恶生态
                const side = Math.random() > 0.5 ? 'left' : 'right';
                const startX = side === 'left' ? 30 : this.w - 80;
                const endX = side === 'left' ? 80 : this.w - 30;

                for (let x = startX; x < endX; x++) {
                    for (let y = Math.floor(this.h * 0.25); y < this.h * 0.85; y++) {
                        if (x < 0 || x >= this.w) continue;

                        const block = tiles[x][y];

                        if (block === BLOCK.STONE || block === BLOCK.GRANITE || block === BLOCK.SLATE) {
                            if (Math.random() > 0.3) {
                                tiles[x][y] = stoneType;
                            }
                        } else if (block === BLOCK.GRASS) {
                            tiles[x][y] = isCrimson ? BLOCK.CRIMSON_STONE : BLOCK.CORRUPTION_STONE;
                        }
                    }
                }

                // 放置祭坛
                for (let i = 0; i < 3 + Math.floor(Math.random() * 3); i++) {
                    const ax = startX + Math.floor(Math.random() * (endX - startX));
                    const ay = Math.floor(this.h * (0.4 + Math.random() * 0.3));
                    if (ax >= 0 && ax < this.w && ay >= 0 && ay < this.h) {
                        if (tiles[ax][ay] === BLOCK.AIR || tiles[ax][ay] === stoneType) {
                            tiles[ax][ay] = altarType;
                        }
                    }
                }
            }

            _createHallowBiome(tiles, walls) {
                // 在世界另一侧创建神圣生态
                const cx = Math.floor(this.w * 0.7);
                const radius = 40 + Math.floor(Math.random() * 20);

                for (let dx = -radius; dx <= radius; dx++) {
                    for (let y = Math.floor(this.h * 0.25); y < this.h * 0.75; y++) {
                        const x = cx + dx;
                        if (x < 0 || x >= this.w) continue;

                        const dist = Math.abs(dx) / radius;
                        if (dist > 1 || Math.random() > (1 - dist * 0.5)) continue;

                        const block = tiles[x][y];

                        if (block === BLOCK.STONE) {
                            tiles[x][y] = Math.random() > 0.5 ? BLOCK.PEARLSTONE : BLOCK.HALLOW_STONE;
                        } else if (block === BLOCK.GRASS) {
                            tiles[x][y] = BLOCK.HALLOW_STONE;
                        } else if (block === BLOCK.SAND) {
                            tiles[x][y] = BLOCK.PEARLSTONE;
                        }
                    }
                }
            }

            _createOceans(tiles, walls) {
                // 左侧海洋
                this._createOcean(tiles, 0, 60, true);
                // 右侧海洋
                this._createOcean(tiles, this.w - 60, this.w, false);
            }

            _createOcean(tiles, startX, endX, isLeft) {
                const surfY = Math.floor(this.h * CONFIG.SURFACE_LEVEL);
                const oceanDepth = 20 + Math.floor(Math.random() * 15);

                for (let x = startX; x < endX; x++) {
                    if (x < 0 || x >= this.w) continue;

                    // 找地表
                    let groundY = surfY;
                    for (let y = 0; y < this.h; y++) {
                        if (tiles[x][y] !== BLOCK.AIR) { groundY = y; break; }
                    }

                    // 挖深并填水
                    const depth = oceanDepth * (isLeft ? (endX - x) / (endX - startX) : (x - startX) / (endX - startX));

                    for (let dy = 0; dy < depth; dy++) {
                        const y = groundY + dy;
                        if (y >= this.h) break;

                        tiles[x][y] = BLOCK.WATER;
                    }

                    // 海底沙子
                    for (let dy = Math.floor(depth); dy < Math.floor(depth) + 5; dy++) {
                        const y = groundY + dy;
                        if (y >= this.h) break;
                        tiles[x][y] = BLOCK.SAND;
                    }

                    // 海草和海带
                    if (Math.random() > 0.85) {
                        const seaY = groundY + Math.floor(depth) - 1;
                        if (seaY >= 0 && seaY < this.h && tiles[x][seaY] === BLOCK.WATER) {
                            tiles[x][seaY] = Math.random() > 0.5 ? BLOCK.SEAWEED : BLOCK.KELP;
                        }
                    }

                    // 珊瑚
                    if (Math.random() > 0.92) {
                        const coralY = groundY + Math.floor(depth);
                        if (coralY >= 0 && coralY < this.h) {
                            tiles[x][coralY] = BLOCK.CORAL;
                        }
                    }
                }
            }

            _distributeHerbs(tiles) {
                const herbs = [
                    { id: BLOCK.DAYBLOOM, biomes: ['plains', 'forest'], surface: true },
                    { id: BLOCK.MOONGLOW, biomes: ['jungle', 'bamboo'], underground: true },
                    { id: BLOCK.BLINKROOT, biomes: ['all'], underground: true },
                    { id: BLOCK.WATERLEAF, biomes: ['desert', 'red_desert'], surface: true },
                    { id: BLOCK.FIREBLOSSOM, biomes: ['all'], hell: true },
                    { id: BLOCK.SHIVERTHORN, biomes: ['snow', 'tundra'], surface: true },
                    { id: BLOCK.DEATHWEED, biomes: ['all'], underground: true }
                ];

                for (let x = 10; x < this.w - 10; x++) {
                    const biome = this._biome(x);

                    for (const herb of herbs) {
                        if (herb.biomes[0] !== 'all' && !herb.biomes.includes(biome)) continue;
                        if (Math.random() > 0.005) continue;

                        let startY, endY;
                        if (herb.surface) {
                            startY = 0;
                            endY = Math.floor(this.h * 0.35);
                        } else if (herb.underground) {
                            startY = Math.floor(this.h * 0.35);
                            endY = Math.floor(this.h * 0.85);
                        } else if (herb.hell) {
                            startY = Math.floor(this.h * 0.9);
                            endY = this.h - 5;
                        }

                        for (let y = startY; y < endY; y++) {
                            if (tiles[x][y] === BLOCK.AIR && y + 1 < this.h && BLOCK_DATA[tiles[x][y + 1]]?.solid) {
                                tiles[x][y] = herb.id;
                                break;
                            }
                        }
                    }
                }
            }

            _placeLifeCrystals(tiles) {
                const crystalCount = 15 + Math.floor(Math.random() * 10);

                for (let i = 0; i < crystalCount; i++) {
                    const x = 50 + Math.floor(Math.random() * (this.w - 100));
                    const y = Math.floor(this.h * (0.4 + Math.random() * 0.4));

                    if (x >= 0 && x < this.w && y >= 0 && y < this.h) {
                        if (tiles[x][y] === BLOCK.AIR && y + 1 < this.h && BLOCK_DATA[tiles[x][y + 1]]?.solid) {
                            tiles[x][y] = Math.random() > 0.7 ? BLOCK.HEART_CRYSTAL : BLOCK.LIFE_CRYSTAL;
                        }
                    }
                }

                // 魔力水晶
                const manaCount = 10 + Math.floor(Math.random() * 8);
                for (let i = 0; i < manaCount; i++) {
                    const x = 50 + Math.floor(Math.random() * (this.w - 100));
                    const y = Math.floor(this.h * (0.5 + Math.random() * 0.35));

                    if (x >= 0 && x < this.w && y >= 0 && y < this.h) {
                        if (tiles[x][y] === BLOCK.AIR) {
                            tiles[x][y] = BLOCK.MANA_CRYSTAL;
                        }
                    }
                }
            }

            _createDungeon(tiles, walls, startX, startY) {
                const roomCount = 4 + Math.floor(Math.random() * 4);
                const rooms = [];

                // 生成房间
                let lastRoom = { x: startX, y: startY, w: 8, h: 6 };
                rooms.push(lastRoom);

                for (let i = 1; i < roomCount; i++) {
                    const dir = Math.floor(Math.random() * 4);
                    let nx = lastRoom.x, ny = lastRoom.y;
                    const nw = 6 + Math.floor(Math.random() * 5);
                    const nh = 5 + Math.floor(Math.random() * 4);

                    switch (dir) {
                        case 0: nx = lastRoom.x + lastRoom.w + 5 + Math.floor(Math.random() * 8); break;
                        case 1: nx = lastRoom.x - nw - 5 - Math.floor(Math.random() * 8); break;
                        case 2: ny = lastRoom.y + lastRoom.h + 3 + Math.floor(Math.random() * 5); break;
                        case 3: ny = lastRoom.y - nh - 3 - Math.floor(Math.random() * 5); break;
                    }

                    if (nx < 10 || nx + nw >= this.w - 10 || ny < this.h * 0.35 || ny + nh >= this.h - 10) continue;

                    const newRoom = { x: nx, y: ny, w: nw, h: nh };
                    rooms.push(newRoom);

                    // 连接走廊
                    this._createCorridor(tiles, walls, lastRoom, newRoom);
                    lastRoom = newRoom;
                }

                // 绘制房间
                const wallBlock = BLOCK.BRICK;
                for (const room of rooms) {
                    for (let dx = 0; dx < room.w; dx++) {
                        for (let dy = 0; dy < room.h; dy++) {
                            const tx = room.x + dx, ty = room.y + dy;
                            if (tx >= this.w || ty >= this.h || tx < 0 || ty < 0) continue;

                            const isWall = dx === 0 || dx === room.w - 1 || dy === 0 || dy === room.h - 1;
                            tiles[tx][ty] = isWall ? wallBlock : BLOCK.AIR;
                            if (!isWall) walls[tx][ty] = 2;
                        }
                    }

                    // 房间装饰
                    const midX = room.x + Math.floor(room.w / 2);
                    const floorY = room.y + room.h - 2;

                    if (midX < this.w && room.y + 1 < this.h) {
                        tiles[midX][room.y + 1] = BLOCK.LANTERN;
                    }

                    // 随机放置物品
                    if (Math.random() > 0.4) {
                        const itemX = room.x + 1 + Math.floor(Math.random() * (room.w - 2));
                        if (itemX < this.w && floorY < this.h && tiles[itemX][floorY] === BLOCK.AIR) {
                            const r = Math.random();
                            if (r > 0.7) tiles[itemX][floorY] = BLOCK.TREASURE_CHEST;
                            else if (r > 0.4) tiles[itemX][floorY] = BLOCK.CRYSTAL;
                            else tiles[itemX][floorY] = BLOCK.BONE;
                        }
                    }

                    // 蜘蛛网
                    if (Math.random() > 0.5) {
                        for (let i = 0; i < 3; i++) {
                            const wx = room.x + 1 + Math.floor(Math.random() * (room.w - 2));
                            const wy = room.y + 1 + Math.floor(Math.random() * 2);
                            if (wx < this.w && wy < this.h && tiles[wx][wy] === BLOCK.AIR) {
                                tiles[wx][wy] = BLOCK.SPIDER_WEB;
                            }
                        }
                    }
                }
            }

            _createCorridor(tiles, walls, room1, room2) {
                const x1 = Math.floor(room1.x + room1.w / 2);
                const y1 = Math.floor(room1.y + room1.h / 2);
                const x2 = Math.floor(room2.x + room2.w / 2);
                const y2 = Math.floor(room2.y + room2.h / 2);

                let cx = x1, cy = y1;

                // 先水平后垂直
                while (cx !== x2) {
                    if (cx >= 0 && cx < this.w && cy >= 0 && cy < this.h) {
                        tiles[cx][cy] = BLOCK.AIR;
                        if (cy - 1 >= 0) tiles[cx][cy - 1] = BLOCK.AIR;
                        if (cy + 1 < this.h) tiles[cx][cy + 1] = BLOCK.AIR;
                        walls[cx][cy] = 2;
                    }
                    cx += cx < x2 ? 1 : -1;
                }

                while (cy !== y2) {
                    if (cx >= 0 && cx < this.w && cy >= 0 && cy < this.h) {
                        tiles[cx][cy] = BLOCK.AIR;
                        if (cx - 1 >= 0) tiles[cx - 1][cy] = BLOCK.AIR;
                        if (cx + 1 < this.w) tiles[cx + 1][cy] = BLOCK.AIR;
                        walls[cx][cy] = 2;
                    }
                    cy += cy < y2 ? 1 : -1;
                }
            }

            _lighting(tiles, light) {
                // 阳光（垂直直射）+ 收集光源
                const w = this.w, h = this.h;
                const srcX = [];
                const srcY = [];
                const srcL = [];

                for (let x = 0; x < w; x++) {
                    let sun = CONFIG.LIGHT_LEVELS;
                    const colTiles = tiles[x];
                    const colLight = light[x];

                    for (let y = 0; y < h; y++) {
                        const id = colTiles[y];

                        // SUN_DECAY: 0 / 1 / 3（与原规则一致）
                        const decay = SUN_DECAY[id];
                        if (decay) sun = sun > decay ? (sun - decay) : 0;

                        const bl = BLOCK_LIGHT[id];
                        const v = sun > bl ? sun : bl;
                        colLight[y] = v;

                        // 只扩散“方块光源”，不扩散太阳光（保持旧效果：太阳光只向下直射）
                        if (bl > 0) {
                            srcX.push(x);
                            srcY.push(y);
                            srcL.push(bl);
                        }
                    }
                }

                // 多光源一次性扩散（比逐个光源 BFS 更快，且无需 visited Set / queue.shift）
                if (srcX.length) this._spreadLights(tiles, light, srcX, srcY, srcL);
            }

            _spreadLights(tiles, light, srcX, srcY, srcL) {
                const w = this.w, h = this.h;

                // 复用数组队列（避免对象分配）
                const qx = [];
                const qy = [];
                const ql = [];
                let head = 0;

                for (let i = 0; i < srcX.length; i++) {
                    qx.push(srcX[i]);
                    qy.push(srcY[i]);
                    ql.push(srcL[i]);
                }

                while (head < qx.length) {
                    const x = qx[head];
                    const y = qy[head];
                    const l = ql[head];
                    head++;

                    if (l <= 0 || x < 0 || x >= w || y < 0 || y >= h) continue;

                    const colLight = light[x];
                    if (l <= colLight[y]) continue; // 不会变亮就不传播，天然去重
                    colLight[y] = l;

                    const nl = l - (BLOCK_SOLID[tiles[x][y]] ? 2 : 1);
                    if (nl > 0) {
                        // push 顺序与旧实现一致：left, right, up, down
                        qx.push(x - 1, x + 1, x, x);
                        qy.push(y, y, y - 1, y + 1);
                        ql.push(nl, nl, nl, nl);
                    }
                }
            }

        }

        // ───────────────────────── WorldGen: weld StructureDescriptors into terrain ─────────────────────────
        WorldGenerator.prototype._weldStructuresFromLibrary = function (tiles, walls) {
            const TU = window.TU || {};
            const lib = TU.Structures;
            if (!lib) return;
            lib.ensureLoaded();
            if (!lib.count || !lib.count()) return;

            const w = this.w, h = this.h;

            const randInt = (a, b) => (a + Math.floor(Math.random() * (b - a + 1))) | 0;
            const clampI = (n, lo, hi) => (n < lo ? lo : (n > hi ? hi : n)) | 0;

            const groundYAt = (x) => {
                if (x < 0 || x >= w) return -1;
                const col = tiles[x];
                for (let y = 0; y < h; y++) {
                    if (col[y] !== BLOCK.AIR) return y;
                }
                return -1;
            };

            const tryPlace = (desc, anchorX, anchorY) => {
                if (!desc) return false;
                const tlx = (anchorX - Math.floor(desc.w * desc.anchor[0])) | 0;
                const tly = (anchorY - Math.floor(desc.h * desc.anchor[1])) | 0;

                // v11-safe bounds: keep a 1-tile margin to reduce edge-cases
                if (tlx < 1 || tly < 1 || tlx + desc.w >= w - 1 || tly + desc.h >= h - 1) return false;

                // 轻量采样碰撞检测：地下结构要求一定比例的“固体”
                const needSolid = desc.placement.mode !== 'surface';
                const minSolid = desc.placement.minSolidRatio || 0;
                if (needSolid && minSolid > 0) {
                    const samples = 36;
                    let solid = 0;
                    for (let i = 0; i < samples; i++) {
                        const sx = tlx + randInt(0, desc.w - 1);
                        const sy = tly + randInt(0, desc.h - 1);
                        const id = tiles[sx][sy];
                        if (BLOCK_SOLID[id]) solid++;
                    }
                    if (solid / samples < minSolid) return false;
                }

                // 写入结构（grid/legend）
                const defWall = (desc.placement.defaultWall | 0) & 255;

                for (let gy = 0; gy < desc.h; gy++) {
                    const row = desc.grid[gy];
                    const yy = tly + gy;
                    if (yy < 0 || yy >= h) continue;

                    for (let gx = 0; gx < desc.w; gx++) {
                        const xx = tlx + gx;
                        if (xx < 0 || xx >= w) continue;

                        const ch = row[gx];
                        if (ch === ' ') continue;

                        const rule = desc.legend[ch];
                        if (!rule) continue;
                        if (rule.chance < 1 && Math.random() > rule.chance) continue;

                        const cur = tiles[xx][yy];
                        if (rule.replace === 'air' && cur !== BLOCK.AIR) continue;
                        if (rule.replace === 'solid' && !BLOCK_SOLID[cur]) continue;

                        if (rule.tile !== null && rule.tile !== undefined) {
                            tiles[xx][yy] = rule.tile & 255;
                            if ((rule.tile & 255) === BLOCK.AIR && defWall) walls[xx][yy] = defWall;
                        }
                        if (rule.wall !== null && rule.wall !== undefined) {
                            walls[xx][yy] = rule.wall & 255;
                        }
                    }
                }

                // “焊接”：从连接点向外挖掘短通道，尽量连到已有空腔
                if (desc.connectors && desc.connectors.length) {
                    for (let i = 0; i < desc.connectors.length; i++) {
                        const c = desc.connectors[i];
                        const cx = tlx + c.x;
                        const cy = tly + c.y;
                        if (cx < 1 || cx >= w - 1 || cy < 1 || cy >= h - 1) continue;

                        if (c.carve) {
                            const wallId = (c.wall === null || c.wall === undefined) ? defWall : (c.wall & 255);
                            this._carveConnectorTunnel(tiles, walls, cx, cy, c.dir, c.len, wallId);
                        }
                    }
                }
                return true;
            };

            // 计划：按深度分布自动抽取结构
            const scale = Math.max(1, (w / 260));
            const plan = [
                { tag: 'tree', count: randInt(3, 6) * scale, depth: [0.08, 0.32] },
                { tag: 'ruin', count: randInt(6, 10) * scale, depth: [0.34, 0.72] },
                { tag: 'dungeon', count: randInt(8, 14) * scale, depth: [0.60, 0.92] }
            ];

            for (let p = 0; p < plan.length; p++) {
                const { tag, count, depth } = plan[p];
                const triesPer = 12;

                for (let i = 0; i < count; i++) {
                    const dn = depth[0] + Math.random() * (depth[1] - depth[0]);
                    const desc = lib.pick(dn, tag) || lib.pick(dn, [tag, 'room']);

                    let placed = false;
                    for (let t = 0; t < triesPer && !placed; t++) {
                        const x = randInt(20, w - 21);

                        let y;
                        if (desc && desc.placement.mode === 'surface') {
                            const gy = groundYAt(x);
                            if (gy < 0 || gy > h * 0.55) continue;
                            y = gy - 1;
                        } else {
                            y = clampI((dn * h) | 0, 10, h - 11);
                            y += randInt(-12, 12);
                            y = clampI(y, 10, h - 11);
                        }
                        placed = tryPlace(desc, x, y);
                    }
                }
            }
        };

        WorldGenerator.prototype._carveConnectorTunnel = function (tiles, walls, x, y, dir, len, wallId) {
            const w = this.w, h = this.h;
            let dx = 0, dy = 0;
            switch (dir) {
                case 'left': dx = -1; break;
                case 'right': dx = 1; break;
                case 'up': dy = -1; break;
                case 'down': dy = 1; break;
                default: return;
            }

            // 从连接点开始向外“找空腔”：最多 len 格；遇到连续空气（已有洞穴/通道）就停
            let ax = x, ay = y;
            let airStreak = 0;
            for (let i = 0; i < len; i++) {
                ax += dx; ay += dy;
                if (ax < 1 || ax >= w - 1 || ay < 1 || ay >= h - 1) break;

                const cur = tiles[ax][ay];
                if (cur === BLOCK.AIR) {
                    airStreak++;
                    if (i > 3 && airStreak >= 2) break;
                } else {
                    airStreak = 0;
                }

                tiles[ax][ay] = BLOCK.AIR;
                if (wallId) walls[ax][ay] = wallId & 255;

                // 做一点点宽度（避免 1 格通道太别扭）
                if (i > 1 && (dx !== 0)) {
                    if (ay - 1 > 0) { tiles[ax][ay - 1] = BLOCK.AIR; if (wallId) walls[ax][ay - 1] = wallId & 255; }
                    if (ay + 1 < h - 1) { tiles[ax][ay + 1] = BLOCK.AIR; if (wallId) walls[ax][ay + 1] = wallId & 255; }
                } else if (i > 1 && (dy !== 0)) {
                    if (ax - 1 > 0) { tiles[ax - 1][ay] = BLOCK.AIR; if (wallId) walls[ax - 1][ay] = wallId & 255; }
                    if (ax + 1 < w - 1) { tiles[ax + 1][ay] = BLOCK.AIR; if (wallId) walls[ax + 1][ay] = wallId & 255; }
                }
            }
        };

        // ───────────────────────── Exports ─────────────────────────
        window.TU = window.TU || {};
        Object.assign(window.TU, { WorldGenerator });

    



        // ═══════════════════════════════════════════════════════════════════════════════
        //                                    粒子系统 (美化版)
        // ═══════════════════════════════════════════════════════════════════════════════
        class ParticleSystem {
            constructor(max = 400) {
                this.particles = [];
                this.max = max;

                // 复用对象，降低 GC；head 用于 O(1) “丢弃最旧粒子”（替代 shift）
                this._pool = [];
                this._head = 0;
            }

            emit(x, y, opts = {}) {
                const count = opts.count || 5;
                const baseSpeed = opts.speed || 3;
                const baseLife = opts.life || 1;
                const baseSize = opts.size || 4;
                const color = opts.color || '#fff';
                const gravity = opts.gravity || 0.1;
                const glow = opts.glow || false;

                for (let i = 0; i < count; i++) {
                    // 保持“超过上限就移除最旧粒子”的原语义，但避免 O(n) 的 shift()
                    if ((this.particles.length - this._head) >= this.max) {
                        const old = this.particles[this._head++];
                        if (old) this._pool.push(old);
                    }

                    const angle = Math.random() * Math.PI * 2;
                    const speed = baseSpeed * (0.3 + Math.random() * 0.7);

                    const p = this._pool.pop() || {};
                    p.x = x;
                    p.y = y;
                    p.vx = Math.cos(angle) * speed;
                    p.vy = Math.sin(angle) * speed + (opts.up ? -speed : 0);
                    p.life = baseLife;
                    p.maxLife = baseLife;
                    p.color = color;
                    p.size = baseSize * (0.5 + Math.random() * 0.5);
                    p.gravity = gravity;
                    p.glow = glow;
                    p.rotation = Math.random() * Math.PI;
                    p.rotationSpeed = (Math.random() - 0.5) * 0.2;

                    this.particles.push(p);
                }
            }

            update(dtScale = 1) {
                // 稳定压缩（保持渲染顺序不变），同时把死亡粒子回收到 pool
                let write = 0;
                const arr = this.particles;

                for (let i = this._head; i < arr.length; i++) {
                    const p = arr[i];
                    if (!p) continue;

                    p.x += p.vx * dtScale;
                    p.y += p.vy * dtScale;
                    p.vy += p.gravity * dtScale;
                    p.vx *= Math.pow(0.98, dtScale);
                    p.life -= 0.02 * dtScale;
                    p.rotation += p.rotationSpeed * dtScale;

                    if (p.life > 0) {
                        arr[write++] = p;
                    } else {
                        this._pool.push(p);
                    }
                }

                arr.length = write;
                this._head = 0;
            }

            render(ctx, cam) {
                ctx.save();

