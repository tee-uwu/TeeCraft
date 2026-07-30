import * as THREE from 'three';
import { atlasMaterialOpaque, atlasMaterialTransparent, blockFaces, atlasUVs } from './textures.js';
import { createNoise2D, createNoise3D } from 'simplex-noise';
import { mulberry32, hashSeed } from './utils.js';

const SHAPES = {
    cube: [
        { dir: [1, 0, 0], corners: [[1,1,1, 1,1], [1,0,1, 1,0], [1,0,0, 0,0], [1,1,0, 0,1]], index: 0 },
        { dir: [-1, 0, 0], corners: [[0,1,0, 1,1], [0,0,0, 1,0], [0,0,1, 0,0], [0,1,1, 0,1]], index: 1 },
        { dir: [0, 1, 0], corners: [[0,1,1, 1,1], [1,1,1, 1,0], [1,1,0, 0,0], [0,1,0, 0,1]], index: 2 },
        { dir: [0, -1, 0], corners: [[0,0,0, 1,1], [1,0,0, 1,0], [1,0,1, 0,0], [0,0,1, 0,1]], index: 3 },
        { dir: [0, 0, 1], corners: [[0,1,1, 1,1], [0,0,1, 1,0], [1,0,1, 0,0], [1,1,1, 0,1]], index: 4 },
        { dir: [0, 0, -1], corners: [[1,1,0, 1,1], [1,0,0, 1,0], [0,0,0, 0,0], [0,1,0, 0,1]], index: 5 }
    ],
    slab: [
        { dir: [1, 0, 0], corners: [[1,0.5,1, 1,0.5], [1,0,1, 1,0], [1,0,0, 0,0], [1,0.5,0, 0,0.5]], index: 0 },
        { dir: [-1, 0, 0], corners: [[0,0.5,0, 1,0.5], [0,0,0, 1,0], [0,0,1, 0,0], [0,0.5,1, 0,0.5]], index: 1 },
        { dir: [0, 1, 0], corners: [[0,0.5,1, 1,1], [1,0.5,1, 1,0], [1,0.5,0, 0,0], [0,0.5,0, 0,1]], index: 2 },
        { dir: [0, -1, 0], corners: [[0,0,0, 1,1], [1,0,0, 1,0], [1,0,1, 0,0], [0,0,1, 0,1]], index: 3 },
        { dir: [0, 0, 1], corners: [[0,0.5,1, 1,0.5], [0,0,1, 1,0], [1,0,1, 0,0], [1,0.5,1, 0,0.5]], index: 4 },
        { dir: [0, 0, -1], corners: [[1,0.5,0, 1,0.5], [1,0,0, 1,0], [0,0,0, 0,0], [0,0.5,0, 0,0.5]], index: 5 }
    ],
    stairs: [
        { dir: [1, 0, 0], corners: [[1,0.5,1, 1,0.5], [1,0,1, 1,0], [1,0,0, 0,0], [1,0.5,0, 0,0.5]], index: 0 },
        { dir: [-1, 0, 0], corners: [[0,0.5,0, 1,0.5], [0,0,0, 1,0], [0,0,1, 0,0], [0,0.5,1, 0,0.5]], index: 1 },
        { dir: [0, -1, 0], corners: [[0,0,0, 1,1], [1,0,0, 1,0], [1,0,1, 0,0], [0,0,1, 0,1]], index: 3 },
        { dir: [0, 0, 1], corners: [[0,0.5,1, 1,0.5], [0,0,1, 1,0], [1,0,1, 0,0], [1,0.5,1, 0,0.5]], index: 4 },
        { dir: [0, 0, -1], corners: [[1,0.5,0, 1,0.5], [1,0,0, 1,0], [0,0,0, 0,0], [0,0.5,0, 0,0.5]], index: 5 },
        { dir: [1, 0, 0], corners: [[1,1,0.5, 0.5,1], [1,0.5,0.5, 0.5,0.5], [1,0.5,0, 0,0.5], [1,1,0, 0,1]], index: 0 },
        { dir: [-1, 0, 0], corners: [[0,1,0, 1,1], [0,0.5,0, 1,0.5], [0,0.5,0.5, 0.5,0.5], [0,1,0.5, 0.5,1]], index: 1 },
        { dir: [0, 1, 0], corners: [[0,1,0.5, 1,0.5], [1,1,0.5, 1,0], [1,1,0, 0,0], [0,1,0, 0,0.5]], index: 2 },
        { dir: [0, 0, 1], corners: [[0,1,0.5, 1,1], [0,0.5,0.5, 1,0.5], [1,0.5,0.5, 0,0.5], [1,1,0.5, 0,1]], index: 4 },
        { dir: [0, 1, 0], corners: [[0,0.5,1, 1,1], [1,0.5,1, 1,0.5], [1,0.5,0.5, 0.5,0.5], [0,0.5,0.5, 0,1]], index: 2 },
        { dir: [0, 0, -1], corners: [[1,1,0, 1,1], [1,0.5,0, 1,0.5], [0,0.5,0, 0,0.5], [0,1,0, 0,1]], index: 5 }
    ]
};

