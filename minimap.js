import * as THREE from 'three';

const minimapCanvas = document.getElementById('minimap');
const ctx = minimapCanvas ? minimapCanvas.getContext('2d') : null;

// Map block types to RGB colors
const BLOCK_COLORS = {
    'grass': '#5e9d34',
    'dirt': '#6b4e31',
    'stone': '#7d7d7d',
    'cobblestone': '#6b6b6b',
    'wood': '#5c4033',
    'planks': '#8b5a2b',
    'leaves': '#228b22',
    'water': '#2e75d3',
    'sand': '#eadd95',
    'bedrock': '#222222',
    'chest': '#c18536',
    'furnace': '#4a4a4a',
    'crafting_table': '#855627',
    'glass': '#a0d1e5'
};

// Colors for crops/farming
for (let i = 0; i <= 7; i++) BLOCK_COLORS['crop_' + i] = '#71b340';
BLOCK_COLORS['farmland'] = '#4a331a';

const MAP_RADIUS = 32; // blocks
const MAP_SIZE = MAP_RADIUS * 2;
let lastUpdate = 0;

export function showMinimap() {
    if (minimapCanvas) minimapCanvas.style.display = 'block';
}

export function hideMinimap() {
    if (minimapCanvas) minimapCanvas.style.display = 'none';
}

export function updateMinimap(dt, player, world) {
    if (!ctx) return;

    lastUpdate += dt;
    if (lastUpdate < 0.2) return; // Update 5 times a second
    lastUpdate = 0;

    const px = Math.floor(player.camera.position.x);
    const pz = Math.floor(player.camera.position.z);

    // Clear background
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 128, 128);

    const pixelScale = 128 / MAP_SIZE;

    // Draw the blocks
    for (let x = -MAP_RADIUS; x < MAP_RADIUS; x++) {
        for (let z = -MAP_RADIUS; z < MAP_RADIUS; z++) {
            const wx = px + x;
            const wz = pz + z;
            
            // Find highest block at this column (fast search from player Y up and down)
            let type = null;
            const py = Math.floor(player.camera.position.y);
            
            // Just check top-down from y=py+15 down to py-30
            for (let y = py + 15; y > Math.max(0, py - 30); y--) {
                const b = world.getBlock(wx, y, wz);
                if (b && b !== 'water') {
                    // Stop at first solid block, or if we hit water check if it's the surface
                    type = b;
                    break;
                } else if (b === 'water') {
                    type = b;
                    break;
                }
            }
            
            if (type) {
                ctx.fillStyle = BLOCK_COLORS[type] || '#ff00ff';
                ctx.fillRect((x + MAP_RADIUS) * pixelScale, (z + MAP_RADIUS) * pixelScale, pixelScale, pixelScale);
            }
        }
    }

    // Draw Waypoints
    if (player.waypointManager && player.waypointManager.waypoints) {
        for (const wp of player.waypointManager.waypoints) {
            const relX = wp.x - px;
            const relZ = wp.z - pz;
            if (Math.abs(relX) <= MAP_RADIUS && Math.abs(relZ) <= MAP_RADIUS) {
                const mx = (relX + MAP_RADIUS) * pixelScale;
                const mz = (relZ + MAP_RADIUS) * pixelScale;
                ctx.fillStyle = wp.color || '#38bdf8';
                ctx.beginPath();
                ctx.arc(mx, mz, 3.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#000000';
                ctx.lineWidth = 1;
                ctx.stroke();
            }
        }
    }

    // Draw player arrow in the center
    ctx.save();
    ctx.translate(64, 64);
    
    // Player Y rotation (yaw)
    // The camera rotation y is usually inverted in Three.js depending on order, let's use the forward vector.
    const dir = player.camera.getWorldDirection(new THREE.Vector3());
    const angle = Math.atan2(dir.x, dir.z);
    ctx.rotate(-angle + Math.PI); // Adjust pointing direction based on camera

    ctx.fillStyle = '#ff0000';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4, 5);
    ctx.lineTo(0, 3);
    ctx.lineTo(-4, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Draw Cardinal Directions
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ff5555';
    ctx.fillText('N', 64, 12);
    ctx.fillStyle = '#ffffff';
    ctx.fillText('S', 64, 116);
    ctx.fillText('E', 116, 64);
    ctx.fillText('W', 12, 64);
}
