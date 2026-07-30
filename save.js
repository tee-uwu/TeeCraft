import { saveProgressToCloud } from './auth.js';

export const SAVE_KEY = 'teecraft_save_v1';

export function hasSave() {
    try {
        return !!localStorage.getItem(SAVE_KEY);
    } catch (e) {
        return false;
    }
}

export function saveGame(world, player, dayNight) {
    try {
        const data = {
            version: 1,
            seed: world.seed,
            time: dayNight.time,
            chunkDiffs: world.serializeChunkDiffs(),
            blockEntities: world.serializeBlockEntities(),
            player: {
                x: player.camera.position.x,
                y: player.camera.position.y,
                z: player.camera.position.z,
                rotX: player.camera.rotation.x,
                rotY: player.camera.rotation.y,
                health: player.health,
                hunger: player.hunger,
                inventory: player.inventory.serialize(),
                activeSlot: player.activeSlot
            }
        };
        localStorage.setItem(SAVE_KEY, JSON.stringify(data));
        saveProgressToCloud(data);
        return true;
    } catch (e) {
        console.warn('Save failed:', e);
        return false;
    }
}

export function loadGame() {
    try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch (e) {
        console.warn('Load failed:', e);
        return null;
    }
}

export function clearSave() {
    try {
        localStorage.removeItem(SAVE_KEY);
    } catch (e) { /* ignore */ }
}

export function applySaveToWorld(data, world) {
    world.loadChunkDiffs(data.chunkDiffs);
    world.loadBlockEntities(data.blockEntities);
}

export function applySaveToPlayer(data, player) {
    const p = data.player;
    if (!p) return;
    if ((p.x === 0 && p.y === 0 && p.z === 0) || p.y < 5) {
        player.camera.position.set(8, 35, 8);
    } else {
        player.camera.position.set(p.x, p.y, p.z);
    }
    player.camera.rotation.x = p.rotX || 0;
    player.camera.rotation.y = p.rotY || 0;
    player.health = p.health ?? 20;
    player.hunger = p.hunger ?? 20;
    player.inventory.deserialize(p.inventory);
    player.activeSlot = p.activeSlot || 0;
}