const BLOCK_SHAPE_MAP = {
    stone_slab: 'slab', wood_slab: 'slab', bed: 'slab',
    stone_stairs: 'stairs', wood_stairs: 'stairs', enchanting_table: 'slab'
};

export const CHUNK_SIZE = 16;
export const MAX_HEIGHT = 64;
export const SEA_LEVEL = 14;

let noise2D = createNoise2D();
let noise3D = createNoise3D();
let tempNoise = createNoise2D();
let humidNoise = createNoise2D();

export function initNoise(seed) {
    noise2D = createNoise2D(mulberry32(seed));
    noise3D = createNoise3D(mulberry32(seed + 1));
    tempNoise = createNoise2D(mulberry32(seed + 2));
    humidNoise = createNoise2D(mulberry32(seed + 3));
}

export class Chunk {
    constructor(chunkX, chunkZ, scene, seed = 0) {
        this.chunkX = chunkX;
        this.chunkZ = chunkZ;
        this.scene = scene;
        this.seed = seed;
        this.worldOffsetX = chunkX * CHUNK_SIZE;
        this.worldOffsetZ = chunkZ * CHUNK_SIZE;
        this.rng = mulberry32(hashSeed(seed, chunkX, chunkZ));

        this.blocks = new Array(CHUNK_SIZE).fill(null).map(() =>
            new Array(MAX_HEIGHT).fill(null).map(() =>
                new Array(CHUNK_SIZE).fill(null)
            )
        );

        this.diffs = new Map();
        
        this.meshOpaque = null;
        this.meshTransparent = null;

        this.generatedEntities = [];

        this.generateTerrain();
        this.buildMesh();
    }

