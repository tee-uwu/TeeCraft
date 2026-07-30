import * as THREE from 'three';
import { blockTypes, ITEMS } from './items.js';

export { blockTypes };

function makeCanvas(size = 16) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    return canvas;
}

function drawNoise(ctx, size, color1, color2, prob = 0.5) {
    ctx.fillStyle = color1;
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
            if (Math.random() > prob) {
                ctx.fillStyle = color2;
                ctx.fillRect(i, j, 1, 1);
            }
        }
    }
}

export const textureNames = [
    'grassTop', 'grassSide', 'dirt', 'stone', 'cobblestone', 'wood', 'woodTop',
    'planks', 'leaves', 'sand', 'glass', 'water', 'coal_ore', 'iron_ore',
    'diamond_ore', 'craftingSide', 'craftingTop', 'furnaceSide', 'furnaceFront',
    'furnaceTop', 'chestFront', 'chestSide', 'chestTop', 'bedrock', 'snow', 'wool', 'farmlandTop', 'farmlandSide',
    'crop_0', 'crop_1', 'crop_2', 'crop_3', 'bedSide', 'bedTop', 'enchantingTop', 'enchantingSide'
];

export const textures = {};
export const atlasUVs = {};

// Build Atlas
const ATLAS_SIZE = 256;
const TILE_SIZE = 16;
const atlasCanvas = document.createElement('canvas');
atlasCanvas.width = ATLAS_SIZE;
atlasCanvas.height = ATLAS_SIZE;
const atlasCtx = atlasCanvas.getContext('2d');

let atlasIndex = 0;
const TILES_PER_ROW = ATLAS_SIZE / TILE_SIZE;

textureNames.forEach(name => {
    // We still create the standalone canvas to draw the art, but we paint it to the atlas
    const canvas = makeCanvas(TILE_SIZE);
    const ctx = canvas.getContext('2d');
    
    // The previous switch statement logic is encapsulated in a helper below
    drawPixelTexture(ctx, name); 
    
    const col = atlasIndex % TILES_PER_ROW;
    const row = Math.floor(atlasIndex / TILES_PER_ROW);
    const px = col * TILE_SIZE;
    const py = row * TILE_SIZE;
    
    atlasCtx.drawImage(canvas, px, py);
    
    // Note: V is flipped in WebGL (0 is bottom).
    const u0 = px / ATLAS_SIZE;
    const v1 = 1.0 - (py / ATLAS_SIZE);
    const u1 = (px + TILE_SIZE) / ATLAS_SIZE;
    const v0 = 1.0 - ((py + TILE_SIZE) / ATLAS_SIZE);
    
    atlasUVs[name] = [u0, v0, u1, v1];
    
    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    textures[name] = tex;
    
    atlasIndex++;
});

export const atlasTexture = new THREE.CanvasTexture(atlasCanvas);
atlasTexture.magFilter = THREE.NearestFilter;
atlasTexture.minFilter = THREE.NearestFilter;
atlasTexture.colorSpace = THREE.SRGBColorSpace;

export const atlasMaterialOpaque = new THREE.MeshLambertMaterial({ map: atlasTexture });
export const atlasMaterialTransparent = new THREE.MeshLambertMaterial({ map: atlasTexture, transparent: true, opacity: 0.8, alphaTest: 0.1 });

