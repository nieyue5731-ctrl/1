                placeIntervalMs: num($('opt-placeinterval'), base.placeIntervalMs),

                joystickSize: num($('opt-joy'), base.joystickSize),
                buttonSize: num($('opt-btn'), base.buttonSize),
                sfxVolume: num($('opt-sfx'), base.sfxVolume * 100) / 100,
                reducedMotion: ($('opt-reduce-motion') ? $('opt-reduce-motion').value === '1' : base.reducedMotion),
            });
        }

        // ───────────────────────── Exports ─────────────────────────
        window.TU = window.TU || {};
        Object.assign(window.TU, { applyInfoHintText, wireUXUI, syncSettingsControls, readSettingsControls });

    



        // ═══════════════════════════════════════════════════════════════════════════════
        //                                  配置常量
        // ═══════════════════════════════════════════════════════════════════════════════
        const CONFIG = Object.freeze({
            TILE_SIZE: 16,
            WORLD_WIDTH: 600,
            WORLD_HEIGHT: 300,
            GRAVITY: 0.42,
            MAX_FALL_SPEED: 14,
            PLAYER_SPEED: 3.2,
            SPRINT_MULT: 1.5,
            // Sprint feel
            // - Hold A/D to sprint after this delay (ms)
            SPRINT_HOLD_MS: 180,
            // - Short burst of extra acceleration when sprint starts (ms)
            SPRINT_BOOST_MS: 220,
            // - Acceleration multiplier during the boost window
            SPRINT_BOOST_ACCEL_MULT: 1.65,
            // - Small initial velocity kick when sprint starts (px/frame-ish)
            SPRINT_KICK: 1.6,
            // - Visual FX "speed feel" duration after sprint start (ms)
            SPRINT_VFX_MS: 280,
            // Sprint ↔ Air polish
            // - Landing "perfect timing" window: within this time after landing, holding a direction can instantly resume sprint (ms)
            PERFECT_LAND_MS: 100,
            // - In air keep a bit of ground-sprint inertia (no extra accel), but cap it lower than full sprint
            AIR_INERTIA_MULT: 1.18,
            // - Sprint start lean animation
            SPRINT_LEAN_MS: 160,
            SPRINT_LEAN_ANGLE: 0.20,
            // - Sprint landing feedback
            LAND_DUST_COUNT: 12,
            LAND_SHAKE_AMP: 1.8,
            LAND_SHAKE_MS: 110,
            JUMP_FORCE: 9.0,
            AIR_CONTROL: 0.65,
            FRICTION: 0.83,
            REACH_DISTANCE: 5,
            LIGHT_LEVELS: 16,
            DAY_LENGTH: 120000,
            SURFACE_LEVEL: 0.25,
            UNDERGROUND_LEVEL: 0.38,
            CAVERN_LEVEL: 0.58,
            UNDERWORLD_LEVEL: 0.90
        });

        // ═══════════════════════════════════════════════════════════════════════════════
        // 配置别名兼容（某些补丁使用 CFG 而非 CONFIG）
        // ═══════════════════════════════════════════════════════════════════════════════
        const CFG = CONFIG;

        // ═══════════════════════════════════════════════════════════════════════════════
        //                                  方块系统
        // ═══════════════════════════════════════════════════════════════════════════════
        const BLOCK = Object.freeze({
            AIR: 0, DIRT: 1, GRASS: 2, STONE: 3, WOOD: 4, LEAVES: 5,
            SAND: 6, SNOW: 7, ICE: 8, MUD: 9, CLAY: 10, LOG: 11,
            COPPER_ORE: 12, IRON_ORE: 13, SILVER_ORE: 14, GOLD_ORE: 15,
            DIAMOND_ORE: 16, HELLSTONE: 17, OBSIDIAN: 18,
            COBBLESTONE: 19, MOSSY_STONE: 20, GRANITE: 21, MARBLE: 22,
            PLANKS: 23, BRICK: 24, GLASS: 25, TORCH: 26,
            WATER: 27, LAVA: 28, ASH: 29, BEDROCK: 30,
            MUSHROOM: 31, FLOWER_RED: 32, FLOWER_YELLOW: 33, TALL_GRASS: 34,
            CACTUS: 35, SNOW_GRASS: 36, JUNGLE_GRASS: 37, CRYSTAL: 38,
            // 新增方块类型
            AMETHYST: 39, RUBY_ORE: 40, EMERALD_ORE: 41, SAPPHIRE_ORE: 42,
            GLOWSTONE: 43, MUSHROOM_GIANT: 44, VINE: 45, CORAL: 46,
            SANDSTONE: 47, RED_SAND: 48, GRAVEL: 49, LIMESTONE: 50,
            SLATE: 51, BASALT: 52, FROZEN_STONE: 53, MOSS: 54,
            SPIDER_WEB: 55, BONE: 56, TREASURE_CHEST: 57, LANTERN: 58,
            PINK_FLOWER: 59, BLUE_FLOWER: 60, SUNFLOWER: 61, FERN: 62,
            BAMBOO: 63, PALM_LOG: 64, PALM_LEAVES: 65, CHERRY_LOG: 66,
            CHERRY_LEAVES: 67, PINE_LOG: 68, PINE_LEAVES: 69, STALAGMITE: 70,
            STALACTITE: 71, UNDERGROUND_MUSHROOM: 72, GLOWING_MOSS: 73,
            // 更多新增方块 - 超级丰富版
            METEORITE: 74, TITANIUM_ORE: 75, COBALT_ORE: 76, MYTHRIL_ORE: 77,
            ORICHALCUM_ORE: 78, ADAMANTITE_ORE: 79, CHLOROPHYTE_ORE: 80,
            LUMINITE_ORE: 81, CRIMSON_STONE: 82, CORRUPTION_STONE: 83,
            HALLOW_STONE: 84, PEARLSTONE: 85, EBONSTONE: 86,
            JUNGLE_TEMPLE_BRICK: 87, LIHZAHRD_BRICK: 88, DUNGEON_BRICK: 89,
            CLOUD: 90, RAIN_CLOUD: 91, SNOW_CLOUD: 92,
            LIVING_WOOD: 93, LIVING_LEAF: 94, MAHOGANY_LOG: 95, MAHOGANY_LEAVES: 96,
            BOREAL_LOG: 97, SHADEWOOD_LOG: 98, PEARLWOOD_LOG: 99,
            HONEY_BLOCK: 100, HIVE: 101, BEE_NEST: 102,
            SPIDER_NEST: 103, COBALT_BRICK: 104, MYTHRIL_BRICK: 105,
            GOLD_BRICK: 106, SILVER_BRICK: 107, COPPER_BRICK: 108,
            PLATINUM_ORE: 109, TUNGSTEN_ORE: 110, LEAD_ORE: 111, TIN_ORE: 112,
            METEORITE_BRICK: 113, HELLSTONE_BRICK: 114,
            LIFE_CRYSTAL: 115, MANA_CRYSTAL: 116, HEART_CRYSTAL: 117,
            ALTAR: 118, DEMON_ALTAR: 119, CRIMSON_ALTAR: 120,
            SUNPLATE: 121, MOONPLATE: 122, STARFALL: 123,
            ROSE: 124, TULIP: 125, ORCHID: 126, LILY: 127,
            SEAWEED: 128, KELP: 129, SEA_OATS: 130,
            PALM_TREE_TOP: 131, GIANT_TREE_LOG: 132,
            HONEY_DRIP: 133, SLIME_BLOCK: 134, GEL_BLOCK: 135,
            RAINBOW_BRICK: 136, CONFETTI_BLOCK: 137, PARTY_BLOCK: 138,
            PUMPKIN: 139, HAY: 140, SCARECROW: 141,
            GRAVESTONE: 142, CROSS: 143, SKULL_BLOCK: 144,
            ROPE: 145, CHAIN: 146, WEB_ROPE: 147,
            PLATFORMS_WOOD: 148, PLATFORMS_STONE: 149, PLATFORMS_METAL: 150,
            MUSHROOM_GRASS: 151, JUNGLE_SPORE: 152, NATURE_SHRINE: 153,
            FIRE_BLOSSOM: 154, MOONGLOW: 155, DAYBLOOM: 156, WATERLEAF: 157,
            DEATHWEED: 158, BLINKROOT: 159, SHIVERTHORN: 160, FIREBLOSSOM: 161
        });

        const Constants = Object.freeze({ CONFIG, BLOCK });
        window.Constants = Constants;

        const BLOCK_DATA = {
            [BLOCK.AIR]: { name: '空气', solid: false, transparent: true, light: 0, hardness: 0 },
            [BLOCK.DIRT]: { name: '土块', solid: true, transparent: false, light: 0, hardness: 1, color: '#8B6914' },
            [BLOCK.GRASS]: { name: '草地', solid: true, transparent: false, light: 0, hardness: 1, color: '#4CAF50' },
            [BLOCK.STONE]: { name: '石块', solid: true, transparent: false, light: 0, hardness: 3, color: '#78909C' },
            [BLOCK.WOOD]: { name: '木材', solid: true, transparent: false, light: 0, hardness: 2, color: '#A1887F' },
            [BLOCK.LEAVES]: { name: '树叶', solid: false, transparent: true, light: 0, hardness: 0.5, color: '#66BB6A' },
            [BLOCK.SAND]: { name: '沙子', solid: true, transparent: false, light: 0, hardness: 0.8, color: '#FFE082' },
            [BLOCK.SNOW]: { name: '雪块', solid: true, transparent: false, light: 0, hardness: 0.5, color: '#ECEFF1' },
            [BLOCK.ICE]: { name: '冰块', solid: true, transparent: true, light: 0, hardness: 1.5, color: '#81D4FA' },
            [BLOCK.MUD]: { name: '泥巴', solid: true, transparent: false, light: 0, hardness: 0.8, color: '#6D4C41' },
            [BLOCK.CLAY]: { name: '粘土', solid: true, transparent: false, light: 0, hardness: 1.2, color: '#BCAAA4' },
            [BLOCK.LOG]: { name: '原木', solid: true, transparent: false, light: 0, hardness: 2, color: '#5D4037' },
            [BLOCK.COPPER_ORE]: { name: '铜矿', solid: true, transparent: false, light: 0, hardness: 4, color: '#FF7043' },
            [BLOCK.IRON_ORE]: { name: '铁矿', solid: true, transparent: false, light: 0, hardness: 5, color: '#90A4AE' },
            [BLOCK.SILVER_ORE]: { name: '银矿', solid: true, transparent: false, light: 1, hardness: 5.5, color: '#CFD8DC' },
            [BLOCK.GOLD_ORE]: { name: '金矿', solid: true, transparent: false, light: 2, hardness: 6, color: '#FFD54F' },
            [BLOCK.DIAMOND_ORE]: { name: '钻石矿', solid: true, transparent: false, light: 4, hardness: 8, color: '#4DD0E1' },
            [BLOCK.HELLSTONE]: { name: '狱岩', solid: true, transparent: false, light: 6, hardness: 10, color: '#FF5722' },
            [BLOCK.OBSIDIAN]: { name: '黑曜石', solid: true, transparent: false, light: 0, hardness: 15, color: '#37474F' },
            [BLOCK.COBBLESTONE]: { name: '圆石', solid: true, transparent: false, light: 0, hardness: 3, color: '#78909C' },
            [BLOCK.MOSSY_STONE]: { name: '苔石', solid: true, transparent: false, light: 0, hardness: 3, color: '#689F38' },
            [BLOCK.GRANITE]: { name: '花岗岩', solid: true, transparent: false, light: 0, hardness: 4, color: '#A1887F' },
            [BLOCK.MARBLE]: { name: '大理石', solid: true, transparent: false, light: 1, hardness: 4, color: '#FAFAFA' },
            [BLOCK.PLANKS]: { name: '木板', solid: true, transparent: false, light: 0, hardness: 2, color: '#BCAAA4' },
            [BLOCK.BRICK]: { name: '砖块', solid: true, transparent: false, light: 0, hardness: 4, color: '#E57373' },
            [BLOCK.GLASS]: { name: '玻璃', solid: true, transparent: true, light: 0, hardness: 0.3, color: '#E1F5FE' },
            [BLOCK.TORCH]: { name: '火把', solid: false, transparent: true, light: 14, hardness: 0.1, color: '#FFEB3B' },
            [BLOCK.WATER]: { name: '水', solid: false, transparent: true, light: 0, hardness: 0, liquid: true, color: '#42A5F5' },
            [BLOCK.LAVA]: { name: '熔岩', solid: false, transparent: true, light: 15, hardness: 0, liquid: true, color: '#FF6D00' },
            [BLOCK.ASH]: { name: '灰烬', solid: true, transparent: false, light: 0, hardness: 0.8, color: '#455A64' },
            [BLOCK.BEDROCK]: { name: '基岩', solid: true, transparent: false, light: 0, hardness: Infinity, color: '#263238' },
            [BLOCK.MUSHROOM]: { name: '蘑菇', solid: false, transparent: true, light: 2, hardness: 0, color: '#EC407A' },
            [BLOCK.FLOWER_RED]: { name: '红花', solid: false, transparent: true, light: 0, hardness: 0, color: '#EF5350' },
            [BLOCK.FLOWER_YELLOW]: { name: '黄花', solid: false, transparent: true, light: 0, hardness: 0, color: '#FFEE58' },
            [BLOCK.TALL_GRASS]: { name: '高草', solid: false, transparent: true, light: 0, hardness: 0, color: '#9CCC65' },
            [BLOCK.CACTUS]: { name: '仙人掌', solid: true, transparent: false, light: 0, hardness: 1, color: '#7CB342' },
            [BLOCK.SNOW_GRASS]: { name: '雪草', solid: true, transparent: false, light: 0, hardness: 1, color: '#ECEFF1' },
            [BLOCK.JUNGLE_GRASS]: { name: '丛林草', solid: true, transparent: false, light: 0, hardness: 1, color: '#43A047' },
            [BLOCK.CRYSTAL]: { name: '水晶', solid: true, transparent: true, light: 8, hardness: 5, color: '#CE93D8' },
            // 新增方块数据
            [BLOCK.AMETHYST]: { name: '紫水晶', solid: true, transparent: true, light: 6, hardness: 6, color: '#9C27B0' },
            [BLOCK.RUBY_ORE]: { name: '红宝石矿', solid: true, transparent: false, light: 3, hardness: 7, color: '#E91E63' },
            [BLOCK.EMERALD_ORE]: { name: '祖母绿矿', solid: true, transparent: false, light: 3, hardness: 7, color: '#4CAF50' },
            [BLOCK.SAPPHIRE_ORE]: { name: '蓝宝石矿', solid: true, transparent: false, light: 3, hardness: 7, color: '#2196F3' },
            [BLOCK.GLOWSTONE]: { name: '萤石', solid: true, transparent: true, light: 12, hardness: 2, color: '#FFC107' },
            [BLOCK.MUSHROOM_GIANT]: { name: '巨型蘑菇', solid: true, transparent: false, light: 3, hardness: 1, color: '#8E24AA' },
            [BLOCK.VINE]: { name: '藤蔓', solid: false, transparent: true, light: 0, hardness: 0.1, color: '#2E7D32' },
            [BLOCK.CORAL]: { name: '珊瑚', solid: true, transparent: false, light: 2, hardness: 1, color: '#FF7043' },
            [BLOCK.SANDSTONE]: { name: '砂岩', solid: true, transparent: false, light: 0, hardness: 2.5, color: '#D4A574' },
            [BLOCK.RED_SAND]: { name: '红沙', solid: true, transparent: false, light: 0, hardness: 0.8, color: '#C75B39' },
            [BLOCK.GRAVEL]: { name: '砾石', solid: true, transparent: false, light: 0, hardness: 1, color: '#757575' },
            [BLOCK.LIMESTONE]: { name: '石灰 ite', solid: true, transparent: false, light: 0, hardness: 2, color: '#E8DCC4' },
            [BLOCK.SLATE]: { name: '板岩', solid: true, transparent: false, light: 0, hardness: 3, color: '#546E7A' },
            [BLOCK.BASALT]: { name: '玄武岩', solid: true, transparent: false, light: 0, hardness: 4, color: '#37474F' },
            [BLOCK.FROZEN_STONE]: { name: '冻石', solid: true, transparent: true, light: 1, hardness: 3, color: '#B3E5FC' },
            [BLOCK.MOSS]: { name: '苔藓', solid: false, transparent: true, light: 0, hardness: 0.1, color: '#558B2F' },
            [BLOCK.SPIDER_WEB]: { name: '蜘蛛网', solid: false, transparent: true, light: 0, hardness: 0.1, color: '#EEEEEE' },
            [BLOCK.BONE]: { name: '骨头', solid: true, transparent: false, light: 0, hardness: 2, color: '#EFEBE9' },
            [BLOCK.TREASURE_CHEST]: { name: '宝箱', solid: true, transparent: false, light: 4, hardness: 3, color: '#8D6E63' },
            [BLOCK.LANTERN]: { name: '灯笼', solid: false, transparent: true, light: 14, hardness: 0.5, color: '#FF9800' },
            [BLOCK.PINK_FLOWER]: { name: '粉花', solid: false, transparent: true, light: 0, hardness: 0, color: '#F48FB1' },
            [BLOCK.BLUE_FLOWER]: { name: '蓝花', solid: false, transparent: true, light: 0, hardness: 0, color: '#64B5F6' },
            [BLOCK.SUNFLOWER]: { name: '向日葵', solid: false, transparent: true, light: 1, hardness: 0, color: '#FFEB3B' },
            [BLOCK.FERN]: { name: '蕨类', solid: false, transparent: true, light: 0, hardness: 0, color: '#66BB6A' },
            [BLOCK.BAMBOO]: { name: '竹子', solid: true, transparent: false, light: 0, hardness: 1, color: '#7CB342' },
            [BLOCK.PALM_LOG]: { name: '棕榈木', solid: true, transparent: false, light: 0, hardness: 2, color: '#A1887F' },
            [BLOCK.PALM_LEAVES]: { name: '棕榈叶', solid: false, transparent: true, light: 0, hardness: 0.3, color: '#8BC34A' },
            [BLOCK.CHERRY_LOG]: { name: '樱花木', solid: true, transparent: false, light: 0, hardness: 2, color: '#795548' },
            [BLOCK.CHERRY_LEAVES]: { name: '樱花叶', solid: false, transparent: true, light: 1, hardness: 0.3, color: '#F8BBD9' },
            [BLOCK.PINE_LOG]: { name: '松木', solid: true, transparent: false, light: 0, hardness: 2, color: '#4E342E' },
            [BLOCK.PINE_LEAVES]: { name: '松针', solid: false, transparent: true, light: 0, hardness: 0.3, color: '#1B5E20' },
            [BLOCK.STALAGMITE]: { name: '石笋', solid: true, transparent: false, light: 0, hardness: 2, color: '#8D6E63' },
            [BLOCK.STALACTITE]: { name: '钟乳石', solid: true, transparent: false, light: 0, hardness: 2, color: '#A1887F' },
            [BLOCK.UNDERGROUND_MUSHROOM]: { name: '地下蘑菇', solid: false, transparent: true, light: 5, hardness: 0, color: '#7E57C2' },
            [BLOCK.GLOWING_MOSS]: { name: '发光苔藓', solid: false, transparent: true, light: 8, hardness: 0.1, color: '#00E676' },
            // 超级丰富版新增方块数据
            [BLOCK.METEORITE]: { name: '陨石', solid: true, transparent: false, light: 4, hardness: 12, color: '#8B4513' },
            [BLOCK.TITANIUM_ORE]: { name: '钛矿', solid: true, transparent: false, light: 2, hardness: 9, color: '#4A6670' },
            [BLOCK.COBALT_ORE]: { name: '钴矿', solid: true, transparent: false, light: 2, hardness: 8, color: '#2E86AB' },
            [BLOCK.MYTHRIL_ORE]: { name: '秘银矿', solid: true, transparent: false, light: 3, hardness: 9, color: '#66BB6A' },
            [BLOCK.ORICHALCUM_ORE]: { name: '山铜矿', solid: true, transparent: false, light: 3, hardness: 9, color: '#FF69B4' },
            [BLOCK.ADAMANTITE_ORE]: { name: '精金矿', solid: true, transparent: false, light: 4, hardness: 10, color: '#DC143C' },
            [BLOCK.CHLOROPHYTE_ORE]: { name: '叶绿矿', solid: true, transparent: false, light: 5, hardness: 11, color: '#32CD32' },
            [BLOCK.LUMINITE_ORE]: { name: '夜明矿', solid: true, transparent: false, light: 10, hardness: 15, color: '#00FFFF' },
            [BLOCK.CRIMSON_STONE]: { name: '猩红石', solid: true, transparent: false, light: 1, hardness: 4, color: '#8B0000' },
            [BLOCK.CORRUPTION_STONE]: { name: '腐化石', solid: true, transparent: false, light: 1, hardness: 4, color: '#4B0082' },
            [BLOCK.HALLOW_STONE]: { name: '神圣石', solid: true, transparent: false, light: 3, hardness: 4, color: '#FFD700' },
            [BLOCK.PEARLSTONE]: { name: '珍珠石', solid: true, transparent: false, light: 2, hardness: 4, color: '#FFF0F5' },
            [BLOCK.EBONSTONE]: { name: '黑檀石', solid: true, transparent: false, light: 0, hardness: 5, color: '#2F1B41' },
            [BLOCK.JUNGLE_TEMPLE_BRICK]: { name: '丛林神庙砖', solid: true, transparent: false, light: 0, hardness: 8, color: '#4A7023' },
            [BLOCK.LIHZAHRD_BRICK]: { name: '丛林蜥蜴砖', solid: true, transparent: false, light: 1, hardness: 10, color: '#8B7355' },
            [BLOCK.DUNGEON_BRICK]: { name: '地牢砖', solid: true, transparent: false, light: 0, hardness: 6, color: '#4169E1' },
            [BLOCK.CLOUD]: { name: '云', solid: true, transparent: true, light: 0, hardness: 0.2, color: '#F5F5F5' },
            [BLOCK.RAIN_CLOUD]: { name: '雨云', solid: true, transparent: true, light: 0, hardness: 0.2, color: '#708090' },
            [BLOCK.SNOW_CLOUD]: { name: '雪云', solid: true, transparent: true, light: 0, hardness: 0.2, color: '#E0FFFF' },
            [BLOCK.LIVING_WOOD]: { name: '生命木', solid: true, transparent: false, light: 1, hardness: 3, color: '#8B4513' },
            [BLOCK.LIVING_LEAF]: { name: '生命叶', solid: false, transparent: true, light: 2, hardness: 0.3, color: '#228B22' },
            [BLOCK.MAHOGANY_LOG]: { name: '红木', solid: true, transparent: false, light: 0, hardness: 2.5, color: '#C04000' },
            [BLOCK.MAHOGANY_LEAVES]: { name: '红木叶', solid: false, transparent: true, light: 0, hardness: 0.3, color: '#006400' },
            [BLOCK.BOREAL_LOG]: { name: '北方木', solid: true, transparent: false, light: 0, hardness: 2, color: '#D2B48C' },
            [BLOCK.SHADEWOOD_LOG]: { name: '暗影木', solid: true, transparent: false, light: 0, hardness: 2, color: '#4A3B5C' },
            [BLOCK.PEARLWOOD_LOG]: { name: '珍珠木', solid: true, transparent: false, light: 1, hardness: 2, color: '#FFDEAD' },
            [BLOCK.HONEY_BLOCK]: { name: '蜂蜜块', solid: true, transparent: true, light: 2, hardness: 0.5, color: '#FFB347' },
            [BLOCK.HIVE]: { name: '蜂巢', solid: true, transparent: false, light: 1, hardness: 2, color: '#DAA520' },
            [BLOCK.BEE_NEST]: { name: '蜂窝', solid: true, transparent: false, light: 2, hardness: 1.5, color: '#F0E68C' },
            [BLOCK.SPIDER_NEST]: { name: '蜘蛛巢', solid: true, transparent: false, light: 0, hardness: 2, color: '#2F2F2F' },
            [BLOCK.COBALT_BRICK]: { name: '钴砖', solid: true, transparent: false, light: 1, hardness: 5, color: '#1E90FF' },
            [BLOCK.MYTHRIL_BRICK]: { name: '秘银砖', solid: true, transparent: false, light: 1, hardness: 5, color: '#3CB371' },
            [BLOCK.GOLD_BRICK]: { name: '金砖', solid: true, transparent: false, light: 2, hardness: 5, color: '#FFD700' },
            [BLOCK.SILVER_BRICK]: { name: '银砖', solid: true, transparent: false, light: 1, hardness: 5, color: '#C0C0C0' },
            [BLOCK.COPPER_BRICK]: { name: '铜砖', solid: true, transparent: false, light: 0, hardness: 4, color: '#B87333' },
            [BLOCK.PLATINUM_ORE]: { name: '铂金矿', solid: true, transparent: false, light: 2, hardness: 7, color: '#E5E4E2' },
            [BLOCK.TUNGSTEN_ORE]: { name: '钨矿', solid: true, transparent: false, light: 1, hardness: 6, color: '#5C5C5C' },
            [BLOCK.LEAD_ORE]: { name: '铅矿', solid: true, transparent: false, light: 0, hardness: 5, color: '#3D3D3D' },
            [BLOCK.TIN_ORE]: { name: '锡矿', solid: true, transparent: false, light: 0, hardness: 4, color: '#D3D3D3' },
            [BLOCK.METEORITE_BRICK]: { name: '陨石砖', solid: true, transparent: false, light: 3, hardness: 6, color: '#CD5C5C' },
            [BLOCK.HELLSTONE_BRICK]: { name: '狱岩砖', solid: true, transparent: false, light: 5, hardness: 7, color: '#FF4500' },
            [BLOCK.LIFE_CRYSTAL]: { name: '生命水晶', solid: true, transparent: true, light: 10, hardness: 3, color: '#FF1493' },
            [BLOCK.MANA_CRYSTAL]: { name: '魔力水晶', solid: true, transparent: true, light: 10, hardness: 3, color: '#00BFFF' },
            [BLOCK.HEART_CRYSTAL]: { name: '心之水晶', solid: true, transparent: true, light: 12, hardness: 4, color: '#FF69B4' },
            [BLOCK.ALTAR]: { name: '祭坛', solid: true, transparent: false, light: 5, hardness: 8, color: '#4B0082' },
            [BLOCK.DEMON_ALTAR]: { name: '恶魔祭坛', solid: true, transparent: false, light: 6, hardness: 10, color: '#8B008B' },
            [BLOCK.CRIMSON_ALTAR]: { name: '猩红祭坛', solid: true, transparent: false, light: 6, hardness: 10, color: '#DC143C' },
            [BLOCK.SUNPLATE]: { name: '日盘', solid: true, transparent: false, light: 8, hardness: 4, color: '#FFD700' },
            [BLOCK.MOONPLATE]: { name: '月盘', solid: true, transparent: false, light: 6, hardness: 4, color: '#C0C0C0' },
            [BLOCK.STARFALL]: { name: '星落', solid: false, transparent: true, light: 10, hardness: 0, color: '#FFFF00' },
            [BLOCK.ROSE]: { name: '玫瑰', solid: false, transparent: true, light: 0, hardness: 0, color: '#FF007F' },
            [BLOCK.TULIP]: { name: '郁金香', solid: false, transparent: true, light: 0, hardness: 0, color: '#FF6347' },
            [BLOCK.ORCHID]: { name: '兰花', solid: false, transparent: true, light: 1, hardness: 0, color: '#DA70D6' },
            [BLOCK.LILY]: { name: '百合', solid: false, transparent: true, light: 0, hardness: 0, color: '#FFFAF0' },
            [BLOCK.SEAWEED]: { name: '海草', solid: false, transparent: true, light: 0, hardness: 0, color: '#2E8B57' },
            [BLOCK.KELP]: { name: '海带', solid: false, transparent: true, light: 0, hardness: 0, color: '#556B2F' },
            [BLOCK.SEA_OATS]: { name: '海燕麦', solid: false, transparent: true, light: 0, hardness: 0, color: '#F4A460' },
            [BLOCK.PALM_TREE_TOP]: { name: '棕榈树顶', solid: false, transparent: true, light: 0, hardness: 0.3, color: '#32CD32' },
            [BLOCK.GIANT_TREE_LOG]: { name: '巨树原木', solid: true, transparent: false, light: 0, hardness: 4, color: '#5D4037' },
            [BLOCK.HONEY_DRIP]: { name: '蜂蜜滴', solid: false, transparent: true, light: 2, hardness: 0, color: '#FFB90F' },
            [BLOCK.SLIME_BLOCK]: { name: '史莱姆块', solid: true, transparent: true, light: 2, hardness: 1, color: '#00FF7F' },
            [BLOCK.GEL_BLOCK]: { name: '凝胶块', solid: true, transparent: true, light: 1, hardness: 0.5, color: '#7FFFD4' },
            [BLOCK.RAINBOW_BRICK]: { name: '彩虹砖', solid: true, transparent: false, light: 6, hardness: 4, color: '#FF69B4' },
            [BLOCK.CONFETTI_BLOCK]: { name: '五彩纸屑', solid: false, transparent: true, light: 0, hardness: 0, color: '#FFD700' },
            [BLOCK.PARTY_BLOCK]: { name: '派对块', solid: true, transparent: false, light: 4, hardness: 2, color: '#FF1493' },
            [BLOCK.PUMPKIN]: { name: '南瓜', solid: true, transparent: false, light: 2, hardness: 1, color: '#FF7F00' },
            [BLOCK.HAY]: { name: '干草', solid: true, transparent: false, light: 0, hardness: 0.5, color: '#DAA520' },
            [BLOCK.SCARECROW]: { name: '稻草人', solid: true, transparent: false, light: 0, hardness: 1, color: '#8B4513' },
            [BLOCK.GRAVESTONE]: { name: '墓碑', solid: true, transparent: false, light: 0, hardness: 3, color: '#696969' },
            [BLOCK.CROSS]: { name: '十字架', solid: true, transparent: false, light: 0, hardness: 2, color: '#808080' },
            [BLOCK.SKULL_BLOCK]: { name: '头骨块', solid: true, transparent: false, light: 0, hardness: 2, color: '#FFFAF0' },
            [BLOCK.ROPE]: { name: '绳索', solid: false, transparent: true, light: 0, hardness: 0.1, color: '#DEB887' },
            [BLOCK.CHAIN]: { name: '锁链', solid: false, transparent: true, light: 0, hardness: 1, color: '#A9A9A9' },
            [BLOCK.WEB_ROPE]: { name: '蛛丝绳', solid: false, transparent: true, light: 0, hardness: 0.1, color: '#F5F5F5' },
            [BLOCK.PLATFORMS_WOOD]: { name: '木平台', solid: false, transparent: true, light: 0, hardness: 0.5, color: '#DEB887' },
            [BLOCK.PLATFORMS_STONE]: { name: '石平台', solid: false, transparent: true, light: 0, hardness: 1, color: '#808080' },
            [BLOCK.PLATFORMS_METAL]: { name: '金属平台', solid: false, transparent: true, light: 0, hardness: 1.5, color: '#C0C0C0' },
            [BLOCK.MUSHROOM_GRASS]: { name: '蘑菇草', solid: true, transparent: false, light: 3, hardness: 1, color: '#4169E1' },
            [BLOCK.JUNGLE_SPORE]: { name: '丛林孢子', solid: false, transparent: true, light: 4, hardness: 0, color: '#00FF00' },
            [BLOCK.NATURE_SHRINE]: { name: '自然神龛', solid: true, transparent: false, light: 8, hardness: 5, color: '#228B22' },
            [BLOCK.FIRE_BLOSSOM]: { name: '火焰花', solid: false, transparent: true, light: 6, hardness: 0, color: '#FF4500' },
            [BLOCK.MOONGLOW]: { name: '月光草', solid: false, transparent: true, light: 5, hardness: 0, color: '#87CEEB' },
            [BLOCK.DAYBLOOM]: { name: '太阳花', solid: false, transparent: true, light: 3, hardness: 0, color: '#FFFF00' },
            [BLOCK.WATERLEAF]: { name: '水叶草', solid: false, transparent: true, light: 2, hardness: 0, color: '#00CED1' },
            [BLOCK.DEATHWEED]: { name: '死亡草', solid: false, transparent: true, light: 1, hardness: 0, color: '#2F4F4F' },
            [BLOCK.BLINKROOT]: { name: '闪烁根', solid: false, transparent: true, light: 4, hardness: 0, color: '#ADFF2F' },
            [BLOCK.SHIVERTHORN]: { name: '寒颤荆棘', solid: false, transparent: true, light: 2, hardness: 0, color: '#E0FFFF' },
            [BLOCK.FIREBLOSSOM]: { name: '烈焰花', solid: false, transparent: true, light: 8, hardness: 0, color: '#FF6347' }
        };

        // ═══════════════════════════════════════════════════════════════════════
        //                       Block lookup tables (性能优化)
        // ═══════════════════════════════════════════════════════════════════════
        // 说明：把 BLOCK_DATA 中高频访问的属性映射到定长数组，减少对象查找/可选链开销。
        // 不改变任何数值与画面逻辑，只是把读取路径变快。

        const BLOCK_MAX_ID = 256; // tiles/light 使用 Uint8Array，ID 范围天然在 0~255
        const BLOCK_SOLID = new Uint8Array(BLOCK_MAX_ID);
        const BLOCK_TRANSPARENT = new Uint8Array(BLOCK_MAX_ID);
        const BLOCK_LIQUID = new Uint8Array(BLOCK_MAX_ID);
        const BLOCK_LIGHT = new Uint8Array(BLOCK_MAX_ID);
        const BLOCK_HARDNESS = new Float32Array(BLOCK_MAX_ID);
        const BLOCK_COLOR = new Array(BLOCK_MAX_ID);

        // 太阳光柱向下衰减（与原 Game._updateLight 规则保持一致）：0 / 1 / 3
        const SUN_DECAY = new Uint8Array(BLOCK_MAX_ID);

        // 迷你地图用：把颜色预先打包成 0xRRGGBB，避免每像素 hexToRgb + 对象分配
        const BLOCK_COLOR_PACKED = new Uint32Array(BLOCK_MAX_ID);
        const BLOCK_WALKABLE = new Uint8Array(BLOCK_MAX_ID);

        (function buildBlockTables() {
            // fallback 与原 Minimap 里 '#F0F' + hexToRgb 的“实际结果”一致：
            // r = parseInt('F0',16)=240, g=parseInt('F',16)=15, b=parseInt('',16)=NaN -> 写入 Uint8ClampedArray 时会变 0
            const FALLBACK_PACKED = (240 << 16) | (15 << 8) | 0;

            for (const k in BLOCK_DATA) {
                const id = Number(k);
                if (!Number.isFinite(id) || id < 0 || id >= BLOCK_MAX_ID) continue;

                const d = BLOCK_DATA[id];
                if (!d) continue;

                BLOCK_SOLID[id] = d.solid ? 1 : 0;
                BLOCK_TRANSPARENT[id] = d.transparent ? 1 : 0;
                BLOCK_LIQUID[id] = d.liquid ? 1 : 0;
                BLOCK_LIGHT[id] = d.light ? d.light : 0;
                BLOCK_HARDNESS[id] = d.hardness ? d.hardness : 0;
                BLOCK_COLOR[id] = d.color;

                if (d.solid && !d.transparent) SUN_DECAY[id] = 3;
                else if (d.transparent && id !== BLOCK.AIR) SUN_DECAY[id] = 1;
                else SUN_DECAY[id] = 0;

                if (typeof d.color === 'string' && d.color.length === 7) {
                    const r = parseInt(d.color.slice(1, 3), 16);
                    const g = parseInt(d.color.slice(3, 5), 16);
                    const b = parseInt(d.color.slice(5, 7), 16);
                    BLOCK_COLOR_PACKED[id] = (r << 16) | (g << 8) | b;
                } else {
                    BLOCK_COLOR_PACKED[id] = FALLBACK_PACKED;
                }
            }
        })();

        (function buildWalkableTable() {
            for (let i = 0; i < BLOCK_MAX_ID; i++) {
                BLOCK_WALKABLE[i] = BLOCK_SOLID[i] ? 0 : 1;
            }
        })();

        // ───────────────────────── Exports ─────────────────────────
        window.TU = window.TU || {};
        Object.assign(window.TU, { CONFIG, BLOCK, BLOCK_DATA, BLOCK_SOLID, BLOCK_LIQUID, BLOCK_TRANSPARENT, BLOCK_WALKABLE, BLOCK_MAX_ID, BLOCK_COLOR_PACKED, SUN_DECAY });

    



        // ═══════════════════════════════════════════════════════════════════════════════
        //                                 噪声生成器
        // ═══════════════════════════════════════════════════════════════════════════════
        class NoiseGenerator {
            constructor(seed = Math.random() * 10000) {
                this.seed = seed;
                this.p = this._initPermutation();
            }

            _initPermutation() {
                const p = Array.from({ length: 256 }, (_, i) => i);
                let s = this.seed;
                for (let i = 255; i > 0; i--) {
                    s = (s * 16807) % 2147483647;
                    const j = s % (i + 1);
                    [p[i], p[j]] = [p[j], p[i]];
                }
                return [...p, ...p];
            }

            _fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
            _lerp(a, b, t) { return a + t * (b - a); }
            _grad(hash, x, y) {
                const h = hash & 3;
                const u = h < 2 ? x : y;
                const v = h < 2 ? y : x;
                return ((h & 1) ? -u : u) + ((h & 2) ? -2 * v : 2 * v);
            }

            noise2D(x, y) {
                const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
                x -= Math.floor(x); y -= Math.floor(y);
                const u = this._fade(x), v = this._fade(y);
                const A = this.p[X] + Y, B = this.p[X + 1] + Y;
                return this._lerp(
                    this._lerp(this._grad(this.p[A], x, y), this._grad(this.p[B], x - 1, y), u),
                    this._lerp(this._grad(this.p[A + 1], x, y - 1), this._grad(this.p[B + 1], x - 1, y - 1), u), v
                );
            }

            fbm(x, y, octaves = 5, lac = 2, gain = 0.5) {
                let val = 0, amp = 1, freq = 1, max = 0;
                for (let i = 0; i < octaves; i++) {
                    val += amp * this.noise2D(x * freq, y * freq);
                    max += amp;
                    amp *= gain;
                    freq *= lac;
                }
                return val / max;
            }

            warpedNoise(x, y, strength = 0.5) {
                const wx = this.fbm(x + 100, y + 100, 3) * strength;
                const wy = this.fbm(x + 200, y + 200, 3) * strength;
                return this.fbm(x + wx, y + wy, 4);
            }
        }

        // ───────────────────────── Exports ─────────────────────────
        window.TU = window.TU || {};
        Object.assign(window.TU, { NoiseGenerator });

    



        // ═══════════════════════════════════════════════════════════════════════════════
        //                                纹理生成器 (像素艺术大师版)
        // ═══════════════════════════════════════════════════════════════════════════════
        class TextureGenerator {
            constructor() {
                this.cache = []; // Array cache: blockId -> canvas|null，比 Map 更快
                this.glowCache = []; // 发光贴图缓存：blockId -> canvas|null
                // 预定义调色板
                this.palette = {
                    dirt: ['#5d4037', '#4e342e', '#3e2723', '#795548'],
                    grass: ['#4caf50', '#388e3c', '#2e7d32', '#81c784'],
                    stone: ['#9e9e9e', '#757575', '#616161', '#424242'],
                    wood: ['#8d6e63', '#6d4c41', '#5d4037', '#4e342e'],
                    sand: ['#fff176', '#fdd835', '#fbc02d', '#f9a825']
                };
            }

            get(blockId) {
                // Array 索引比 Map.has/get 更快；用 undefined 作为“未缓存”哨兵
                const cached = this.cache[blockId];
                if (cached !== undefined) return cached;

                const data = BLOCK_DATA[blockId];
                if (!data?.color) {
                    this.cache[blockId] = null;
                    return null;
                }

                const canvas = document.createElement('canvas');
                canvas.width = canvas.height = CONFIG.TILE_SIZE;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                // 禁用平滑以获得清脆的像素感
                ctx.imageSmoothingEnabled = false;

                this._drawPixelArt(ctx, blockId, data);
                this.cache[blockId] = canvas;
                return canvas;
            }

            getGlow(blockId) {
                // 仅对发光方块生成“预烘焙辉光贴图”，避免每格 ctx.save/shadowBlur 的高开销
                const cached = this.glowCache[blockId];
                if (cached !== undefined) return cached;

                const base = this.get(blockId);
                if (!base) {
                    this.glowCache[blockId] = null;
                    return null;
                }

                // BLOCK_LIGHT / BLOCK_COLOR 在后续常量区定义；方法执行时已就绪即可
                const bl = (typeof BLOCK_LIGHT !== 'undefined' && BLOCK_LIGHT[blockId]) ? BLOCK_LIGHT[blockId] : 0;
                if (bl <= 5) {
                    this.glowCache[blockId] = null;
                    return null;
                }

                const pad = Math.max(2, Math.min(24, Math.ceil(bl * 1.6)));
                const size = CONFIG.TILE_SIZE + pad * 2;

                const glow = document.createElement('canvas');
                glow.width = glow.height = size;
                const gctx = glow.getContext('2d', { alpha: true });
                gctx.imageSmoothingEnabled = false;

                gctx.clearRect(0, 0, size, size);
                gctx.save();
                gctx.shadowColor = (typeof BLOCK_COLOR !== 'undefined' && BLOCK_COLOR[blockId]) ? BLOCK_COLOR[blockId] : (BLOCK_DATA[blockId]?.color || '#ffffff');
                gctx.shadowBlur = bl * 2;
                gctx.drawImage(base, pad, pad);
                gctx.restore();

                // 给渲染端一个 pad 信息（用于绘制时回退偏移）
                glow.__pad = pad;

                this.glowCache[blockId] = glow;
                return glow;
            }

            _drawPixel(ctx, x, y, color) {
                ctx.fillStyle = color;
                ctx.fillRect(x, y, 1, 1);
            }

            // 使用像素矩阵绘制
            _drawMatrix(ctx, matrix, colors) {
                for (let y = 0; y < 16; y++) {
                    for (let x = 0; x < 16; x++) {
                        const char = matrix[y] ? matrix[y][x] : '.';
                        if (colors[char]) {
                            this._drawPixel(ctx, x, y, colors[char]);
                        }
                    }
                }
            }

            _drawPixelArt(ctx, id, data) {
                const s = CONFIG.TILE_SIZE;
                const p = this.palette;

                // 基础底色填充
                const baseColor = data.color || '#F0F';

                // 生成随机像素纹理的辅助函数
                const fillNoise = (colors, density = 0.3) => {
                    for (let x = 0; x < s; x++) {
                        for (let y = 0; y < s; y++) {
                            if (Math.random() < density) {
                                const c = colors[Math.floor(Math.random() * colors.length)];
                                this._drawPixel(ctx, x, y, c);
                            }
                        }
                    }
                };

                switch (id) {
                    case BLOCK.DIRT:
                        // 土块：深浅不一的噪点
                        ctx.fillStyle = p.dirt[0]; ctx.fillRect(0, 0, s, s);
                        fillNoise(p.dirt, 0.5);
                        break;

                    case BLOCK.GRASS:
                    case BLOCK.SNOW_GRASS:
                    case BLOCK.JUNGLE_GRASS:
                        // 侧面草方块：顶部是草，下面是土
                        const isSnow = id === BLOCK.SNOW_GRASS;
                        const topColors = isSnow ? ['#fff', '#eee', '#ddd'] :
                            (id === BLOCK.JUNGLE_GRASS ? ['#66bb6a', '#43a047', '#2e7d32'] : p.grass);
                        const soilColors = id === BLOCK.JUNGLE_GRASS ? ['#5d4037', '#4e342e'] : p.dirt;

                        // 土壤部分
                        ctx.fillStyle = soilColors[0]; ctx.fillRect(0, 0, s, s);
                        fillNoise(soilColors, 0.4);

                        // 草顶 (3-5像素厚)
                        ctx.fillStyle = topColors[1];
                        ctx.fillRect(0, 0, s, 4);

                        // 草的边缘（垂下的像素）
                        for (let x = 0; x < s; x++) {
                            const drop = Math.floor(Math.random() * 3) + 1;
                            ctx.fillStyle = topColors[Math.floor(Math.random() * topColors.length)];
                            ctx.fillRect(x, 0, 1, 4 + drop);
                            // 偶尔的高光
                            if (Math.random() > 0.8) {
                                ctx.fillStyle = topColors[0];
                                ctx.fillRect(x, 1, 1, 1);
                            }
                        }
                        break;

                    case BLOCK.STONE:
                    case BLOCK.COBBLESTONE:
                    case BLOCK.MOSSY_STONE:
                    case BLOCK.GRANITE:
                    case BLOCK.MARBLE:
                        // 石头纹理：不规则的层状或块状
                        const stoneBase = id === BLOCK.GRANITE ? '#4e342e' : (id === BLOCK.MARBLE ? '#f5f5f5' : '#757575');
                        const stoneDark = id === BLOCK.GRANITE ? '#3e2723' : (id === BLOCK.MARBLE ? '#e0e0e0' : '#616161');

                        ctx.fillStyle = stoneBase; ctx.fillRect(0, 0, s, s);

                        if (id === BLOCK.COBBLESTONE) {
                            // 圆石：画几个圆圈轮廓
                            ctx.fillStyle = '#00000033'; // 阴影缝隙
                            ctx.fillRect(2, 1, 10, 1); ctx.fillRect(1, 2, 1, 4); ctx.fillRect(12, 2, 1, 4); ctx.fillRect(2, 6, 10, 1);
                            ctx.fillRect(0, 8, 6, 1); ctx.fillRect(5, 9, 1, 4); ctx.fillRect(0, 13, 6, 1);
                            ctx.fillRect(7, 8, 9, 1); ctx.fillRect(7, 9, 1, 5); ctx.fillRect(15, 9, 1, 5);
                        } else {
                            // 天然石：横向裂纹
                            for (let i = 0; i < 8; i++) {
                                const sx = Math.floor(Math.random() * s);
                                const sy = Math.floor(Math.random() * s);
                                const len = Math.floor(Math.random() * 5) + 2;
                                ctx.fillStyle = stoneDark;
                                ctx.fillRect(sx, sy, len, 1);
                            }
                            fillNoise([stoneBase, stoneDark], 0.2);
                        }

                        if (id === BLOCK.MOSSY_STONE) {
                            fillNoise(p.grass, 0.2); // 苔藓斑点
                        }
                        break;

                    case BLOCK.WOOD:
                    case BLOCK.LOG:
                        // 原木：树皮纹理（垂直）
                        ctx.fillStyle = '#5d4037'; ctx.fillRect(0, 0, s, s);
                        for (let x = 1; x < s; x += 2) {
                            ctx.fillStyle = Math.random() > 0.5 ? '#4e342e' : '#3e2723';
                            ctx.fillRect(x, 0, 1, s);
                            if (Math.random() > 0.7) ctx.fillRect(x + 1, Math.random() * s, 1, 2); // 树节
                        }
                        break;

                    case BLOCK.PLANKS:
                        // 木板：水平条纹
                        ctx.fillStyle = '#8d6e63'; ctx.fillRect(0, 0, s, s);
                        // 分隔线
                        ctx.fillStyle = '#4e342e';
                        ctx.fillRect(0, 4, s, 1);
                        ctx.fillRect(0, 9, s, 1);
                        ctx.fillRect(0, 14, s, 1);
                        // 随机噪点模拟木纹
                        fillNoise(['#795548', '#a1887f'], 0.1);
                        break;

                    case BLOCK.BRICK:
                        // 砖块：交错排列
                        ctx.fillStyle = '#8d6e63'; ctx.fillRect(0, 0, s, s); // 灰缝
                        const bCol = '#d32f2f';
                        const bLit = '#ef5350';
                        const bDrk = '#b71c1c';

                        const drawOneBrick = (x, y, w, h) => {
                            ctx.fillStyle = bCol; ctx.fillRect(x, y, w, h);
                            ctx.fillStyle = bLit; ctx.fillRect(x, y, w - 1, 1); ctx.fillRect(x, y, 1, h - 1);
                            ctx.fillStyle = bDrk; ctx.fillRect(x + w - 1, y, 1, h); ctx.fillRect(x, y + h - 1, w, 1);
                        };

                        drawOneBrick(0, 0, 7, 7);
                        drawOneBrick(8, 0, 8, 7);
                        drawOneBrick(0, 8, 3, 7);
                        drawOneBrick(4, 8, 8, 7);
                        drawOneBrick(13, 8, 3, 7);
                        break;

                    case BLOCK.LEAVES:
                        // 树叶：通透的像素点簇
                        // 不清除背景，让它透明
                        const leafColors = ['#2e7d32', '#388e3c', '#43a047'];
                        for (let x = 0; x < s; x += 2) {
                            for (let y = 0; y < s; y += 2) {
                                if (Math.random() > 0.3) {
                                    ctx.fillStyle = leafColors[Math.floor(Math.random() * leafColors.length)];
                                    ctx.fillRect(x, y, 2, 2);
                                    // 阴影
                                    if (Math.random() > 0.5) {
                                        ctx.fillStyle = '#1b5e20';
                                        ctx.fillRect(x + 1, y + 1, 1, 1);
                                    }
                                }
                            }
                        }
                        break;

                    case BLOCK.GLASS:
                        // 玻璃：边框 + 反光
                        ctx.fillStyle = 'rgba(225, 245, 254, 0.2)'; ctx.fillRect(1, 1, 14, 14);
                        ctx.strokeStyle = '#81d4fa'; ctx.lineWidth = 1; ctx.strokeRect(0.5, 0.5, 15, 15);
                        // 反光条
                        ctx.fillStyle = 'rgba(255,255,255,0.6)';
                        ctx.fillRect(3, 3, 2, 2);
                        ctx.fillRect(5, 5, 2, 2);
                        ctx.fillRect(10, 10, 3, 3);
                        break;

                    case BLOCK.ORE_COPPER:
                    case BLOCK.ORE_IRON:
                    case BLOCK.ORE_SILVER:
                    case BLOCK.ORE_GOLD:
                    case BLOCK.ORE_DIAMOND:
                    case BLOCK.COPPER_ORE: case BLOCK.IRON_ORE: case BLOCK.SILVER_ORE:
                    case BLOCK.GOLD_ORE: case BLOCK.DIAMOND_ORE:
                        // 矿石：石头背景 + 宝石镶嵌
                        this._drawPixelArt(ctx, BLOCK.STONE, BLOCK_DATA[BLOCK.STONE]);

                        let oreC = '#FFF';
                        if (id === BLOCK.COPPER_ORE) oreC = '#e67e22';
                        if (id === BLOCK.IRON_ORE) oreC = '#d7ccc8';
                        if (id === BLOCK.SILVER_ORE) oreC = '#e0e0e0';
                        if (id === BLOCK.GOLD_ORE) oreC = '#ffd700';
                        if (id === BLOCK.DIAMOND_ORE) oreC = '#29b6f6';
                        if (data.color) oreC = data.color;

                        for (let i = 0; i < 4; i++) {
                            const ox = Math.floor(Math.random() * 12) + 2;
                            const oy = Math.floor(Math.random() * 12) + 2;
                            // 矿石形状
                            ctx.fillStyle = oreC;
                            ctx.fillRect(ox, oy, 2, 2);
                            ctx.fillRect(ox - 1, oy, 1, 1);
                            ctx.fillRect(ox, oy - 1, 1, 1);
                            // 高光
                            ctx.fillStyle = '#ffffffaa';
                            ctx.fillRect(ox, oy, 1, 1);
                        }
                        break;

                    case BLOCK.TORCH:
                        // 火把
                        ctx.fillStyle = '#5d4037'; ctx.fillRect(7, 6, 2, 10); // 柄
                        // 火焰中心
                        ctx.fillStyle = '#ffeb3b'; ctx.fillRect(6, 4, 4, 4);
                        ctx.fillStyle = '#fff'; ctx.fillRect(7, 5, 2, 2);
                        // 外焰
                        ctx.fillStyle = '#ff5722';
                        ctx.fillRect(7, 2, 2, 2);
                        ctx.fillRect(6, 4, 1, 1); ctx.fillRect(9, 4, 1, 1);
                        break;

                    case BLOCK.SAND:
                        ctx.fillStyle = '#fff59d'; ctx.fillRect(0, 0, s, s);
                        // 波浪纹理
                        ctx.fillStyle = '#fdd835';
                        for (let y = 2; y < s; y += 4) {
                            for (let x = 0; x < s; x++) {
                                if ((x + y) % 4 === 0) ctx.fillRect(x, y, 1, 1);
                            }
                        }
                        fillNoise(['#fbc02d'], 0.1);
                        break;

                    case BLOCK.MUSHROOM:
                        // 蘑菇
                        ctx.fillStyle = '#fff'; ctx.fillRect(7, 10, 2, 6); // 茎
                        // 伞盖
                        ctx.fillStyle = '#e91e63';
                        ctx.fillRect(4, 7, 8, 3);
                        ctx.fillRect(5, 6, 6, 1);
                        // 斑点
                        ctx.fillStyle = '#f8bbd0';
                        ctx.fillRect(5, 8, 1, 1); ctx.fillRect(9, 7, 1, 1);
                        break;

                    case BLOCK.FLOWER_RED:
                    case BLOCK.FLOWER_YELLOW:
                    case BLOCK.PINK_FLOWER:
                    case BLOCK.BLUE_FLOWER:
                        const stemC = '#4caf50';
                        ctx.fillStyle = stemC; ctx.fillRect(7, 8, 2, 8); // 茎
                        // 叶
                        ctx.fillRect(5, 12, 2, 1); ctx.fillRect(9, 11, 2, 1);
                        // 花瓣
                        let petalC = '#f44336';
                        if (id === BLOCK.FLOWER_YELLOW) petalC = '#ffeb3b';
                        if (id === BLOCK.PINK_FLOWER) petalC = '#f48fb1';
                        if (id === BLOCK.BLUE_FLOWER) petalC = '#64b5f6';
                        ctx.fillStyle = petalC;
                        ctx.fillRect(6, 6, 4, 4);
                        ctx.fillRect(7, 5, 2, 6);
                        ctx.fillRect(5, 7, 6, 2);
                        // 花蕊
                        ctx.fillStyle = '#fff'; ctx.fillRect(7, 7, 2, 2);
                        break;

                    case BLOCK.SUNFLOWER:
                        ctx.fillStyle = '#4caf50'; ctx.fillRect(7, 6, 2, 10); // 茎
                        ctx.fillRect(5, 10, 2, 1); ctx.fillRect(9, 9, 2, 1);
                        // 花瓣 - 向日葵
                        ctx.fillStyle = '#ffeb3b';
                        for (let i = 0; i < 8; i++) {
                            const angle = (i / 8) * Math.PI * 2;
                            const px = 8 + Math.cos(angle) * 4;
                            const py = 4 + Math.sin(angle) * 4;
                            ctx.fillRect(Math.floor(px) - 1, Math.floor(py) - 1, 3, 3);
                        }
                        ctx.fillStyle = '#8d6e63'; ctx.fillRect(6, 2, 4, 4); // 中心
                        break;

                    case BLOCK.FERN:
                        ctx.fillStyle = '#2e7d32';
                        ctx.fillRect(7, 6, 2, 10);
                        // 蕨类叶片
                        for (let i = 0; i < 5; i++) {
                            const y = 6 + i * 2;
                            ctx.fillRect(4, y, 3, 1);
                            ctx.fillRect(9, y + 1, 3, 1);
                        }
                        break;

                    case BLOCK.VINE:
                        ctx.fillStyle = '#388e3c';
                        ctx.fillRect(7, 0, 2, 16);
                        ctx.fillRect(5, 3, 2, 1);
                        ctx.fillRect(9, 6, 2, 1);
                        ctx.fillRect(4, 10, 2, 1);
                        ctx.fillRect(10, 13, 2, 1);
                        break;

                    case BLOCK.BAMBOO:
                        ctx.fillStyle = '#7cb342'; ctx.fillRect(6, 0, 4, 16);
                        ctx.fillStyle = '#689f38';
                        ctx.fillRect(6, 3, 4, 1);
                        ctx.fillRect(6, 8, 4, 1);
                        ctx.fillRect(6, 13, 4, 1);
                        ctx.fillStyle = '#8bc34a';
                        ctx.fillRect(7, 0, 2, 16);
                        break;

                    case BLOCK.CHERRY_LEAVES:
                        const cherryColors = ['#f48fb1', '#f8bbd9', '#fce4ec', '#ec407a'];
                        for (let x = 0; x < s; x += 2) {
                            for (let y = 0; y < s; y += 2) {
                                if (Math.random() > 0.25) {
                                    ctx.fillStyle = cherryColors[Math.floor(Math.random() * cherryColors.length)];
                                    ctx.fillRect(x, y, 2, 2);
                                }
                            }
                        }
                        break;

                    case BLOCK.PINE_LEAVES:
                        const pineColors = ['#1b5e20', '#2e7d32', '#388e3c'];
                        for (let x = 0; x < s; x++) {
                            for (let y = 0; y < s; y++) {
                                if (Math.random() > 0.2) {
                                    ctx.fillStyle = pineColors[Math.floor(Math.random() * pineColors.length)];
                                    ctx.fillRect(x, y, 1, 1);
                                }
                            }
                        }
                        break;

                    case BLOCK.PALM_LEAVES:
                        const palmColors = ['#7cb342', '#8bc34a', '#9ccc65'];
                        for (let x = 0; x < s; x += 2) {
                            for (let y = 0; y < s; y += 2) {
                                if (Math.random() > 0.3) {
                                    ctx.fillStyle = palmColors[Math.floor(Math.random() * palmColors.length)];
                                    ctx.fillRect(x, y, 2, 2);
                                }
                            }
                        }
                        break;

                    case BLOCK.SANDSTONE:
                        ctx.fillStyle = '#d4a574'; ctx.fillRect(0, 0, s, s);
                        ctx.fillStyle = '#c9956c';
                        ctx.fillRect(0, 4, s, 1);
                        ctx.fillRect(0, 10, s, 1);
                        fillNoise(['#deb887', '#c9956c'], 0.2);
                        break;

                    case BLOCK.RED_SAND:
                        ctx.fillStyle = '#c75b39'; ctx.fillRect(0, 0, s, s);
                        fillNoise(['#b74a2a', '#d96c4a'], 0.4);
                        break;

                    case BLOCK.GRAVEL:
                        ctx.fillStyle = '#757575'; ctx.fillRect(0, 0, s, s);
                        for (let i = 0; i < 20; i++) {
                            const gx = Math.floor(Math.random() * 14) + 1;
                            const gy = Math.floor(Math.random() * 14) + 1;
                            ctx.fillStyle = Math.random() > 0.5 ? '#616161' : '#9e9e9e';
                            ctx.fillRect(gx, gy, 2, 2);
                        }
                        break;

                    case BLOCK.LIMESTONE:
                        ctx.fillStyle = '#e8dcc4'; ctx.fillRect(0, 0, s, s);
                        fillNoise(['#d7c9a8', '#f5f0e0'], 0.25);
                        break;

                    case BLOCK.SLATE:
                        ctx.fillStyle = '#546e7a'; ctx.fillRect(0, 0, s, s);
                        for (let y = 2; y < s; y += 3) {
                            ctx.fillStyle = '#455a64';
                            ctx.fillRect(0, y, s, 1);
                        }
                        break;

                    case BLOCK.BASALT:
                        ctx.fillStyle = '#37474f'; ctx.fillRect(0, 0, s, s);
                        fillNoise(['#263238', '#455a64'], 0.3);
                        break;

                    case BLOCK.FROZEN_STONE:
                        ctx.fillStyle = '#b3e5fc'; ctx.fillRect(0, 0, s, s);
                        fillNoise(['#81d4fa', '#e1f5fe'], 0.3);
                        // 冰晶效果
                        ctx.fillStyle = 'rgba(255,255,255,0.5)';
                        ctx.fillRect(3, 3, 2, 2);
                        ctx.fillRect(10, 8, 2, 2);
                        break;

                    case BLOCK.GLOWSTONE:
                        ctx.fillStyle = '#ffc107'; ctx.fillRect(0, 0, s, s);
                        fillNoise(['#ffeb3b', '#ff9800', '#fff176'], 0.5);
                        // 发光效果
                        ctx.fillStyle = '#fff';
                        ctx.fillRect(4, 4, 2, 2);
                        ctx.fillRect(10, 10, 2, 2);
                        break;

                    case BLOCK.AMETHYST:
                        ctx.fillStyle = '#9c27b0'; ctx.fillRect(0, 0, s, s);
                        // 晶体纹理
                        ctx.fillStyle = '#ba68c8';
                        ctx.fillRect(3, 2, 2, 6);
                        ctx.fillRect(8, 4, 3, 8);
                        ctx.fillStyle = '#e1bee7';
                        ctx.fillRect(4, 3, 1, 4);
                        ctx.fillRect(9, 5, 1, 6);
                        break;

                    case BLOCK.MUSHROOM_GIANT:
                        ctx.fillStyle = '#8e24aa'; ctx.fillRect(0, 0, s, s);
                        fillNoise(['#7b1fa2', '#9c27b0', '#ab47bc'], 0.4);
                        // 斑点
                        ctx.fillStyle = '#e1bee7';
                        ctx.fillRect(3, 4, 2, 2);
                        ctx.fillRect(10, 8, 2, 2);
                        ctx.fillRect(6, 12, 2, 2);
                        break;

                    case BLOCK.UNDERGROUND_MUSHROOM:
                        ctx.fillStyle = '#7e57c2'; ctx.fillRect(7, 10, 2, 6);
                        ctx.fillStyle = '#5e35b1';
                        ctx.fillRect(4, 7, 8, 3);
                        ctx.fillRect(5, 6, 6, 1);
                        // 发光点
                        ctx.fillStyle = '#b39ddb';
                        ctx.fillRect(5, 8, 1, 1);
                        ctx.fillRect(9, 7, 1, 1);
                        break;

                    case BLOCK.GLOWING_MOSS:
                        ctx.fillStyle = '#00e676';
                        for (let x = 0; x < s; x += 2) {
                            for (let y = 0; y < s; y += 2) {
                                if (Math.random() > 0.4) {
                                    ctx.fillStyle = Math.random() > 0.5 ? '#00e676' : '#69f0ae';
                                    ctx.fillRect(x, y, 2, 2);
                                }
                            }
                        }
                        break;

                    case BLOCK.STALAGMITE:
                    case BLOCK.STALACTITE:
                        const isUp = id === BLOCK.STALACTITE;
                        ctx.fillStyle = '#8d6e63';
                        if (isUp) {
                            ctx.fillRect(6, 0, 4, 8);
                            ctx.fillRect(7, 8, 2, 6);
                            ctx.fillRect(7, 14, 2, 2);
                        } else {
                            ctx.fillRect(7, 0, 2, 2);
                            ctx.fillRect(7, 2, 2, 6);
                            ctx.fillRect(6, 8, 4, 8);
                        }
                        break;

                    case BLOCK.SPIDER_WEB:
                        ctx.strokeStyle = '#eeeeee';
                        ctx.lineWidth = 1;
                        // 放射线
                        for (let i = 0; i < 8; i++) {
                            const angle = (i / 8) * Math.PI * 2;
                            ctx.beginPath();
                            ctx.moveTo(8, 8);
                            ctx.lineTo(8 + Math.cos(angle) * 7, 8 + Math.sin(angle) * 7);
                            ctx.stroke();
                        }
                        // 同心环
                        for (let r = 2; r <= 6; r += 2) {
                            ctx.beginPath();
                            ctx.arc(8, 8, r, 0, Math.PI * 2);
                            ctx.stroke();
                        }
                        break;

                    case BLOCK.BONE:
                        ctx.fillStyle = '#efebe9'; ctx.fillRect(0, 0, s, s);
                        ctx.fillStyle = '#d7ccc8';
                        ctx.fillRect(2, 6, 12, 4);
                        ctx.fillRect(0, 5, 3, 6);
                        ctx.fillRect(13, 5, 3, 6);
                        break;

                    case BLOCK.TREASURE_CHEST:
                        ctx.fillStyle = '#8d6e63'; ctx.fillRect(2, 4, 12, 10);
                        ctx.fillStyle = '#5d4037';
                        ctx.fillRect(2, 4, 12, 2);
                        ctx.fillStyle = '#ffd700';
                        ctx.fillRect(6, 8, 4, 3);
                        ctx.fillRect(7, 7, 2, 1);
                        break;

                    case BLOCK.LANTERN:
                        ctx.fillStyle = '#5d4037'; ctx.fillRect(6, 0, 4, 2);
                        ctx.fillStyle = '#ff9800'; ctx.fillRect(5, 2, 6, 8);
                        ctx.fillStyle = '#ffeb3b'; ctx.fillRect(6, 3, 4, 6);
                        ctx.fillStyle = '#fff'; ctx.fillRect(7, 4, 2, 4);
                        ctx.fillStyle = '#5d4037';
                        ctx.fillRect(5, 10, 6, 2);
                        ctx.fillRect(6, 12, 4, 2);
                        break;

                    case BLOCK.MOSS:
                        for (let x = 0; x < s; x++) {
                            for (let y = 0; y < s; y++) {
                                if (Math.random() > 0.5) {
                                    ctx.fillStyle = Math.random() > 0.5 ? '#558b2f' : '#689f38';
                                    ctx.fillRect(x, y, 1, 1);
                                }
                            }
                        }
                        break;

                    default:
                        // 默认降级处理
                        ctx.fillStyle = baseColor;
                        ctx.fillRect(0, 0, s, s);
                        ctx.fillStyle = '#00000022';
                        ctx.strokeRect(0, 0, s, s);
                        fillNoise(['#ffffff33', '#00000033'], 0.2);
                }
            }
        }

        // ───────────────────────── Exports ─────────────────────────
        window.TU = window.TU || {};
        Object.assign(window.TU, { TextureGenerator });

    