    generateTerrain() {
        const rng = this.rng;
        for (let x = 0; x < CHUNK_SIZE; x++) {
            for (let z = 0; z < CHUNK_SIZE; z++) {
                const worldX = this.worldOffsetX + x;
                const worldZ = this.worldOffsetZ + z;

                // Biome calculation
                const temp = (tempNoise(worldX * 0.005, worldZ * 0.005) + 1) / 2; // 0 to 1
                const humid = (humidNoise(worldX * 0.005, worldZ * 0.005) + 1) / 2; // 0 to 1

                let biome = 'plains';
                let baseHeight = 10;
                let heightVar = 12;
                
                if (temp > 0.6 && humid < 0.4) {
                    biome = 'desert';
                    baseHeight = 8;
                    heightVar = 6;
                } else if (temp < 0.3) {
                    biome = 'snow';
                    baseHeight = 12;
                    heightVar = 16;
                } else if (temp > 0.4 && humid > 0.5) {
                    biome = 'forest';
                    baseHeight = 12;
                    heightVar = 10;
                }

                // Elevation
                const elevation = noise2D(worldX * 0.015, worldZ * 0.015);
                let height = Math.floor((elevation + 1) * heightVar) + baseHeight;

                this.blocks[x][0][z] = 'bedrock';
                for (let y = 1; y <= height; y++) {
                    // 3D Noise for caves - carve only in stone/dirt layers
                    let isCave = false;
                    if (y < height - 3 && y > 3) {
                        const caveDensity = noise3D(worldX * 0.05, y * 0.05, worldZ * 0.05);
                        if (caveDensity > 0.4) {
                            isCave = true;
                        }
                    }

                    if (isCave) {
                        this.blocks[x][y][z] = null;
                        continue;
                    }

                    let type = 'stone';
                    if (y === height) {
                        if (biome === 'desert') type = 'sand';
                        else if (biome === 'snow') type = 'snow';
                        else type = 'grass';
                    } else if (y >= height - 3) {
                        if (biome === 'desert') type = 'sand';
                        else if (biome === 'snow') type = 'dirt';
                        else type = 'dirt';
                    }
                    this.blocks[x][y][z] = type;
                }

                // Ore veins
                for (let y = 1; y < height - 3; y++) {
                    if (this.blocks[x][y][z] !== 'stone') continue;
                    if (y < 10 && rng() < 0.006) this.blocks[x][y][z] = 'diamond_ore';
                    else if (y < height - 8 && rng() < 0.015) this.blocks[x][y][z] = 'iron_ore';
                    else if (rng() < 0.02) this.blocks[x][y][z] = 'coal_ore';
                }

                // Fill below sea level with water
                if (height < SEA_LEVEL) {
                    for (let y = height + 1; y <= SEA_LEVEL; y++) {
                        if (!this.blocks[x][y][z]) {
                            this.blocks[x][y][z] = 'water';
                        }
                    }
                }

                // Trees
                if (biome === 'forest' && this.blocks[x][height][z] === 'grass' && rng() < 0.05) {
                    this.generateTree(x, height + 1, z, rng);
                } else if (biome === 'plains' && this.blocks[x][height][z] === 'grass' && rng() < 0.005) {
                    this.generateTree(x, height + 1, z, rng);
                }

                // Structures
                if (biome === 'plains' && this.blocks[x][height][z] === 'grass' && rng() < 0.003) {
                    this.generateHut(x, height + 1, z, rng);
                }
            }
        }
    }

    generateHut(cx, cy, cz, rng) {
        for (let y = 0; y < 4; y++) {
            for (let x = -2; x <= 2; x++) {
                for (let z = -2; z <= 2; z++) {
                    const bx = cx + x;
                    const by = cy + y;
                    const bz = cz + z;
                    if (bx < 0 || bx >= CHUNK_SIZE || bz < 0 || bz >= CHUNK_SIZE || by >= MAX_HEIGHT) continue;
                    
                    if (x === -2 || x === 2 || z === -2 || z === 2) {
                        if (z === -2 && x === 0 && y < 2) continue; // door
                        this.blocks[bx][by][bz] = 'cobblestone';
                    }
                    if (y === 3) {
                        this.blocks[bx][by][bz] = 'planks'; // roof
                    }
                }
            }
        }
        
        for (let x = -1; x <= 1; x++) {
            for (let z = -1; z <= 1; z++) {
                const bx = cx + x;
                const bz = cz + z;
                if (bx >= 0 && bx < CHUNK_SIZE && bz >= 0 && bz < CHUNK_SIZE && cy - 1 >= 0) {
                    this.blocks[bx][cy - 1][bz] = 'planks';
                }
            }
        }

        const bx = cx;
        const bz = cz + 1;
        if (bx >= 0 && bx < CHUNK_SIZE && bz >= 0 && bz < CHUNK_SIZE && cy < MAX_HEIGHT) {
            this.blocks[bx][cy][bz] = 'chest';
            this.generatedEntities.push({
                x: this.worldOffsetX + bx,
                y: cy,
                z: this.worldOffsetZ + bz,
                type: 'chest',
                loot: true
            });
        }
    }

