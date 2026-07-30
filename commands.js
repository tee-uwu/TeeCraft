import * as THREE from 'three';
import { ITEMS } from './items.js';

const CASTLE_SPAWN = { x: 8, y: 38, z: 8 };
const WORLD_SPAWN  = { x: 64, y: 38, z: 64 };

// ─── Cheat code state ───────────────────────────────────────────────────
export let cheats = {
    fly: false,
    godMode: false,
    noclip: false,
};

// ─── Command Console ────────────────────────────────────────────────────
let _player = null;
let _world  = null;
let _saveGame = null;
let _dayNight = null;

export function initCommands(player, world, saveGame, dayNight) {
    _player   = player;
    _world    = world;
    _saveGame = saveGame;
    _dayNight = dayNight;

    const consoleEl  = document.getElementById('command-console');
    const consoleOut = document.getElementById('console-output');
    const consoleForm = document.getElementById('console-form');
    const consoleInput = document.getElementById('console-input');
    if (!consoleEl || !consoleOut || !consoleForm || !consoleInput) return;

    // Open with / or K key while game is running
    document.addEventListener('keydown', (e) => {
        if (!document.pointerLockElement) return;
        if (e.code === 'KeyK' || e.key === '/') {
            e.preventDefault();
            document.exitPointerLock();
            consoleEl.classList.toggle('hidden');
            if (!consoleEl.classList.contains('hidden')) {
                consoleInput.value = '';
                consoleInput.focus();
            }
        }
        if (e.code === 'Escape') {
            consoleEl.classList.add('hidden');
        }
    });

    // Close with Escape when console is open
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Escape' && !consoleEl.classList.contains('hidden')) {
            consoleEl.classList.add('hidden');
        }
    });

    consoleForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const raw = consoleInput.value.trim();
        consoleInput.value = '';
        if (!raw) return;
        const result = runCommand(raw);
        consoleOut.textContent += `\n> ${raw}\n  ${result}`;
        consoleOut.scrollTop = consoleOut.scrollHeight;
    });
}

function log(msg) {
    const out = document.getElementById('console-output');
    if (out) {
        out.textContent += '\n  ' + msg;
        out.scrollTop = out.scrollHeight;
    }
}

