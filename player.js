import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { ui } from './ui.js';
import { audio } from './audio.js';
import { Inventory } from './inventory.js';
import { WaypointManager } from './waypoints.js';
import {
    HARDNESS, PICKAXE_REQUIRED, BLOCK_TOOL_CATEGORY, TOOL_DAMAGE,
    getToolTier, getToolType, FOOD, ITEMS, UNBREAKABLE
} from './items.js';

const MAX_HEALTH = 20;
const MAX_HUNGER = 20;
const MAX_BREATH = 15;
const REACH = 6;

export class Player {
    constructor(camera, worldManager, domElement, mobManager, entityManager, particleManager) {
        this.camera = camera;
        this.world = worldManager;
        this.mobManager = mobManager;
        this.entityManager = entityManager;
        this.particleManager = particleManager;
        this.waypointManager = new WaypointManager(worldManager.scene);
        this.controls = new PointerLockControls(camera, domElement);
        this.scene = worldManager.scene;

        this.width = 0.6;
        this.height = 1.8;
        this.velocity = new THREE.Vector3();
        this.onGround = false;
        this.baseSpeed = 16.0; // Slower, smoother, realistic walking speed
        this.jumpSpeed = 8.8;
        this.gravity = 28.0;
        this.isFlying = false; // Creative flight mode cheat

        this._initHandModel();

        this.inventory = new Inventory();
        this.activeSlot = 0;
        this._giveStarterItems();

        this.health = MAX_HEALTH;
        this.hunger = MAX_HUNGER;
        this.breath = MAX_BREATH;
        this.alive = true;
        this.xp = 0;
        this.level = 0;

        this.hungerAccum = 0;
        this.regenAccum = 0;
        this.starveAccum = 0;
        this.drownAccum = 0;
        this.isSprinting = false;
        this.isCrouching = false;
        this.isSwimming = false;
        this.wasUnderwater = false;
        this.fallStartY = null;
        this.invulnTimer = 0;
        this.hurtFlashTimer = 0;

        this.leftDown = false;
        this.miningKey = null;
        this.miningProgress = 0;
        this.attackCooldown = 0;

        this.keys = { KeyW: false, KeyA: false, KeyS: false, KeyD: false, Space: false, ShiftLeft: false, ControlLeft: false };
        this.direction = new THREE.Vector3();

        document.addEventListener('keydown', (e) => this.onKeyDown(e));
        document.addEventListener('keyup', (e) => this.onKeyUp(e));

        this.raycaster = new THREE.Raycaster();
        document.addEventListener('contextmenu', e => e.preventDefault());
        document.addEventListener('mousedown', (e) => this.onMouseDown(e));
        document.addEventListener('mouseup', (e) => this.onMouseUp(e));

        this._buildTargetOutline();

        ui.attach(this);

        // ── Third-Person / POV mode ──────────────────────────────────────
        this.thirdPerson = false;
        this.thirdPersonDist = 4.5;  // camera distance behind player
        this.physicsPos = new THREE.Vector3(); // tracks true head position
        this.selfGroup = null;        // own 3D player mesh shown in 3rd person
        this._initSelfMesh();
    }

    _giveStarterItems() {
        this.inventory.addItem('wood_pickaxe', 1);
        this.inventory.addItem('wood_axe', 1);
        this.inventory.addItem('wood_sword', 1);
    }