[
  {
    "id": "dungeon_room_basic",
    "tags": ["dungeon", "room"],
    "weight": 3,
    "depth": [0.62, 0.92],
    "anchor": [0.5, 0.5],
    "placement": { "mode": "underground", "minSolidRatio": 0.55, "defaultWall": 2 },
    "pattern": [
      "#############",
      "#...........#",
      "#..l.....l..#",
      "#...........#",
      "#.....C.....#",
      "#...........#",
      "#..l.....l..#",
      "#...........#",
      "#############"
    ],
    "legend": {
      "#": { "tile": "DUNGEON_BRICK", "replace": "any" },
      ".": { "tile": "AIR", "wall": 2, "replace": "any" },
      "l": { "tile": "LANTERN", "replace": "any" },
      "C": { "tile": "TREASURE_CHEST", "replace": "any" }
    },
    "connectors": [
      { "x": 0, "y": 4, "dir": "left", "len": 18, "carve": true, "wall": 2 },
      { "x": 12, "y": 4, "dir": "right", "len": 18, "carve": true, "wall": 2 }
    ]
  },
  {
    "id": "ruin_shrine",
    "tags": ["ruin", "room"],
    "weight": 2,
    "depth": [0.38, 0.74],
    "anchor": [0.5, 0.5],
    "placement": { "mode": "underground", "minSolidRatio": 0.45, "defaultWall": 1 },
    "pattern": [
      "  #######  ",
      " ##.....## ",
      "##..#.#..##",
      "#...#C#...#",
      "##..#.#..##",
      " ##.....## ",
      "  #######  "
    ],
    "legend": {
      "#": { "tile": "COBBLESTONE" },
      ".": { "tile": "AIR", "wall": 1 },
      "C": { "tile": "TREASURE_CHEST" }
    },
    "connectors": [
      { "x": 5, "y": 6, "dir": "down", "len": 10, "carve": true, "wall": 1 }
    ]
  },
  {
    "id": "ancient_tree",
    "tags": ["tree"],
    "weight": 2,
    "depth": [0.05, 0.35],
    "anchor": [0.5, 1.0],
    "placement": { "mode": "surface" },
    "pattern": [
      "   LLL   ",
      "  LLLLL  ",
      " LLLLLLL ",
      "  LLLLL  ",
      "   LLL   ",
      "    T    ",
      "    T    ",
      "    T    ",
      "    T    "
    ],
    "legend": {
      "L": { "tile": "LEAVES", "replace": "air" },
      "T": { "tile": "WOOD", "replace": "any" }
    }
  }
]




        // ═══════════════════════════════════════════════════════════════════════════════
        //                                世界生成器 (超级增强版)
        // ═══════════════════════════════════════════════════════════════════════════════
        // ───────────────────────── StructureDescriptor System (JSON, v11-safe) ─────────────────────────
        (() => {
            const TU = window.TU = window.TU || {};
            const LS_KEY = 'TU_STRUCTURES_JSON';
            const LIMITS = Object.freeze({ MAX_W: 96, MAX_H: 96, MAX_CELLS: 4096, MAX_DESC: 256, MAX_CONN: 16 });

            const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
            const clamp01 = (n) => (n < 0 ? 0 : (n > 1 ? 1 : n));
            const clampI = (n, lo, hi) => (n < lo ? lo : (n > hi ? hi : n)) | 0;
            const asNum = (v, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
            const asStr = (v, d = '') => (typeof v === 'string' ? v : d);

            function resolveBlockId(v) {
                if (typeof v === 'number' && Number.isFinite(v)) return clampI(v, 0, 255);
                if (typeof v === 'string') {
                    const k = v.trim();
                    if (!k || k === 'KEEP' || k === 'NULL' || k === 'null') return null;
                    if (typeof BLOCK === 'object' && k in BLOCK) return BLOCK[k];
                }
                return null;
            }
            function resolveWallId(v) {
                if (v === null || v === undefined) return null;
                if (typeof v === 'number' && Number.isFinite(v)) return clampI(v, 0, 255);
                if (typeof v === 'string') {
                    const s = v.trim();
                    if (!s) return null;
                    const n = Number(s);
                    if (Number.isFinite(n)) return clampI(n, 0, 255);
                }
                return null;
            }
            function dirVec(dir) {
                switch (dir) {
                    case 'left': return [-1, 0];
                    case 'right': return [1, 0];
                    case 'up': return [0, -1];
                    case 'down': return [0, 1];
                    default: return [0, 0];
                }
            }

            function normalizeDescriptor(raw, idx) {
                if (!isObj(raw)) return null;

                const id = asStr(raw.id, `desc_${idx}`).slice(0, 64);
                const tags = Array.isArray(raw.tags) ? raw.tags.map(t => asStr(t, '')).filter(Boolean).slice(0, 16) : [];
                const weight = Math.max(0.0001, asNum(raw.weight, 1));

                let depth = [0, 1];
                if (Array.isArray(raw.depth) && raw.depth.length >= 2) {
                    const a = clamp01(asNum(raw.depth[0], 0));
                    const b = clamp01(asNum(raw.depth[1], 1));
                    depth = a <= b ? [a, b] : [b, a];
                }

                const placement = isObj(raw.placement) ? raw.placement : {};
                const mode = placement.mode === 'surface' ? 'surface' : 'underground';
                const minSolidRatio = clamp01(asNum(placement.minSolidRatio, mode === 'underground' ? 0.5 : 0.0));
                const defaultWall = clampI(asNum(placement.defaultWall, 0), 0, 255);

                let anchor = [0.5, 0.5];
                if (Array.isArray(raw.anchor) && raw.anchor.length >= 2) {
                    anchor = [clamp01(asNum(raw.anchor[0], 0.5)), clamp01(asNum(raw.anchor[1], 0.5))];
                }

                const pat = Array.isArray(raw.pattern) ? raw.pattern.map(s => String(s).replace(/\r/g, '')) : [];
                if (!pat.length) return null;

                const h = pat.length;
                let w = 0;
                for (let i = 0; i < pat.length; i++) w = Math.max(w, pat[i].length);

                if (w <= 0 || h <= 0) return null;
                if (w > LIMITS.MAX_W || h > LIMITS.MAX_H) return null;
                if (w * h > LIMITS.MAX_CELLS) return null;

                const grid = pat.map(line => line.padEnd(w, ' '));

                const legendRaw = isObj(raw.legend) ? raw.legend : {};
                const legend = Object.create(null);
                for (const k in legendRaw) {
                    if (!k || k.length !== 1) continue;
                    const v = legendRaw[k];
                    if (!isObj(v)) continue;

                    const tile = resolveBlockId(v.tile);
                    const wall = resolveWallId(v.wall);
                    const replace = (v.replace === 'solid' || v.replace === 'air' || v.replace === 'any') ? v.replace : 'any';
                    const chance = clamp01(asNum(v.chance, 1));

                    // tile === null → KEEP（跳过写入 tile）
                    legend[k] = { tile, wall, replace, chance };
                }

                const connectors = [];
                if (Array.isArray(raw.connectors)) {
                    for (let i = 0; i < raw.connectors.length && connectors.length < LIMITS.MAX_CONN; i++) {
                        const c = raw.connectors[i];
                        if (!isObj(c)) continue;
                        const x = clampI(asNum(c.x, 0), 0, w - 1);
                        const y = clampI(asNum(c.y, 0), 0, h - 1);
                        const dir = asStr(c.dir, 'right');
                        const len = clampI(asNum(c.len, 10), 1, 64);
                        const carve = !!c.carve;
                        const wall = resolveWallId(c.wall);
                        connectors.push({ x, y, dir, len, carve, wall });
                    }
                }

                return { id, tags, weight, depth, placement: { mode, minSolidRatio, defaultWall }, anchor, w, h, grid, legend, connectors };
            }

            class StructureLibrary {
                constructor() {
                    this._descs = [];
                    this._loaded = false;
                    this._lastError = '';
                }
                count() { return this._descs.length; }
                lastError() { return this._lastError; }

                clear() {
                    this._descs.length = 0;
                    this._loaded = true;
                    this._lastError = '';
                }

                loadFromArray(arr, { replace = false } = {}) {
                    if (!Array.isArray(arr)) return { ok: false, added: 0, error: 'not_array' };
                    if (replace) this._descs.length = 0;

                    let added = 0;
                    for (let i = 0; i < arr.length && this._descs.length < LIMITS.MAX_DESC; i++) {
                        const desc = normalizeDescriptor(arr[i], i);
                        if (!desc) continue;
                        this._descs.push(desc);
                        added++;
                    }
                    this._loaded = true;
                    this._lastError = '';
                    return { ok: true, added };
                }

                loadFromJSON(json, { replace = false } = {}) {
                    try {
                        const arr = typeof json === 'string' ? JSON.parse(json) : json;
                        return this.loadFromArray(arr, { replace });
                    } catch (e) {
                        this._lastError = String(e && e.message ? e.message : e);
                        return { ok: false, added: 0, error: this._lastError };
                    }
                }

                ensureLoaded() {
                    if (this._loaded) return;

                    // 1) localStorage 覆盖
                    const ls = (() => { try { return localStorage.getItem(LS_KEY); } catch { return null; } })();
                    if (ls) {
                        const r = this.loadFromJSON(ls, { replace: true });
                        if (r.ok && this._descs.length) { this._loaded = true; return; }
                    }

                    // 2) 内嵌 JSON（默认库）
                    const el = document.getElementById('tu-structures-json');
                    if (el && el.textContent) {
                        const r = this.loadFromJSON(el.textContent, { replace: true });
                        if (r.ok) { this._loaded = true; return; }
                    }

                    // 3) 兜底：空库
                    this._loaded = true;
                }

                // tags: string | string[]
                pick(depthNorm, tags) {
                    this.ensureLoaded();
                    if (!this._descs.length) return null;

                    const dn = clamp01(asNum(depthNorm, 0.5));
                    const tagList = Array.isArray(tags) ? tags : (tags ? [tags] : []);
                    const filtered = [];

                    for (let i = 0; i < this._descs.length; i++) {
                        const d = this._descs[i];
                        if (dn < d.depth[0] || dn > d.depth[1]) continue;
                        if (tagList.length) {
                            let ok = false;
                            for (let t = 0; t < tagList.length; t++) {
                                if (d.tags.includes(tagList[t])) { ok = true; break; }
                            }
                            if (!ok) continue;
                        }
                        filtered.push(d);
                    }
                    if (!filtered.length) return null;

                    let total = 0;
                    for (let i = 0; i < filtered.length; i++) total += filtered[i].weight;

                    let r = Math.random() * total;
                    for (let i = 0; i < filtered.length; i++) {
                        r -= filtered[i].weight;
                        if (r <= 0) return filtered[i];
                    }
                    return filtered[filtered.length - 1];
                }

                exportJSON() {
                    // 仅导出可序列化的“原型信息”（pattern/grid 会被保留为数组）
                    this.ensureLoaded();
                    return JSON.stringify(this._descs.map(d => ({
                        id: d.id, tags: d.tags, weight: d.weight, depth: d.depth,
                        anchor: d.anchor, placement: d.placement,
                        pattern: d.grid, legend: d.legend, connectors: d.connectors
                    })), null, 2);
                }
            }

            TU.Structures = TU.Structures || new StructureLibrary();

            // 便捷 API：开发者可在控制台/自定义 UI 中调用
            TU.loadStructureJSON = (jsonString) => {
                try { localStorage.setItem(LS_KEY, jsonString); } catch { }
                const r = TU.Structures.loadFromJSON(jsonString, { replace: true });
                return r;
            };
            TU.clearStructureJSON = () => { try { localStorage.removeItem(LS_KEY); } catch { } TU.Structures.clear(); TU.Structures.ensureLoaded(); };

            // 提前加载一次（避免首次生成时 parse 卡顿）
            try { TU.Structures.ensureLoaded(); } catch { }
        })();

        class WorldGenerator {
            constructor(w, h, seed) {
                this.w = w;
                this.h = h;
                this.seed = seed;
                this.noise = new NoiseGenerator(seed);
                this.biomeNoise = new NoiseGenerator(seed + 1000);
                this.caveNoise = new NoiseGenerator(seed + 2000);
                this.oreNoise = new NoiseGenerator(seed + 3000);
                this.structureNoise = new NoiseGenerator(seed + 4000);
            }

            async generate(progress) {
                const tiles = Array.from({ length: this.w }, () => new Uint8Array(this.h));
                const walls = Array.from({ length: this.w }, () => new Uint8Array(this.h));
                const light = Array.from({ length: this.w }, () => new Uint8Array(this.h));

                const steps = [
                    ['✨ 编织地形...', () => this._terrain(tiles, walls)],
                    ['🏔️ 生成山脉峡谷...', () => this._specialTerrain(tiles, walls)],
                    ['🕳️ 雕刻洞穴...', () => this._caves(tiles, walls)],
                    ['🌊 创造湖泊...', () => this._lakes(tiles)],
                    ['💎 埋藏宝藏...', () => this._ores(tiles)],
                    ['🌿 种植生命...', () => this._vegetation(tiles)],
                    ['🍄 地下生态...', () => this._undergroundLife(tiles, walls)],
                    ['🏠 建造遗迹...', () => this._structures(tiles, walls)],
                    ['🏰 隐秘地牢...', () => this._dungeons(tiles, walls)],
                    ['💫 点亮世界...', () => this._lighting(tiles, light)]
                ];

                for (let i = 0; i < steps.length; i++) {
                    progress(steps[i][0], (i / steps.length) * 100);
                    steps[i][1]();
                    await new Promise(r => setTimeout(r, 30));
                }

                progress('🎮 准备就绪!', 100);
                return { tiles, walls, light, w: this.w, h: this.h };
            }

            _biome(x) {
                const v = this.biomeNoise.fbm(x * 0.003, 0, 4);
                const v2 = this.biomeNoise.fbm(x * 0.008 + 500, 100, 3);

                if (v < -0.35) return 'tundra';
                if (v < -0.15) return 'snow';
                if (v < 0.05) return 'forest';
                if (v < 0.2) return 'plains';
                if (v < 0.35) return v2 > 0 ? 'cherry' : 'bamboo';
                if (v < 0.55) return 'jungle';
                if (v < 0.7) return 'savanna';
                return v2 > 0.2 ? 'red_desert' : 'desert';
            }

            _subBiome(x, y) {
                const v = this.biomeNoise.fbm(x * 0.02, y * 0.02, 3);
                if (y > this.h * 0.5 && y < this.h * 0.7) {
                    if (v > 0.4) return 'mushroom_cave';
                    if (v < -0.4) return 'crystal_cave';
                }
                if (y > this.h * 0.65 && y < this.h * 0.85) {
                    if (v > 0.3) return 'lush_cave';
                    if (v < -0.3) return 'ice_cave';
                }
                return 'normal';
            }

            _terrain(tiles, walls) {
                const surfY = Math.floor(this.h * CONFIG.SURFACE_LEVEL);

                for (let x = 0; x < this.w; x++) {
                    const biome = this._biome(x);

                    // 更复杂的地形高度
                    let heightMod = this.noise.fbm(x * 0.008, 0, 6) * 25;
                    heightMod += this.noise.fbm(x * 0.02, 0, 4) * 8;
                    heightMod += this.noise.fbm(x * 0.05, 0, 2) * 3;

                    // 生物群系影响高度
                    if (biome === 'tundra' || biome === 'snow') heightMod += 10;