// Maps block type -> [right, left, top, bottom, front, back] texture names
export const blockFaces = {
    grass: ['grassSide', 'grassSide', 'grassTop', 'dirt', 'grassSide', 'grassSide'],
    dirt: ['dirt', 'dirt', 'dirt', 'dirt', 'dirt', 'dirt'],
    stone: ['stone', 'stone', 'stone', 'stone', 'stone', 'stone'],
    cobblestone: ['cobblestone', 'cobblestone', 'cobblestone', 'cobblestone', 'cobblestone', 'cobblestone'],
    wood: ['wood', 'wood', 'woodTop', 'woodTop', 'wood', 'wood'],
    planks: ['planks', 'planks', 'planks', 'planks', 'planks', 'planks'],
    leaves: ['leaves', 'leaves', 'leaves', 'leaves', 'leaves', 'leaves'],
    sand: ['sand', 'sand', 'sand', 'sand', 'sand', 'sand'],
    glass: ['glass', 'glass', 'glass', 'glass', 'glass', 'glass'],
    water: ['water', 'water', 'water', 'water', 'water', 'water'],
    coal_ore: ['coal_ore', 'coal_ore', 'coal_ore', 'coal_ore', 'coal_ore', 'coal_ore'],
    iron_ore: ['iron_ore', 'iron_ore', 'iron_ore', 'iron_ore', 'iron_ore', 'iron_ore'],
    diamond_ore: ['diamond_ore', 'diamond_ore', 'diamond_ore', 'diamond_ore', 'diamond_ore', 'diamond_ore'],
    crafting_table: ['craftingSide', 'craftingSide', 'craftingTop', 'planks', 'craftingSide', 'craftingSide'],
    furnace: ['furnaceSide', 'furnaceSide', 'furnaceTop', 'furnaceTop', 'furnaceFront', 'furnaceSide'],
    chest: ['chestSide', 'chestSide', 'chestTop', 'chestTop', 'chestFront', 'chestSide'],
    bedrock: ['bedrock', 'bedrock', 'bedrock', 'bedrock', 'bedrock', 'bedrock'],
    snow: ['snow', 'snow', 'snow', 'snow', 'snow', 'snow'],
    wool: ['wool', 'wool', 'wool', 'wool', 'wool', 'wool'],
    farmland: ['farmlandSide', 'farmlandSide', 'farmlandTop', 'dirt', 'farmlandSide', 'farmlandSide'],
    crop_0: ['crop_0', 'crop_0', 'crop_0', 'crop_0', 'crop_0', 'crop_0'],
    crop_1: ['crop_1', 'crop_1', 'crop_1', 'crop_1', 'crop_1', 'crop_1'],
    crop_2: ['crop_2', 'crop_2', 'crop_2', 'crop_2', 'crop_2', 'crop_2'],
    crop_3: ['crop_3', 'crop_3', 'crop_3', 'crop_3', 'crop_3', 'crop_3'],
    stone_slab: ['stone', 'stone', 'stone', 'stone', 'stone', 'stone'],
    wood_slab: ['planks', 'planks', 'planks', 'planks', 'planks', 'planks'],
    stone_stairs: ['stone', 'stone', 'stone', 'stone', 'stone', 'stone'],
    wood_stairs: ['planks', 'planks', 'planks', 'planks', 'planks', 'planks'],
    bed: ['bedSide', 'bedSide', 'bedTop', 'planks', 'bedSide', 'bedSide'],
    enchanting_table: ['enchantingSide', 'enchantingSide', 'enchantingTop', 'bedrock', 'enchantingSide', 'enchantingSide']
};