    generateTree(cx, cy, cz, rng) {
        const height = Math.floor(rng() * 3) + 4;
        for (let y = 0; y < height; y++) {
            if (cy + y < MAX_HEIGHT) this.blocks[cx][cy + y][cz] = 'wood';
        }
        for (let x = -2; x <= 2; x++) {
            for (let y = height - 2; y <= height + 1; y++) {
                for (let z = -2; z <= 2; z++) {
                    if (Math.abs(x) + Math.abs(z) + (y - height) > 3) continue;
                    const bx = cx + x;
                    const by = cy + y;
                    const bz = cz + z;
                    if (bx >= 0 && bx < CHUNK_SIZE && bz >= 0 && bz < CHUNK_SIZE && by < MAX_HEIGHT) {
                        if (!this.blocks[bx][by][bz]) this.blocks[bx][by][bz] = 'leaves';
                    }
                }
            }
        }
    }

    isTransparent(type) {
        return type === 'water' || type === 'glass' || type === 'leaves' || 
               type === 'stone_slab' || type === 'wood_slab' || type === 'bed' ||
               type === 'stone_stairs' || type === 'wood_stairs';
    }

    shouldRenderFace(x, y, z, myType, dir) {
        if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= MAX_HEIGHT || z < 0 || z >= CHUNK_SIZE) return true;
        const neighbor = this.blocks[x][y][z];
        if (!neighbor) return true;
        
        const meTrans = this.isTransparent(myType);
        const nTrans = this.isTransparent(neighbor);
        
        // If myType is a custom shape and neighbor is a custom shape, they might not occlude perfectly.
        const myShape = BLOCK_SHAPE_MAP[myType] || 'cube';
        const nShape = BLOCK_SHAPE_MAP[neighbor] || 'cube';
        if (myShape !== 'cube' || nShape !== 'cube') {
            // For simplicity, if they are the exact same shape and block type and next to each other on x/z, they do occlude side faces.
            // But vertically they might not.
            if (myType === neighbor && dir[1] === 0) return false;
            if (!meTrans && nTrans) return true;
            return true;
        }
        
        if (!meTrans && !nTrans) return false;
        if (meTrans && neighbor === myType) return false;
        if (!meTrans && nTrans) return true;
        
