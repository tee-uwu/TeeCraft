// ---------------------------------------------------------------------------
// Central data-only definitions for every block & item in the game, plus
// mining rules (hardness / required tool tier) and crafting recipes.
// Keeping this separate from textures.js (visuals) and inventory.js (logic)
// mirrors how a real game separates data tables from systems.
// ---------------------------------------------------------------------------

export const blockTypes = [
    'grass', 'dirt', 'stone', 'wood', 'leaves', 'sand', 'glass',
    'planks', 'cobblestone', 'coal_ore', 'iron_ore', 'diamond_ore',
    'crafting_table', 'furnace', 'chest', 'water', 'bedrock', 'snow', 'wool',
    'farmland', 'crop_0', 'crop_1', 'crop_2', 'crop_3',
    'bed', 'stone_slab', 'wood_slab', 'stone_stairs', 'wood_stairs', 'enchanting_table'
];

// Blocks the player can never break or place through.
export const UNBREAKABLE = new Set(['bedrock']);
// Blocks that don't stop the player (walk/swim through).
export const NON_SOLID = new Set(['water', 'crop_0', 'crop_1', 'crop_2', 'crop_3']);
// Blocks that let light/visibility through for face-culling & fog purposes.
export const TRANSPARENT = new Set(['water', 'leaves', 'glass', 'crop_0', 'crop_1', 'crop_2', 'crop_3', 'bed', 'stone_slab', 'wood_slab', 'stone_stairs', 'wood_stairs', 'enchanting_table']);

// Tool tiers - higher can mine anything a lower tier can.
export const TIER = { none: 0, wood: 1, stone: 2, iron: 3 };

// Seconds to break a block by hand; tools divide this (see MINING below).
export const HARDNESS = {
    grass: 0.6, dirt: 0.5, sand: 0.5, gravel: 0.6, snow: 0.4, wool: 0.8,
    stone: 1.5, cobblestone: 1.5,
    wood: 1.0, planks: 1.0, leaves: 0.25,
    coal_ore: 3.0, iron_ore: 4.5, diamond_ore: 6.0,
    glass: 0.3, crafting_table: 2.5, furnace: 3.5, chest: 2.5,
    farmland: 0.5, crop_0: 0.1, crop_1: 0.1, crop_2: 0.1, crop_3: 0.1,
    bed: 0.2, stone_slab: 1.5, wood_slab: 1.0, stone_stairs: 1.5, wood_stairs: 1.0, enchanting_table: 3.0
};

// Which blocks require a pickaxe of at least this tier to drop anything.
export const PICKAXE_REQUIRED = {
    stone: TIER.wood, cobblestone: TIER.wood,
    coal_ore: TIER.wood, iron_ore: TIER.stone, diamond_ore: TIER.iron,
    furnace: TIER.wood
};

// Block -> item id it drops when broken with a valid tool (defaults to itself).
export const BLOCK_DROPS = {
    stone: 'cobblestone',
    coal_ore: 'coal',
    iron_ore: 'iron_ore', // smelt in furnace to get iron_ingot
    diamond_ore: 'diamond',
    glass: null, // shatters, drops nothing (no silk touch)
    crop_0: 'seeds',
    crop_1: 'seeds',
    crop_2: 'seeds',
    crop_3: 'wheat'
    // 'leaves' is special-cased directly in world.js's breakBlock()
};

export function getToolTier(toolId) {
    if (!toolId) return TIER.none;
    if (toolId.startsWith('wood_')) return TIER.wood;
    if (toolId.startsWith('stone_')) return TIER.stone;
    if (toolId.startsWith('iron_')) return TIER.iron;
    return TIER.none;
}

export function getToolType(toolId) {
    if (!toolId) return null;
    if (toolId.endsWith('_pickaxe')) return 'pickaxe';
    if (toolId.endsWith('_axe')) return 'axe';
    if (toolId.endsWith('_shovel')) return 'shovel';
    if (toolId.endsWith('_sword')) return 'sword';
    if (toolId.endsWith('_hoe')) return 'hoe';
    return null;
}

