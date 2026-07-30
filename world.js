import { Chunk, CHUNK_SIZE, SEA_LEVEL, initNoise } from './chunk.js';
import {
    UNBREAKABLE, PICKAXE_REQUIRED, BLOCK_DROPS, getToolTier,
    SMELTING, FUEL_BURN_TIME, SMELT_TIME
} from './items.js';
import { randomSeed } from './utils.js';

export { SEA_LEVEL };

export function isSolidType(type) {
    return !!type && type !== 'water';
}

export class WorldManager {
    constructor(scene, seed) {
        this.scene = scene;
        this.seed = (seed === undefined || seed === null) ? randomSeed() : seed;
        initNoise(this.seed);

        this.chunks = new Map();
        this.chunkDiffs = new Map();   // chunkKey -> [[x,y,z,type], ...] (persists across unload)
        this.blockEntities = new Map(); // "x,y,z" world -> furnace state
        this.activeCrops = new Map();
        this.cropTickTimer = 0;
        this.renderDistance = 6;
    }

    getChunkKey(cx, cz) {
        return `${cx},${cz}`;
    }

    blockKey(x, y, z) {
        return `${x},${y},${z}`;
    }

    update(playerX, playerZ) {
        const currentChunkX = Math.floor(playerX / CHUNK_SIZE);
        const currentChunkZ = Math.floor(playerZ / CHUNK_SIZE);

        const chunksInRadius = new Set();
        const missingChunks = [];

        for (let x = -this.renderDistance; x <= this.renderDistance; x++) {
            for (let z = -this.renderDistance; z <= this.renderDistance; z++) {
                const cx = currentChunkX + x;
                const cz = currentChunkZ + z;
                const key = this.getChunkKey(cx, cz);
                chunksInRadius.add(key);

                if (!this.chunks.has(key)) {
                    const distSq = x * x + z * z;
                    missingChunks.push({ cx, cz, key, distSq });
                }
            }
        }

        // Sort missing chunks by distance to player (closest first)
        missingChunks.sort((a, b) => a.distSq - b.distSq);

        // Process a maximum of 2 chunks per frame to guarantee 60 FPS streaming
        const MAX_CHUNKS_PER_FRAME = 2;
        const toGenerate = missingChunks.slice(0, MAX_CHUNKS_PER_FRAME);

        for (const item of toGenerate) {
            const { cx, cz, key } = item;
            const chunk = new Chunk(cx, cz, this.scene, this.seed);
            if (this.chunkDiffs.has(key)) {
                chunk.applyDiffs(this.chunkDiffs.get(key));
            }
            this.chunks.set(key, chunk);

            for (let i = 0; i < CHUNK_SIZE; i++) {
                for (let j = 0; j < CHUNK_SIZE; j++) {
                    for (let k = 1; k < 60; k++) {
                        const wx = cx * CHUNK_SIZE + i;
                        const wz = cz * CHUNK_SIZE + j;
                        const t = chunk.getBlock(wx, k, wz);
                        if (t && t.startsWith('crop_')) {
                            this.activeCrops.set(this.blockKey(wx, k, wz), { x: wx, y: k, z: wz });
                        }
                    }
                }
            }

            if (chunk.generatedEntities) {
                for (const ent of chunk.generatedEntities) {
                    const b = chunk.getBlock(ent.x, ent.y, ent.z);
                    if (b === ent.type && !this.blockEntities.has(this.blockKey(ent.x, ent.y, ent.z))) {
                        if (ent.type === 'chest') {
                            const items = new Array(27).fill(null);
                            if (ent.loot) {
                                items[0] = { id: 'iron_ore', count: Math.floor(Math.random() * 5) + 1 };
                                items[13] = { id: 'apple', count: Math.floor(Math.random() * 3) + 1 };
                                items[26] = { id: 'coal_ore', count: Math.floor(Math.random() * 8) + 1 };
                                items[5] = { id: 'wood_pickaxe', count: 1 };
                            }
                            this.blockEntities.set(this.blockKey(ent.x, ent.y, ent.z), { type: 'chest', items });
                        }
                    }
                }
            }
        }

        // Unload chunks outside renderDistance
        for (const [key, chunk] of this.chunks.entries()) {
            if (!chunksInRadius.has(key)) {
                const diffs = chunk.getDiffsForSave();
                if (diffs.length) this.chunkDiffs.set(key, diffs);
                chunk.destroy();
                this.chunks.delete(key);
            }
        }
    }

    getBlock(x, y, z) {
        const cx = Math.floor(x / CHUNK_SIZE);
        const cz = Math.floor(z / CHUNK_SIZE);
        const chunk = this.chunks.get(this.getChunkKey(cx, cz));
        if (chunk) return chunk.getBlock(x, y, z);
        return null;
    }

    isSolid(x, y, z) {
        return isSolidType(this.getBlock(Math.floor(x), Math.floor(y), Math.floor(z)));
    }

    isWater(x, y, z) {
        return this.getBlock(Math.floor(x), Math.floor(y), Math.floor(z)) === 'water';
    }

    setBlockRaw(x, y, z, type) {
        const cx = Math.floor(x / CHUNK_SIZE);
        const cz = Math.floor(z / CHUNK_SIZE);
        const chunk = this.chunks.get(this.getChunkKey(cx, cz));
        if (chunk) chunk.setBlock(x, y, z, type);

        const key = this.blockKey(x, y, z);
        if (type && type.startsWith('crop_')) {
            this.activeCrops.set(key, { x, y, z });
        } else {
            this.activeCrops.delete(key);
        }
    }