    // ── Self mesh (shown in third-person POV) ─────────────────────────────────
    _initSelfMesh() {
        const group = new THREE.Group();

        const skinMat  = new THREE.MeshLambertMaterial({ color: 0xd4a373 });
        const shirtMat = new THREE.MeshLambertMaterial({ color: 0x2563eb });
        const pantsMat = new THREE.MeshLambertMaterial({ color: 0x1e3a8a });

        // Head
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), skinMat);
        head.position.y = 1.4;
        group.add(head);

        // Body
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.3), shirtMat);
        body.position.y = 0.8;
        group.add(body);

        // Arms
        const armGeo = new THREE.BoxGeometry(0.22, 0.65, 0.22);
        const rArm = new THREE.Mesh(armGeo, skinMat);
        rArm.position.set(-0.36, 0.82, 0);
        group.add(rArm);
        const lArm = new THREE.Mesh(armGeo, skinMat);
        lArm.position.set(0.36, 0.82, 0);
        group.add(lArm);

        // Legs
        const legGeo = new THREE.BoxGeometry(0.22, 0.75, 0.25);
        const rLeg = new THREE.Mesh(legGeo, pantsMat);
        rLeg.position.set(-0.13, 0.08, 0);
        group.add(rLeg);
        const lLeg = new THREE.Mesh(legGeo, pantsMat);
        lLeg.position.set(0.13, 0.08, 0);
        group.add(lLeg);

        group.visible = false; // hidden in first-person
        this.scene.add(group);
        this.selfGroup = group;

        // Try to apply own skin if already set in localStorage
        const skinData = localStorage.getItem('teecraft_skin_data');
        if (skinData) this._applySkinToSelf(skinData);
    }

    async _applySkinToSelf(dataUrl) {
        try {
            // Dynamic import to avoid circular deps
            const { buildSkinnedPlayer, loadSkinImage } = await import('./skin.js');
            const img = await loadSkinImage(dataUrl);
            const skinnedGroup = buildSkinnedPlayer(img);
            // Replace plain mesh children with skinned ones
            while (this.selfGroup.children.length) this.selfGroup.remove(this.selfGroup.children[0]);
            this.selfGroup.add(skinnedGroup);
        } catch (e) { /* keep default mesh */ }
    }

    toggleThirdPerson() {
        this.thirdPerson = !this.thirdPerson;
        if (this.selfGroup) this.selfGroup.visible = this.thirdPerson;
        // Hide first-person hand in third-person
        if (this.handGroup) this.handGroup.visible = !this.thirdPerson;
        return this.thirdPerson;
    }

    _updateThirdPersonCamera() {
        // Save true physics (head) position
        this.physicsPos.copy(this.camera.position);

        // Compute backward direction from camera yaw
        const forward = new THREE.Vector3();
        this.camera.getWorldDirection(forward);
        forward.y = 0;
        forward.normalize();

        // Camera goes behind & above player
        const camOffset = forward.clone().multiplyScalar(-this.thirdPersonDist);
        camOffset.y = this.thirdPersonDist * 0.55;

        const newCamPos = this.physicsPos.clone().add(camOffset);
        // Smooth camera transition
        this.camera.position.lerp(newCamPos, 0.18);

        // Place self mesh at feet (physicsPos - height)
        const feetY = this.physicsPos.y - this.height;
        this.selfGroup.position.set(this.physicsPos.x, feetY, this.physicsPos.z);

        // Rotate self mesh to face same direction as camera
        this.selfGroup.rotation.y = this.camera.rotation.y + Math.PI;

        // Animate walking arms/legs
        const moving = this.keys.KeyW || this.keys.KeyA || this.keys.KeyS || this.keys.KeyD;
        if (moving) {
            const t = Date.now() * 0.006;
            // Swing arms and legs
            const children = this.selfGroup.children[0]
                ? this.selfGroup.children[0].children
                : this.selfGroup.children;
            // Just rotate the whole group slightly for a walk bob
            this.selfGroup.rotation.z = Math.sin(t) * 0.02;
        } else {
            this.selfGroup.rotation.z = 0;
        }
    }

    _buildTargetOutline() {
        const geo = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.005, 1.005, 1.005));
        const mat = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });
        this.targetOutline = new THREE.LineSegments(geo, mat);
        this.targetOutline.visible = false;
        this.scene.add(this.targetOutline);
    }

    getActiveItem() {
        return this.inventory.slots[this.activeSlot];
    }

    getActiveItemId() {
        const item = this.getActiveItem();
        return item ? item.id : null;
    }

    addXp(amount) {
        this.xp += amount;
        let leveledUp = false;
        while (this.xp >= this.getXpNeeded()) {
            this.xp -= this.getXpNeeded();
            this.level++;
            leveledUp = true;
        }
        if (leveledUp) {
            if (audio.playLevelUp) audio.playLevelUp();
        } else {
            if (audio.playXp) audio.playXp();
        }
        ui.updateXpBar();
    }
    
    getXpNeeded() {
        return 10 + this.level * 5;
    }

    onKeyDown(e) {
        const code = e.code;
        const key = e.key ? e.key.toLowerCase() : '';

        if (code === 'KeyW' || code === 'ArrowUp' || key === 'w') this.keys.KeyW = true;
        if (code === 'KeyA' || code === 'ArrowLeft' || key === 'a') this.keys.KeyA = true;
        if (code === 'KeyS' || code === 'ArrowDown' || key === 's') this.keys.KeyS = true;
        if (code === 'KeyD' || code === 'ArrowRight' || key === 'd') this.keys.KeyD = true;
        if (code === 'Space' || key === ' ') this.keys.Space = true;
        if (code === 'ShiftLeft' || code === 'ShiftRight' || key === 'shift') this.keys.ShiftLeft = true;
        if (code === 'ControlLeft' || code === 'ControlRight' || key === 'control') this.keys.ControlLeft = true;

        if (e.code === 'KeyE' || key === 'e') {
            if (ui.anyScreenOpen()) {
                ui.closeAllScreens();
                this.controls.lock();
            } else if (this.controls.isLocked) {
                this.controls.unlock();
                ui.openInventory();
            }
        }
        if (e.code === 'Escape' || key === 'escape') {
            if (ui.anyScreenOpen()) ui.closeAllScreens();
        }
        if (e.code === 'KeyF' || key === 'f') {
            this.tryEat();
        }
    }

    onKeyUp(e) {
        const code = e.code;
        const key = e.key ? e.key.toLowerCase() : '';

        if (code === 'KeyW' || code === 'ArrowUp' || key === 'w') this.keys.KeyW = false;
        if (code === 'KeyA' || code === 'ArrowLeft' || key === 'a') this.keys.KeyA = false;
        if (code === 'KeyS' || code === 'ArrowDown' || key === 's') this.keys.KeyS = false;
        if (code === 'KeyD' || code === 'ArrowRight' || key === 'd') this.keys.KeyD = false;
        if (code === 'Space' || key === ' ') this.keys.Space = false;
        if (code === 'ShiftLeft' || code === 'ShiftRight' || key === 'shift') this.keys.ShiftLeft = false;
        if (code === 'ControlLeft' || code === 'ControlRight' || key === 'control') this.keys.ControlLeft = false;
    }

    onMouseDown(event) {
        audio.init();
        audio.resume();
        if (!this.controls.isLocked) return;

        if (event.button === 0) {
            this.leftDown = true;
            this.triggerHandSwing();
        } else if (event.button === 2) {
            this.handleRightClick();
        }
    }

    _initHandModel() {
        this.handGroup = new THREE.Group();
        this.camera.add(this.handGroup);

        const armGeo = new THREE.BoxGeometry(0.12, 0.45, 0.12);
        const armMat = new THREE.MeshStandardMaterial({ color: 0xd4a373, roughness: 0.8 });
        this.armMesh = new THREE.Mesh(armGeo, armMat);
        this.armMesh.position.set(0, 0, 0);
        this.armMesh.rotation.set(-0.35, -0.25, 0.2);
        this.handGroup.add(this.armMesh);

        const toolGeo = new THREE.BoxGeometry(0.09, 0.38, 0.09);
        const toolMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.5 });
        this.toolMesh = new THREE.Mesh(toolGeo, toolMat);
        this.toolMesh.position.set(-0.02, 0.22, -0.08);
        this.toolMesh.rotation.set(0.65, 0.2, -0.4);
        this.armMesh.add(this.toolMesh);

        this.handBasePos = new THREE.Vector3(0.36, -0.32, -0.52);
        this.handGroup.position.copy(this.handBasePos);

        this.swingTimer = 0;
        this.walkBobTimer = 0;
    }

    triggerHandSwing() {
        if (this.swingTimer <= 0) {
            this.swingTimer = 0.01;
        }
    }

    updateHandAnimation(dt) {
        if (!this.handGroup) return;

        const isMoving = (this.keys.KeyW || this.keys.KeyA || this.keys.KeyS || this.keys.KeyD) && this.onGround;
        if (isMoving) {
            this.walkBobTimer += dt * 8;
        } else {
            this.walkBobTimer = 0;
        }

        const bobX = Math.sin(this.walkBobTimer) * 0.02;
        const bobY = Math.abs(Math.cos(this.walkBobTimer)) * 0.025;

        if (this.leftDown) {
            this.swingTimer += dt * 8.5; // continuous chop while mining
        } else if (this.swingTimer > 0) {
            this.swingTimer += dt * 8.5;
            if (this.swingTimer >= Math.PI) this.swingTimer = 0;
        }

        const swingProgress = Math.sin(this.swingTimer % Math.PI);
        const swingRotX = -swingProgress * 0.85;
        const swingRotY = swingProgress * 0.45;
        const swingRotZ = swingProgress * 0.3;

        this.handGroup.position.set(
            this.handBasePos.x + bobX + swingProgress * -0.08,
            this.handBasePos.y - bobY + swingProgress * -0.06,
            this.handBasePos.z + swingProgress * -0.1
        );

        this.handGroup.rotation.set(
            swingRotX,
            swingRotY,
            swingRotZ
        );

        const itemId = this.getActiveItemId();
        if (this.toolMesh) {
            if (!itemId) {
                this.toolMesh.visible = false;
            } else {
                this.toolMesh.visible = true;
                if (itemId.includes('diamond')) this.toolMesh.material.color.setHex(0x4cc9f0);
                else if (itemId.includes('iron')) this.toolMesh.material.color.setHex(0xd1d5db);
                else if (itemId.includes('stone')) this.toolMesh.material.color.setHex(0x78716c);
                else if (itemId.includes('wood') || itemId.includes('plank')) this.toolMesh.material.color.setHex(0x92400e);
                else this.toolMesh.material.color.setHex(0x22c55e);
            }
        }
    }

    onMouseUp(event) {
        if (event.button === 0) {
            this.leftDown = false;
            this.miningKey = null;
            this.miningProgress = 0;
            ui.setMiningProgress(0);
        }
    }

    raycastBlocksAndMobs() {
        this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
        this.raycaster.far = REACH;
        const blockMeshes = this.world.getInteractableMeshes();
        const mobMeshes = this.mobManager ? this.mobManager.getMeshes() : [];
        const all = [...blockMeshes, ...mobMeshes];
        const intersects = this.raycaster.intersectObjects(all, true);
        return intersects.length > 0 ? intersects[0] : null;
    }

    handleRightClick() {
        // Handle bow shooting
        const activeItem = this.getActiveItem();
        if (activeItem && activeItem.id === 'bow') {
            if (this.inventory.countItem('arrow') > 0) {
                this.inventory.removeItem('arrow', 1);
                const dir = new THREE.Vector3();
                this.camera.getWorldDirection(dir);
                const pos = this.camera.position.clone();
                this.entityManager.spawnArrow(pos, dir, 30, 'player');
                audio.playAttack();
                ui.refreshAll();
            }
            return;
        }

        const hit = this.raycastBlocksAndMobs();
        if (!hit || hit.distance > REACH) return;
        const mob = this.mobManager ? this.mobManager.findMobByMesh(hit.object) : null;
        if (mob) {
            const activeItem = this.getActiveItem();
            if (activeItem && activeItem.id === 'wheat' && (mob.type === 'pig' || mob.type === 'cow' || mob.type === 'sheep' || mob.type === 'chicken')) {
                if (mob.feedWheat && mob.feedWheat()) {
                    this.inventory.removeItem('wheat', 1);
                    ui.refreshAll();
                }
            }
            return;
        }

        const chunk = hit.object.userData.chunk;
        if (!chunk) return;
        
        const p = hit.point.clone().sub(hit.face.normal.clone().multiplyScalar(0.01));
        const worldX = Math.floor(p.x);
        const worldY = Math.floor(p.y);
        const worldZ = Math.floor(p.z);
        const type = this.world.getBlock(worldX, worldY, worldZ);
        if (!type) return;

        if (type === 'crafting_table') {
            ui.openCraftingTable();
            this.controls.unlock();
            return;
        }
        if (type === 'furnace') {
            ui.openFurnace(worldX, worldY, worldZ);
            this.controls.unlock();
            return;
        }
        if (type === 'chest') {
            ui.openChest(worldX, worldY, worldZ);
            this.controls.unlock();
            return;
        }
        if (type === 'bed') {
            if (this.onSleep) this.onSleep();
            return;
        }
        if (type === 'enchanting_table') {
            ui.openEnchantingTable();
            this.controls.unlock();
            return;
        }

        // Otherwise: interact or place a block
        const item = this.getActiveItem();

        // Hoe mechanics
        if (item && getToolType(item.id) === 'hoe') {
            if (type === 'grass' || type === 'dirt') {
                this.world.setBlock(worldX, worldY, worldZ, 'farmland');
                audio.playPlace('dirt');
                if (type === 'grass' && Math.random() < 0.25) { // 25% chance to drop seeds
                    if (this.entityManager) {
                        this.entityManager.spawnItem('seeds', 1, worldX + 0.5, worldY + 1.2, worldZ + 0.5);
                    }
                }
                return;
            }
        }

        const nx = Math.round(hit.face.normal.x);
        const ny = Math.round(hit.face.normal.y);
        const nz = Math.round(hit.face.normal.z);
        const newX = worldX + nx, newY = worldY + ny, newZ = worldZ + nz;

        // Planting seeds
        if (item && item.id === 'seeds') {
            if (type === 'farmland' && hit.face.normal.y === 1 && !this.world.getBlock(newX, newY, newZ)) {
                if (this.world.placeBlock(newX, newY, newZ, 'crop_0')) {
                    this.inventory.removeItem('seeds', 1);
                    ui.refreshAll();
                    audio.playPlace('grass'); // crop sound
                }
            }
            return;
        }

        if (!item || !ITEMS[item.id] || ITEMS[item.id].category !== 'block') return;

        if (this.world.getBlock(newX, newY, newZ)) return;
        if (this._wouldIntersectPlayer(newX, newY, newZ)) return;

        if (this.world.placeBlock(newX, newY, newZ, item.id)) {
            this.inventory.removeItem(item.id, 1);
            ui.refreshAll();
            audio.playPlace(item.id);
        }
    }

    _wouldIntersectPlayer(bx, by, bz) {
        const p = this.camera.position;
        const halfW = this.width / 2 + 0.05;
        const minX = p.x - halfW, maxX = p.x + halfW;
        const minZ = p.z - halfW, maxZ = p.z + halfW;
        const minY = p.y - this.height, maxY = p.y + 0.2;
        return (bx + 1 > minX && bx < maxX && bz + 1 > minZ && bz < maxZ && by + 1 > minY && by < maxY);
    }

    updateMining(dt) {
        if (!this.leftDown || !this.controls.isLocked || ui.anyScreenOpen()) {
            this.targetOutline.visible = false;
            return;
        }
        const hit = this.raycastBlocksAndMobs();
        if (!hit || hit.distance > REACH) {
            this.miningKey = null; this.miningProgress = 0; ui.setMiningProgress(0);
            this.targetOutline.visible = false;
            return;
        }

        const mob = this.mobManager ? this.mobManager.findMobByMesh(hit.object) : null;
        if (mob) {
            this.targetOutline.visible = false;
            this.attackCooldown -= dt;
            if (this.attackCooldown <= 0) {
                let dmg = TOOL_DAMAGE[this.getActiveItemId()] || TOOL_DAMAGE.none;
                const activeItem = this.getActiveItem();
                if (activeItem && activeItem.enchantments && activeItem.enchantments.sharpness) {
                    dmg += activeItem.enchantments.sharpness * 2;
                }
                const died = mob.takeDamage(dmg);
                audio.playAttack();
                audio.playMobHurt(mob.type);
                if (this.particleManager) {
                    this.particleManager.spawnMobHit(mob.position.x, mob.position.y + 0.5, mob.position.z);
                    this.particleManager.spawnDamageText(mob.position.x, mob.position.y + 0.8, mob.position.z, `-${dmg}`);
                }
                this.attackCooldown = 0.45;
                if (died) this._grantMobDrops(mob);
            }
            return;
        }

        const chunk = hit.object.userData.chunk;
        if (!chunk) { this.targetOutline.visible = false; return; }

        const p = hit.point.clone().sub(hit.face.normal.clone().multiplyScalar(0.01));
        const worldX = Math.floor(p.x);
        const worldY = Math.floor(p.y);
        const worldZ = Math.floor(p.z);
        const type = this.world.getBlock(worldX, worldY, worldZ);
        if (!type || type === 'water' || UNBREAKABLE.has(type)) { this.targetOutline.visible = false; return; }
        
        const key = `${worldX},${worldY},${worldZ}`;

        this.targetOutline.visible = true;
        this.targetOutline.position.set(worldX + 0.5, worldY + 0.5, worldZ + 0.5);

        if (this.miningKey !== key) {
            this.miningKey = key;
            this.miningProgress = 0;
        }

        const toolId = this.getActiveItemId();
        const activeItem = this.getActiveItem();
        const category = BLOCK_TOOL_CATEGORY[type];
        const toolCategory = getToolType(toolId);
        const tier = getToolTier(toolId);
        let speedMult = 1;
        if (category && toolCategory === category) {
            speedMult = 1 + tier * 2.2; // wood ~3.2x, stone ~5.4x, iron ~7.6x
        }
        if (activeItem && activeItem.enchantments && activeItem.enchantments.efficiency) {
            speedMult += activeItem.enchantments.efficiency * 2.0;
        }
        const required = (HARDNESS[type] || 1) / speedMult;

        this.miningProgress += dt;
        ui.setMiningProgress(Math.min(1, this.miningProgress / required));

        if (this.miningProgress >= required) {
            const result = this.world.breakBlock(worldX, worldY, worldZ, toolId);
            this.miningKey = null;
            this.miningProgress = 0;
            ui.setMiningProgress(0);
            if (result) {
                audio.playBreak(result.type);
                if (this.particleManager) this.particleManager.spawnBlockBreak(worldX, worldY, worldZ, result.type);
                let drop = result.drop;
                if (drop === undefined) { // leaves: random chance of stick/apple
                    const roll = Math.random();
                    drop = roll < 0.05 ? 'apple' : roll < 0.15 ? 'stick' : null;
                }
                if (drop) {
                    this.entityManager.spawnItem(drop, 1, worldX + 0.5, worldY + 0.5, worldZ + 0.5);
                }

                if (result.type === 'coal_ore' || result.type === 'iron_ore' || result.type === 'diamond_ore') {
                    if (this.entityManager) {
                        const xpAmount = result.type === 'coal_ore' ? 2 : result.type === 'iron_ore' ? 4 : 7;
                        this.entityManager.spawnXpOrb(worldX + 0.5, worldY + 0.5, worldZ + 0.5, xpAmount);
                    }
                }

                const entity = result.entity;
                if (entity && this.entityManager) {
                    if (entity.type === 'chest' && entity.items) {
                        for (const item of entity.items) {
                            if (item && item.count > 0) {
                                this.entityManager.spawnItem(item.id, item.count, worldX + 0.5, worldY + 0.5, worldZ + 0.5);
                            }
                        }
                    } else if (entity.type === 'furnace') {
                        if (entity.input && entity.input.count > 0) this.entityManager.spawnItem(entity.input.id, entity.input.count, worldX + 0.5, worldY + 0.5, worldZ + 0.5);
                        if (entity.fuel && entity.fuel.count > 0) this.entityManager.spawnItem(entity.fuel.id, entity.fuel.count, worldX + 0.5, worldY + 0.5, worldZ + 0.5);
                        if (entity.output && entity.output.count > 0) this.entityManager.spawnItem(entity.output.id, entity.output.count, worldX + 0.5, worldY + 0.5, worldZ + 0.5);
                    }
                }
            }
        }
    }

    _grantMobDrops(mob) {
        for (const d of mob.def.drops) {
            if (d.count > 0 && Math.random() <= d.chance) {
                this.entityManager.spawnItem(d.id, d.count, mob.position.x, mob.position.y + 0.5, mob.position.z);
            }
        }
        if (this.entityManager) {
            const xpAmount = Math.floor(Math.random() * 5) + 3;
            this.entityManager.spawnXpOrb(mob.position.x, mob.position.y + 0.5, mob.position.z, xpAmount);
        }
    }

    tryEat() {
        const item = this.getActiveItem();
        if (!item || !FOOD[item.id]) return;
        if (this.hunger >= MAX_HUNGER) return;
        this.hunger = Math.min(MAX_HUNGER, this.hunger + FOOD[item.id].hunger);
        this.inventory.removeItem(item.id, 1);
        audio.playEat();
        ui.refreshAll();
    }

    damage(amount, source) {
        if (this.invulnTimer > 0 || !this.alive) return;
        
        let armorPoints = 0;
        const armor = this.inventory.armor;
        if (armor && armor[0]) armorPoints += 2; // helmet
        if (armor && armor[1]) armorPoints += 6; // chest
        if (armor && armor[2]) armorPoints += 5; // legs
        if (armor && armor[3]) armorPoints += 2; // boots
        
        const reduction = Math.min(0.8, armorPoints * 0.04);
        const actualAmount = Math.max(0, amount * (1 - reduction));
        
        this.health -= actualAmount;
        this.invulnTimer = 0.5;
        this.hurtFlashTimer = 0.3;
        audio.playHurt();
        if (this.health <= 0) {
            this.health = 0;
            this.die();
        }
    }

    die() {
        this.alive = false;
        audio.playDeath();
        
        if (this.waypointManager) {
            this.waypointManager.addWaypoint('Death Location', this.camera.position.x, this.camera.position.y - this.height, this.camera.position.z, '#ef4444', 'death');
        }

        if (this.entityManager) {
            for (let i = 0; i < this.inventory.slots.length; i++) {
                const item = this.inventory.slots[i];
                if (item && item.count > 0) {
                    this.entityManager.spawnItem(item.id, item.count, this.camera.position.x, this.camera.position.y, this.camera.position.z);
                }
            }
            for (let i = 0; i < this.inventory.armor.length; i++) {
                const item = this.inventory.armor[i];
                if (item && item.count > 0) {
                    this.entityManager.spawnItem(item.id, item.count, this.camera.position.x, this.camera.position.y, this.camera.position.z);
                }
            }
            this.inventory.slots = new Array(this.inventory.slots.length).fill(null);
            this.inventory.armor = new Array(4).fill(null);
            ui.refreshAll();
        }

        ui.showDeathScreen();
        this.controls.unlock();
    }

    respawn() {
        this.health = MAX_HEALTH;
        this.hunger = MAX_HUNGER;
        this.breath = MAX_BREATH;
        this.alive = true;
        this.velocity.set(0, 0, 0);
        this.fallStartY = null;
        this.invulnTimer = 3.0; // 3 seconds spawn protection
        this.hungerAccum = 0;
        this.starveAccum = 0;
        this.drownAccum = 0;

        // Force-load spawn chunk at (8, 8) so ground exists
        if (this.world) {
            this.world.update(8, 8);
            let spawnY = 35;
            for (let y = 60; y > 1; y--) {
                if (this.world.getBlock(8, y, 8) && this.world.getBlock(8, y, 8) !== 'water') {
                    spawnY = y + 1 + this.height;
                    break;
                }
            }
            this.camera.position.set(8, spawnY, 8);
        } else {
            this.camera.position.set(8, 40, 8);
        }

        ui.hideDeathScreen();
        ui.updateVitals(this.health, this.hunger, this.breath, false);
    }

    isSolid(x, y, z) {
        return this.world.isSolid(x, y, z);
    }

    checkCollisions(dt) {
        const position = this.camera.position;
        const halfWidth = this.width / 2;
        const corners = [[halfWidth, halfWidth], [-halfWidth, halfWidth], [halfWidth, -halfWidth], [-halfWidth, -halfWidth]];

        const newY = position.y + this.velocity.y * dt;
        const feetY = newY - this.height;
        const headY = newY;
        let yCollision = false;

        if (this.velocity.y < 0) {
            for (const [cx, cz] of corners) {
                if (this.isSolid(position.x + cx, feetY, position.z + cz)) {
                    yCollision = true;
                    position.y = Math.floor(feetY) + 1 + this.height;
                    this.velocity.y = 0;
                    if (!this.onGround) this._handleLanding();
                    this.onGround = true;
                    break;
                }
            }
        } else if (this.velocity.y > 0) {
            for (const [cx, cz] of corners) {
                if (this.isSolid(position.x + cx, headY + 0.1, position.z + cz)) {
                    yCollision = true;
                    position.y = Math.floor(headY + 0.1) - 0.1;
                    this.velocity.y = 0;
                    break;
                }
            }
        }
        if (!yCollision) {
            position.y = newY;
            if (this.onGround) {
                this.onGround = false;
                if (this.fallStartY === null) this.fallStartY = position.y;
            }
        }

        const newX = position.x + this.velocity.x * dt;
        let xCollision = false;
        const checkHeights = [position.y - this.height + 0.1, position.y - this.height / 2, position.y - 0.1];

        for (const h of checkHeights) {
            const px = this.velocity.x > 0 ? newX + halfWidth : newX - halfWidth;
            if (this.isSolid(px, h, position.z - halfWidth + 0.05) || this.isSolid(px, h, position.z + halfWidth - 0.05)) {
                xCollision = true; this.velocity.x = 0; break;
            }
        }
        if (!xCollision) position.x = newX;

        const newZ = position.z + this.velocity.z * dt;
        let zCollision = false;

        for (const h of checkHeights) {
            const pz = this.velocity.z > 0 ? newZ + halfWidth : newZ - halfWidth;
            if (this.isSolid(position.x - halfWidth + 0.05, h, pz) || this.isSolid(position.x + halfWidth - 0.05, h, pz)) {
                zCollision = true; this.velocity.z = 0; break;
            }
        }
        if (!zCollision) position.z = newZ;
    }

    _handleLanding() {
        if (this.fallStartY !== null && this.invulnTimer <= 0) {
            const fallDist = this.fallStartY - this.camera.position.y;
            if (!this.isSwimming && fallDist > 3.2) {
                this.damage(Math.floor(fallDist - 3));
            }
        }
        this.fallStartY = null;
    }

    updateSurvival(dt) {
        if (!this.alive) return;

        // Sprinting/crouch/hunger exhaustion
        const moving = this.keys.KeyW || this.keys.KeyA || this.keys.KeyS || this.keys.KeyD;
        this.isCrouching = this.keys.ShiftLeft && this.onGround;
        this.isSprinting = this.keys.ControlLeft && moving && !this.isCrouching && this.hunger > 0.5;

        let exhaustion = 0.35 * dt;
        if (this.isSprinting) exhaustion = 2.2 * dt;
        else if (moving) exhaustion = 0.8 * dt;
        this.hungerAccum += exhaustion;
        if (this.hungerAccum >= 8) {
            this.hungerAccum = 0;
            if (this.hunger > 0) this.hunger--;
        }

        // Starvation / natural regen
        if (this.hunger <= 0) {
            this.starveAccum += dt;
            if (this.starveAccum >= 4) {
                this.starveAccum = 0;
                if (this.health > 1) this.damage(1);
            }
        } else if (this.hunger >= 18 && this.health < MAX_HEALTH) {
            this.regenAccum += dt;
            if (this.regenAccum >= 3) {
                this.regenAccum = 0;
                this.health = Math.min(MAX_HEALTH, this.health + 1);
                this.hungerAccum += 6; // regen costs extra food
            }
        }

        // Breathing / drowning
        const eyeBlock = this.world.getBlock(
            Math.floor(this.camera.position.x),
            Math.floor(this.camera.position.y),
            Math.floor(this.camera.position.z)
        );
        const underwater = eyeBlock === 'water';
        if (underwater) {
            this.breath = Math.max(0, this.breath - dt);
            if (this.breath <= 0) {
                this.drownAccum += dt;
                if (this.drownAccum >= 2) {
                    this.drownAccum = 0;
                    this.damage(2);
                }
            }
        } else {
            this.breath = Math.min(MAX_BREATH, this.breath + dt * 4);
            this.drownAccum = 0;
        }
        if (underwater && !this.wasUnderwater) audio.playSplash();
        this.wasUnderwater = underwater;

        if (this.invulnTimer > 0) this.invulnTimer -= dt;
        if (this.hurtFlashTimer > 0) this.hurtFlashTimer -= dt;

        ui.updateVitals(this.health, this.hunger, this.breath, underwater);
    }

    update(dt) {
        this.updateMining(dt);
        this.updateSurvival(dt);
        this.updateHandAnimation(dt);
        if (this.waypointManager) this.waypointManager.update(dt, this.camera.position);

        if (!this.controls.isLocked || !this.alive) return;

        const feetBlock = this.world.getBlock(
            Math.floor(this.camera.position.x),
            Math.floor(this.camera.position.y - this.height + 0.4),
            Math.floor(this.camera.position.z)
        );
        const wasSwimming = this.isSwimming;
        this.isSwimming = feetBlock === 'water' || this.wasUnderwater;

        if (!wasSwimming && this.isSwimming) {
            audio.playSplash();
            if (this.particleManager) {
                this.particleManager.spawnSplash(this.camera.position.x, this.camera.position.y - 1, this.camera.position.z);
            }
        }

        const friction = this.isSwimming ? 4.0 : 10.0;
        this.velocity.x -= this.velocity.x * friction * dt;
        this.velocity.z -= this.velocity.z * friction * dt;

        if (this.isSwimming) {
            // Buoyancy & water drag
            this.velocity.y += 1.5 * dt; // gentle float
            if (this.keys.Space) this.velocity.y = Math.min(this.velocity.y + 18 * dt, 4.0);
            if (this.keys.ShiftLeft) this.velocity.y = Math.max(this.velocity.y - 18 * dt, -4.0);
            this.velocity.y *= (1 - 3.5 * dt);
            this.fallStartY = null;

            // 3D Pitch Swimming when pressing W
            if (this.keys.KeyW) {
                const dir3D = new THREE.Vector3();
                this.camera.getWorldDirection(dir3D);
                this.velocity.y += dir3D.y * 6.0 * dt;
            }
        } else {
            this.velocity.y -= this.gravity * dt;
        }

        const forward = new THREE.Vector3();
        this.camera.getWorldDirection(forward);
        forward.y = 0;
        if (forward.lengthSq() > 0.0001) forward.normalize();
        else forward.set(0, 0, -1);

        const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

        const moveVec = new THREE.Vector3();
        if (this.keys.KeyW) moveVec.add(forward);
        if (this.keys.KeyS) moveVec.sub(forward);
        if (this.keys.KeyD) moveVec.add(right);
        if (this.keys.KeyA) moveVec.sub(right);
        if (moveVec.lengthSq() > 0.0001) moveVec.normalize();

        let speed = this.baseSpeed;
        if (this.isSprinting) speed *= 1.55;
        if (this.isCrouching) speed *= 0.3;
        if (this.isSwimming) speed *= 0.55;
        if (this.isFlying) speed *= 2.0;

        if (this.isFlying) {
            // Creative Flight Physics
            this.velocity.x += moveVec.x * speed * friction * dt;
            this.velocity.z += moveVec.z * speed * friction * dt;
            if (this.keys.Space) this.velocity.y = Math.min(this.velocity.y + 28 * dt, 14.0);
            else if (this.keys.ShiftLeft) this.velocity.y = Math.max(this.velocity.y - 28 * dt, -14.0);
            else this.velocity.y *= (1 - 8.0 * dt);
            this.velocity.x *= (1 - 8.0 * dt);
            this.velocity.z *= (1 - 8.0 * dt);
            this.fallStartY = null;
            this.onGround = false;
            this.camera.position.x += this.velocity.x * dt;
            this.camera.position.y += this.velocity.y * dt;
            this.camera.position.z += this.velocity.z * dt;
        } else {
            if (this.keys.KeyW || this.keys.KeyA || this.keys.KeyS || this.keys.KeyD) {
                this.velocity.x += moveVec.x * speed * friction * dt;
                this.velocity.z += moveVec.z * speed * friction * dt;
            }
            if (this.keys.Space && this.onGround && !this.isSwimming) {
                this.velocity.y = this.jumpSpeed;
                this.onGround = false;
                this.fallStartY = this.camera.position.y;
            }
            this.checkCollisions(dt);
        }

        if (this.camera.position.y < -10 && this.alive) {
            this.damage(100);
        }

        // Third-person camera & self mesh
        if (this.thirdPerson && this.selfGroup) {
            this._updateThirdPersonCamera();
        }
    }

    teleportToCastle() {
        // Castle/Hub spawn point
        this.camera.position.set(8, 38, 8);
        this.velocity.set(0, 0, 0);
        this.onGround = true;
        this.fallStartY = null;
    }

    teleportToWorld() {
        // Portal exit — random open world spawn
        this.camera.position.set(64, 38, 64);
        this.velocity.set(0, 0, 0);
        this.onGround = true;
        this.fallStartY = null;
    }
}