// Best-suited tool category per block, for the mining-speed bonus.
export const BLOCK_TOOL_CATEGORY = {
    stone: 'pickaxe', cobblestone: 'pickaxe', coal_ore: 'pickaxe',
    iron_ore: 'pickaxe', diamond_ore: 'pickaxe', furnace: 'pickaxe',
    stone_slab: 'pickaxe', stone_stairs: 'pickaxe',
    wood: 'axe', planks: 'axe', crafting_table: 'axe', chest: 'axe',
    wood_slab: 'axe', wood_stairs: 'axe', bed: 'axe',
    grass: 'shovel', dirt: 'shovel', sand: 'shovel', snow: 'shovel',
    farmland: 'shovel'
};

// Attack damage (hearts * 2, matching Minecraft's half-heart convention).
export const TOOL_DAMAGE = {
    none: 1, wood_sword: 4, stone_sword: 5, iron_sword: 6,
    wood_pickaxe: 2, stone_pickaxe: 3, iron_pickaxe: 4,
    wood_axe: 3, stone_axe: 4, iron_axe: 5,
    wood_shovel: 1.5, stone_shovel: 2, iron_shovel: 2.5,
    wood_hoe: 1.5, stone_hoe: 2, iron_hoe: 2.5
};

// Item metadata: display name, max stack size, category.
export const ITEMS = {};
function reg(id, name, stack = 64, category = 'material') {
    ITEMS[id] = { id, name, stack, category };
}

blockTypes.forEach(b => {
    if (b === 'water' || b === 'bedrock') return; // not obtainable items
    reg(b, prettyName(b), 64, 'block');
});

reg('stick', 'Stick', 64, 'material');
reg('coal', 'Coal', 64, 'material');
reg('iron_ingot', 'Iron Ingot', 64, 'material');
reg('diamond', 'Diamond', 64, 'material');
reg('feather', 'Feather', 64, 'material');
reg('seeds', 'Seeds', 64, 'material');
reg('wheat', 'Wheat', 64, 'material');

reg('wood_pickaxe', 'Wooden Pickaxe', 1, 'tool');
reg('wood_axe', 'Wooden Axe', 1, 'tool');
reg('wood_shovel', 'Wooden Shovel', 1, 'tool');
reg('wood_sword', 'Wooden Sword', 1, 'tool');
reg('wood_hoe', 'Wooden Hoe', 1, 'tool');
reg('stone_pickaxe', 'Stone Pickaxe', 1, 'tool');
reg('stone_axe', 'Stone Axe', 1, 'tool');
reg('stone_shovel', 'Stone Shovel', 1, 'tool');
reg('stone_sword', 'Stone Sword', 1, 'tool');
reg('stone_hoe', 'Stone Hoe', 1, 'tool');
reg('iron_pickaxe', 'Iron Pickaxe', 1, 'tool');
reg('iron_axe', 'Iron Axe', 1, 'tool');
reg('iron_shovel', 'Iron Shovel', 1, 'tool');
reg('iron_sword', 'Iron Sword', 1, 'tool');
reg('iron_hoe', 'Iron Hoe', 1, 'tool');

reg('bow', 'Bow', 1, 'tool');
reg('arrow', 'Arrow', 64, 'material');

reg('iron_helmet', 'Iron Helmet', 1, 'armor');
reg('iron_chestplate', 'Iron Chestplate', 1, 'armor');
reg('iron_leggings', 'Iron Leggings', 1, 'armor');
reg('iron_boots', 'Iron Boots', 1, 'armor');

reg('apple', 'Apple', 64, 'food');
reg('raw_porkchop', 'Raw Porkchop', 64, 'food');
reg('cooked_porkchop', 'Cooked Porkchop', 64, 'food');
reg('raw_beef', 'Raw Beef', 64, 'food');
reg('cooked_beef', 'Cooked Beef', 64, 'food');
reg('raw_chicken', 'Raw Chicken', 64, 'food');
reg('cooked_chicken', 'Cooked Chicken', 64, 'food');