function drawPixelTexture(ctx, type) {
    switch (type) {
        case 'enchantingTop':
            drawNoise(ctx, 16, '#1e102a', '#100818', 0.5);
            ctx.fillStyle = '#ff3366';
            ctx.fillRect(4, 4, 8, 8); // Red book in center
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(6, 6, 4, 4);
            break;
        case 'enchantingSide':
            drawNoise(ctx, 16, '#1e102a', '#100818', 0.5);
            ctx.fillStyle = '#5a3d75';
            ctx.fillRect(0, 0, 16, 4); // Decorative trim
            break;
        case 'grassTop':
            drawNoise(ctx, 16, '#4f7a28', '#5e9130', 0.5);
            break;
        case 'grassSide':
            drawNoise(ctx, 16, '#6b4d29', '#543c1f', 0.5);
            ctx.fillStyle = '#4f7a28';
            ctx.fillRect(0, 0, 16, 4);
            for(let i=0; i<16; i++) {
                if (Math.random() > 0.3) ctx.fillRect(i, 4, 1, 1 + Math.floor(Math.random() * 3));
            }
            break;
        case 'dirt':
            drawNoise(ctx, 16, '#6b4d29', '#543c1f', 0.5);
            break;
        case 'stone':
            drawNoise(ctx, 16, '#7d7d7d', '#6a6a6a', 0.4);
            break;
        case 'cobblestone':
            drawNoise(ctx, 16, '#5e5e5e', '#454545', 0.3);
            ctx.strokeStyle = '#333';
            ctx.strokeRect(0, 0, 8, 8); ctx.strokeRect(8, 8, 8, 8);
            ctx.strokeRect(8, 0, 8, 8); ctx.strokeRect(0, 8, 8, 8);
            break;
        case 'wood':
            drawNoise(ctx, 16, '#5c4028', '#422c19', 0.6);
            ctx.fillStyle = '#302010';
            for(let i=1; i<16; i+=3) ctx.fillRect(i, 0, 1, 16);
            break;
        case 'woodTop':
            drawNoise(ctx, 16, '#9c7951', '#85633f', 0.3);
            ctx.strokeStyle = '#5c4028'; ctx.beginPath();
            ctx.arc(8, 8, 3, 0, Math.PI*2); ctx.stroke();
            ctx.beginPath(); ctx.arc(8, 8, 6, 0, Math.PI*2); ctx.stroke();
            break;
        case 'planks':
            drawNoise(ctx, 16, '#a88151', '#946d3b', 0.2);
            ctx.fillStyle = '#6b4d29';
            ctx.fillRect(0, 3, 16, 1); ctx.fillRect(0, 7, 16, 1);
            ctx.fillRect(0, 11, 16, 1); ctx.fillRect(0, 15, 16, 1);
            ctx.fillRect(4, 0, 1, 3); ctx.fillRect(10, 4, 1, 3);
            ctx.fillRect(2, 8, 1, 3); ctx.fillRect(12, 12, 1, 3);
            break;
        case 'leaves':
            drawNoise(ctx, 16, '#2d5c1e', '#1a3b10', 0.6);
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            for(let i=0; i<16; i++) {
                for(let j=0; j<16; j++) {
                    if (Math.random() > 0.7) ctx.fillRect(i, j, 1, 1);
                }
            }
            break;
        case 'sand':
            drawNoise(ctx, 16, '#d6cd98', '#c4b97a', 0.6);
            break;
        case 'glass':
            ctx.fillStyle = 'rgba(200, 230, 255, 0.2)';
            ctx.fillRect(0, 0, 16, 16);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.lineWidth = 1;
            ctx.strokeRect(0, 0, 16, 16);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.fillRect(2, 2, 4, 1); ctx.fillRect(2, 3, 1, 3);
            break;
        case 'water':
            ctx.fillStyle = 'rgba(40, 80, 200, 0.8)';
            ctx.fillRect(0, 0, 16, 16);
            drawNoise(ctx, 16, 'rgba(60, 100, 220, 0.8)', 'rgba(30, 60, 180, 0.8)', 0.5);
            break;
        case 'coal_ore':
            drawNoise(ctx, 16, '#7d7d7d', '#6a6a6a', 0.4);
            ctx.fillStyle = '#111';
            ctx.fillRect(3, 3, 2, 2); ctx.fillRect(10, 2, 2, 2);
            ctx.fillRect(4, 11, 2, 2); ctx.fillRect(11, 10, 2, 2);
            ctx.fillRect(7, 7, 2, 2);
            break;
        case 'iron_ore':
            drawNoise(ctx, 16, '#7d7d7d', '#6a6a6a', 0.4);
            ctx.fillStyle = '#d4b794';
            ctx.fillRect(2, 4, 3, 2); ctx.fillRect(10, 3, 2, 3);
            ctx.fillRect(5, 10, 3, 2); ctx.fillRect(11, 11, 2, 2);
            ctx.fillRect(7, 6, 2, 3);
            break;
        case 'diamond_ore':
            drawNoise(ctx, 16, '#7d7d7d', '#6a6a6a', 0.4);
            ctx.fillStyle = '#3cebf0';
            ctx.fillRect(3, 3, 2, 2); ctx.fillRect(11, 2, 2, 2);
            ctx.fillRect(2, 11, 2, 2); ctx.fillRect(10, 12, 2, 2);
            ctx.fillRect(7, 7, 3, 2);
            break;
        case 'craftingSide':
            drawNoise(ctx, 16, '#a88151', '#946d3b', 0.2);
            ctx.fillStyle = '#5c4028'; ctx.fillRect(0, 0, 16, 2);
            ctx.fillRect(0, 0, 2, 16); ctx.fillRect(14, 0, 2, 16);
            break;
        case 'craftingTop':
            drawNoise(ctx, 16, '#a88151', '#946d3b', 0.2);
            ctx.fillStyle = '#78471c';
            ctx.fillRect(0, 0, 16, 16);
            ctx.fillStyle = '#a88151';
            ctx.fillRect(2, 2, 4, 4); ctx.fillRect(10, 2, 4, 4);
            ctx.fillRect(2, 10, 4, 4); ctx.fillRect(10, 10, 4, 4);
            break;
        case 'furnaceSide':
            drawNoise(ctx, 16, '#5e5e5e', '#454545', 0.3);
            ctx.strokeStyle = '#333'; ctx.strokeRect(0, 0, 16, 16);
            break;
        case 'furnaceFront':
            drawNoise(ctx, 16, '#5e5e5e', '#454545', 0.3);
            ctx.strokeStyle = '#333'; ctx.strokeRect(0, 0, 16, 16);
            ctx.fillStyle = '#222'; ctx.fillRect(3, 9, 10, 5);
            ctx.fillStyle = '#111'; ctx.fillRect(4, 2, 8, 4);
            ctx.fillStyle = '#ff6600'; ctx.fillRect(5, 11, 6, 2);
            break;
        case 'furnaceTop':
            drawNoise(ctx, 16, '#5e5e5e', '#454545', 0.3);
            ctx.strokeStyle = '#333'; ctx.strokeRect(0, 0, 16, 16);
            break;
        case 'chestFront':
            drawNoise(ctx, 16, '#9c7951', '#85633f', 0.2);
            ctx.fillStyle = '#5c4028';
            ctx.fillRect(0, 0, 16, 1); ctx.fillRect(0, 15, 16, 1);
            ctx.fillRect(0, 0, 1, 16); ctx.fillRect(15, 0, 1, 16);
            ctx.fillRect(0, 7, 16, 1);
            ctx.fillStyle = '#d6cd98';
            ctx.fillRect(7, 6, 2, 4);
            break;
        case 'chestSide':
            drawNoise(ctx, 16, '#9c7951', '#85633f', 0.2);
            ctx.fillStyle = '#5c4028';
            ctx.fillRect(0, 0, 16, 1); ctx.fillRect(0, 15, 16, 1);
            ctx.fillRect(0, 0, 1, 16); ctx.fillRect(15, 0, 1, 16);
            ctx.fillRect(0, 7, 16, 1);
            break;
        case 'chestTop':
            drawNoise(ctx, 16, '#9c7951', '#85633f', 0.2);
            ctx.fillStyle = '#5c4028';
            ctx.fillRect(0, 0, 16, 1); ctx.fillRect(0, 15, 16, 1);
            ctx.fillRect(0, 0, 1, 16); ctx.fillRect(15, 0, 1, 16);
            break;
        case 'bedTop':
            ctx.fillStyle = '#b03030';
            ctx.fillRect(0, 0, 16, 8);
            ctx.fillStyle = '#e0e0e0';
            ctx.fillRect(0, 8, 16, 8);
            break;
        case 'bedSide':
            ctx.fillStyle = '#85633f';
            ctx.fillRect(0, 0, 16, 16);
            ctx.fillStyle = '#b03030';
            ctx.fillRect(0, 0, 16, 5);
            ctx.fillStyle = '#e0e0e0';
            ctx.fillRect(0, 5, 16, 3);
            break;
        case 'bedrock':
            drawNoise(ctx, 16, '#3a3a3a', '#222222', 0.4);
            break;
        case 'snow':
            drawNoise(ctx, 16, '#ffffff', '#e0e0e0', 0.8);
            break;
        case 'wool':
            drawNoise(ctx, 16, '#e8e8e8', '#d0d0d0', 0.6);
            ctx.fillStyle = '#b0b0b0';
            ctx.fillRect(4, 4, 1, 2); ctx.fillRect(10, 8, 2, 1);
            break;
        case 'farmlandTop':
            drawNoise(ctx, 16, '#543c1f', '#46321a', 0.5);
            ctx.fillStyle = '#3d2b16';
            ctx.fillRect(0, 3, 16, 2); ctx.fillRect(0, 11, 16, 2);
            break;
        case 'farmlandSide':
            drawNoise(ctx, 16, '#6b4d29', '#543c1f', 0.5);
            ctx.fillStyle = '#543c1f';
            ctx.fillRect(0, 0, 16, 4);
            break;
        case 'crop_0':
            ctx.fillStyle = '#5e9130';
            ctx.fillRect(6, 12, 4, 4);
            break;
        case 'crop_1':
            ctx.fillStyle = '#5e9130';
            ctx.fillRect(6, 8, 4, 8);
            ctx.fillRect(4, 10, 2, 6); ctx.fillRect(10, 10, 2, 6);
            break;
        case 'crop_2':
            ctx.fillStyle = '#7ebd42';
            ctx.fillRect(6, 4, 4, 12);
            ctx.fillRect(4, 6, 2, 10); ctx.fillRect(10, 6, 2, 10);
            ctx.fillStyle = '#d6cd98';
            ctx.fillRect(6, 4, 4, 2);
            break;
        case 'crop_3':
            ctx.fillStyle = '#c4b97a';
            ctx.fillRect(6, 0, 4, 16);
            ctx.fillRect(4, 2, 2, 14); ctx.fillRect(10, 2, 2, 14);
            ctx.fillStyle = '#d6cd98';
            ctx.fillRect(6, 0, 4, 4);
            break;
    }
}

