import * as THREE from 'three';
import { WorldManager } from './world.js';
import { Player } from './player.js';
import { MobManager } from './mobs.js';
import { ui } from './ui.js';
import { audio } from './audio.js';
import { EntityManager } from './entities.js';
import { ParticleManager } from './particles.js';
import { hasSave, loadGame, clearSave, applySaveToWorld, applySaveToPlayer, saveGame } from './save.js';
import { showMinimap, hideMinimap, updateMinimap } from './minimap.js';
import { initSchematics } from './schematics.js';
import { MultiplayerManager } from './multiplayer.js';
import { initCommands, cheats } from './commands.js';
import { AmbientManager } from './ambient.js';
import { uploadSkin, loadMySkin, clearSkinCache } from './skin.js';

// --- 1. Scene & Core Setup ---
const scene = new THREE.Scene();
scene.background = new THREE.Color('#87CEEB');
scene.fog = new THREE.Fog('#87CEEB', 20, 60);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
directionalLight.position.set(100, 200, 100);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
directionalLight.shadow.camera.near = 0.5;
directionalLight.shadow.camera.far = 500;
directionalLight.shadow.camera.left = -100;
directionalLight.shadow.camera.right = 100;
directionalLight.shadow.camera.top = 100;
directionalLight.shadow.camera.bottom = -100;
scene.add(directionalLight);
scene.add(directionalLight.target);

// --- 2. Load save (if any) & build world/mobs/player ---
const existingSave = loadGame();

const world = new WorldManager(scene, existingSave ? existingSave.seed : undefined);
if (existingSave) applySaveToWorld(existingSave, world);

const mobManager = new MobManager(scene, world);
const entityManager = new EntityManager(scene, world);
const particleManager = new ParticleManager(scene);
const player = new Player(camera, world, document.body, mobManager, entityManager, particleManager);

initSchematics(world, player);

if (existingSave) {
    applySaveToPlayer(existingSave, player);
} else {
    world.update(8, 8);
    let spawnY = 35;
    for (let y = 60; y > 1; y--) {
        if (world.getBlock(8, y, 8) && world.getBlock(8, y, 8) !== 'water') {
            spawnY = y + 1.05 + player.height;
            break;
        }
    }
    camera.position.set(8, spawnY, 8);
    player.fallStartY = null;
    player.onGround = true;
}

const dayNight = { time: existingSave && typeof existingSave.time === 'number' ? existingSave.time : 0.28 };
const DAY_LENGTH = 600; // seconds for a full day/night cycle

const multiplayer = new MultiplayerManager(scene, world, player);
const ambient = new AmbientManager(scene);

// Spawn player at Castle on new game
if (!existingSave) {
    player.teleportToCastle();
}

// Commands / Cheat Console init
initCommands(player, world, saveGame, dayNight);

const manualSaveBtn = document.getElementById('manual-save-btn');
if (manualSaveBtn) {
    manualSaveBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const ok = saveGame(world, player, dayNight);
        const toast = document.getElementById('save-toast');
        if (toast) {
            toast.textContent = ok ? '✅ Game Saved to Supabase Cloud & Local Storage!' : '❌ Save Failed';
            toast.classList.remove('hidden');
            setTimeout(() => toast.classList.add('hidden'), 3500);
        }
    });
}

player.onSleep = () => {
    // Only sleep if it's night (time is between 0.45 and 0.95 roughly)
    if (dayNight.time > 0.45 && dayNight.time < 0.95) {
        dayNight.time = 0.28; // fast-forward to morning
    }
};

// ─── Skin UI ─────────────────────────────────────────────────────────────────
function drawSkinPreview(dataUrl) {
    const canvas = document.getElementById('skin-preview-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const img = new Image();
    img.onload = () => {
        ctx.clearRect(0, 0, 64, 64);
        ctx.drawImage(img, 0, 0, 64, 64);
    };
    img.src = dataUrl;
}

// Load existing skin preview on open
loadMySkin().then(dataUrl => {
    if (dataUrl) {
        drawSkinPreview(dataUrl);
        const st = document.getElementById('skin-status');
        if (st) st.textContent = '✅ Custom skin active';
    }
});

const skinFileInput = document.getElementById('skin-file-input');
if (skinFileInput) {
    skinFileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const msg = document.getElementById('skin-upload-msg');
        const st  = document.getElementById('skin-status');
        if (msg) msg.textContent = '⏳ Uploading skin…';
        if (st) st.textContent = 'Uploading…';

        const result = await uploadSkin(file);

        if (result.error) {
            if (msg) msg.style.color = '#ff5555';
            if (msg) msg.textContent = `❌ ${result.error}`;
        } else {
            if (msg) { msg.style.color = '#55ff55'; msg.textContent = '✅ Skin uploaded & saved! Restart game to see it on your avatar.'; }
            if (st)  st.textContent = '✅ Custom skin active';
            drawSkinPreview(result.dataUrl);
            // Push new skin to multiplayer immediately
            if (multiplayer) multiplayer.mySkinDataUrl = result.dataUrl;
        }
        e.target.value = '';
    });
}