        return true;
    }

    buildMesh() {
        if (this.meshOpaque) { this.scene.remove(this.meshOpaque); this.meshOpaque.geometry.dispose(); this.meshOpaque = null; }
        if (this.meshTransparent) { this.scene.remove(this.meshTransparent); this.meshTransparent.geometry.dispose(); this.meshTransparent = null; }

        const opaquePositions = [], opaqueUVs = [], opaqueIndices = [];
        const transPositions = [], transUVs = [], transIndices = [];
        
        let opaqueVertexCount = 0;
        let transVertexCount = 0;

        for (let y = 0; y < MAX_HEIGHT; y++) {
            for (let x = 0; x < CHUNK_SIZE; x++) {
                for (let z = 0; z < CHUNK_SIZE; z++) {
                    const type = this.blocks[x][y][z];
                    if (!type) continue;
                    
                    const isTrans = this.isTransparent(type);
                    const positions = isTrans ? transPositions : opaquePositions;
                    const uvs = isTrans ? transUVs : opaqueUVs;
                    const indices = isTrans ? transIndices : opaqueIndices;
                    let vCount = isTrans ? transVertexCount : opaqueVertexCount;
                    
                    const facesNames = blockFaces[type] || [type, type, type, type, type, type];
                    const shapeName = BLOCK_SHAPE_MAP[type] || 'cube';
                    const shapeFaces = SHAPES[shapeName];

                    for (const { dir, corners, index } of shapeFaces) {
                        const nx = x + dir[0];
                        const ny = y + dir[1];
                        const nz = z + dir[2];
                        
                        if (this.shouldRenderFace(nx, ny, nz, type, dir)) {
                            const texName = facesNames[index];
                            const uvBounds = atlasUVs[texName] || [0, 0, 1, 1];
                            const [u0, v0, u1, v1] = uvBounds;
                            
                            for (const pos of corners) {
                                positions.push(this.worldOffsetX + x + pos[0], y + pos[1], this.worldOffsetZ + z + pos[2]);
                                uvs.push(u0 + pos[3] * (u1 - u0), v0 + pos[4] * (v1 - v0));
                            }
                            
                            indices.push(vCount, vCount+1, vCount+2);
                            indices.push(vCount+2, vCount+3, vCount);
                            
                            vCount += 4;
                        }
                    }
                    
                    if (isTrans) transVertexCount = vCount;
                    else opaqueVertexCount = vCount;
                }
            }
        }

        if (opaqueIndices.length > 0) {
            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.Float32BufferAttribute(opaquePositions, 3));
            geo.setAttribute('uv', new THREE.Float32BufferAttribute(opaqueUVs, 2));
            geo.setIndex(opaqueIndices);
            geo.computeVertexNormals();
            this.meshOpaque = new THREE.Mesh(geo, atlasMaterialOpaque);
            this.meshOpaque.userData = { chunk: this };
            this.meshOpaque.castShadow = true;
            this.meshOpaque.receiveShadow = true;
            this.scene.add(this.meshOpaque);
        }

        if (transIndices.length > 0) {
            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.Float32BufferAttribute(transPositions, 3));
            geo.setAttribute('uv', new THREE.Float32BufferAttribute(transUVs, 2));
            geo.setIndex(transIndices);
            geo.computeVertexNormals();
            this.meshTransparent = new THREE.Mesh(geo, atlasMaterialTransparent);
            this.meshTransparent.userData = { chunk: this };
            this.meshTransparent.receiveShadow = true;
            this.scene.add(this.meshTransparent);
        }
    }

    setBlock(worldX, worldY, worldZ, type, rebuildMesh = true) {
        const x = worldX - this.worldOffsetX;
        const z = worldZ - this.worldOffsetZ;
        const y = worldY;
        if (x < 0 || x >= CHUNK_SIZE || z < 0 || z >= CHUNK_SIZE || y < 0 || y >= MAX_HEIGHT) return;
        this._setLocal(x, y, z, type, true, rebuildMesh);
    }

    _setLocal(x, y, z, type, recordDiff, rebuildMesh = true) {
        const oldType = this.blocks[x][y][z];
        if (oldType === type) return;

        this.blocks[x][y][z] = type;
        if (recordDiff) {
            this.diffs.set(`${x},${y},${z}`, type);
        }
        
        if (rebuildMesh) {
            this.buildMesh();
        }
    }

    getBlock(worldX, worldY, worldZ) {
        const x = worldX - this.worldOffsetX;
        const z = worldZ - this.worldOffsetZ;
        const y = worldY;
        if (x < 0 || x >= CHUNK_SIZE || z < 0 || z >= CHUNK_SIZE || y < 0 || y >= MAX_HEIGHT) return null;
        return this.blocks[x][y][z];
    }

    getDiffsForSave() {
        return Array.from(this.diffs.entries()).map(([key, type]) => {
            const [x, y, z] = key.split(',').map(Number);
            return [x, y, z, type];
        });
    }

    applyDiffs(diffList) {
        for (const [x, y, z, type] of diffList) {
            this.blocks[x][y][z] = type;
        }
        this.buildMesh();
    }

    destroy() {
        if (this.meshOpaque) { this.scene.remove(this.meshOpaque); this.meshOpaque.geometry.dispose(); }
        if (this.meshTransparent) { this.scene.remove(this.meshTransparent); this.meshTransparent.geometry.dispose(); }
    }
}