// -----------------------------------------------------------------------
// Icons (for hotbar / inventory / crafting UI). Blocks reuse their world
// texture; everything else gets a small hand-drawn canvas icon.
// -----------------------------------------------------------------------

function faceIconSrc(type) {
    if (type === 'grass') return textures.grassSide.image;
    if (type === 'wood') return textures.wood.image;
    if (type === 'crafting_table') return textures.craftingSide.image;
    if (type === 'furnace') return textures.furnaceFront.image;
    if (type === 'chest') return textures.chestFront.image;
    return textures[type] ? textures[type].image : null;
}

function drawToolIcon(ctx, tier, kind) {
    const tierColor = { wood: '#a17038', stone: '#9a9a9a', iron: '#e0e0e0' }[tier];
    const stickColor = '#8a5a2b';
    ctx.strokeStyle = stickColor;
    ctx.lineWidth = 2;
    ctx.save();
    ctx.translate(16, 16);
    ctx.rotate(Math.PI / 4);
    ctx.beginPath(); ctx.moveTo(-2, 0); ctx.lineTo(-2, 13); ctx.stroke();
    ctx.fillStyle = tierColor;
    if (kind === 'pickaxe') {
        ctx.fillRect(-11, -13, 22, 6);
        ctx.fillRect(-11, -13, 6, 6);
        ctx.fillRect(5, -13, 6, 6);
    } else if (kind === 'axe') {
        ctx.beginPath();
        ctx.moveTo(-2, -14); ctx.lineTo(10, -10); ctx.lineTo(8, 0); ctx.lineTo(-2, -4);
        ctx.closePath(); ctx.fill();
    } else if (kind === 'shovel') {
        ctx.fillRect(-6, -16, 12, 8);
    } else if (kind === 'sword') {
        ctx.fillStyle = tierColor;
        ctx.fillRect(-3, -18, 6, 20);
        ctx.fillStyle = '#555';
        ctx.fillRect(-7, 0, 14, 3);
    } else if (kind === 'hoe') {
        ctx.fillRect(-8, -14, 12, 4);
        ctx.fillRect(-4, -14, 4, 6);
    } else if (tier === 'bow') {
        ctx.restore();
        ctx.save();
        ctx.strokeStyle = '#8a5a2b'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(16, 16, 12, -Math.PI/2, Math.PI/2); ctx.stroke();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(16, 4); ctx.lineTo(16, 28); ctx.stroke();
    }
    ctx.restore();
}