const skinResetBtn = document.getElementById('skin-reset-btn');
if (skinResetBtn) {
    skinResetBtn.addEventListener('click', () => {
        clearSkinCache();
        if (multiplayer) multiplayer.mySkinDataUrl = null;
        const canvas = document.getElementById('skin-preview-canvas');
        if (canvas) canvas.getContext('2d').clearRect(0, 0, 64, 64);
        const st  = document.getElementById('skin-status');
        const msg = document.getElementById('skin-upload-msg');
        if (st)  st.textContent = 'No custom skin set';
        if (msg) { msg.style.color = '#aaa'; msg.textContent = 'Skin reset to default.'; }
    });
}
// --- 3. UI wiring: blocker / start screen ---
const blocker = document.getElementById('blocker');
const hotbar = document.getElementById('hotbar');
const newWorldBtn = document.getElementById('new-world-btn');
const continueBtn = document.getElementById('continue-btn');
const playHint = document.getElementById('play-hint');

if (existingSave) {
    playHint.textContent = 'A saved world was found';
    newWorldBtn.classList.remove('hidden');
    continueBtn.classList.remove('hidden');
    continueBtn.addEventListener('click', (e) => { e.stopPropagation(); player.controls.lock(); });
    newWorldBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        clearSave();
        location.reload();
    });
} else {
    newWorldBtn.classList.add('hidden');
    continueBtn.classList.add('hidden');
}

import { getCurrentUser } from './auth.js';

blocker.addEventListener('click', async () => {
    const user = await getCurrentUser();
    if (!user) return; // Must be logged in to play
    if (!ui.anyScreenOpen() && player.alive) {
        player.controls.lock();
    }
});
renderer.domElement.addEventListener('click', async () => {
    const user = await getCurrentUser();
    if (!user) return; // Must be logged in to play
    if (!ui.anyScreenOpen() && player.alive && !player.controls.isLocked) {
        player.controls.lock();
    }
});

player.controls.addEventListener('lock', () => {
    blocker.style.display = 'none';
    ui.crosshair.style.display = 'block';
    hotbar.style.display = 'flex';
    const coordsHud = document.getElementById('coords-hud');
    const vitalsHud = document.getElementById('vitals-hud');
    if (coordsHud) coordsHud.style.display = 'flex';
    if (vitalsHud) vitalsHud.style.display = 'flex';
    showMinimap();
    audio.init();
    audio.resume();
    audio.startMusic();
});

player.controls.addEventListener('unlock', () => {
    hideMinimap();
    if (!ui.anyScreenOpen() && player.alive) {
        blocker.style.display = 'flex';
        ui.crosshair.style.display = 'none';
        hotbar.style.display = 'none';
        const coordsHud = document.getElementById('coords-hud');
        const vitalsHud = document.getElementById('vitals-hud');
        if (coordsHud) coordsHud.style.display = 'none';
        if (vitalsHud) vitalsHud.style.display = 'none';
    }
});

let isRaining = false;
let weatherFade = 0;
let weatherTimer = 0;

document.addEventListener('keydown', (e) => {
    if (e.code === 'KeyM') {
        audio.setEnabled(!audio.enabled);
    }
    if (e.code === 'KeyB') {
        if (ui.screen === 'waypoint') {
            ui.closeAllScreens();
            player.controls.lock();
        } else if (!ui.anyScreenOpen() && player.alive) {
            ui.openWaypointScreen();
            player.controls.unlock();
        }
    }
    if (e.code === 'F3') {
        e.preventDefault();
        ui.toggleDebugCoords();
    }
    if (e.code === 'F4') {
        e.preventDefault();
        isRaining = !isRaining;
        weatherTimer = 0;
    }
});

const volSlider = document.getElementById('volume-slider');
if (volSlider) {
    volSlider.addEventListener('input', (e) => {
        audio.setVolume(parseFloat(e.target.value));
    });
}

const renderSlider = document.getElementById('render-dist-slider');
const renderVal = document.getElementById('render-dist-val');
if (renderSlider) {
    renderSlider.value = world.renderDistance;
    renderVal.textContent = world.renderDistance;
    renderSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        world.renderDistance = val;
        renderVal.textContent = val;
    });
}