    // Backwards-compatible alias used by older call sites.
    setBlock(x, y, z, type) {
        this.setBlockRaw(x, y, z, type);
    }

    // Attempts to break a block with the given tool item id.
    // Returns { type, drop } where drop is the item id to give the player
    // (or null/undefined - undefined signals "caller decides", used for leaves).
    breakBlock(x, y, z, toolId) {
        const type = this.getBlock(x, y, z);
        if (!type || UNBREAKABLE.has(type) || type === 'water') return null;

        let drop;
        const required = PICKAXE_REQUIRED[type];
        if (required !== undefined) {
            const tier = getToolTier(toolId);
            drop = (tier >= required) ? (BLOCK_DROPS.hasOwnProperty(type) ? BLOCK_DROPS[type] : type) : null;
        } else if (type === 'leaves') {
            drop = undefined; // special-cased by the caller
        } else if (BLOCK_DROPS.hasOwnProperty(type)) {
            drop = BLOCK_DROPS[type];
        } else {
            drop = type;
        }

        this.setBlockRaw(x, y, z, null);
        const entityKey = this.blockKey(x, y, z);
        let entity = null;
        if (type === 'furnace' || type === 'chest') {
            entity = this.blockEntities.get(entityKey);
            this.blockEntities.delete(entityKey);
        }
        return { type, drop, entity };
    }

    placeBlock(x, y, z, type) {
        if (this.getBlock(x, y, z)) return false;
        this.setBlockRaw(x, y, z, type);
        if (type === 'furnace') {
            this.blockEntities.set(this.blockKey(x, y, z), {
                type: 'furnace', input: null, fuel: null, output: null,
                progress: 0, burnRemaining: 0
            });
        } else if (type === 'chest') {
            this.blockEntities.set(this.blockKey(x, y, z), {
                type: 'chest', items: new Array(27).fill(null)
            });
        }
        return true;
    }

    getFurnaceAt(x, y, z) {
        const ent = this.blockEntities.get(this.blockKey(x, y, z));
        return ent && ent.type === 'furnace' ? ent : null;
    }

    getChestAt(x, y, z) {
        const ent = this.blockEntities.get(this.blockKey(x, y, z));
        return ent && ent.type === 'chest' ? ent : null;
    }

    updateEntities(dt) {
        this.updateFurnaces(dt);

        this.cropTickTimer += dt;
        if (this.cropTickTimer > 3.0) { // check crops every 3 seconds
            this.cropTickTimer = 0;
            for (const [key, pos] of this.activeCrops.entries()) {
                const chunk = this.chunks.get(this.getChunkKey(Math.floor(pos.x / CHUNK_SIZE), Math.floor(pos.z / CHUNK_SIZE)));
                if (!chunk) continue;
                
                // Crop dies if not on farmland
                const ground = chunk.getBlock(pos.x, pos.y - 1, pos.z);
                if (ground !== 'farmland') {
                    this.setBlockRaw(pos.x, pos.y, pos.z, null);
                    continue;
                }

                const type = chunk.getBlock(pos.x, pos.y, pos.z);
                if (type && type.startsWith('crop_')) {
                    const stage = parseInt(type.split('_')[1]);
                    if (stage < 3 && Math.random() < 0.2) { // 20% chance to grow
                        this.setBlockRaw(pos.x, pos.y, pos.z, `crop_${stage + 1}`);
                    }
                } else {
                    this.activeCrops.delete(key);
                }
            }
        }
    }

    updateFurnaces(dt) {
        for (const entity of this.blockEntities.values()) {
            if (entity.type !== 'furnace') continue;
            const canSmelt = entity.input && SMELTING[entity.input.id] &&
                (!entity.output || (entity.output.id === SMELTING[entity.input.id] && entity.output.count < 64));

            if (entity.burnRemaining > 0 && canSmelt) {
                entity.burnRemaining -= dt;
                entity.progress += dt;
                entity.burning = true;
                if (entity.progress >= SMELT_TIME) {
                    entity.progress = 0;
                    const resultId = SMELTING[entity.input.id];
                    entity.input.count--;
                    if (entity.input.count <= 0) entity.input = null;
                    if (entity.output && entity.output.id === resultId) entity.output.count++;
                    else entity.output = { id: resultId, count: 1 };
                }
            } else if (canSmelt && entity.fuel && entity.fuel.count > 0 && FUEL_BURN_TIME[entity.fuel.id]) {
                entity.burnRemaining = FUEL_BURN_TIME[entity.fuel.id];
                entity.fuel.count--;
                if (entity.fuel.count <= 0) entity.fuel = null;
                entity.burning = true;
            } else if (entity.burnRemaining <= 0) {
                entity.burning = false;
            }
        }
    }

    getInteractableMeshes() {
        const meshes = [];
        for (const chunk of this.chunks.values()) {
            if (chunk.meshOpaque) meshes.push(chunk.meshOpaque);
            if (chunk.meshTransparent) meshes.push(chunk.meshTransparent);
        }
        return meshes;
    }

    // --- Persistence -------------------------------------------------
    serializeChunkDiffs() {
        for (const [key, chunk] of this.chunks.entries()) {
            const diffs = chunk.getDiffsForSave();
            if (diffs.length) this.chunkDiffs.set(key, diffs);
        }
        return Object.fromEntries(this.chunkDiffs.entries());
    }

    loadChunkDiffs(obj) {
        this.chunkDiffs = new Map(Object.entries(obj || {}));
    }

    serializeBlockEntities() {
        return Object.fromEntries(this.blockEntities.entries());
    }

    loadBlockEntities(obj) {
        this.blockEntities = new Map(Object.entries(obj || {}));
    }
}