function drawMaterialIcon(ctx, id) {
    switch (id) {
        case 'stick':
            ctx.strokeStyle = '#8a5a2b'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(4, 28); ctx.lineTo(24, 6); ctx.stroke();
            break;
        case 'coal':
            ctx.fillStyle = '#1a1a1a';
            ctx.beginPath(); ctx.arc(16, 16, 9, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#3a3a3a'; ctx.fillRect(12, 12, 3, 3);
            break;
        case 'iron_ingot':
            ctx.fillStyle = '#e6d3b3';
            ctx.fillRect(7, 11, 18, 9);
            ctx.strokeStyle = '#b09570'; ctx.strokeRect(7, 11, 18, 9);
            break;
        case 'diamond':
            ctx.fillStyle = '#5decf5';
            ctx.beginPath();
            ctx.moveTo(16, 6); ctx.lineTo(25, 14); ctx.lineTo(16, 27); ctx.lineTo(7, 14);
            ctx.closePath(); ctx.fill();
            break;
        case 'feather':
            ctx.fillStyle = '#f2f2f2';
            ctx.beginPath();
            ctx.ellipse(16, 16, 5, 12, Math.PI / 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#ccc'; ctx.beginPath(); ctx.moveTo(11, 21); ctx.lineTo(21, 11); ctx.stroke();
            break;
        case 'seeds':
            ctx.fillStyle = '#5e9130';
            ctx.fillRect(12, 16, 4, 4); ctx.fillRect(20, 12, 4, 4); ctx.fillRect(8, 24, 4, 4);
            break;
        case 'wheat':
            ctx.fillStyle = '#d6cd98';
            ctx.fillRect(12, 4, 8, 24);
            ctx.fillStyle = '#c4b97a';
            ctx.fillRect(8, 8, 4, 16); ctx.fillRect(20, 8, 4, 16);
            break;
        case 'apple':
            ctx.fillStyle = '#d13030';
            ctx.beginPath(); ctx.arc(16, 18, 9, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#5a3d1e'; ctx.fillRect(15, 6, 2, 5);
            ctx.fillStyle = '#3a8a3a'; ctx.fillRect(17, 6, 5, 3);
            break;
        case 'raw_porkchop':
        case 'raw_beef':
            ctx.fillStyle = id === 'raw_beef' ? '#b5453f' : '#e8a0a8';
            ctx.beginPath(); ctx.ellipse(16, 16, 10, 7, -0.3, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(11, 11, 2, 4, -0.3, 0, Math.PI * 2); ctx.fill();
            break;
        case 'cooked_porkchop':
        case 'cooked_beef':
            ctx.fillStyle = '#7a4a2a';
            ctx.beginPath(); ctx.ellipse(16, 16, 10, 7, -0.3, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#5c3520'; ctx.beginPath(); ctx.ellipse(16, 16, 10, 7, -0.3, 0, Math.PI * 2); ctx.stroke();
            break;
        case 'raw_chicken':
            ctx.fillStyle = '#e8c9a0';
            ctx.beginPath(); ctx.ellipse(16, 16, 9, 7, 0, 0, Math.PI * 2); ctx.fill();
            break;
        case 'cooked_chicken':
            ctx.fillStyle = '#c98a3d';
            ctx.beginPath(); ctx.ellipse(16, 16, 9, 7, 0, 0, Math.PI * 2); ctx.fill();
            break;
        case 'arrow':
            ctx.strokeStyle = '#8a5a2b'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(6, 26); ctx.lineTo(24, 8); ctx.stroke();
            ctx.fillStyle = '#666'; ctx.fillRect(22, 6, 4, 4);
            ctx.fillStyle = '#fff'; ctx.fillRect(4, 24, 4, 4);
            break;
        case 'iron_helmet':
            ctx.fillStyle = '#e6d3b3'; ctx.fillRect(6, 6, 20, 14);
            ctx.clearRect(10, 12, 12, 8);
            break;
        case 'iron_chestplate':
            ctx.fillStyle = '#e6d3b3'; ctx.fillRect(6, 8, 20, 18);
            break;
        case 'iron_leggings':
            ctx.fillStyle = '#e6d3b3'; ctx.fillRect(8, 8, 16, 20);
            ctx.clearRect(12, 12, 8, 16);
            break;
        case 'iron_boots':
            ctx.fillStyle = '#e6d3b3'; ctx.fillRect(8, 18, 6, 10); ctx.fillRect(18, 18, 6, 10);
            break;
    }
}

export const uiIcons = {};

blockTypes.forEach(type => {
    if (type === 'water' || type === 'bedrock') return;
    const src = faceIconSrc(type);
    if (src) uiIcons[type] = src.toDataURL('image/png');
});

Object.keys(ITEMS).forEach(id => {
    if (uiIcons[id]) return; // already a block icon
    const canvas = makeCanvas(32);
    const ctx = canvas.getContext('2d');
    const item = ITEMS[id];
    if (item.category === 'tool') {
        const tier = id.split('_')[0];
        const kind = id.split('_')[1];
        drawToolIcon(ctx, tier, kind);
    } else {
        drawMaterialIcon(ctx, id);
    }
    uiIcons[id] = canvas.toDataURL('image/png');
});