const sensSlider = document.getElementById('sens-slider');
const sensVal = document.getElementById('sens-val');
if (sensSlider) {
    sensSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        player.controls.pointerSpeed = val;
        sensVal.textContent = val.toFixed(1);
    });
}

window.addEventListener('beforeunload', () => {
    saveGame(world, player, dayNight);
});

// --- 4. Day/night lighting ---
const DAY_COLOR = new THREE.Color('#87CEEB');
const NIGHT_COLOR = new THREE.Color('#0a1128');
const RAIN_COLOR = new THREE.Color('#4a5e6d');
const _skyColor = new THREE.Color();

const DAY_CYCLE_MS = 600000; // 10 minutes per full 24h Day/Night cycle

function updateDayNight(dt) {
    // Globally synchronized UTC Epoch Time (Identical for all multiplayer players worldwide)
    dayNight.time = (Date.now() % DAY_CYCLE_MS) / DAY_CYCLE_MS;
    const sunHeight = Math.sin(dayNight.time * Math.PI * 2);
    const dayFactor = Math.max(0, sunHeight);

    // Weather state machine
    weatherTimer += dt;
    if (weatherTimer > 300) { // Check roughly every 5 mins
        weatherTimer = 0;
        if (Math.random() < 0.3) isRaining = !isRaining;
    }

    if (isRaining && weatherFade < 1) weatherFade = Math.min(1, weatherFade + dt * 0.5);
    else if (!isRaining && weatherFade > 0) weatherFade = Math.max(0, weatherFade - dt * 0.5);

    const angle = dayNight.time * Math.PI * 2;
    directionalLight.position.set(Math.cos(angle) * 120, Math.max(sunHeight, 0.06) * 150 + 20, Math.sin(angle) * 60 + 40);
    directionalLight.target.position.set(camera.position.x, camera.position.y, camera.position.z);
    
    directionalLight.intensity = (0.15 + dayFactor * 0.55) * (1 - weatherFade * 0.6);
    ambientLight.intensity = (0.22 + dayFactor * 0.6) * (1 - weatherFade * 0.3);

    const t = Math.max(0, Math.min(1, (sunHeight + 0.2) / 1.2));
    _skyColor.lerpColors(NIGHT_COLOR, DAY_COLOR, t);
    
    if (weatherFade > 0) {
        _skyColor.lerp(RAIN_COLOR, weatherFade * 0.8);
    }

    if (player && player.wasUnderwater) {
        const underwaterCol = new THREE.Color(0x0e508c);
        scene.background = new THREE.Color(0x0a3860);
        scene.fog.color = underwaterCol;
        scene.fog.near = 2;
        scene.fog.far = 24;
    } else {
        const rDist = world ? world.renderDistance : 6;
        scene.background = _skyColor;
        scene.fog.color = _skyColor;
        scene.fog.near = rDist * 16 * 0.7;
        scene.fog.far = rDist * 16 * 1.6;
    }

    return sunHeight < 0.05;
}

// --- 5. Main Game Loop ---
let prevTime = performance.now();
let autosaveTimer = 0;

function animate() {
    requestAnimationFrame(animate);

    const time = performance.now();
    const dt = Math.min((time - prevTime) / 1000, 0.1);
    prevTime = time;

    const isNight = updateDayNight(dt);

    world.update(camera.position.x, camera.position.z);
    world.updateEntities(dt);

    player.update(dt);

    if (player.alive) {
        mobManager.update(dt, camera.position, isNight, (dmg) => player.damage(dmg));
        entityManager.update(dt, player);
    }
    particleManager.update(dt);
    multiplayer.update(dt);
    ambient.update(dt, camera.position);

    // God mode — keep health/hunger full
    if (cheats.godMode) {
        player.health = 20;
        player.hunger = 20;
        player.invulnTimer = 1;
    }

    ui.tick(dt);
    ui.updateCoords(player, mobManager, entityManager);
    if (player.alive && document.pointerLockElement) {
        updateMinimap(dt, player, world);
    }

    if (weatherFade > 0.1) {
        particleManager.spawnRain(camera.position.x, camera.position.y, camera.position.z, Math.floor(weatherFade * 15));
        if (weatherFade > 0.5) audio.setRain(true);
    } else {
        audio.setRain(false);
    }

    autosaveTimer += dt;
    if (autosaveTimer > 20) {
        autosaveTimer = 0;
        saveGame(world, player, dayNight);
    }

    renderer.render(scene, camera);
}

animate();
