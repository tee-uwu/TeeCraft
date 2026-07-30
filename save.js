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
        if (!world || !player || !player.camera) {
            const raw = localStorage.getItem(SAVE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                saveProgressToCloud(parsed);
                return true;
            }
            return false;
        }

        const data = {
            version: 1,
            seed: world.seed || 12345,
            time: (dayNight && typeof dayNight.time === 'number') ? dayNight.time : 0.28,
            chunkDiffs: (world.serializeChunkDiffs) ? world.serializeChunkDiffs() : {},
            blockEntities: (world.serializeBlockEntities) ? world.serializeBlockEntities() : [],
            player: {
                x: (player.camera && player.camera.position) ? player.camera.position.x : 8,
                y: (player.camera && player.camera.position) ? player.camera.position.y : 35,
                z: (player.camera && player.camera.position) ? player.camera.position.z : 8,
                rotX: (player.camera && player.camera.rotation) ? player.camera.rotation.x : 0,
                rotY: (player.camera && player.camera.rotation) ? player.camera.rotation.y : 0,
                health: (typeof player.health === 'number') ? player.health : 20,
                hunger: (typeof player.hunger === 'number') ? player.hunger : 20,
                inventory: (player.inventory && player.inventory.serialize) ? player.inventory.serialize() : [],
                activeSlot: player.activeSlot || 0
            }
        };
        localStorage.setItem(SAVE_KEY, JSON.stringify(data));
        saveProgressToCloud(data);
        return true;
    } catch (e) {
        console.warn('Save attempted with fallback:', e);
        try {
            const raw = localStorage.getItem(SAVE_KEY);
            if (raw) {
                saveProgressToCloud(JSON.parse(raw));
                return true;
            }
        } catch (err) {}
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