export const FOOD = {
    apple: { hunger: 4 },
    raw_porkchop: { hunger: 3 },
    cooked_porkchop: { hunger: 8 },
    raw_beef: { hunger: 3 },
    cooked_beef: { hunger: 8 },
    raw_chicken: { hunger: 2 },
    cooked_chicken: { hunger: 6 }
};

// Furnace: raw -> cooked, and ore -> ingot.
export const SMELTING = {
    iron_ore: 'iron_ingot',
    raw_porkchop: 'cooked_porkchop',
    raw_beef: 'cooked_beef',
    raw_chicken: 'cooked_chicken',
    sand: 'glass'
};
export const FUEL_BURN_TIME = { // seconds of smelting time provided
    coal: 8, planks: 1.5, wood: 1.5, stick: 0.5
};
export const SMELT_TIME = 3.5; // seconds per item

function prettyName(id) {
    return id.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
}

// ---------------------------------------------------------------------------
// Crafting recipes. Shaped recipes match a pattern inside the NxN grid
// (like real Minecraft); shapeless recipes just need the right ingredient
// counts anywhere in the grid.
// ---------------------------------------------------------------------------

// pattern: array of rows (strings), each character maps via `key`. '.' = empty.
// Shapes are matched allowing translation (the shape can sit anywhere in the
// grid) but not rotation/mirroring, same as vanilla Minecraft.
export const RECIPES = [
    { id: 'planks', shaped: true, pattern: ['W'], key: { W: 'wood' }, result: { id: 'planks', count: 4 } },
    { id: 'stick', shaped: true, pattern: ['P', 'P'], key: { P: 'planks' }, result: { id: 'stick', count: 4 } },
    { id: 'crafting_table', shaped: true, pattern: ['PP', 'PP'], key: { P: 'planks' }, result: { id: 'crafting_table', count: 1 } },
    { id: 'chest', shaped: true, pattern: ['PPP', 'P.P', 'PPP'], key: { P: 'planks' }, result: { id: 'chest', count: 1 }, needsTable: true },
    { id: 'furnace', shaped: true, pattern: ['CCC', 'C.C', 'CCC'], key: { C: 'cobblestone' }, result: { id: 'furnace', count: 1 }, needsTable: true },

    { id: 'wood_pickaxe', shaped: true, pattern: ['PPP', '.S.', '.S.'], key: { P: 'planks', S: 'stick' }, result: { id: 'wood_pickaxe', count: 1 }, needsTable: true },
    { id: 'wood_axe', shaped: true, pattern: ['PP', 'PS', '.S'], key: { P: 'planks', S: 'stick' }, result: { id: 'wood_axe', count: 1 }, needsTable: true },
    { id: 'wood_shovel', shaped: true, pattern: ['P', 'S', 'S'], key: { P: 'planks', S: 'stick' }, result: { id: 'wood_shovel', count: 1 }, needsTable: true },
    { id: 'wood_sword', shaped: true, pattern: ['P', 'P', 'S'], key: { P: 'planks', S: 'stick' }, result: { id: 'wood_sword', count: 1 }, needsTable: true },
    { id: 'wood_hoe', shaped: true, pattern: ['PP', '.S', '.S'], key: { P: 'planks', S: 'stick' }, result: { id: 'wood_hoe', count: 1 }, needsTable: true },

    { id: 'stone_pickaxe', shaped: true, pattern: ['CCC', '.S.', '.S.'], key: { C: 'cobblestone', S: 'stick' }, result: { id: 'stone_pickaxe', count: 1 }, needsTable: true },
    { id: 'stone_axe', shaped: true, pattern: ['CC', 'CS', '.S'], key: { C: 'cobblestone', S: 'stick' }, result: { id: 'stone_axe', count: 1 }, needsTable: true },
    { id: 'stone_shovel', shaped: true, pattern: ['C', 'S', 'S'], key: { C: 'cobblestone', S: 'stick' }, result: { id: 'stone_shovel', count: 1 }, needsTable: true },
    { id: 'stone_sword', shaped: true, pattern: ['C', 'C', 'S'], key: { C: 'cobblestone', S: 'stick' }, result: { id: 'stone_sword', count: 1 }, needsTable: true },
    { id: 'stone_hoe', shaped: true, pattern: ['CC', '.S', '.S'], key: { C: 'cobblestone', S: 'stick' }, result: { id: 'stone_hoe', count: 1 }, needsTable: true },

    { id: 'iron_pickaxe', shaped: true, pattern: ['III', '.S.', '.S.'], key: { I: 'iron_ingot', S: 'stick' }, result: { id: 'iron_pickaxe', count: 1 }, needsTable: true },
    { id: 'iron_axe', shaped: true, pattern: ['II', 'IS', '.S'], key: { I: 'iron_ingot', S: 'stick' }, result: { id: 'iron_axe', count: 1 }, needsTable: true },
    { id: 'iron_shovel', shaped: true, pattern: ['I', 'S', 'S'], key: { I: 'iron_ingot', S: 'stick' }, result: { id: 'iron_shovel', count: 1 }, needsTable: true },
    { id: 'iron_sword', shaped: true, pattern: ['I', 'I', 'S'], key: { I: 'iron_ingot', S: 'stick' }, result: { id: 'iron_sword', count: 1 }, needsTable: true },
    { id: 'iron_hoe', shaped: true, pattern: ['II', '.S', '.S'], key: { I: 'iron_ingot', S: 'stick' }, result: { id: 'iron_hoe', count: 1 }, needsTable: true },

    { id: 'bow', shaped: true, pattern: [' SW', 'S W', ' SW'], key: { S: 'stick', W: 'wool' }, result: { id: 'bow', count: 1 }, needsTable: true },
    { id: 'arrow', shaped: true, pattern: ['I', 'S', 'F'], key: { I: 'iron_ingot', S: 'stick', F: 'feather' }, result: { id: 'arrow', count: 4 }, needsTable: true },

    { id: 'iron_helmet', shaped: true, pattern: ['III', 'I.I'], key: { I: 'iron_ingot' }, result: { id: 'iron_helmet', count: 1 }, needsTable: true },
    { id: 'iron_chestplate', shaped: true, pattern: ['I.I', 'III', 'III'], key: { I: 'iron_ingot' }, result: { id: 'iron_chestplate', count: 1 }, needsTable: true },
    { id: 'iron_leggings', shaped: true, pattern: ['III', 'I.I', 'I.I'], key: { I: 'iron_ingot' }, result: { id: 'iron_leggings', count: 1 }, needsTable: true },
    { id: 'iron_boots', shaped: true, pattern: ['I.I', 'I.I'], key: { I: 'iron_ingot' }, result: { id: 'iron_boots', count: 1 }, needsTable: true },

    { id: 'stone_slab', shaped: true, pattern: ['CCC'], key: { C: 'cobblestone' }, result: { id: 'stone_slab', count: 6 }, needsTable: true },
    { id: 'wood_slab', shaped: true, pattern: ['PPP'], key: { P: 'planks' }, result: { id: 'wood_slab', count: 6 }, needsTable: true },
    { id: 'stone_stairs', shaped: true, pattern: ['C..', 'CC.', 'CCC'], key: { C: 'cobblestone' }, result: { id: 'stone_stairs', count: 4 }, needsTable: true },
    { id: 'wood_stairs', shaped: true, pattern: ['P..', 'PP.', 'PPP'], key: { P: 'planks' }, result: { id: 'wood_stairs', count: 4 }, needsTable: true },
    { id: 'bed', shaped: true, pattern: ['WWW', 'PPP'], key: { W: 'wool', P: 'planks' }, result: { id: 'bed', count: 1 }, needsTable: true },
    { id: 'enchanting_table', shaped: true, pattern: ['.C.', 'PCP', 'CCC'], key: { C: 'cobblestone', P: 'planks' }, result: { id: 'enchanting_table', count: 1 }, needsTable: true }
];
