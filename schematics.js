import { CHUNK_SIZE, MAX_HEIGHT } from './chunk.js';

let schematicsData = null;

export async function loadSchematicsData() {
    if (schematicsData) return schematicsData;
    try {
        const resp = await fetch('./schematicsData.json');
        schematicsData = await resp.json();
        return schematicsData;
    } catch (e) {
        console.error('Failed to load schematicsData.json:', e);
        return null;
    }
}

export function spawnSchematic(world, schematic, startX, startY, startZ, types) {
    if (!schematic || !schematic.blocks) return;
    const modifiedChunks = new Set();
    const blocks = schematic.blocks;

    for (let i = 0; i < blocks.length; i++) {
        const [x, y, z, typeIdx] = blocks[i];
        const type = types[typeIdx];
        const wx = Math.floor(startX + x);
        const wy = Math.floor(startY + y);
        const wz = Math.floor(startZ + z);

        if (wy < 0 || wy >= MAX_HEIGHT) continue;

        const cx = Math.floor(wx / CHUNK_SIZE);
        const cz = Math.floor(wz / CHUNK_SIZE);
        const key = `${cx},${cz}`;
        modifiedChunks.add(key);

        const lx = wx - cx * CHUNK_SIZE;
        const lz = wz - cz * CHUNK_SIZE;

        if (!world.chunkDiffs.has(key)) {
            world.chunkDiffs.set(key, []);
        }
        world.chunkDiffs.get(key).push([lx, wy, lz, type]);

        const chunk = world.chunks.get(key);
        if (chunk) {
            chunk.setBlock(wx, wy, wz, type, false);
        }
    }

    for (const key of modifiedChunks) {
        const chunk = world.chunks.get(key);
        if (chunk) {
            chunk.buildMesh();
        }
    }
}

export async function initSchematics(world, player) {
    const data = await loadSchematicsData();
    if (!data) return;

    const types = data.types;

    // Spawn Small Castle structure near spawn
    const castleX = 30;
    const castleZ = 30;
    const castleY = 18;
    spawnSchematic(world, data.smallCastle, castleX, castleY, castleZ, types);

    // Spawn Hub & Big Farm structure
    const hubX = -150;
    const hubZ = -150;
    const hubY = 16;
    spawnSchematic(world, data.hub, hubX, hubY, hubZ, types);

    // Register Waypoints for navigation
    if (player && player.waypointManager) {
        const wps = player.waypointManager.waypoints;
        if (!wps.some(w => w.name === 'Small Castle')) {
            player.waypointManager.addWaypoint('Small Castle', castleX + 8, castleY + 2, castleZ + 8, '#c084fc');
        }
        if (!wps.some(w => w.name === 'Hub & Big Farm')) {
            player.waypointManager.addWaypoint('Hub & Big Farm', hubX + 150, hubY + 10, hubZ + 120, '#38bdf8');
        }
    }
}