function runCommand(raw) {
    const parts = raw.toLowerCase().trim().split(/\s+/);
    const cmd   = parts[0];

    switch (cmd) {

        // ── Navigation ────────────────────────────────────────────────
        case 'respawn':
        case 'castle':
        case '/respawn':
            if (!_player) return '❌ Game not loaded yet.';
            _player.teleportToCastle();
            return '🏰 Teleported back to the Castle Hub!';

        case 'world':
        case 'portal':
            if (!_player) return '❌ Game not loaded yet.';
            _player.teleportToWorld();
            return '🌍 Teleported through the Portal to the Open World!';

        case 'tp':
        case 'teleport': {
            if (!_player || parts.length < 4) return '❌ Usage: tp <x> <y> <z>';
            const [, x, y, z] = parts.map(Number);
            _player.camera.position.set(x, y, z);
            _player.velocity.set(0, 0, 0);
            return `📍 Teleported to (${x}, ${y}, ${z})`;
        }

        // ── Cheats / God mode ─────────────────────────────────────────
        case 'fly':
        case '/fly':
            if (!_player) return '❌ Game not loaded yet.';
            _player.isFlying = !_player.isFlying;
            cheats.fly = _player.isFlying;
            return _player.isFlying
                ? '🕊️ FLY MODE ON — Space to ascend, Shift to descend!'
                : '🦶 FLY MODE OFF — Back on the ground!';

        case 'pov':
        case '/pov':
        case 'thirdperson':
        case 'f5': {
            if (!_player) return '❌ Game not loaded yet.';
            const on = _player.toggleThirdPerson();
            // Refresh own skin on the self mesh if skin was uploaded after init
            if (on) {
                const skinData = localStorage.getItem('teecraft_skin_data');
                if (skinData && _player.selfGroup) _player._applySkinToSelf(skinData);
            }
            return on
                ? '👁️ THIRD-PERSON ON — See yourself from others\' perspective! (type pov again to go back)'
                : '🎯 FIRST-PERSON ON — Back to normal view!';
        }

        case 'god':
        case 'godmode':
            cheats.godMode = !cheats.godMode;
            return cheats.godMode
                ? '⚡ GOD MODE ON — Immortal & immune to damage!'
                : '💀 GOD MODE OFF — Normal survival mode.';

        case 'heal':
        case '/heal':
            if (!_player) return '❌ Game not loaded yet.';
            _player.health = 20;
            _player.hunger = 20;
            return '❤️ Health & Hunger fully restored!';

        case 'kill':
            if (!_player) return '❌ Game not loaded yet.';
            _player.damage(9999);
            return '💀 You have been slain.';

        // ── Items / Inventory ─────────────────────────────────────────
        case 'give': {
            if (!_player || parts.length < 2) return '❌ Usage: give <item_id> [count]';
            const itemId = parts[1];
            const count  = parseInt(parts[2]) || 1;
            if (!ITEMS[itemId]) return `❌ Unknown item: ${itemId}. Try: diamond_sword, iron_pickaxe, diamond, bread`;
            _player.inventory.addItem(itemId, count);
            return `✅ Gave ${count}x ${ITEMS[itemId]?.name || itemId}`;
        }

        case 'kit': {
            if (!_player) return '❌ Game not loaded yet.';
            const kitItems = [
                'diamond_sword', 'diamond_pickaxe', 'diamond_axe',
                'diamond_shovel', 'diamond_helmet', 'diamond_chestplate',
                'diamond_leggings', 'diamond_boots', 'bread', 'torch'
            ];
            kitItems.forEach(id => _player.inventory.addItem(id, 64));
            return '💎 DIAMOND KIT given — Full diamond armor + tools!';
        }

        case 'clear':
            document.getElementById('console-output').textContent = 'Console cleared.';
            return '';

        // ── Time ──────────────────────────────────────────────────────
        case 'day':
        case '/time':
            if (_dayNight) _dayNight.time = 0.28;
            return '☀️ Time set to Daytime!';

        case 'night':
            if (_dayNight) _dayNight.time = 0.72;
            return '🌙 Time set to Nighttime!';

        // ── Save ──────────────────────────────────────────────────────
        case 'save':
        case '/save':
            if (_saveGame && _player && _world && _dayNight) {
                const ok = _saveGame(_world, _player, _dayNight);
                return ok ? '💾 Game saved to cloud & local storage!' : '❌ Save failed.';
            }
            return '❌ Game not ready.';

        // ── Help ──────────────────────────────────────────────────────
        case 'help':
        case '?':
            return [
                '━━━━━━ TEECRAFT COMMAND HELP ━━━━━━',
                '📍 NAVIGATION:',
                '  respawn       → Teleport back to Castle Hub',
                '  world/portal  → Enter Portal to Open World',
                '  tp <x> <y> <z> → Teleport to coordinates',
                '',
                '⚡ CHEATS:',
                '  fly           → Toggle creative flight (Space=up, Shift=down)',
                '  pov           → Toggle third-person view (see yourself!)',
                '  god           → Toggle invincibility',
                '  heal          → Restore health & hunger',
                '  kill          → Kill yourself',
                '',
                '🎒 ITEMS:',
                '  give <item> [count] → Give item (e.g. give diamond_sword 1)',
                '  kit           → Full diamond starter kit',
                '',
                '⏰ TIME:',
                '  day / night   → Set world time',
                '  save          → Save game to cloud',
                '',
                '  Press K or / to open this console in-game.'
            ].join('\n');

        default:
            return `❌ Unknown command: "${cmd}". Type help for all commands.`;
    }
}
